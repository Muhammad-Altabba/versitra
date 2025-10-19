import CryptoJS from 'crypto-js';
import { ENV } from '../_core/env';

/**
 * Encrypt sensitive data using AES encryption
 */
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENV.cookieSecret).toString();
}

/**
 * Decrypt sensitive data
 */
export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENV.cookieSecret);
  return bytes.toString(CryptoJS.enc.Utf8);
}

