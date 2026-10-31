import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ResendRecoveryMailer} from '../dist/services/recovery-mail.js';
test('recovery email uses the server key and an idempotency key without exposing recipient or token in errors',async()=>{
  const key='re_isolated_fake_key_for_testing';let request;
  const sender=new ResendRecoveryMailer({key,from:'no-reply@example.test',fetcher:async(url,init)=>{request={url,...init};return new Response('{"id":"mail-test"}');}});
  assert.equal(sender.isConfigured(),true);
  await sender.sendReset({email:'customer@example.test',url:'https://example.test/dat-lai-mat-khau#token=raw',requestId:'request-1'});
  assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.headers.Authorization,'Bearer '+key);
  assert.equal(request.headers['Idempotency-Key'],'password-reset/request-1');
  const body=JSON.parse(request.body);assert.match(body.text,/15 phút/);assert.match(body.text,/#token=raw/);assert.deepEqual(body.to,['customer@example.test']);
  const fail=new ResendRecoveryMailer({key,from:'no-reply@example.test',fetcher:async()=>new Response('{"message":"private provider details"}',{status:403})});
  await assert.rejects(fail.sendReset({email:'customer@example.test',url:'secret-link',requestId:'request-2'}),/^Error: Recovery mail delivery failed$/);
});
