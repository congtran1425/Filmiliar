import crypto from 'crypto';

export interface ZaloPayOrderParams {
  amount: number;
  description: string;
  appUser?: string;
  redirectUrl?: string;
  items?: any[];
  extraData?: Record<string, any>;
}

export interface ZaloPayCreateResponse {
  return_code: number;
  return_message: string;
  sub_return_code?: number;
  sub_return_message?: string;
  order_url?: string;
  zp_trans_token?: string;
  order_token?: string;
  app_trans_id: string;
}

export interface ZaloPayQueryResponse {
  return_code: number; // 1: Success, 2: Fail, 3: Processing/Pending
  return_message: string;
  sub_return_code?: number;
  sub_return_message?: string;
  is_processing?: boolean;
  amount?: number;
  zp_trans_id?: number | string;
  server_time?: number;
  discount_amount?: number;
}

export class ZaloPayService {
  private appId: string;
  private key1: string;
  private key2: string;
  private endpoint: string;
  private queryEndpoint: string;
  private callbackUrl: string;

  constructor() {
    this.appId = process.env.ZALOPAY_APP_ID || '';
    this.key1 = process.env.ZALOPAY_KEY1 || '';
    this.key2 = process.env.ZALOPAY_KEY2 || '';
    this.endpoint = process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create';
    this.queryEndpoint = process.env.ZALOPAY_QUERY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/query';
    this.callbackUrl = process.env.ZALOPAY_CALLBACK_URL || '';
  }

  /**
   * Tạo đơn thanh toán ZaloPay Sandbox v2
   */
  async createPayment(params: ZaloPayOrderParams): Promise<ZaloPayCreateResponse> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const transSuffix = Math.floor(100000 + Math.random() * 900000);
    const appTransId = `${yy}${mm}${dd}_${transSuffix}`;

    const appTime = Date.now();
    const appUser = params.appUser || 'filmiliar_guest';
    const embedData = JSON.stringify({
      redirecturl: params.redirectUrl || 'http://localhost:5173',
      ...params.extraData
    });
    const items = JSON.stringify(params.items || []);

    // Format: appid|app_trans_id|appuser|amount|apptime|embeddata|item
    const rawData = `${this.appId}|${appTransId}|${appUser}|${params.amount}|${appTime}|${embedData}|${items}`;
    const mac = crypto.createHmac('sha256', this.key1).update(rawData).digest('hex');

    const payload = {
      app_id: this.appId,
      app_user: appUser,
      app_time: appTime,
      amount: params.amount,
      app_trans_id: appTransId,
      embed_data: embedData,
      item: items,
      description: params.description,
      bank_code: '',
      callback_url: this.callbackUrl,
      mac
    };

    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      formData.append(key, String(value));
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = (await response.json()) as Record<string, any>;
      return {
        ...data,
        app_trans_id: appTransId
      } as ZaloPayCreateResponse;
    } catch (error: any) {
      throw new Error(`Lỗi kết nối ZaloPay Gateway: ${error.message}`);
    }
  }

  /**
   * Kiểm tra chữ ký Callback từ ZaloPay Server
   */
  verifyCallback(dataStr: string, reqMac: string): boolean {
    const mac = crypto.createHmac('sha256', this.key2).update(dataStr).digest('hex');
    return reqMac === mac;
  }

  /**
   * Chủ động truy vấn trạng thái đơn hàng (Polling query)
   */
  async checkOrderStatus(appTransId: string): Promise<ZaloPayQueryResponse> {
    // Format: appid|app_trans_id|key1
    const rawData = `${this.appId}|${appTransId}|${this.key1}`;
    const mac = crypto.createHmac('sha256', this.key1).update(rawData).digest('hex');

    const formData = new URLSearchParams();
    formData.append('app_id', this.appId);
    formData.append('app_trans_id', appTransId);
    formData.append('mac', mac);

    try {
      const response = await fetch(this.queryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      return (await response.json()) as ZaloPayQueryResponse;
    } catch (error: any) {
      throw new Error(`Lỗi truy vấn trạng thái ZaloPay: ${error.message}`);
    }

  }
}

export const zaloPayService = new ZaloPayService();
