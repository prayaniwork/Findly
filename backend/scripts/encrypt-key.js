#!/usr/bin/env node

/**
 * 🔒 Findly Encryption Utility CLI
 * Encrypts sensitive API URLs or Keys into AES-256-GCM ciphertext.
 *
 * Usage:
 *   node scripts/encrypt-key.js "<your-secret-url-or-api-key>" "[optional-passphrase]"
 */

const crypto = require('crypto');

const secretToEncrypt = process.argv[2];
const customPassphrase = process.argv[3] || process.env.FINDLY_ENCRYPTION_SECRET || 'findly-default-vault-key';

if (!secretToEncrypt) {
  console.log(`
Usage:
  node scripts/encrypt-key.js "<secret-text>" "[optional-passphrase]"

Example:
  node scripts/encrypt-key.js "https://api.myntra.com/v1/search" "my-secret-passphrase"
`);
  process.exit(1);
}

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SALT = 'findly-secure-salt-2026';

function deriveKey(passphrase) {
  return crypto.pbkdf2Sync(passphrase, DEFAULT_SALT, 100000, 32, 'sha256');
}

function encrypt(text, passphrase) {
  const secretKey = deriveKey(passphrase);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

const encryptedValue = encrypt(secretToEncrypt, customPassphrase);

console.log('\n======================================================');
console.log('🔒 ENCRYPTION SUCCESSFUL (AES-256-GCM)');
console.log('======================================================');
console.log('\nEncrypted Ciphertext:\n');
console.log(encryptedValue);
console.log('\nCopy and paste this into backend/.env.local:');
console.log('------------------------------------------------------');
if (secretToEncrypt.startsWith('http')) {
  console.log(`COMMERCE_API_URL=${encryptedValue}`);
} else {
  console.log(`COMMERCE_API_KEY=${encryptedValue}`);
}
if (customPassphrase !== 'findly-default-vault-key') {
  console.log(`FINDLY_ENCRYPTION_SECRET=${customPassphrase}`);
}
console.log('------------------------------------------------------\n');
