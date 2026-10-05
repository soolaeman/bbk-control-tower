import {
  CashflowType,
  CashflowCategory,
  CashflowEntry,
  CashflowSummary,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '@/lib/types/cashflow';
import {
  fetchCashflowEntries,
  saveCashflowEntry,
  deleteCashflowEntry as deleteSqliteCashflowEntry,
} from './sqlite-cashflow-repository';

export * from '@/lib/types/cashflow';

/**
 * Get all cashflow entries from SQLite SSOT (Zero Google Sheets)
 */
export async function getCashflowEntries(): Promise<CashflowEntry[]> {
  return fetchCashflowEntries();
}

/**
 * Append a new cashflow entry into SQLite SSOT
 */
export async function addCashflowEntry(entry: Omit<CashflowEntry, 'id' | 'rowIndex'>): Promise<{ success: boolean; entry?: CashflowEntry; error?: string }> {
  try {
    const created = await saveCashflowEntry(entry);
    return { success: true, entry: created };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a cashflow entry by ID from SQLite SSOT
 */
export async function deleteCashflowEntry(idOrRowIndex: string | number): Promise<{ success: boolean; error?: string }> {
  try {
    const id = String(idOrRowIndex);
    const ok = await deleteSqliteCashflowEntry(id);
    if (!ok) return { success: false, error: 'Failed to delete from database' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
