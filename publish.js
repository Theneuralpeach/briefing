// Encrypts payload.json -> data/today.json (AES-256-GCM, PBKDF2-SHA256/150000).
// Browser (Web Crypto) decrypts with the same passphrase. Run: PASS='...' node publish.js
const c = require('crypto'), fs = require('fs');
const pass = process.env.PASS;
if (!pass) { console.error('ERROR: PASS env var required'); process.exit(1); }
const payload = fs.readFileSync('payload.json', 'utf8');
JSON.parse(payload); // validate it's JSON
const salt = c.randomBytes(16), iv = c.randomBytes(12);
const key = c.pbkdf2Sync(pass, salt, 150000, 32, 'sha256');
const ci = c.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([ci.update(payload, 'utf8'), ci.final()]);
const tag = ci.getAuthTag();
fs.writeFileSync('data/today.json', JSON.stringify({
  enc: true,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: Buffer.concat([ct, tag]).toString('base64')
}));
console.log('OK: data/today.json encrypted & written (' + payload.length + ' bytes plaintext)');
