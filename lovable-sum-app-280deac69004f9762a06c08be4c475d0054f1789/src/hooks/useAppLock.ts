import { useState, useEffect } from 'react';
import {
  isPasswordEnabled,
  isAppLocked,
  verifyPassword,
  verifyRecoveryCode,
  verifyRecoveryAnswer,
  unlockApp,
  getSecurityConfig,
  fullSecurityReset,
} from '@/lib/security';

export function useAppLock() {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recoveryQuestion, setRecoveryQuestion] = useState<string | null>(null);
  const [hasRecoveryCode, setHasRecoveryCode] = useState(false);

  useEffect(() => {
    checkLockStatus();
  }, []);

  const checkLockStatus = async () => {
    setLoading(true);
    try {
      const enabled = await isPasswordEnabled();
      setHasPassword(enabled);
      
      if (enabled) {
        const locked = await isAppLocked();
        setIsLocked(locked);
        
        // Get recovery options
        const config = await getSecurityConfig();
        if (config) {
          setRecoveryQuestion(config.recoveryQuestion || null);
          setHasRecoveryCode(!!config.recoveryCode);
        }
      } else {
        setIsLocked(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const unlock = async (password: string): Promise<boolean> => {
    const valid = await verifyPassword(password);
    if (valid) {
      await unlockApp();
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const recoverWithCode = async (code: string): Promise<boolean> => {
    const valid = await verifyRecoveryCode(code);
    if (valid) {
      await unlockApp();
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const recoverWithAnswer = async (answer: string): Promise<boolean> => {
    const valid = await verifyRecoveryAnswer(answer);
    if (valid) {
      await unlockApp();
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const resetAll = async (): Promise<void> => {
    await fullSecurityReset();
    setIsLocked(false);
    setHasPassword(false);
  };

  return {
    isLocked,
    hasPassword,
    loading,
    recoveryQuestion,
    hasRecoveryCode,
    unlock,
    recoverWithCode,
    recoverWithAnswer,
    resetAll,
    refresh: checkLockStatus,
  };
}
