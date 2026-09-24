import crypto from 'crypto';

/**
 * 🔒 Findly Secure Vault & Cryptography Module
 * Provides AES-256-GCM encryption at rest and secure in-memory credential resolution.
 */

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SALT = 'findly-secure-salt-2026';

/**
 * Derives a 32-byte encryption key from a passphrase using PBKDF2
 */
function deriveKey(passphrase: string): Buffer {
  return crypto.pbkdf2Sync(passphrase, DEFAULT_SALT, 100000, 32, 'sha256');
}

/**
 * Encrypts a plaintext secret into an AES-256-GCM ciphertext string.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plainText: string, passphrase?: string): string {
  const secretKey = deriveKey(passphrase || process.env.FINDLY_ENCRYPTION_SECRET || 'findly-default-vault-key');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext string back to plaintext in memory.
 */
export function decryptSecret(value: string, passphrase?: string): string {
  if (!value || !value.startsWith('enc:v1:')) {
    // Already plaintext
    return value;
  }

  try {
    const parts = value.split(':');
    if (parts.length !== 5) {
      throw new Error('Malformed encrypted secret format');
    }

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encryptedText = parts[4];

    const secretKey = deriveKey(passphrase || process.env.FINDLY_ENCRYPTION_SECRET || 'findly-default-vault-key');
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    console.error('🔒 [Security] Decryption error: Invalid key or corrupted secret.');
    throw new Error('Failed to decrypt secret: ' + err.message);
  }
}

/**
 * Resolves the active Commerce API configuration.
 * Strictly server-side only: never return this object to the client/browser!
 */
export function getCommerceConfig() {
  const rawUrl = process.env.COMMERCE_API_URL || '';
  const rawKey = process.env.COMMERCE_API_KEY || '';
  const headerName = process.env.COMMERCE_API_KEY_HEADER || 'X-API-Key';

  const apiUrl = rawUrl ? decryptSecret(rawUrl.trim()) : '';
  const apiKey = rawKey ? decryptSecret(rawKey.trim()) : '';

  return {
    isConfigured: Boolean(apiUrl),
    apiUrl,
    apiKey,
    headerName,
  };
}

/**
 * Resolves the SerpAPI key securely for server-side Google Lens & Google Shopping queries.
 */
export function getSerpApiKey(): string {
  const rawKey = process.env.SERPAPI_API_KEY || process.env.COMMERCE_API_KEY || '';
  if (!rawKey) return '';
  return decryptSecret(rawKey.trim());
}
