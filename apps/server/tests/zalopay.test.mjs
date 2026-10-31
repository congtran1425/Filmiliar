import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { ZaloPayService } from '../dist/services/zalopay.service.js';

const key1 = 'local-test-key1-at-least-32-characters';
const key2 = 'local-test-key2-at-least-32-characters';
const appId = '123456';

test('refund and query refund sign exact forms and preserve large refund IDs', async () => {
  const requests = [];
  const gateway = new ZaloPayService({ appId, key1, key2, callbackUrl: 'https://example.test/callback',
    fetcher: async (url, init) => {
      requests.push({ url, form: new URLSearchParams(init.body) });
      return new Response('{"return_code":1,"refund_id":9876543210987654321}');
    }
  });
  const params = { mRefundId: '261031_123456_abcdef', providerTxnId: '98765432109876543', amount: 1000000, description: 'Filmiliar hoan coc', timestamp: 1793408400000 };
  const created = await gateway.createRefund(params);
  const queried = await gateway.queryRefund(params.mRefundId);
  assert.equal(created.refund_id, '9876543210987654321');
  assert.equal(queried.refund_id, '9876543210987654321');
  const [create, query] = requests;
  assert.equal(create.url, 'https://sb-openapi.zalopay.vn/v2/refund');
  assert.equal(create.form.get('zp_trans_id'), params.providerTxnId);
  assert.equal(create.form.get('mac'), crypto.createHmac('sha256', key1).update(`${appId}|${params.providerTxnId}|1000000|${params.description}|${params.timestamp}`).digest('hex'));
  assert.equal(query.url, 'https://sb-openapi.zalopay.vn/v2/query_refund');
  assert.equal(query.form.get('mac'), crypto.createHmac('sha256', key1).update(`${appId}|${params.mRefundId}|${query.form.get('timestamp')}`).digest('hex'));
});

test('refund refuses unsafe amounts, HTTP failures and malformed provider responses', async () => {
  const opts = { appId, key1, key2, callbackUrl: 'https://example.test/callback' };
  let calls = 0;
  const params = { mRefundId: '261031_123456_abcdef', providerTxnId: '98765432109876543', amount: -1, description: 'Refund', timestamp: Date.now() };
  const gateway = new ZaloPayService({ ...opts, fetcher: async () => { calls++; return new Response('', { status: 500 }); } });
  await assert.rejects(gateway.createRefund(params), /Invalid refund parameters/);
  assert.equal(calls, 0);
  await assert.rejects(gateway.createRefund({ ...params, amount: 1000 }), /refund request failed/);
  const invalid = new ZaloPayService({ ...opts, fetcher: async () => new Response('{"return_code":"1"}') });
  await assert.rejects(invalid.queryRefund(params.mRefundId), /Invalid ZaloPay refund response/);
});

test('create signs the exact request and asks for a 15-minute Sandbox VietQR', async () => {
  let request;
  const gateway = new ZaloPayService({ appId, key1, key2, callbackUrl: 'https://example.test/api/payment/callback',
    fetcher: async (url, init) => {
      request = { url, form: new URLSearchParams(init.body) };
      return new Response(JSON.stringify({ return_code: 1, qr_code: 'qr-payload' }), { status: 200 });
    }
  });
  const result = await gateway.createPayment({ appTransId: '261013_test123', appUser: 'user-1', amount: 1250000, bookingId: 'booking-1', description: 'Filmiliar Sandbox' });
  assert.equal(request.url, 'https://sb-openapi.zalopay.vn/v2/create');
  assert.equal(request.form.get('expire_duration_seconds'), '900');
  const embedData = request.form.get('embed_data');
  assert.deepEqual(JSON.parse(embedData), { bookingId: 'booking-1', preferred_payment_method: ['vietqr'] });
  const raw = [appId, '261013_test123', 'user-1', '1250000', request.form.get('app_time'), embedData, '[]'].join('|');
  assert.equal(request.form.get('mac'), crypto.createHmac('sha256', key1).update(raw).digest('hex'));
  assert.equal(result.app_trans_id, '261013_test123');
  assert.equal(result.qr_code, 'qr-payload');
});

test('query keeps a large provider transaction ID exact', async () => {
  let form;
  const gateway = new ZaloPayService({ appId, key1, key2, callbackUrl: 'https://example.test/api/payment/callback',
    fetcher: async (_url, init) => {
      form = new URLSearchParams(init.body);
      return new Response('{"return_code":1,"amount":1250000,"zp_trans_id":98765432109876543}', { status: 200 });
    }
  });
  const result = await gateway.checkOrderStatus('261013_test123');
  assert.equal(form.get('mac'), crypto.createHmac('sha256', key1).update(`${appId}|261013_test123|${key1}`).digest('hex'));
  assert.equal(result.zp_trans_id, '98765432109876543');
});

test('callback MAC uses key2 and rejects tampering', () => {
  const gateway = new ZaloPayService({ appId, key1, key2, callbackUrl: 'https://example.test/api/payment/callback' });
  const data = '{"app_id":123456,"app_trans_id":"261013_test123","amount":1250000,"zp_trans_id":98765432109876543}';
  const mac = crypto.createHmac('sha256', key2).update(data).digest('hex');
  assert.equal(gateway.verifyCallback(data, mac), true);
  assert.equal(gateway.verifyCallback(data.replace('1250000', '1250001'), mac), false);
  assert.equal(gateway.verifyCallback(data, 'bad'), false);
  assert.equal(gateway.parseCallback(data).zp_trans_id, '98765432109876543');
});
