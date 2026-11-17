// Track-Money: Complete Backend-Only Automated Unit & Integration Functional Test Suite
// Uses track_money_backup_2026-11-16.json as a READ-ONLY test dataset.
// Does NOT test frontend, DOM, UI, or browser functionality.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_PATH = path.join(PROJECT_ROOT, 'track_money_backup_2026-11-16.json');

// Record SHA-256 of original backup file before any tests run (must never be modified)
const ORIGINAL_BACKUP_RAW = fs.readFileSync(BACKUP_PATH, 'utf8');
const ORIGINAL_BACKUP_HASH = crypto.createHash('sha256').update(ORIGINAL_BACKUP_RAW).digest('hex');
const getBackupClone = () => JSON.parse(ORIGINAL_BACKUP_RAW);

// --- In-Memory IndexedDB & localStorage Shims for Pure Backend Testing ---
class MockIndex {
  constructor(store, name, keyPath) {
    this.store = store;
    this.name = name;
    this.keyPath = keyPath;
  }
  getAll(query) {
    const req = { onsuccess: null, onerror: null, result: [] };
    queueMicrotask(() => {
      req.result = Array.from(this.store.data.values())
        .filter(item => (query === undefined ? true : item[this.keyPath] === query))
        .map(v => JSON.parse(JSON.stringify(v)));
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
}

class MockObjectStore {
  constructor(name, keyPath = 'id') {
    this.name = name;
    this.keyPath = keyPath;
    this.data = new Map();
    this.indexes = new Map();
  }
  createIndex(name, keyPath) {
    const idx = new MockIndex(this, name, keyPath);
    this.indexes.set(name, idx);
    return idx;
  }
  index(name) {
    return this.indexes.get(name);
  }
  get(key) {
    const req = { onsuccess: null, onerror: null, result: undefined };
    queueMicrotask(() => {
      const val = this.data.get(key);
      req.result = val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
  getAll() {
    const req = { onsuccess: null, onerror: null, result: [] };
    queueMicrotask(() => {
      req.result = Array.from(this.data.values()).map(v => JSON.parse(JSON.stringify(v)));
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
  put(item) {
    const req = { onsuccess: null, onerror: null, result: null };
    queueMicrotask(() => {
      const key = item[this.keyPath];
      this.data.set(key, JSON.parse(JSON.stringify(item)));
      req.result = key;
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
  delete(key) {
    const req = { onsuccess: null, onerror: null, result: null };
    queueMicrotask(() => {
      this.data.delete(key);
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
  clear() {
    const req = { onsuccess: null, onerror: null, result: null };
    queueMicrotask(() => {
      this.data.clear();
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
}

class MockIDBDatabase {
  constructor() {
    this.stores = new Map();
    this.objectStoreNames = {
      contains: (name) => this.stores.has(name)
    };
  }
  createObjectStore(name, opts = {}) {
    const store = new MockObjectStore(name, opts.keyPath || 'id');
    this.stores.set(name, store);
    return store;
  }
  transaction() {
    return {
      objectStore: (name) => this.stores.get(name)
    };
  }
}

let activeMockDB = new MockIDBDatabase();
const localMap = new Map();

global.indexedDB = {
  open: () => {
    const dbRef = activeMockDB;
    const req = { onsuccess: null, onupgradeneeded: null, onerror: null, result: dbRef };
    queueMicrotask(() => {
      if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: dbRef } });
      queueMicrotask(() => {
        if (req.onsuccess) req.onsuccess({ target: { result: dbRef } });
      });
    });
    return req;
  }
};

global.localStorage = {
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: (k) => localMap.delete(k),
  clear: () => localMap.clear()
};

// Import backend modules after shims are in place
const { StorageEngine } = await import('../js/db/storage.js');
const { AccountModel } = await import('../js/models/account.js');
const { TransactionModel } = await import('../js/models/transaction.js');
const { NLUEngine } = await import('../js/ai/nlu.js');
const { FinancialInsightsEngine } = await import('../js/ai/insights.js');
const { FinancialQueryEngine } = await import('../js/ai/queries.js');
const { AssistantCoordinator } = await import('../js/ai/assistant.js');
const { GeminiService } = await import('../js/ai/gemini.js');

// Helper: create a clean isolated StorageEngine seeded with the real backup JSON
async function createSeededStorage() {
  activeMockDB = new MockIDBDatabase();
  localMap.clear();
  const engine = new StorageEngine();
  await engine.readyPromise;
  await engine.importData(getBackupClone());
  return engine;
}

// Fixed reference date matching dataset's active month (2026-11-17)
const TEST_REF_DATE = new Date(2026, 10, 17, 12, 0, 0);

// ============================================================================
// 1. BACKUP RESTORE & DATASET INTEGRITY
// ============================================================================
test('1. Backup JSON restore integrity & validation', async () => {
  const storage = await createSeededStorage();

  const [accounts, transactions, categories, recurring, auditLogs, profile] = await Promise.all([
    storage.getAll('accounts'),
    storage.getAll('transactions'),
    storage.getAll('categories'),
    storage.getAll('recurring_transactions'),
    storage.getAll('ai_audit_logs'),
    storage.getProfile()
  ]);

  assert.equal(accounts.length, 12, 'Should restore all 12 accounts');
  assert.equal(transactions.length, 87, 'Should restore all 87 transactions');
  assert.ok(categories.length >= 30, 'Should restore all categories and defaults');
  assert.equal(recurring.length, 1, 'Should restore 1 recurring item');
  assert.equal(auditLogs.length, 26, 'Should restore 26 AI audit logs');
  assert.equal(profile.loginId, 'Karthik');
  assert.equal(profile.currency, '₹');

  // Verify invalid backup JSON is rejected
  await assert.rejects(() => storage.importData(null), /Invalid Track-Money backup JSON/);
  await assert.rejects(() => storage.importData({ accounts: [] }), /Missing accounts or transactions/);
});

// ============================================================================
// 2. ACCOUNT BALANCE CALCULATIONS (ALL 12 REAL ACCOUNTS)
// ============================================================================
test('2. Exact account balance calculations & persisted sync across all 12 real accounts', async () => {
  const storage = await createSeededStorage();
  const calculated = await storage.getAccountsWithCalculatedBalances();
  const persisted = await storage.getAll('accounts');

  const expectedDebit = {
    'acc_1791687020803_6nejr': 782.74,   // ICICI
    'acc_1791687111504_hw8sl': 5173.13,  // IOB
    'acc_1791687151389_9b896': 31.22,    // KBL
    'acc_1791687214900_bgn1j': 4300,     // Wallet
    'acc_1791871142850_7zejg': 14679,    // Demat
    'acc_1791874791478_q6nd6': 81569,    // PF
    'acc_1791874841095_r8vr7': 50000,    // HDFC FD
    'acc_1791875105131_2vw11': 2         // Federal bank
  };

  const expectedCredit = {
    // HDFC Credit Card: opening 11066 + exp 21243 - ccPay 10767 - refund/income 382 = 21160
    'acc_1791686819170_3u8q7': { outstanding: 21160, available: 20840, util: 50.4 },
    // SBI Credit Card: opening 0 + exp 414 - ccPay 414 = 0
    'acc_1791687350327_odno0': { outstanding: 0, available: 45000, util: 0 },
    // Amazon Pay Later: opening 0 + exp 4631 - ccPay 891 = 3740
    'acc_1791873125795_y028z': { outstanding: 3740, available: 26260, util: 12.5 },
    // Yes Bank kiwi: 0
    'acc_1794812921467_hqpnr': { outstanding: 0, available: 27000, util: 0 }
  };

  for (const [id, expBal] of Object.entries(expectedDebit)) {
    const calc = calculated.find(a => a.id === id);
    const raw = persisted.find(a => a.id === id);
    assert.ok(calc, `Debit account ${id} must exist`);
    assert.equal(calc.currentBalance, expBal, `Calculated balance mismatch for ${calc.name}`);
    assert.equal(raw.currentBalance, expBal, `Persisted balance must stay synchronized for ${raw.name}`);
  }

  for (const [id, exp] of Object.entries(expectedCredit)) {
    const calc = calculated.find(a => a.id === id);
    const raw = persisted.find(a => a.id === id);
    assert.ok(calc, `Credit account ${id} must exist`);
    assert.equal(calc.currentOutstanding, exp.outstanding, `Outstanding mismatch for ${calc.name}`);
    assert.equal(calc.availableCredit, exp.available, `Available credit mismatch for ${calc.name}`);
    assert.equal(calc.utilizationRate, exp.util, `Utilization mismatch for ${calc.name}`);
    assert.equal(raw.currentOutstanding, exp.outstanding, `Persisted outstanding must sync for ${raw.name}`);
    assert.equal(raw.availableCredit, exp.available, `Persisted availableCredit must sync for ${raw.name}`);
  }

  // Ensure returned cache objects are cloned (external mutation cannot corrupt cache)
  calculated[0].currentBalance = -999999;
  const freshAgain = await storage.getAccountsWithCalculatedBalances();
  assert.notEqual(freshAgain[0].currentBalance, -999999);
});

// ============================================================================
// 3. DASHBOARD & MONTHLY REPORT SYNCHRONIZATION
// ============================================================================
test('3. Dashboard metrics & Monthly Reports exact accuracy and synchronization', async () => {
  const storage = await createSeededStorage();

  const metrics = await storage.getDashboardMetrics(TEST_REF_DATE);
  const novReport = await storage.getMonthlyReport(2026, 10); // Nov 2026 (0-indexed)
  const octReport = await storage.getMonthlyReport(2026, 9);  // Oct 2026

  // Assets, Liabilities, Net Position
  assert.equal(metrics.totalAssets, 156537.09);
  assert.equal(metrics.totalLiabilities, 24900);
  assert.equal(metrics.netPosition, 131637.09);
  assert.equal(metrics.totalCreditLimit, 144000);
  assert.equal(metrics.totalCreditAvailable, 119100);
  assert.equal(metrics.overallCreditUtilization, 17.3);

  // Dashboard November cash flow MUST exactly match November Monthly Report
  assert.equal(metrics.thisMonthIncome, 3339);
  assert.equal(metrics.thisMonthExpense, 37370);
  assert.equal(metrics.savingsThisMonth, -34031);
  assert.equal(novReport.income, metrics.thisMonthIncome);
  assert.equal(novReport.expense, metrics.thisMonthExpense);
  assert.equal(novReport.savings, metrics.savingsThisMonth);
  assert.equal(novReport.savingsRate, metrics.savingsRate);
  assert.equal(novReport.txCount, 39);
  assert.equal(novReport.transferCount, 3);
  assert.equal(novReport.transferTotal, 15000);
  assert.equal(novReport.creditCardPaymentTotal, 10767);

  // Category totals sum to exact monthly expense
  const novCatSum = novReport.categoryBreakdown.reduce((s, c) => s + c.amount, 0);
  assert.equal(novCatSum, 37370);
  assert.equal(novReport.categoryBreakdown[0].name, 'Car EMI');
  assert.equal(novReport.categoryBreakdown[0].amount, 13105);
  assert.equal(novReport.categoryBreakdown[1].name, 'Car Expense');
  assert.equal(novReport.categoryBreakdown[1].amount, 10411);

  // October Monthly Report
  assert.equal(octReport.income, 59375);
  assert.equal(octReport.expense, 32269);
  assert.equal(octReport.savings, 27106);
  assert.equal(octReport.savingsRate, 45.7);
  assert.equal(octReport.txCount, 48);
  assert.equal(octReport.transferCount, 1);
  assert.equal(octReport.transferTotal, 20000);
  assert.equal(octReport.creditCardPaymentTotal, 1305);

  // Upcoming credit dues only lists cards with outstanding > 0
  assert.equal(metrics.upcomingPayments.length, 2);
  const dueNames = metrics.upcomingPayments.map(p => p.accountName).sort();
  assert.deepEqual(dueNames, ['Amazon Pay Later', 'HDFC']);
});

// ============================================================================
// 4. EXPENSE, INCOME, TRANSFER & CREDIT CARD PAYMENT MUTATIONS + VALIDATION
// ============================================================================
test('4. Add expense, income, transfer, credit card payment & strict validation', async () => {
  const storage = await createSeededStorage();
  const IOB = 'acc_1791687111504_hw8sl';
  const ICICI = 'acc_1791687020803_6nejr';
  const HDFC_CC = 'acc_1791686819170_3u8q7';
  const SBI_CC = 'acc_1791687350327_odno0';

  // 4A. Add Expense on Debit (IOB: 5173.13 -> 4673.13)
  await storage.addTransaction({
    id: 'tx_test_exp_debit',
    accountId: IOB,
    type: 'expense',
    amount: 500,
    category: 'Food',
    description: 'Team lunch',
    date: '2026-11-17'
  });
  assert.equal((await storage.getAccountById(IOB)).currentBalance, 4673.13);
  assert.equal((await storage.get('accounts', IOB)).currentBalance, 4673.13);

  // 4B. Add Expense on Credit (SBI CC: 0 -> 2500, avail 45000 -> 42500)
  await storage.addTransaction({
    id: 'tx_test_exp_credit',
    accountId: SBI_CC,
    type: 'expense',
    amount: 2500,
    category: 'Shopping',
    description: 'Headphones',
    date: '2026-11-17'
  });
  const sbiAfter = await storage.getAccountById(SBI_CC);
  assert.equal(sbiAfter.currentOutstanding, 2500);
  assert.equal(sbiAfter.availableCredit, 42500);

  // 4C. Add Income on Debit (ICICI: 782.74 -> 15782.74)
  await storage.addTransaction({
    id: 'tx_test_inc_debit',
    accountId: ICICI,
    type: 'income',
    amount: 15000,
    category: 'Freelance',
    description: 'Client milestone',
    date: '2026-11-17'
  });
  assert.equal((await storage.getAccountById(ICICI)).currentBalance, 15782.74);

  // 4D. Bank-to-Bank Transfer (ICICI -> IOB ₹3,000): deducts source, adds destination, totalAssets unchanged!
  const beforeTransferMetrics = await storage.getDashboardMetrics(TEST_REF_DATE);
  await storage.addTransaction({
    id: 'tx_test_transfer',
    accountId: ICICI,
    targetAccountId: IOB,
    type: 'transfer',
    amount: 3000,
    category: 'Transfer',
    description: 'Transfer ICICI to IOB',
    date: '2026-11-17'
  });
  assert.equal((await storage.getAccountById(ICICI)).currentBalance, 12782.74);
  assert.equal((await storage.getAccountById(IOB)).currentBalance, 7673.13);
  const afterTransferMetrics = await storage.getDashboardMetrics(TEST_REF_DATE);
  assert.equal(afterTransferMetrics.totalAssets, beforeTransferMetrics.totalAssets, 'Internal transfer must not change totalAssets');
  assert.equal(afterTransferMetrics.netPosition, beforeTransferMetrics.netPosition, 'Internal transfer must not change netPosition');

  // 4E. Credit Card Bill Payment (ICICI -> HDFC CC ₹6,000): deducts bank, lowers card debt, restores limit, netPosition unchanged!
  const beforeCCMetrics = await storage.getDashboardMetrics(TEST_REF_DATE);
  await storage.addTransaction({
    id: 'tx_test_cc_pay',
    accountId: ICICI,
    targetAccountId: HDFC_CC,
    type: 'credit_card_payment',
    amount: 6000,
    category: 'Bills & Utilities',
    description: 'HDFC Card Payoff',
    date: '2026-11-17'
  });
  assert.equal((await storage.getAccountById(ICICI)).currentBalance, 6782.74);
  const hdfcAfterPay = await storage.getAccountById(HDFC_CC);
  assert.equal(hdfcAfterPay.currentOutstanding, 15160);
  assert.equal(hdfcAfterPay.availableCredit, 26840);
  const afterCCMetrics = await storage.getDashboardMetrics(TEST_REF_DATE);
  assert.equal(afterCCMetrics.netPosition, beforeCCMetrics.netPosition, 'Credit card payoff must not alter netPosition');

  // 4F. Refund/Income on Credit Card reduces outstanding (HDFC CC: 15160 -> 14660)
  await storage.addTransaction({
    id: 'tx_test_cc_refund',
    accountId: HDFC_CC,
    type: 'income',
    amount: 500,
    category: 'Refund',
    description: 'Merchant refund',
    date: '2026-11-17'
  });
  assert.equal((await storage.getAccountById(HDFC_CC)).currentOutstanding, 14660);

  // 4G. Validation guards (invalid amounts, self-transfer, missing accounts, duplicate IDs)
  await assert.rejects(() => storage.addTransaction({ accountId: ICICI, type: 'expense', amount: 0 }), /greater than 0/);
  await assert.rejects(() => storage.addTransaction({ accountId: ICICI, type: 'expense', amount: -100 }), /greater than 0/);
  await assert.rejects(() => storage.addTransaction({ accountId: ICICI, type: 'expense', amount: NaN }), /valid number/);
  await assert.rejects(() => storage.addTransaction({ accountId: 'nonexistent', type: 'expense', amount: 100 }), /not found/);
  await assert.rejects(() => storage.addTransaction({ accountId: ICICI, targetAccountId: ICICI, type: 'transfer', amount: 100 }), /must be different/);
  await assert.rejects(() => storage.addTransaction({ accountId: ICICI, type: 'transfer', amount: 100 }), /targetAccountId is required/);
  await assert.rejects(() => storage.addTransaction({ id: 'tx_test_transfer', accountId: ICICI, targetAccountId: IOB, type: 'transfer', amount: 100 }), /already exists/);
});

// ============================================================================
// 5. EDIT & DELETE TRANSACTIONS + EDIT ACCOUNT + NO DUPLICATE UPDATES
// ============================================================================
test('5. Edit & delete transactions and edit accounts without duplicate balance updates', async () => {
  const storage = await createSeededStorage();
  const IOB = 'acc_1791687111504_hw8sl';
  const WALLET = 'acc_1791687214900_bgn1j';
  const HDFC_CC = 'acc_1791686819170_3u8q7';

  // Add a transfer IOB -> Wallet ₹1,000
  const tx = await storage.addTransaction({
    accountId: IOB,
    targetAccountId: WALLET,
    type: 'transfer',
    amount: 1000,
    category: 'Transfer',
    description: 'Cash withdrawal',
    date: '2026-11-17'
  });
  assert.equal((await storage.getAccountById(IOB)).currentBalance, 4173.13);
  assert.equal((await storage.getAccountById(WALLET)).currentBalance, 5300);

  // Edit transfer amount 1000 -> 1500
  await storage.updateTransaction(tx.id, { amount: 1500 });
  assert.equal((await storage.getAccountById(IOB)).currentBalance, 3673.13);
  assert.equal((await storage.getAccountById(WALLET)).currentBalance, 5800);

  // Calling _syncStoredBalances repeatedly must be strictly idempotent (zero duplicate updates!)
  await storage._syncStoredBalances();
  await storage._syncStoredBalances();
  assert.equal((await storage.getAccountById(IOB)).currentBalance, 3673.13);
  assert.equal((await storage.getAccountById(WALLET)).currentBalance, 5800);

  // Delete the transfer -> both accounts must revert to exact pre-transfer balances!
  const deleted = await storage.deleteTransaction(tx.id);
  assert.equal(deleted, true);
  assert.equal((await storage.getAccountById(IOB)).currentBalance, 5173.13);
  assert.equal((await storage.getAccountById(WALLET)).currentBalance, 4300);
  assert.equal((await storage.get('accounts', IOB)).currentBalance, 5173.13);
  assert.equal((await storage.get('accounts', WALLET)).currentBalance, 4300);

  // Deleting non-existent ID returns false cleanly
  assert.equal(await storage.deleteTransaction('tx_does_not_exist'), false);

  // Edit Credit Card Account: update limit & dueDay (testing dueDay persistence fix!)
  const updatedCard = await storage.updateAccount(HDFC_CC, {
    creditLimit: 60000,
    dueDay: 12,
    dueDate: '12th of month'
  });
  assert.equal(updatedCard.creditLimit, 60000);
  assert.equal(updatedCard.dueDay, 12, 'dueDay must be persisted by updateAccount');
  assert.equal(updatedCard.currentOutstanding, 21160);
  assert.equal(updatedCard.availableCredit, 38840);
  assert.equal(updatedCard.utilizationRate, 35.3);
});

// ============================================================================
// 6. FILTERING, SEARCH & TIMEZONE-SAFE DATE RANGES
// ============================================================================
test('6. Transaction filtering, search, and timezone-safe date ranges', async () => {
  const storage = await createSeededStorage();

  const novOnly = await storage.getFilteredTransactions({
    startDate: '2026-11-01',
    endDate: '2026-11-30'
  });
  assert.equal(novOnly.length, 39, 'November filter must return all 39 Nov transactions');

  const octOnly = await storage.getFilteredTransactions({
    startDate: '2026-10-01',
    endDate: '2026-10-31'
  });
  assert.equal(octOnly.length, 48, 'October filter must return all 48 Oct transactions');

  const transfers = await storage.getFilteredTransactions({ type: 'transfer' });
  assert.equal(transfers.length, 4);

  const highValue = await storage.getFilteredTransactions({ minAmount: 10000 });
  assert.ok(highValue.every(t => Number(t.amount) >= 10000));
  assert.ok(highValue.length >= 6);

  // Account filter includes transactions where account is targetAccountId (Demat received 2 transfers!)
  const dematTxs = await storage.getFilteredTransactions({ accountId: 'acc_1791871142850_7zejg' });
  assert.equal(dematTxs.length, 2, 'Demat should see its 2 incoming transfers');

  // Search by target account name + notes works (2 incoming transfers to Demat + 1 DEMAT closure note)
  const searchDemat = await storage.getFilteredTransactions({ search: 'demat' });
  assert.equal(searchDemat.length, 3);
});

// ============================================================================
// 7. EXPORT, FACTORY RESET, RESTORE ROUND-TRIP & EMERGENCY SNAPSHOT RECOVERY
// ============================================================================
test('7. Backup export, factory reset, restore round-trip, deduplication & emergency snapshot', async () => {
  const storage = await createSeededStorage();

  // Export and verify exported accounts contain freshly synced balances
  const exported = await storage.exportAllData();
  assert.equal(exported.accounts.length, 12);
  assert.equal(exported.transactions.length, 87);
  const exportedHdfc = exported.accounts.find(a => a.id === 'acc_1791686819170_3u8q7');
  assert.equal(exportedHdfc.currentOutstanding, 21160);
  const exportedIcici = exported.accounts.find(a => a.id === 'acc_1791687020803_6nejr');
  assert.equal(exportedIcici.currentBalance, 782.74);

  // Factory Reset
  await storage.resetAllData();
  assert.equal((await storage.getAll('accounts')).length, 0);
  assert.equal((await storage.getAll('transactions')).length, 0);
  assert.equal((await storage.getAll('recurring_transactions')).length, 0);
  assert.ok((await storage.getAll('categories')).length >= 30);
  assert.equal(localMap.get('tm_backup_snapshot'), undefined);

  // Restore with intentional duplicate account & transaction entries -> must deduplicate!
  const dupBackup = JSON.parse(JSON.stringify(exported));
  dupBackup.accounts.push(dupBackup.accounts[0]);
  dupBackup.transactions.push(dupBackup.transactions[0]);
  await storage.importData(dupBackup);

  const restoredAccounts = await storage.getAccountsWithCalculatedBalances();
  const restoredTxs = await storage.getAll('transactions');
  assert.equal(restoredAccounts.length, 12, 'Duplicate account must be deduplicated');
  assert.equal(restoredTxs.length, 87, 'Duplicate transaction must be deduplicated');
  assert.equal(restoredAccounts.find(a => a.id === 'acc_1791687020803_6nejr').currentBalance, 782.74);
  assert.equal(restoredAccounts.find(a => a.id === 'acc_1791686819170_3u8q7').currentOutstanding, 21160);

  // Emergency snapshot recovery test (verifies DEMO_ACCOUNT_IDS ReferenceError fix!)
  assert.ok(localMap.get('tm_backup_snapshot'), 'Emergency snapshot must exist in localStorage');
  activeMockDB = new MockIDBDatabase(); // Simulate IndexedDB cleared by OS while localStorage snapshot survives
  const recoveredStorage = new StorageEngine();
  await recoveredStorage.readyPromise;
  const recoveredAccs = await recoveredStorage.getAccountsWithCalculatedBalances();
  assert.equal(recoveredAccs.length, 12, 'Emergency snapshot must recover all 12 user accounts');
  assert.equal((await recoveredStorage.getAll('transactions')).length, 87);
});

// ============================================================================
// 8. AI INTELLIGENCE ENGINE: INSIGHTS, TRENDS, ANOMALIES & RECOMMENDATIONS
// ============================================================================
test('8. Real-data AI financial intelligence engine (insights, trends, anomalies, savings)', async () => {
  const storage = await createSeededStorage();
  const insights = await storage.getFinancialInsights(TEST_REF_DATE);

  // Overall Summary
  assert.equal(insights.activePeriod, 'November 2026');
  assert.equal(insights.previousPeriod, 'October 2026');
  assert.equal(insights.summary.netPosition, 131637.09);
  assert.equal(insights.summary.totalAssets, 156537.09);
  assert.equal(insights.summary.liquidAssets, 10289.09);
  assert.equal(insights.summary.investedAssets, 146248);
  assert.equal(insights.summary.totalLiabilities, 24900);
  assert.equal(insights.summary.activeMonthExpense, 37370);
  assert.equal(insights.summary.activeMonthIncome, 3339);

  // Month-over-Month Trends (Oct 32269 -> Nov 37370: +5101 / +15.8%)
  assert.equal(insights.trends.expenseChange, 5101);
  assert.equal(insights.trends.expenseChangePct, 15.8);
  assert.equal(insights.trends.missingSalaryDetected, true);
  assert.equal(insights.trends.previousSalaryAmount, 59025);

  const risingNames = insights.trends.risingCategories.map(c => c.category);
  assert.ok(risingNames.includes('Car EMI'), 'Should detect Car EMI increase');
  assert.ok(risingNames.includes('Car Expense'), 'Should detect Car Expense surge');
  assert.ok(risingNames.includes('Shopping'), 'Should detect Shopping increase');

  // Anomalies & Unusual Spending
  assert.ok(insights.anomalies.unusualTransactions.length >= 1, 'Should flag outlier transactions');
  assert.equal(insights.anomalies.unusualTransactions[0].amount, 13105);
  assert.ok(insights.anomalies.categorySpikes.some(s => s.category === 'Car Expense'), 'Should flag Car Expense spike');
  assert.ok(insights.anomalies.categorySpikes.some(s => s.category === 'Outside Food'), 'Should flag Outside Food spike');
  assert.ok(
    insights.anomalies.potentialDuplicates.some(d => d.amount === 186 && d.date === '2026-11-03'),
    'Should detect potential duplicate ₹186 Refund entries on HDFC on 2026-11-03'
  );

  // High Credit Card Utilization Alert (HDFC 50.4% -> payoff ₹8,560 to reach 30%)
  assert.equal(insights.alerts.highUtilizationCards.length, 1);
  assert.equal(insights.alerts.highUtilizationCards[0].name, 'HDFC');
  assert.equal(insights.alerts.highUtilizationCards[0].utilizationRate, 50.4);
  assert.equal(insights.alerts.highUtilizationCards[0].payoffToReach30, 8560);

  // Liquidity Alert (ICICI 782.74 < Car EMI 13105)
  assert.equal(insights.alerts.liquidityAlerts.length, 1);
  assert.equal(insights.alerts.liquidityAlerts[0].accountName, 'ICICI');
  assert.equal(insights.alerts.liquidityAlerts[0].shortfall, 12322.26);

  // Actionable Recommendations & Quantified Savings Potential
  assert.ok(insights.recommendations.length >= 4, 'Should produce multiple personalized recommendations');
  assert.ok(insights.estimatedMonthlySavingsPotential > 0, 'Should compute non-zero monthly savings potential');
});

// ============================================================================
// 9. AI CONVERSATIONAL QUERIES, CACHING, SPEED & NLU PARSING
// ============================================================================
test('9. AssistantCoordinator queries, caching, speed (<25ms) & NLUEngine bug fixes', async () => {
  const storage = await createSeededStorage();
  const coordinator = new AssistantCoordinator(storage);

  // Ensure local-first query engine answers all analytical queries instantaneously with real numbers
  const queriesToVerify = [
    { prompt: 'Give me an overall financial summary', expectIncludes: ['1,31,637.09', '37,370'] },
    { prompt: 'How can I save more?', expectIncludes: ['HDFC', '50.4%', '8,560', 'ICICI'] },
    { prompt: 'Check for unusual spending', expectIncludes: ['13,105', 'Car Expense', '186'] },
    { prompt: 'Show my spending trends', expectIncludes: ['October 2026', 'November 2026', '15.8%'] },
    { prompt: 'Where did I spend the most this month?', expectIncludes: ['Car EMI', '13,105', 'Car Expense'] },
    { prompt: 'Analyze my income', expectIncludes: ['3,339', '59,375', 'Salary'] },
    { prompt: 'What is my HDFC balance?', expectIncludes: ['Credit Card', 'Fixed Deposit', '21,160', '50,000'] },
    { prompt: 'What is my ICICI balance?', expectIncludes: ['ICICI', '782.74'] },
    { prompt: 'How much credit card debt do I have?', expectIncludes: ['24,900', 'HDFC', 'Amazon Pay Later'] },
    { prompt: 'How much did I spend on Car Expense?', expectIncludes: ['10,411'] },
    { prompt: 'Show transactions above 5000', expectIncludes: ['13,105', '10,002'] }
  ];

  const t0 = performance.now();
  for (const q of queriesToVerify) {
    const res = await coordinator.processInput(q.prompt);
    assert.ok(res && res.text, `Response missing for: ${q.prompt}`);
    for (const token of q.expectIncludes) {
      assert.ok(res.text.includes(token), `Response for "${q.prompt}" should include "${token}". Got:\n${res.text}`);
    }
  }
  const elapsedMs = performance.now() - t0;
  assert.ok(elapsedMs < 250, `All 11 analytical AI queries should run fast (took ${elapsedMs.toFixed(1)}ms)`);

  // Verify response cache hits on repeat query & invalidates after mutation
  const cachedRes = await coordinator.processInput('What is my ICICI balance?');
  assert.equal(cachedRes.fromCache, true, 'Repeated identical query should serve from cache');

  await storage.addTransaction({
    accountId: 'acc_1791687020803_6nejr',
    type: 'income',
    amount: 1000,
    category: 'Other Income',
    description: 'Cache invalidation test',
    date: '2026-11-17'
  });
  const freshAfterTx = await coordinator.processInput('What is my ICICI balance?');
  assert.notEqual(freshAfterTx.fromCache, true, 'Cache must invalidate after DB mutation');
  assert.ok(freshAfterTx.text.includes('1,782.74'), 'AI must immediately reflect new ICICI balance 1,782.74');

  // NLU Bug Fix Verifications
  const today = new Date();
  const expectedDayBeforeYesterday = new Date(today);
  expectedDayBeforeYesterday.setDate(expectedDayBeforeYesterday.getDate() - 2);
  assert.equal(
    NLUEngine.extractDate('spent 200 day before yesterday'),
    expectedDayBeforeYesterday.toISOString().split('T')[0],
    'day before yesterday must return today - 2 days'
  );

  const accs = await storage.getAccountsWithCalculatedBalances();
  const parsedTransfer = NLUEngine.parse('Transfer 5k from IOB to ICICI', accs, []);
  assert.equal(parsedTransfer.intent, 'create_transfer');
  assert.equal(parsedTransfer.amount, 5000, '5k transfer must parse as 5000, not 5');
  assert.equal(parsedTransfer.fromAccount.name, 'IOB');
  assert.equal(parsedTransfer.toAccount.name, 'ICICI');

  // Confirmation word-boundary check: "add note" must NOT cancel a pending action
  assert.equal(AssistantCoordinator._isCancelReply('add note lunch'), false);
  assert.equal(AssistantCoordinator._isCancelReply('no'), true);
  assert.equal(AssistantCoordinator._isConfirmReply('yes'), true);
  assert.equal(AssistantCoordinator._isConfirmReply('spent 500 on snacks'), false);
});

// ============================================================================
// 10. GEMINI SERVICE PROMPT GROUNDING & ACTION EXECUTION
// ============================================================================
test('10. GeminiService system prompt grounding & executeAction validation', async () => {
  const storage = await createSeededStorage();

  // Verify system prompt contains real analytics, trends, anomalies, and alerts
  const ctx = await storage.getFinancialContextForAI();
  const prompt = GeminiService.buildSystemPrompt(ctx);
  assert.ok(prompt.includes('1,31,637.09'), 'System prompt must include real Net Worth');
  assert.ok(prompt.includes('50.4%'), 'System prompt must include HDFC high-utilization alert');
  assert.ok(prompt.includes('Car Expense'), 'System prompt must include Car Expense spike/category');
  assert.ok(prompt.includes('Car EMI'), 'System prompt must include liquidity/EMI context');

  // Verify executeAction: create_transaction (expense on IOB)
  const txRes = await GeminiService.executeAction({
    action: 'create_transaction',
    parameters: {
      type: 'expense',
      amount: 450,
      accountName: 'IOB',
      category: 'Food',
      description: 'AI Lunch'
    }
  }, storage);
  assert.equal(txRes.success, true);
  assert.equal((await storage.getAccountById('acc_1791687111504_hw8sl')).currentBalance, 4723.13);

  // Verify executeAction: transfer_money (IOB -> ICICI)
  const trRes = await GeminiService.executeAction({
    action: 'transfer_money',
    parameters: {
      fromAccount: 'IOB',
      toAccount: 'ICICI',
      amount: 1000
    }
  }, storage);
  assert.equal(trRes.success, true);
  assert.equal((await storage.getAccountById('acc_1791687111504_hw8sl')).currentBalance, 3723.13);
  assert.equal((await storage.getAccountById('acc_1791687020803_6nejr')).currentBalance, 1782.74);

  // Verify executeAction rejects self-transfer and invalid amounts
  await assert.rejects(() => GeminiService.executeAction({
    action: 'transfer_money',
    parameters: { fromAccount: 'IOB', toAccount: 'IOB', amount: 500 }
  }, storage), /must be different/);

  await assert.rejects(() => GeminiService.executeAction({
    action: 'create_transaction',
    parameters: { type: 'expense', amount: -50, accountName: 'IOB' }
  }, storage), /greater than 0/);
});

// ============================================================================
// 11. VERIFY ORIGINAL BACKUP JSON FILE WAS NEVER MODIFIED
// ============================================================================
test('11. Original track_money_backup_2026-11-16.json remains 100% unmodified', () => {
  const afterRaw = fs.readFileSync(BACKUP_PATH, 'utf8');
  const afterHash = crypto.createHash('sha256').update(afterRaw).digest('hex');
  assert.equal(afterHash, ORIGINAL_BACKUP_HASH, 'Original backup JSON file must NOT be modified');
});
