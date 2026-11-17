// Track-Money: IndexedDB Local Relational Storage Engine
import { DB_NAME, DB_VERSION, STORES, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_TRANSACTIONS, DEFAULT_RECURRING } from './schema.js';
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';
import { FinancialInsightsEngine } from '../ai/insights.js';

const round2 = (n) => {
  const v = Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
};

const lsGet = (key) => (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
const lsSet = (key, val) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); };
const lsRemove = (key) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); };

export class StorageEngine {
  constructor() {
    this.db = null;
    this.isReady = false;
    this._dataVersion = 0;
    this._cachedAccountsWithBalances = null;
    this._cachedDashboardMetrics = null;
    this._cachedDashboardMonthKey = null;
    this._cachedAiContext = null;
    this._cachedFinancialInsights = null;
    this.readyPromise = this.init();
  }

  _invalidateCache() {
    this._dataVersion++;
    this._cachedAccountsWithBalances = null;
    this._cachedDashboardMetrics = null;
    this._cachedDashboardMonthKey = null;
    this._cachedAiContext = null;
    this._cachedFinancialInsights = null;
  }

  async init() {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Accounts store
        if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
          const accStore = db.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
          accStore.createIndex('category', 'category', { unique: false });
          accStore.createIndex('type', 'type', { unique: false });
        }

        // Transactions store
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
          txStore.createIndex('accountId', 'accountId', { unique: false });
          txStore.createIndex('type', 'type', { unique: false });
          txStore.createIndex('category', 'category', { unique: false });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('createdTimestamp', 'createdTimestamp', { unique: false });
        }

        // Categories store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          const catStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'name' });
          catStore.createIndex('type', 'type', { unique: false });
        }

        // Recurring transactions
        if (!db.objectStoreNames.contains(STORES.RECURRING)) {
          const recStore = db.createObjectStore(STORES.RECURRING, { keyPath: 'id' });
          recStore.createIndex('accountId', 'accountId', { unique: false });
        }

        // AI Audit Logs
        if (!db.objectStoreNames.contains(STORES.AI_AUDIT)) {
          const auditStore = db.createObjectStore(STORES.AI_AUDIT, { keyPath: 'id' });
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // App Settings
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    // Request persistent storage from browser (prevents mobile/desktop OS cache purge)
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        navigator.storage.persist().then(persistent => {
          if (persistent) console.log('Track-Money: IndexedDB persistent storage granted.');
        }).catch(() => {});
      } catch (e) {}
    }

    await this.seedInitialDataIfEmpty();
    await this.saveLocalEmergencySnapshot();
    return this.db;
  }

  async seedInitialDataIfEmpty() {
    const DEMO_ACCOUNT_IDS = ['acc_hdfc_bank', 'acc_sbi_savings', 'acc_demat', 'acc_cash', 'acc_hdfc_cc', 'acc_amazon_pay'];
    const DEMO_TX_IDS = ['tx_001', 'tx_002', 'tx_003', 'tx_004', 'tx_005', 'tx_006', 'tx_007', 'tx_008', 'tx_009', 'tx_010'];
    const DEMO_REC_IDS = ['rec_salary', 'rec_rent', 'rec_netflix', 'rec_sip'];

    // 1. One-time purge of previously seeded dummy demo accounts/transactions if not already done
    const isCleaned = lsGet('tm_demo_cleaned_v2');
    if (!isCleaned) {
      for (const accId of DEMO_ACCOUNT_IDS) {
        const acc = await this.get(STORES.ACCOUNTS, accId);
        if (acc) await this.delete(STORES.ACCOUNTS, accId);
      }
      for (const txId of DEMO_TX_IDS) {
        const tx = await this.get(STORES.TRANSACTIONS, txId);
        if (tx) await this.delete(STORES.TRANSACTIONS, txId);
      }
      for (const recId of DEMO_REC_IDS) {
        const rec = await this.get(STORES.RECURRING, recId);
        if (rec) await this.delete(STORES.RECURRING, recId);
      }

      const rawSnapshot = lsGet('tm_backup_snapshot');
      if (rawSnapshot) {
        try {
          const snapshot = JSON.parse(rawSnapshot);
          if (snapshot.accounts) {
            snapshot.accounts = snapshot.accounts.filter(a => !DEMO_ACCOUNT_IDS.includes(a.id));
          }
          if (snapshot.transactions) {
            snapshot.transactions = snapshot.transactions.filter(t => !DEMO_TX_IDS.includes(t.id));
          }
          if (snapshot.recurring) {
            snapshot.recurring = snapshot.recurring.filter(r => !DEMO_REC_IDS.includes(r.id));
          }
          lsSet('tm_backup_snapshot', JSON.stringify(snapshot));
        } catch (e) {
          lsRemove('tm_backup_snapshot');
        }
      }
      lsSet('tm_demo_cleaned_v2', 'true');
    }

    let existingAccounts = await this.getAll(STORES.ACCOUNTS);

    // If IndexedDB accounts are completely empty, check if a valid user backup snapshot exists
    if (existingAccounts.length === 0) {
      const emergencySnapshot = lsGet('tm_backup_snapshot');
      if (emergencySnapshot) {
        try {
          const snapshotData = JSON.parse(emergencySnapshot);
          const userAccounts = (snapshotData?.accounts || []).filter(a => !DEMO_ACCOUNT_IDS.includes(a.id));
          if (userAccounts.length > 0) {
            console.log('Track-Money: Restoring user accounts from emergency local backup snapshot...');
            for (const acc of userAccounts) await this.put(STORES.ACCOUNTS, acc);
            if (snapshotData.transactions) {
              const userTxs = snapshotData.transactions.filter(t => !DEMO_TX_IDS.includes(t.id));
              for (const tx of userTxs) await this.put(STORES.TRANSACTIONS, tx);
            }
            if (snapshotData.categories) {
              for (const cat of snapshotData.categories) await this.put(STORES.CATEGORIES, cat);
            }
            if (snapshotData.recurring) {
              const userRecs = snapshotData.recurring.filter(r => !DEMO_REC_IDS.includes(r.id));
              for (const rec of userRecs) await this.put(STORES.RECURRING, rec);
            }
            if (snapshotData.settings) {
              for (const s of snapshotData.settings) await this.put(STORES.SETTINGS, s);
            }
            existingAccounts = await this.getAll(STORES.ACCOUNTS);
          }
        } catch (e) {
          console.warn('Track-Money: Could not restore emergency snapshot:', e);
        }
      }
    }

    if (existingAccounts.length === 0 && DEFAULT_ACCOUNTS.length > 0) {
      console.log('Seeding initial Track-Money accounts...');
      for (const acc of DEFAULT_ACCOUNTS) {
        await this.put(STORES.ACCOUNTS, acc);
      }
    }

    const existingCategories = await this.getAll(STORES.CATEGORIES);
    if (existingCategories.length === 0) {
      console.log('Seeding initial Track-Money categories...');
      for (const cat of DEFAULT_CATEGORIES) {
        await this.put(STORES.CATEGORIES, cat);
      }
    } else {
      // Auto-merge newly added default categories into existing database
      const existingNames = new Set(existingCategories.map(c => (c.name || '').toLowerCase()));
      for (const cat of DEFAULT_CATEGORIES) {
        if (!existingNames.has((cat.name || '').toLowerCase())) {
          await this.put(STORES.CATEGORIES, cat);
        }
      }
    }

    const existingTx = await this.getAll(STORES.TRANSACTIONS);
    if (existingTx.length === 0 && DEFAULT_TRANSACTIONS.length > 0) {
      console.log('Seeding initial Track-Money transactions...');
      for (const tx of DEFAULT_TRANSACTIONS) {
        await this.put(STORES.TRANSACTIONS, tx);
      }
    }

    const existingRec = await this.getAll(STORES.RECURRING);
    if (existingRec.length === 0 && DEFAULT_RECURRING.length > 0) {
      console.log('Seeding initial Track-Money recurring schedules...');
      for (const rec of DEFAULT_RECURRING) {
        await this.put(STORES.RECURRING, rec);
      }
    }

    const profile = await this.get(STORES.SETTINGS, 'profile');
    if (!profile) {
      const defaultLoginId = lsGet('tm_login_id') || 'User';
      await this.put(STORES.SETTINGS, {
        key: 'profile',
        loginId: defaultLoginId,
        name: defaultLoginId,
        currency: lsGet('tm_currency') || '₹',
        pinEnabled: false,
        pinCode: null,
        createdDate: new Date().toISOString()
      });
    }
  }

  async saveLocalEmergencySnapshot() {
    if (typeof localStorage === 'undefined') return;
    try {
      const accounts = await this.getAll(STORES.ACCOUNTS);
      const transactions = await this.getAll(STORES.TRANSACTIONS);
      const categories = await this.getAll(STORES.CATEGORIES);
      const recurring = await this.getAll(STORES.RECURRING);
      const settings = await this.getAll(STORES.SETTINGS);
      if (accounts.length > 0 || transactions.length > 0) {
        const snapshot = {
          timestamp: new Date().toISOString(),
          accounts,
          transactions,
          categories,
          recurring,
          settings
        };
        lsSet('tm_backup_snapshot', JSON.stringify(snapshot));
      }
    } catch (e) {
      console.warn('Could not save local emergency snapshot:', e);
    }
  }

  // Profile & User Identity Management (100% Local-First)
  async getProfile() {
    if (!this.db) await this.readyPromise;
    const profile = await this.get(STORES.SETTINGS, 'profile');
    return profile || {
      key: 'profile',
      loginId: lsGet('tm_login_id') || 'User',
      name: lsGet('tm_login_id') || 'User',
      currency: lsGet('tm_currency') || '₹',
      pinEnabled: false,
      pinCode: null,
      createdDate: new Date().toISOString()
    };
  }

  async saveProfile(profileData) {
    if (!this.db) await this.readyPromise;
    const current = (await this.get(STORES.SETTINGS, 'profile')) || {};
    const updated = {
      ...current,
      ...profileData,
      key: 'profile',
      updatedDate: new Date().toISOString()
    };
    if (updated.currency) {
      lsSet('tm_currency', updated.currency);
    }
    if (updated.loginId) {
      lsSet('tm_login_id', updated.loginId);
    }
    await this.put(STORES.SETTINGS, updated);
    return updated;
  }

  // Generic IndexedDB operations
  async getTransaction(storeNames, mode = 'readonly') {
    if (!this.db) await this.readyPromise;
    return this.db.transaction(storeNames, mode);
  }

  async getAll(storeName) {
    if (!this.db) await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    if (!this.db) await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _putRaw(storeName, value) {
    if (!this.db) await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    const res = await this._putRaw(storeName, value);
    if (
      storeName === STORES.ACCOUNTS ||
      storeName === STORES.TRANSACTIONS ||
      storeName === STORES.CATEGORIES ||
      storeName === STORES.RECURRING
    ) {
      this._invalidateCache();
    }
    this.scheduleEmergencySnapshot();
    return res;
  }

  async delete(storeName, key) {
    if (!this.db) await this.readyPromise;
    const res = await new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
    if (
      storeName === STORES.ACCOUNTS ||
      storeName === STORES.TRANSACTIONS ||
      storeName === STORES.CATEGORIES ||
      storeName === STORES.RECURRING
    ) {
      this._invalidateCache();
    }
    if (storeName === STORES.TRANSACTIONS) {
      await this._syncStoredBalances();
    }
    this.scheduleEmergencySnapshot();
    return res;
  }

  scheduleEmergencySnapshot() {
    if (this._snapshotTimer) clearTimeout(this._snapshotTimer);
    this._snapshotTimer = setTimeout(() => {
      this.saveLocalEmergencySnapshot();
    }, 800);
  }

  async clear(storeName) {
    if (!this.db) await this.readyPromise;
    if (!this.db.objectStoreNames.contains(storeName)) return true;
    this._invalidateCache();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      if (!store) return resolve(true);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clearAllAccountsAndTransactions() {
    if (!this.db) await this.readyPromise;
    await this.clear(STORES.ACCOUNTS);
    await this.clear(STORES.TRANSACTIONS);
    await this.clear(STORES.RECURRING);
    lsRemove('tm_backup_snapshot');
    return true;
  }

  // Update Existing Account without losing transactions
  async updateAccount(id, updateData) {
    if (!this.db) await this.readyPromise;
    const existing = await this.get(STORES.ACCOUNTS, id);
    if (!existing) {
      throw new Error(`Account with ID "${id}" not found.`);
    }

    const updatedCategory = updateData.category || existing.category;
    const isCredit = updatedCategory === 'credit';

    const updated = {
      ...existing,
      name: updateData.name !== undefined ? updateData.name.trim() : existing.name,
      category: updatedCategory,
      type: updateData.type || existing.type,
      institution: updateData.institution !== undefined ? updateData.institution : (existing.institution || ''),
      description: updateData.description !== undefined ? updateData.description : existing.description,
      color: updateData.color || existing.color,
      icon: updateData.icon || existing.icon,
      currency: updateData.currency || existing.currency,
      updatedTimestamp: Date.now()
    };

    if (!isCredit) {
      if (updateData.openingBalance !== undefined) {
        updated.openingBalance = round2(Number(updateData.openingBalance) || 0);
      }
      updated.creditLimit = 0;
      updated.openingOutstanding = 0;
    } else {
      if (updateData.creditLimit !== undefined) {
        updated.creditLimit = round2(Number(updateData.creditLimit) || 0);
      }
      if (updateData.openingOutstanding !== undefined) {
        updated.openingOutstanding = round2(Number(updateData.openingOutstanding) || 0);
      }
      if (updateData.billingCycle !== undefined) {
        updated.billingCycle = updateData.billingCycle;
      }
      if (updateData.dueDay !== undefined) {
        updated.dueDay = parseInt(updateData.dueDay, 10) || AccountModel.parseDueDay(updateData);
      }
      if (updateData.dueDate !== undefined) {
        updated.dueDate = updateData.dueDate;
        if (updateData.dueDay === undefined) {
          updated.dueDay = AccountModel.parseDueDay({ dueDate: updateData.dueDate });
        }
      }
      if (updateData.interestRate !== undefined) {
        updated.interestRate = Number(updateData.interestRate) || 0;
      }
      updated.availableCredit = Math.max(0, round2((updated.creditLimit || 0) - (updated.openingOutstanding || 0)));
    }

    await this.put(STORES.ACCOUNTS, updated);
    await this._syncStoredBalances();
    await this.saveLocalEmergencySnapshot();
    return (await this.getAccountById(id)) || updated;
  }

  // Factory Reset All Data (Completely clear all data and re-seed clean default categories)
  async resetAllData() {
    if (!this.db) await this.readyPromise;
    if (this._snapshotTimer) {
      clearTimeout(this._snapshotTimer);
      this._snapshotTimer = null;
    }
    for (const storeName of Object.values(STORES)) {
      await this.clear(storeName);
    }

    lsRemove('tm_backup_snapshot');
    lsSet('tm_demo_cleaned_v2', 'true');

    // Re-seed standard default categories
    for (const cat of DEFAULT_CATEGORIES) {
      await this._putRaw(STORES.CATEGORIES, cat);
    }

    // Re-seed default profile
    const defaultLoginId = lsGet('tm_login_id') || 'User';
    await this._putRaw(STORES.SETTINGS, {
      key: 'profile',
      loginId: defaultLoginId,
      name: defaultLoginId,
      currency: lsGet('tm_currency') || '₹',
      pinEnabled: false,
      pinCode: null,
      createdDate: new Date().toISOString()
    });

    this._invalidateCache();
    return true;
  }

  // Synchronize calculated balances onto stored account records without mutating opening balances.
  // Deterministically derived from openingBalance/openingOutstanding + all transactions (immune to duplicate updates).
  async _syncStoredBalances() {
    if (!this.db) await this.readyPromise;
    this._cachedAccountsWithBalances = null;
    this._cachedDashboardMetrics = null;
    this._cachedAiContext = null;
    this._cachedFinancialInsights = null;

    const calculated = await this.getAccountsWithCalculatedBalances();
    const rawAccounts = await this.getAll(STORES.ACCOUNTS);
    const rawMap = new Map(rawAccounts.map(a => [a.id, a]));

    for (const calc of calculated) {
      const raw = rawMap.get(calc.id);
      if (!raw) continue;
      let changed = false;
      const next = { ...raw };
      if (calc.category === 'debit') {
        if (next.currentBalance !== calc.currentBalance) {
          next.currentBalance = calc.currentBalance;
          changed = true;
        }
      } else {
        if (
          next.currentOutstanding !== calc.currentOutstanding ||
          next.availableCredit !== calc.availableCredit ||
          next.utilizationRate !== calc.utilizationRate
        ) {
          next.currentOutstanding = calc.currentOutstanding;
          next.availableCredit = calc.availableCredit;
          next.utilizationRate = calc.utilizationRate;
          changed = true;
        }
      }
      if (changed) {
        await this._putRaw(STORES.ACCOUNTS, next);
      }
    }
    return calculated;
  }

  // Account Operations & Dynamic Balance Calculations (Optimized O(A+T) Single-Pass)
  async getAccountsWithCalculatedBalances() {
    if (this._cachedAccountsWithBalances) {
      return this._cachedAccountsWithBalances.map(a => ({ ...a }));
    }
    if (!this.db) await this.readyPromise;
    const [accounts, transactions] = await Promise.all([
      this.getAll(STORES.ACCOUNTS),
      this.getAll(STORES.TRANSACTIONS)
    ]);

    const accMap = {};
    for (const a of accounts) {
      accMap[a.id] = {
        totalIncome: 0,
        totalSpent: 0,
        totalTransfersIn: 0,
        totalTransfersOut: 0,
        totalPaymentsMade: 0,
        totalRefunds: 0
      };
    }

    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      const src = accMap[tx.accountId];
      const hasDistinctTarget = tx.targetAccountId && tx.targetAccountId !== tx.accountId;
      const tgt = hasDistinctTarget ? accMap[tx.targetAccountId] : null;

      if (src) {
        if (tx.type === 'income' || tx.type === 'adjustment') {
          src.totalIncome += amt;
        } else if (tx.type === 'expense' || tx.type === 'purchase') {
          src.totalSpent += amt;
        } else if (tx.type === 'transfer') {
          src.totalTransfersOut += amt;
        } else if (tx.type === 'credit_card_payment') {
          src.totalSpent += amt;
        } else if (tx.type === 'refund') {
          src.totalRefunds += amt;
        }
      }

      if (tgt) {
        if (tx.type === 'transfer' || tx.type === 'adjustment') {
          tgt.totalTransfersIn += amt;
        } else if (tx.type === 'credit_card_payment') {
          tgt.totalPaymentsMade += amt;
        }
      }
    }

    const calculated = accounts.map(acc => {
      const accCopy = { ...acc };
      const stats = accMap[acc.id] || {
        totalIncome: 0, totalSpent: 0, totalTransfersIn: 0, totalTransfersOut: 0, totalPaymentsMade: 0, totalRefunds: 0
      };

      if (acc.category === 'debit') {
        const opening = Number(acc.openingBalance) || 0;
        accCopy.totalIncome = round2(stats.totalIncome + stats.totalRefunds);
        accCopy.totalTransfersIn = round2(stats.totalTransfersIn);
        accCopy.totalTransfersOut = round2(stats.totalTransfersOut);
        accCopy.totalSpent = round2(stats.totalSpent + stats.totalTransfersOut);
        accCopy.currentBalance = round2(
          opening + stats.totalIncome + stats.totalTransfersIn + stats.totalRefunds - stats.totalSpent - stats.totalTransfersOut
        );
      } else {
        const opening = Number(acc.openingOutstanding) || 0;
        const limit = Number(acc.creditLimit) || 0;
        accCopy.totalSpent = round2(stats.totalSpent + stats.totalTransfersOut);
        accCopy.paymentsMade = round2(stats.totalPaymentsMade + stats.totalTransfersIn);
        accCopy.totalRefunds = round2(stats.totalRefunds + stats.totalIncome);
        const outstanding = Math.max(
          0,
          round2(
            opening + stats.totalSpent + stats.totalTransfersOut - stats.totalPaymentsMade - stats.totalTransfersIn - stats.totalRefunds - stats.totalIncome
          )
        );
        accCopy.currentOutstanding = outstanding;
        accCopy.availableCredit = Math.max(0, round2(limit - outstanding));
        accCopy.utilizationRate = limit > 0 ? Number(((outstanding / limit) * 100).toFixed(1)) : 0;
      }
      return accCopy;
    });

    this._cachedAccountsWithBalances = calculated;
    return calculated.map(a => ({ ...a }));
  }

  async getAccountById(id) {
    const accounts = await this.getAccountsWithCalculatedBalances();
    return accounts.find(a => a.id === id) || null;
  }

  // Financial Position & Dashboard Metrics (High-Speed Cached)
  async getDashboardMetrics(referenceDate = null) {
    const now = referenceDate ? new Date(referenceDate) : new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthKey = `${currentYear}-${currentMonth}`;

    if (!referenceDate && this._cachedDashboardMetrics && this._cachedDashboardMonthKey === monthKey) {
      return this._cachedDashboardMetrics;
    }

    const [accounts, transactions] = await Promise.all([
      this.getAccountsWithCalculatedBalances(),
      this.getAll(STORES.TRANSACTIONS)
    ]);

    // Sum Assets (Debit Accounts)
    const debitAccounts = accounts.filter(a => a.category === 'debit');
    const totalAssets = round2(debitAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0));

    // Sum Liabilities (Credit Accounts)
    const creditAccounts = accounts.filter(a => a.category === 'credit');
    const totalLiabilities = round2(creditAccounts.reduce((sum, a) => sum + (a.currentOutstanding || 0), 0));
    const totalCreditLimit = round2(creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0));
    const totalCreditAvailable = round2(creditAccounts.reduce((sum, a) => sum + (a.availableCredit || 0), 0));
    const overallCreditUtilization = totalCreditLimit > 0
      ? Number(((totalLiabilities / totalCreditLimit) * 100).toFixed(1))
      : 0;

    const netPosition = round2(totalAssets - totalLiabilities);

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    const categorySpending = {};

    transactions.forEach(tx => {
      const txDate = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
      const isThisMonth = txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
      const amt = Number(tx.amount) || 0;

      if (isThisMonth) {
        if (tx.type === 'income') {
          thisMonthIncome = round2(thisMonthIncome + amt);
        } else if (tx.type === 'expense' || tx.type === 'purchase') {
          thisMonthExpense = round2(thisMonthExpense + amt);
          const cat = tx.category || 'Other Expense';
          categorySpending[cat] = round2((categorySpending[cat] || 0) + amt);
        }
      }
    });

    const savingsThisMonth = round2(thisMonthIncome - thisMonthExpense);
    const savingsRate = thisMonthIncome > 0
      ? Number(((savingsThisMonth / thisMonthIncome) * 100).toFixed(1))
      : 0;

    // Upcoming credit card payments with dynamic recurring monthly due calculation
    const upcomingPayments = creditAccounts
      .filter(a => (a.currentOutstanding || 0) > 0)
      .map(a => {
        const dueInfo = AccountModel.getNextDueDate(a, now);
        return {
          id: a.id,
          accountName: a.name,
          amountDue: a.currentOutstanding,
          dueDate: dueInfo.dateString,
          dueDay: dueInfo.dueDay,
          daysUntilDue: dueInfo.daysUntilDue,
          isOverdue: dueInfo.isOverdue,
          isDueToday: dueInfo.isDueToday,
          isDueSoon: dueInfo.isDueSoon,
          billingCycle: a.billingCycle || `${dueInfo.dueDay}th of month`
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // Sort transactions by date descending, then createdTimestamp descending
    const recentTransactions = [...transactions]
      .sort((a, b) => {
        const diff = TransactionModel.parseLocalDate(b.date || b.createdTimestamp) - TransactionModel.parseLocalDate(a.date || a.createdTimestamp);
        return diff !== 0 ? diff : (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
      })
      .slice(0, 10);

    const metrics = {
      totalAssets,
      totalLiabilities,
      netPosition,
      thisMonthIncome,
      thisMonthExpense,
      savingsThisMonth,
      savingsRate,
      totalCreditLimit,
      totalCreditAvailable,
      overallCreditUtilization,
      categorySpending,
      upcomingPayments,
      debitAccounts,
      creditAccounts,
      recentTransactions
    };

    if (!referenceDate) {
      this._cachedDashboardMetrics = metrics;
      this._cachedDashboardMonthKey = monthKey;
    }
    return metrics;
  }

  // Real-Data Financial Insights (Cached until data changes)
  async getFinancialInsights(referenceDate = null) {
    if (!referenceDate && this._cachedFinancialInsights) {
      return this._cachedFinancialInsights;
    }
    const [accounts, transactions, recurring, metrics] = await Promise.all([
      this.getAccountsWithCalculatedBalances(),
      this.getAll(STORES.TRANSACTIONS),
      this.getAll(STORES.RECURRING),
      this.getDashboardMetrics(referenceDate)
    ]);

    const insights = FinancialInsightsEngine.analyze({
      accounts,
      transactions,
      recurring,
      metrics,
      referenceDate: referenceDate || new Date()
    });

    if (!referenceDate) {
      this._cachedFinancialInsights = insights;
    }
    return insights;
  }

  // Concise, token-efficient financial context tailored for fast, intelligent Gemini AI responses
  async getFinancialContextForAI() {
    if (this._cachedAiContext) {
      return this._cachedAiContext;
    }
    const [metrics, accounts, categories, transactions, insights] = await Promise.all([
      this.getDashboardMetrics(),
      this.getAccountsWithCalculatedBalances(),
      this.getAll(STORES.CATEGORIES),
      this.getAll(STORES.TRANSACTIONS),
      this.getFinancialInsights()
    ]);

    const accNameMap = new Map(accounts.map(a => [a.id, a.name]));

    // Top 15 recent transactions with concise essential fields
    const recentTx = [...transactions]
      .sort((a, b) => {
        const diff = TransactionModel.parseLocalDate(b.date || b.createdTimestamp) - TransactionModel.parseLocalDate(a.date || a.createdTimestamp);
        return diff !== 0 ? diff : (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
      })
      .slice(0, 15)
      .map(t => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        category: t.category,
        accountName: accNameMap.get(t.accountId) || 'Account',
        targetAccountName: t.targetAccountId ? (accNameMap.get(t.targetAccountId) || undefined) : undefined,
        description: t.description || ''
      }));

    // Filter non-zero category spending to keep prompt compact
    const activeCatSpending = {};
    for (const [cat, amt] of Object.entries(metrics.categorySpending || {})) {
      if (amt > 0) activeCatSpending[cat] = amt;
    }

    const aiContext = {
      activePeriod: insights.activePeriod,
      netPosition: metrics.netPosition,
      totalAssets: metrics.totalAssets,
      liquidAssets: insights.summary.liquidAssets,
      investedAssets: insights.summary.investedAssets,
      totalLiabilities: metrics.totalLiabilities,
      thisMonthIncome: metrics.thisMonthIncome,
      thisMonthExpense: metrics.thisMonthExpense,
      savingsThisMonth: metrics.savingsThisMonth,
      savingsRate: metrics.savingsRate,
      overallCreditUtilization: metrics.overallCreditUtilization,
      categorySpending: activeCatSpending,
      accounts: accounts.map(a => ({
        name: a.name,
        category: a.category,
        type: a.type,
        balance: a.category === 'debit' ? a.currentBalance : undefined,
        outstanding: a.category === 'credit' ? a.currentOutstanding : undefined,
        availableCredit: a.category === 'credit' ? a.availableCredit : undefined,
        limit: a.category === 'credit' ? a.creditLimit : undefined,
        utilizationRate: a.category === 'credit' ? a.utilizationRate : undefined
      })),
      categories: categories.map(c => c.name),
      recentTransactions: recentTx,
      insights: {
        monthlyHistory: insights.monthlyHistory.slice(-4),
        trends: {
          previousPeriod: insights.trends.previousPeriod,
          expenseChange: insights.trends.expenseChange,
          expenseChangePct: insights.trends.expenseChangePct,
          risingCategories: insights.trends.risingCategories.slice(0, 4),
          missingSalaryDetected: insights.trends.missingSalaryDetected,
          previousSalaryAmount: insights.trends.previousSalaryAmount
        },
        anomalies: {
          unusualTransactions: insights.anomalies.unusualTransactions.slice(0, 4),
          categorySpikes: insights.anomalies.categorySpikes.slice(0, 3),
          potentialDuplicates: insights.anomalies.potentialDuplicates.slice(0, 3)
        },
        highUtilizationCards: insights.alerts.highUtilizationCards,
        liquidityAlerts: insights.alerts.liquidityAlerts,
        estimatedMonthlySavingsPotential: insights.estimatedMonthlySavingsPotential,
        recommendations: insights.recommendations.slice(0, 5).map(r => r.detail)
      }
    };

    this._cachedAiContext = aiContext;
    return aiContext;
  }

  // Transactions with filtering
  async getFilteredTransactions(filters = {}) {
    const [transactions, accounts] = await Promise.all([
      this.getAll(STORES.TRANSACTIONS),
      this.getAll(STORES.ACCOUNTS)
    ]);
    const accMap = new Map(accounts.map(a => [a.id, a]));
    const startDateObj = filters.startDate ? TransactionModel.parseLocalDate(filters.startDate) : null;
    const endDateObj = filters.endDate ? TransactionModel.parseLocalDate(filters.endDate) : null;

    return transactions
      .map(tx => ({
        ...tx,
        accountName: accMap.get(tx.accountId)?.name || 'Unknown Account',
        targetAccountName: tx.targetAccountId ? accMap.get(tx.targetAccountId)?.name : null
      }))
      .filter(tx => {
        // Search text
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const matchDesc = (tx.description || '').toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          const matchCat = (tx.category || '').toLowerCase().includes(q);
          const matchSubcat = (tx.subcategory || '').toLowerCase().includes(q);
          const matchAcc = (tx.accountName || '').toLowerCase().includes(q);
          const matchTargetAcc = (tx.targetAccountName || '').toLowerCase().includes(q);
          if (!matchDesc && !matchNotes && !matchCat && !matchSubcat && !matchAcc && !matchTargetAcc) {
            return false;
          }
        }

        // Account filter
        if (filters.accountId && filters.accountId !== 'all') {
          if (tx.accountId !== filters.accountId && tx.targetAccountId !== filters.accountId) {
            return false;
          }
        }

        // Category filter
        if (filters.category && filters.category !== 'all') {
          if (tx.category !== filters.category) {
            return false;
          }
        }

        // Type filter
        if (filters.type && filters.type !== 'all') {
          if (tx.type !== filters.type) {
            return false;
          }
        }

        // Date range filter (timezone-safe local date comparison)
        if (startDateObj && !isNaN(startDateObj.getTime())) {
          const txDateObj = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
          if (txDateObj < startDateObj) return false;
        }
        if (endDateObj && !isNaN(endDateObj.getTime())) {
          const txDateObj = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
          if (txDateObj > endDateObj) return false;
        }

        // Amount min/max
        if (filters.minAmount !== undefined && filters.minAmount !== '') {
          if (Number(tx.amount) < Number(filters.minAmount)) return false;
        }
        if (filters.maxAmount !== undefined && filters.maxAmount !== '') {
          if (Number(tx.amount) > Number(filters.maxAmount)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const diff = TransactionModel.parseLocalDate(b.date || b.createdTimestamp) - TransactionModel.parseLocalDate(a.date || a.createdTimestamp);
        return diff !== 0 ? diff : (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
      });
  }

  async _validateTransactionPayload(tx) {
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount)) {
      throw new Error('Transaction amount must be a valid number.');
    }
    if (tx.type === 'adjustment') {
      if (amount === 0) throw new Error('Adjustment amount must be non-zero.');
    } else if (amount <= 0) {
      throw new Error('Transaction amount must be greater than 0.');
    }

    if (!tx.accountId) {
      throw new Error('Source accountId is required.');
    }
    const srcAcc = await this.get(STORES.ACCOUNTS, tx.accountId);
    if (!srcAcc) {
      throw new Error(`Account "${tx.accountId}" not found.`);
    }

    if (tx.type === 'transfer' || tx.type === 'credit_card_payment') {
      if (!tx.targetAccountId) {
        throw new Error(`Destination targetAccountId is required for ${tx.type}.`);
      }
      if (tx.targetAccountId === tx.accountId) {
        throw new Error('Source and destination accounts must be different.');
      }
      const tgtAcc = await this.get(STORES.ACCOUNTS, tx.targetAccountId);
      if (!tgtAcc) {
        throw new Error(`Destination account "${tx.targetAccountId}" not found.`);
      }
    }
  }

  // Create Transaction with Validation & Immediate Balance Synchronization
  async addTransaction(txData) {
    if (!this.db) await this.readyPromise;
    if (txData.id) {
      const existing = await this.get(STORES.TRANSACTIONS, txData.id);
      if (existing) {
        throw new Error(`Transaction with ID "${txData.id}" already exists.`);
      }
    }

    const rawAmount = Number(txData.amount);
    const id = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const tx = {
      id,
      accountId: txData.accountId,
      targetAccountId: txData.targetAccountId || null,
      type: txData.type || 'expense',
      amount: rawAmount,
      category: txData.category || 'Other Expense',
      subcategory: txData.subcategory || '',
      description: txData.description || 'Transaction',
      date: txData.date || new Date().toISOString().split('T')[0],
      paymentMethod: txData.paymentMethod || 'Other',
      notes: txData.notes || '',
      createdTimestamp: txData.createdTimestamp || Date.now(),
      aiAuditId: txData.aiAuditId || null
    };

    await this._validateTransactionPayload(tx);
    tx.amount = round2(tx.amount);
    await this.put(STORES.TRANSACTIONS, tx);
    await this._syncStoredBalances();
    await this.saveLocalEmergencySnapshot();
    return tx;
  }

  // Update Existing Transaction with Validation & Immediate Balance Synchronization
  async updateTransaction(id, updateData) {
    if (!this.db) await this.readyPromise;
    const existing = await this.get(STORES.TRANSACTIONS, id);
    if (!existing) {
      throw new Error(`Transaction with ID "${id}" not found.`);
    }

    const nextType = updateData.type || existing.type;
    const nextTargetAccountId = (nextType === 'transfer' || nextType === 'credit_card_payment')
      ? (updateData.targetAccountId !== undefined ? updateData.targetAccountId : existing.targetAccountId)
      : (updateData.targetAccountId !== undefined ? updateData.targetAccountId : null);

    const updated = {
      ...existing,
      accountId: updateData.accountId !== undefined ? updateData.accountId : existing.accountId,
      targetAccountId: nextTargetAccountId,
      type: nextType,
      amount: updateData.amount !== undefined ? Number(updateData.amount) : existing.amount,
      category: updateData.category || existing.category,
      subcategory: updateData.subcategory !== undefined ? updateData.subcategory : existing.subcategory,
      description: updateData.description !== undefined ? updateData.description : existing.description,
      date: updateData.date || existing.date,
      paymentMethod: updateData.paymentMethod || existing.paymentMethod,
      notes: updateData.notes !== undefined ? updateData.notes : existing.notes,
      updatedTimestamp: Date.now()
    };

    await this._validateTransactionPayload(updated);
    updated.amount = round2(updated.amount);
    await this.put(STORES.TRANSACTIONS, updated);
    await this._syncStoredBalances();
    await this.saveLocalEmergencySnapshot();
    return updated;
  }

  // Delete Transaction & Immediately Synchronize Account Balances
  async deleteTransaction(id) {
    if (!this.db) await this.readyPromise;
    const existing = await this.get(STORES.TRANSACTIONS, id);
    if (!existing) return false;
    await this.delete(STORES.TRANSACTIONS, id);
    await this.saveLocalEmergencySnapshot();
    return true;
  }

  // AI Audit Logging
  async logAiAudit(auditData) {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const entry = {
      id,
      timestamp: Date.now(),
      originalMessage: auditData.originalMessage,
      interpretedAction: auditData.interpretedAction,
      confirmationStatus: auditData.confirmationStatus || 'pending',
      resultingTransactionId: auditData.resultingTransactionId || null
    };
    await this.put(STORES.AI_AUDIT, entry);
    return entry;
  }

  async updateAiAuditStatus(id, status, resultingTxId = null) {
    const record = await this.get(STORES.AI_AUDIT, id);
    if (record) {
      record.confirmationStatus = status;
      if (resultingTxId) record.resultingTransactionId = resultingTxId;
      await this.put(STORES.AI_AUDIT, record);
    }
  }

  // Export and Backup (always exports freshly synced account balances)
  async exportAllData() {
    await this._syncStoredBalances();
    const data = {
      exportVersion: 1,
      exportTimestamp: new Date().toISOString(),
      accounts: await this.getAll(STORES.ACCOUNTS),
      transactions: await this.getAll(STORES.TRANSACTIONS),
      categories: await this.getAll(STORES.CATEGORIES),
      recurring: await this.getAll(STORES.RECURRING),
      aiAuditLogs: await this.getAll(STORES.AI_AUDIT),
      settings: await this.getAll(STORES.SETTINGS)
    };
    return data;
  }

  async importData(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Invalid Track-Money backup JSON: Must be a valid object.');
    }
    if (!Array.isArray(jsonData.accounts) || !Array.isArray(jsonData.transactions)) {
      throw new Error('Invalid Track-Money backup JSON: Missing accounts or transactions array.');
    }

    // Clear all existing stores to prevent duplicates or orphan records
    for (const storeName of Object.values(STORES)) {
      await this.clear(storeName);
    }

    // Restore accounts (deduplicated by ID)
    const seenAccIds = new Set();
    for (const item of jsonData.accounts) {
      if (!item || !item.id || seenAccIds.has(item.id)) continue;
      seenAccIds.add(item.id);
      await this._putRaw(STORES.ACCOUNTS, item);
    }

    // Restore transactions (deduplicated by ID)
    const seenTxIds = new Set();
    for (const item of jsonData.transactions) {
      if (!item || !item.id || seenTxIds.has(item.id)) continue;
      seenTxIds.add(item.id);
      await this._putRaw(STORES.TRANSACTIONS, item);
    }

    // Restore categories
    if (jsonData.categories && Array.isArray(jsonData.categories) && jsonData.categories.length > 0) {
      for (const item of jsonData.categories) {
        if (item && item.name) await this._putRaw(STORES.CATEGORIES, item);
      }
    }

    // Auto-merge standard default categories ensuring none are missing
    const currentCategories = await this.getAll(STORES.CATEGORIES);
    const existingNames = new Set(currentCategories.map(c => (c.name || '').toLowerCase()));
    for (const cat of DEFAULT_CATEGORIES) {
      if (!existingNames.has((cat.name || '').toLowerCase())) {
        await this._putRaw(STORES.CATEGORIES, cat);
      }
    }

    // Restore recurring schedules
    if (jsonData.recurring && Array.isArray(jsonData.recurring)) {
      for (const item of jsonData.recurring) {
        if (item && item.id) await this._putRaw(STORES.RECURRING, item);
      }
    }

    // Restore AI audit logs
    if (jsonData.aiAuditLogs && Array.isArray(jsonData.aiAuditLogs)) {
      for (const item of jsonData.aiAuditLogs) {
        if (item && item.id) await this._putRaw(STORES.AI_AUDIT, item);
      }
    }

    // Restore settings
    if (jsonData.settings && Array.isArray(jsonData.settings)) {
      for (const item of jsonData.settings) {
        if (!item || !item.key) continue;
        await this._putRaw(STORES.SETTINGS, item);
        if (item.key === 'profile') {
          if (item.currency) lsSet('tm_currency', item.currency);
          if (item.loginId) lsSet('tm_login_id', item.loginId);
        }
      }
    }

    // Mark demo as cleaned so restored accounts aren't purged
    lsSet('tm_demo_cleaned_v2', 'true');

    this._invalidateCache();
    await this._syncStoredBalances();
    await this.saveLocalEmergencySnapshot();
    return true;
  }

  // Shared Report Builder (used by both Monthly and Custom Date-Range reports)
  _buildReport(filteredTxs, categories, accounts, meta = {}) {
    const catMap = new Map(categories.map(c => [(c.name || '').toLowerCase(), c]));
    const accMap = new Map(accounts.map(a => [a.id, a]));

    let totalIncome = 0;
    let totalExpense = 0;
    let transferCount = 0;
    let transferTotal = 0;
    let creditCardPaymentTotal = 0;
    const categoryTotals = {};
    const categoryTxList = {};
    const enrichedTransactions = [];

    filteredTxs.forEach(tx => {
      const enrichedTx = {
        ...tx,
        accountName: accMap.get(tx.accountId)?.name || 'Unknown Account',
        targetAccountName: tx.targetAccountId ? accMap.get(tx.targetAccountId)?.name : null
      };
      enrichedTransactions.push(enrichedTx);

      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalIncome = round2(totalIncome + amt);
      } else if (tx.type === 'expense' || tx.type === 'purchase') {
        totalExpense = round2(totalExpense + amt);
        const catName = tx.category || 'Other Expense';
        categoryTotals[catName] = round2((categoryTotals[catName] || 0) + amt);
        if (!categoryTxList[catName]) categoryTxList[catName] = [];
        categoryTxList[catName].push(enrichedTx);
      } else if (tx.type === 'transfer') {
        transferCount++;
        transferTotal = round2(transferTotal + amt);
      } else if (tx.type === 'credit_card_payment') {
        creditCardPaymentTotal = round2(creditCardPaymentTotal + amt);
      }
    });

    const netSavings = round2(totalIncome - totalExpense);
    const savingsRate = totalIncome > 0
      ? Number(((netSavings / totalIncome) * 100).toFixed(1))
      : 0;

    // Curated high-contrast palette so no two pie chart categories ever share the same or near-identical color
    const DISTINCT_CHART_PALETTE = [
      '#14b8a6', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6',
      '#ef4444', '#84cc16', '#06b6d4', '#f97316', '#6366f1',
      '#eab308', '#d946ef', '#10b981', '#0ea5e9', '#e11d48',
      '#a855f7', '#22c55e', '#fb7185', '#2dd4bf', '#94a3b8'
    ];

    const hexToRgb = (hex) => {
      const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
      if (!m) return null;
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const isTooClose = (hex, usedHexes) => {
      const rgb = hexToRgb(hex);
      if (!rgb) return true;
      for (const u of usedHexes) {
        if (u === hex.toLowerCase()) return true;
        const uRgb = hexToRgb(u);
        if (!uRgb) continue;
        const dist = Math.hypot(rgb[0] - uRgb[0], rgb[1] - uRgb[1], rgb[2] - uRgb[2]);
        if (dist < 60) return true;
      }
      return false;
    };

    const usedColors = [];
    const pickUniqueColor = (preferredHex, idx) => {
      const pref = (preferredHex || '').trim().toLowerCase();
      if (pref && hexToRgb(pref) && !isTooClose(pref, usedColors)) {
        usedColors.push(pref);
        return pref;
      }
      for (const cand of DISTINCT_CHART_PALETTE) {
        if (!isTooClose(cand, usedColors)) {
          usedColors.push(cand.toLowerCase());
          return cand;
        }
      }
      for (const cand of DISTINCT_CHART_PALETTE) {
        if (!usedColors.includes(cand.toLowerCase())) {
          usedColors.push(cand.toLowerCase());
          return cand;
        }
      }
      const fallback = `hsl(${(idx * 137.508) % 360}, 75%, 55%)`;
      usedColors.push(fallback);
      return fallback;
    };

    const sortedEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const categoryBreakdown = sortedEntries.map(([name, amount], idx) => {
      const catInfo = catMap.get(name.toLowerCase());
      const pct = totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(1)) : 0;
      const uniqueColor = pickUniqueColor(catInfo?.color, idx);
      return {
        name,
        amount: round2(amount),
        percentage: pct,
        count: categoryTxList[name]?.length || 0,
        icon: catInfo?.icon || '🏷️',
        color: uniqueColor,
        transactions: categoryTxList[name] || []
      };
    });

    enrichedTransactions.sort((a, b) => {
      const diff = TransactionModel.parseLocalDate(b.date || b.createdTimestamp) - TransactionModel.parseLocalDate(a.date || a.createdTimestamp);
      return diff !== 0 ? diff : (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
    });

    return {
      ...meta,
      income: totalIncome,
      expense: totalExpense,
      savings: netSavings,
      savingsRate,
      categoryBreakdown,
      transactions: enrichedTransactions,
      txCount: enrichedTransactions.length,
      transferCount,
      transferTotal,
      creditCardPaymentTotal
    };
  }

  // Monthly Financial Analytics & Categorical Aggregations
  async getMonthlyReport(year, month) {
    if (!this.db) await this.readyPromise;
    const [transactions, categories, accounts] = await Promise.all([
      this.getAll(STORES.TRANSACTIONS),
      this.getAll(STORES.CATEGORIES),
      this.getAll(STORES.ACCOUNTS)
    ]);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const filtered = transactions.filter(tx => {
      const txDate = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
      return txDate.getFullYear() === year && txDate.getMonth() === month;
    });

    return this._buildReport(filtered, categories, accounts, {
      year,
      month,
      monthName: monthNames[month]
    });
  }

  // Custom Date-Range Report (inclusive startDate..endDate, YYYY-MM-DD)
  async getRangeReport(startDate, endDate) {
    if (!this.db) await this.readyPromise;
    const [transactions, categories, accounts] = await Promise.all([
      this.getAll(STORES.TRANSACTIONS),
      this.getAll(STORES.CATEGORIES),
      this.getAll(STORES.ACCOUNTS)
    ]);

    const startObj = startDate ? TransactionModel.parseLocalDate(startDate) : null;
    const endObj = endDate ? TransactionModel.parseLocalDate(endDate) : null;

    const filtered = transactions.filter(tx => {
      const d = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
      if (isNaN(d.getTime())) return false;
      if (startObj && !isNaN(startObj.getTime()) && d < startObj) return false;
      if (endObj && !isNaN(endObj.getTime()) && d > endObj) return false;
      return true;
    });

    return this._buildReport(filtered, categories, accounts, {
      startDate: startDate || '',
      endDate: endDate || ''
    });
  }

  async getAvailableReportPeriods() {
    if (!this.db) await this.readyPromise;
    const transactions = await this.getAll(STORES.TRANSACTIONS);
    const periods = new Set();
    const now = new Date();
    periods.add(`${now.getFullYear()}-${now.getMonth()}`);
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periods.add(`${prevMonth.getFullYear()}-${prevMonth.getMonth()}`);

    transactions.forEach(tx => {
      const d = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
      if (!isNaN(d.getTime())) {
        periods.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    });

    return Array.from(periods).map(p => {
      const [year, month] = p.split('-').map(Number);
      return { year, month };
    }).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
  }
}

export const storage = new StorageEngine();
