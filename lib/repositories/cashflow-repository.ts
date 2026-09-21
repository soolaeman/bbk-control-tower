import {
  CashflowType,
  CashflowCategory,
  CashflowEntry,
  CashflowSummary,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '@/lib/types/cashflow';
import {
  fetchTursoCashflowEntries,
  saveTursoCashflowEntry,
  deleteTursoCashflowEntry,
} from './turso-cashflow-repository';

export * from '@/lib/types/cashflow';

/**
 * Get all cashflow entries from Turso SQLite Cloud SSOT (Zero Google Sheets)
 */
export async function getCashflowEntries(): Promise<CashflowEntry[]> {
  return fetchTursoCashflowEntries();
}

/**
 * Append a new cashflow entry into Turso SQLite Cloud SSOT
 */
export async function addCashflowEntry(entry: Omit<CashflowEntry, 'id' | 'rowIndex'>): Promise<{ success: boolean; entry?: CashflowEntry; error?: string }> {
  try {
    const created = await saveTursoCashflowEntry(entry);
    return { success: true, entry: created };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a cashflow entry by ID from Turso SQLite Cloud SSOT
 */
export async function deleteCashflowEntry(idOrRowIndex: string | number): Promise<{ success: boolean; error?: string }> {
  try {
    const id = String(idOrRowIndex);
    const ok = await deleteTursoCashflowEntry(id);
    if (!ok) return { success: false, error: 'Failed to delete from database' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
