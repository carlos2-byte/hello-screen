/**
 * Security utilities for app password/PIN protection
 */

import { defaultAdapter } from './storageAdapter';

const PASSWORD_KEY = 'app_password';
const RECOVERY_KEY = 'app_recovery';
const LOCKED_KEY = 'app_locked';

export interface SecurityConfig {
  passwordHash: string;
  recoveryQuestion?: string;
  recoveryAnswerHash?: string;
  recoveryCode?: string; // Hashed recovery code
}

/**
 * Simple hash function for password storage
 * Note: In a real production app, use a proper library like bcrypt
 * For offline-only app, this provides reasonable security
 */
async function simpleHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random recovery code
 */
export function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar chars (0,O,1,I)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Check if password is enabled
 */
export async function isPasswordEnabled(): Promise<boolean> {
  const config = await defaultAdapter.getItem<SecurityConfig>(PASSWORD_KEY, null as unknown as SecurityConfig);
  return !!config?.passwordHash;
}

/**
 * Get security config
 */
export async function getSecurityConfig(): Promise<SecurityConfig | null> {
  return await defaultAdapter.getItem<SecurityConfig>(PASSWORD_KEY, null as unknown as SecurityConfig);
}

/**
 * Create password with recovery option
 */
export async function createPassword(
  password: string,
  recoveryOption: {
    type: 'code' | 'question';
    question?: string;
    answer?: string;
  }
): Promise<{ success: boolean; recoveryCode?: string }> {
  const passwordHash = await simpleHash(password);
  
  const config: SecurityConfig = {
    passwordHash,
  };
  
  let recoveryCode: string | undefined;
  
  if (recoveryOption.type === 'code') {
    recoveryCode = generateRecoveryCode();
    config.recoveryCode = await simpleHash(recoveryCode);
  } else if (recoveryOption.type === 'question' && recoveryOption.question && recoveryOption.answer) {
    config.recoveryQuestion = recoveryOption.question;
    config.recoveryAnswerHash = await simpleHash(recoveryOption.answer.toLowerCase().trim());
  }
  
  await defaultAdapter.setItem(PASSWORD_KEY, config);
  await defaultAdapter.setItem(LOCKED_KEY, true);
  
  return { success: true, recoveryCode };
}

/**
 * Verify password
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const config = await getSecurityConfig();
  if (!config) return true; // No password set
  
  const hash = await simpleHash(password);
  return hash === config.passwordHash;
}

/**
 * Verify recovery code
 */
export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const config = await getSecurityConfig();
  if (!config?.recoveryCode) return false;
  
  const hash = await simpleHash(code.toUpperCase().replace(/\s/g, ''));
  return hash === config.recoveryCode;
}

/**
 * Verify recovery answer
 */
export async function verifyRecoveryAnswer(answer: string): Promise<boolean> {
  const config = await getSecurityConfig();
  if (!config?.recoveryAnswerHash) return false;
  
  const hash = await simpleHash(answer.toLowerCase().trim());
  return hash === config.recoveryAnswerHash;
}

/**
 * Change password
 */
export async function changePassword(newPassword: string): Promise<boolean> {
  const config = await getSecurityConfig();
  if (!config) return false;
  
  config.passwordHash = await simpleHash(newPassword);
  await defaultAdapter.setItem(PASSWORD_KEY, config);
  return true;
}

/**
 * Remove password (disable security)
 */
export async function removePassword(): Promise<void> {
  await defaultAdapter.removeItem(PASSWORD_KEY);
  await defaultAdapter.removeItem(LOCKED_KEY);
}

/**
 * Full reset - removes password and all security data
 */
export async function fullSecurityReset(): Promise<void> {
  await defaultAdapter.removeItem(PASSWORD_KEY);
  await defaultAdapter.removeItem(LOCKED_KEY);
}

/**
 * Check if app is locked
 */
export async function isAppLocked(): Promise<boolean> {
  const hasPassword = await isPasswordEnabled();
  if (!hasPassword) return false;
  
  const locked = await defaultAdapter.getItem<boolean>(LOCKED_KEY, true);
  return locked;
}

/**
 * Lock the app
 */
export async function lockApp(): Promise<void> {
  await defaultAdapter.setItem(LOCKED_KEY, true);
}

/**
 * Unlock the app
 */
export async function unlockApp(): Promise<void> {
  await defaultAdapter.setItem(LOCKED_KEY, false);
}
