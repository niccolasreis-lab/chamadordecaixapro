const fs = require('fs');
const http = require('http');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const content = '--' + boundary + '\r\n' +
  'Content-Disposition: form-data; name="file"; filename="test.png"\r\n' +
  'Content-Type: image/png\r\n\r\n' +
  'fakeimagecontent\r\n' +
  '--' + boundary + '--\r\n';

const req = http.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/institucional/logo',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': Buffer.byteLength(content)
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', data));
});

req.on('error', e => console.error('REQUEST ERROR:', e));
req.write(content);
req.end();
