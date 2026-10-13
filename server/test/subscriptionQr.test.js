const test=require('node:test');const assert=require('node:assert/strict');
const {managementUrl,managementQrSvg}=require('../services/subscriptionQr');
test('QR abre gestão HTTPS da instalação sem incluir senha ou chave',()=>{
  const url=managementUrl({SUBSCRIPTION_ENABLED:'true',SUBSCRIPTION_URL:'https://central.example/?token=should-not-leak#private',SUBSCRIPTION_CUSTOMER_ID:'current-client',SUBSCRIPTION_TOKEN:'activation-secret'});
  assert.equal(url,'https://central.example/?customer=current-client');
  assert.ok(!url.includes('secret'));assert.ok(!url.includes('token'));
  const svg=managementQrSvg(url);assert.ok(svg.startsWith('<svg'));assert.ok(svg.includes('viewBox='));
});
test('instalação não vinculada ou URL insegura não oferece QR administrativo',()=>{
  assert.equal(managementUrl({SUBSCRIPTION_ENABLED:'false'}),null);
  assert.equal(managementUrl({SUBSCRIPTION_ENABLED:'true',SUBSCRIPTION_URL:'http://central.example',SUBSCRIPTION_CUSTOMER_ID:'client'}),null);
  assert.equal(managementUrl({SUBSCRIPTION_ENABLED:'true',SUBSCRIPTION_URL:'https://admin:pass@central.example',SUBSCRIPTION_CUSTOMER_ID:'client'}),null);
});
