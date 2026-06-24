// Encrypts payload.json -> data/today.json (AES-256-GCM, PBKDF2-SHA256/150000).
// Browser (Web Crypto) decrypts with the same passphrase. Run: PASS='...' node publish.js
// Output is ALWAYS raw JSON {enc,salt,iv,ct} (never base64-wrapped). Self-verifies before exit.
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
const blob = {
  enc: true,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: Buffer.concat([ct, tag]).toString('base64')
};
fs.writeFileSync('data/today.json', JSON.stringify(blob));

// --- self-verify: the file MUST be raw JSON and MUST round-trip decrypt ---
const onDisk = fs.readFileSync('data/today.json', 'utf8');
if (!onDisk.startsWith('{')) {
  console.error('VERIFY FAIL: data/today.json is not raw JSON (must start with "{", not base64).');
  process.exit(1);
}
let back;
try { back = JSON.parse(onDisk); } catch (e) { console.error('VERIFY FAIL: not valid JSON: ' + e.message); process.exit(1); }
if (back.enc !== true || !back.salt || !back.iv || !back.ct) { console.error('VERIFY FAIL: missing enc/salt/iv/ct.'); process.exit(1); }
for (const k of ['salt', 'iv', 'ct']) {
  if (!/^[A-Za-z0-9+/]+=*$/.test(back[k])) { console.error('VERIFY FAIL: ' + k + ' is not clean base64 (corrupted).'); process.exit(1); }
}
try {
  const draw = Buffer.from(back.ct, 'base64');
  const dec = c.createDecipheriv('aes-256-gcm', c.pbkdf2Sync(pass, Buffer.from(back.salt, 'base64'), 150000, 32, 'sha256'), Buffer.from(back.iv, 'base64'));
  dec.setAuthTag(draw.slice(draw.length - 16));
  const rt = Buffer.concat([dec.update(draw.slice(0, draw.length - 16)), dec.final()]).toString('utf8');
  if (rt !== payload) { console.error('VERIFY FAIL: round-trip mismatch.'); process.exit(1); }
} catch (e) { console.error('VERIFY FAIL: round-trip decrypt error: ' + e.message); process.exit(1); }
console.log('OK: data/today.json encrypted, written & verified (round-trip decrypt matches, ' + payload.length + ' bytes plaintext)');
