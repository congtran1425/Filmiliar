import crypto from 'node:crypto';

export interface ZaloPayCreateParams {
  appTransId: string;
  appUser: string;
  amount: number;
  description: string;
  bookingId: string;
  redirectUrl?: string;
}

export interface ZaloPayCreateResponse {
  return_code: number;
  sub_return_code?: number;
  return_message?: string;
  qr_code?: string;
  order_url?: string;
  app_trans_id: string;
}

export interface ZaloPayQueryResponse {
  return_code: number;
  return_message?: string;
  sub_return_code?: number;
  amount?: number;
  zp_trans_id?: string;
}

export interface ZaloPayCallbackData {
  app_id: number;
  app_trans_id: string;
  amount: number;
  zp_trans_id?: string;
  embed_data?: string;
}

export interface ZaloPayRefundParams {
  mRefundId: string;
  providerTxnId: string;
  amount: number;
  description: string;
  timestamp: number;
}

export interface ZaloPayRefundResponse {
  return_code: number;
  sub_return_code?: number;
  return_message?: string;
  refund_id?: string;
}

export interface ZaloPayGateway {
  createPayment(params: ZaloPayCreateParams): Promise<ZaloPayCreateResponse>;
  checkOrderStatus(appTransId: string): Promise<ZaloPayQueryResponse>;
  verifyCallback(data: string, mac: string): boolean;
  parseCallback(data: string): ZaloPayCallbackData;
  createRefund(params: ZaloPayRefundParams): Promise<ZaloPayRefundResponse>;
  queryRefund(mRefundId: string): Promise<ZaloPayRefundResponse>;
  appId: number;
}

type GatewayOptions = {
  appId?: string;
  key1?: string;
  key2?: string;
  callbackUrl?: string;
  fetcher?: typeof fetch;
};

function exactTransactionId(raw: string, field = 'zp_trans_id'): string | undefined {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(?:"(\\d+)"|(\\d+))(?=\\s*[,}])`));
  return match?.[1] || match?.[2];
}

export class ZaloPayService implements ZaloPayGateway {
  readonly appId: number;
  private readonly key1: string;
  private readonly key2: string;
  private readonly callbackUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: GatewayOptions = {}) {
    this.appId = Number(options.appId ?? process.env.ZALOPAY_APP_ID ?? '');
    this.key1 = options.key1 ?? process.env.ZALOPAY_KEY1 ?? '';
    this.key2 = options.key2 ?? process.env.ZALOPAY_KEY2 ?? '';
    this.callbackUrl = options.callbackUrl ?? process.env.ZALOPAY_CALLBACK_URL ?? '';
    this.fetcher = options.fetcher ?? fetch;
  }

  isConfigured(): boolean {
    return Number.isSafeInteger(this.appId) && this.appId > 0 && this.key1.length >= 16 &&
      this.key2.length >= 16 && /^https:\/\//.test(this.callbackUrl);
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new Error('ZaloPay Sandbox configuration is incomplete');
  }

  async createPayment(params: ZaloPayCreateParams): Promise<ZaloPayCreateResponse> {
    this.assertConfigured();
    const appTime = Date.now();
    const embedData = JSON.stringify({ bookingId: params.bookingId, preferred_payment_method: ['vietqr'], ...(params.redirectUrl ? { redirecturl: params.redirectUrl } : {}) });
    const items = '[]';
    const rawMac = `${this.appId}|${params.appTransId}|${params.appUser}|${params.amount}|${appTime}|${embedData}|${items}`;
    const mac = crypto.createHmac('sha256', this.key1).update(rawMac).digest('hex');
    const body = new URLSearchParams({
      app_id: String(this.appId), app_user: params.appUser, app_time: String(appTime),
      amount: String(params.amount), app_trans_id: params.appTransId,
      embed_data: embedData, item: items, description: params.description,
      bank_code: '', callback_url: this.callbackUrl, expire_duration_seconds: '900', mac
    });
    const response = await this.fetcher('https://sb-openapi.zalopay.vn/v2/create', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('ZaloPay create request failed');
    const result = JSON.parse(await response.text()) as ZaloPayCreateResponse;
    if (typeof result.return_code !== 'number') throw new Error('Invalid ZaloPay create response');
    return { ...result, app_trans_id: params.appTransId };
  }

  async checkOrderStatus(appTransId: string): Promise<ZaloPayQueryResponse> {
    this.assertConfigured();
    const rawMac = `${this.appId}|${appTransId}|${this.key1}`;
    const mac = crypto.createHmac('sha256', this.key1).update(rawMac).digest('hex');
    const body = new URLSearchParams({ app_id: String(this.appId), app_trans_id: appTransId, mac });
    const response = await this.fetcher('https://sb-openapi.zalopay.vn/v2/query', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('ZaloPay query request failed');
    const raw = await response.text();
    const result = JSON.parse(raw) as ZaloPayQueryResponse;
    if (typeof result.return_code !== 'number') throw new Error('Invalid ZaloPay query response');
    return { ...result, zp_trans_id: exactTransactionId(raw) };
  }

  async createRefund(params: ZaloPayRefundParams): Promise<ZaloPayRefundResponse> {
    this.assertConfigured();
    if (!Number.isSafeInteger(params.amount) || params.amount <= 0 || !/^\d+$/.test(params.providerTxnId) ||
        params.mRefundId.length > 45 || params.description.length > 100) throw new Error('Invalid refund parameters');
    const rawMac = `${this.appId}|${params.providerTxnId}|${params.amount}|${params.description}|${params.timestamp}`;
    const mac = crypto.createHmac('sha256', this.key1).update(rawMac).digest('hex');
    const body = new URLSearchParams({ app_id: String(this.appId), m_refund_id: params.mRefundId,
      zp_trans_id: params.providerTxnId, amount: String(params.amount), description: params.description,
      timestamp: String(params.timestamp), mac });
    return this.refundRequest('refund', body);
  }

  async queryRefund(mRefundId: string): Promise<ZaloPayRefundResponse> {
    this.assertConfigured();
    const timestamp = String(Date.now());
    const mac = crypto.createHmac('sha256', this.key1).update(`${this.appId}|${mRefundId}|${timestamp}`).digest('hex');
    return this.refundRequest('query_refund', new URLSearchParams({ app_id: String(this.appId), m_refund_id: mRefundId, timestamp, mac }));
  }

  private async refundRequest(action: 'refund' | 'query_refund', body: URLSearchParams): Promise<ZaloPayRefundResponse> {
    const response = await this.fetcher(`https://sb-openapi.zalopay.vn/v2/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('ZaloPay refund request failed');
    const raw = await response.text();
    const result = JSON.parse(raw) as ZaloPayRefundResponse;
    if (!Number.isInteger(result.return_code)) throw new Error('Invalid ZaloPay refund response');
    return { ...result, refund_id: exactTransactionId(raw, 'refund_id') };
  }

  verifyCallback(data: string, mac: string): boolean {
    if (!this.isConfigured() || !/^[a-f0-9]{64}$/i.test(mac)) return false;
    const actual = crypto.createHmac('sha256', this.key2).update(data).digest();
    return crypto.timingSafeEqual(actual, Buffer.from(mac, 'hex'));
  }

  parseCallback(data: string): ZaloPayCallbackData {
    const value = JSON.parse(data) as Record<string, unknown>;
    if (typeof value.app_id !== 'number' || typeof value.app_trans_id !== 'string' ||
        typeof value.amount !== 'number' || !Number.isSafeInteger(value.amount)) {
      throw new Error('Invalid ZaloPay callback data');
    }
    return {
      app_id: value.app_id,
      app_trans_id: value.app_trans_id,
      amount: value.amount,
      zp_trans_id: exactTransactionId(data),
      embed_data: typeof value.embed_data === 'string' ? value.embed_data : undefined
    };
  }
}
