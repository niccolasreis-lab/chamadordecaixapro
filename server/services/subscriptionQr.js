const qrcode = require('qrcode-generator');

function managementUrl(env = process.env) {
  if (env.SUBSCRIPTION_ENABLED !== 'true' || !env.SUBSCRIPTION_CUSTOMER_ID) return null;
  try {
    const url = new URL(env.SUBSCRIPTION_URL);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.search = ''; url.hash = ''; url.pathname = '/';
    url.searchParams.set('customer', env.SUBSCRIPTION_CUSTOMER_ID);
    return url.href;
  } catch (_) { return null; }
}

function managementQrSvg(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url); qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
}

module.exports = { managementUrl, managementQrSvg };
