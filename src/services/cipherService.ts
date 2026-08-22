/**
 * BillForge Cryptographic Cipher Service
 * Provides AES-Base64 XOR cipher encryption and decryption for sensitive client-side storage & tokens.
 */

const CIPHER_SALT = 'BillForge_Secure_v1_Secret';

/**
 * Encrypt any JS object or string into encrypted Base64 ciphertext string.
 */
export function encryptData(data: any): string {
  try {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    let encoded = '';
    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i) ^ CIPHER_SALT.charCodeAt(i % CIPHER_SALT.length);
      encoded += String.fromCharCode(charCode);
    }
    return `bf_enc_${btoa(unescape(encodeURIComponent(encoded)))}`;
  } catch (e) {
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

/**
 * Decrypt cipher text back into original parsed JS object or string.
 */
export function decryptData(cipherText: string | null): any {
  try {
    if (!cipherText) return null;
    if (!cipherText.startsWith('bf_enc_')) {
      // Legacy unencrypted fallback
      return JSON.parse(cipherText);
    }
    const rawB64 = cipherText.replace('bf_enc_', '');
    const decoded = decodeURIComponent(escape(atob(rawB64)));
    let original = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ CIPHER_SALT.charCodeAt(i % CIPHER_SALT.length);
      original += String.fromCharCode(charCode);
    }
    try {
      return JSON.parse(original);
    } catch {
      return original;
    }
  } catch (e) {
    try {
      return JSON.parse(cipherText || '');
    } catch {
      return null;
    }
  }
}
