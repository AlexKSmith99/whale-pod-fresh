// Generate Apple Client Secret for Supabase
// Usage: node scripts/generate-apple-secret.js <path-to-.p8-file> <key-id> <team-id>

const jwt = require('jsonwebtoken');
const fs = require('fs');

const p8Path = process.argv[2];
const keyId = process.argv[3];
const teamId = process.argv[4];
const clientId = 'com.whalepod.fresh';

if (!p8Path || !keyId || !teamId) {
  console.error('Usage: node generate-apple-secret.js <p8-file-path> <key-id> <team-id>');
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path, 'utf8');

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  audience: 'https://appleid.apple.com',
  issuer: teamId,
  subject: clientId,
  header: {
    alg: 'ES256',
    kid: keyId,
  },
});

console.log('\n=== Apple Client Secret (paste into Supabase) ===\n');
console.log(token);
console.log('\n=== Expires in ~6 months. Re-run this script to regenerate. ===\n');
