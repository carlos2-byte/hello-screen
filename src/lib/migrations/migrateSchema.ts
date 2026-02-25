import { StorageAdapter } from '../storageAdapter';

const MIGRATION_VERSION_KEY = 'schema_version';
const CURRENT_VERSION = 1;

/**
 * Run schema migrations once
 * This ensures data structure compatibility across app updates
 */
export async function migrateSchemaOnce(adapter: StorageAdapter): Promise<void> {
  const currentVersion = await adapter.getItem<number>(MIGRATION_VERSION_KEY, 0);

  if (currentVersion >= CURRENT_VERSION) {
    return; // Already up to date
  }

  // Run migrations sequentially
  if (currentVersion < 1) {
    await migrateToV1(adapter);
  }

  // Update version
  await adapter.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
}

/**
 * V1 Migration: Initial schema setup
 * - Ensure transactions have proper structure
 * - Add createdAt to existing transactions
 */
async function migrateToV1(adapter: StorageAdapter): Promise<void> {
  const transactions = await adapter.getItem<Record<string, any>>('transactions', {});

  const migratedTransactions: Record<string, any> = {};

  for (const [id, tx] of Object.entries(transactions)) {
    migratedTransactions[id] = {
      ...tx,
      id: tx.id || id,
      createdAt: tx.createdAt || new Date().toISOString(),
      amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
    };
  }

  await adapter.setItem('transactions', migratedTransactions);
}
