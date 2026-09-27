// Track-Money: IndexedDB Local Relational Storage Engine
import { DB_NAME, DB_VERSION, STORES, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_TRANSACTIONS, DEFAULT_RECURRING } from './schema.js';

class StorageEngine {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.readyPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
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

    await this.seedInitialDataIfEmpty();
    return this.db;
  }

  async seedInitialDataIfEmpty() {
    const existingAccounts = await this.getAll(STORES.ACCOUNTS);
    if (existingAccounts.length === 0) {
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
    }

    const existingTx = await this.getAll(STORES.TRANSACTIONS);
    if (existingTx.length === 0) {
      console.log('Seeding initial Track-Money transactions...');
      for (const tx of DEFAULT_TRANSACTIONS) {
        await this.put(STORES.TRANSACTIONS, tx);
      }
    }

    const existingRec = await this.getAll(STORES.RECURRING);
    if (existingRec.length === 0) {
      console.log('Seeding initial Track-Money recurring schedules...');
      for (const rec of DEFAULT_RECURRING) {
        await this.put(STORES.RECURRING, rec);
      }
    }

    const profile = await this.get(STORES.SETTINGS, 'profile');
    if (!profile) {
      const defaultLoginId = localStorage.getItem('tm_login_id') || 'User';
      await this.put(STORES.SETTINGS, {
        key: 'profile',
        loginId: defaultLoginId,
        name: defaultLoginId,
        currency: localStorage.getItem('tm_currency') || '₹',
        pinEnabled: false,
        pinCode: null,
        createdDate: new Date().toISOString()
      });
    }
  }

  // Profile & User Identity Management (100% Local-First)
  async getProfile() {
    if (!this.db) await this.readyPromise;
    const profile = await this.get(STORES.SETTINGS, 'profile');
    return profile || {
      key: 'profile',
      loginId: localStorage.getItem('tm_login_id') || 'User',
      name: localStorage.getItem('tm_login_id') || 'User',
      currency: localStorage.getItem('tm_currency') || '₹',
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
      localStorage.setItem('tm_currency', updated.currency);
    }
    if (updated.loginId) {
      localStorage.setItem('tm_login_id', updated.loginId);
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

  async put(storeName, value) {
    if (!this.db) await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    if (!this.db) await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    if (!this.db) await this.readyPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Account Operations & Dynamic Balance Calculations
  async getAccountsWithCalculatedBalances() {
    if (!this.db) await this.readyPromise;
    const accounts = await this.getAll(STORES.ACCOUNTS);
    const transactions = await this.getAll(STORES.TRANSACTIONS);

    return accounts.map(acc => {
      const accCopy = { ...acc };
      let totalIncome = 0;
      let totalSpent = 0;
      let totalTransfersIn = 0;
      let totalTransfersOut = 0;
      let totalPaymentsMade = 0;
      let totalRefunds = 0;

      // Scan all transactions affecting this account
      transactions.forEach(tx => {
        const amt = Number(tx.amount) || 0;

        // Debit / Asset Account Logic
        if (acc.category === 'debit') {
          if (tx.accountId === acc.id) {
            if (tx.type === 'income') {
              totalIncome += amt;
            } else if (tx.type === 'expense') {
              totalSpent += amt;
            } else if (tx.type === 'transfer') {
              totalTransfersOut += amt;
            } else if (tx.type === 'credit_card_payment') {
              totalSpent += amt; // paid from bank to card
            } else if (tx.type === 'refund') {
              totalRefunds += amt;
            } else if (tx.type === 'adjustment') {
              totalIncome += amt; // adjustment can be positive or handled
            }
          }
          // If this account was target of a transfer
          if (tx.targetAccountId === acc.id && (tx.type === 'transfer' || tx.type === 'adjustment')) {
            totalTransfersIn += amt;
          }
        }

        // Credit / Liability Account Logic
        if (acc.category === 'credit') {
          if (tx.accountId === acc.id) {
            if (tx.type === 'expense' || tx.type === 'purchase') {
              totalSpent += amt;
            } else if (tx.type === 'refund') {
              totalRefunds += amt;
            }
          }
          // If this credit card received a payment
          if (tx.targetAccountId === acc.id && tx.type === 'credit_card_payment') {
            totalPaymentsMade += amt;
          }
        }
      });

      if (acc.category === 'debit') {
        const opening = Number(acc.openingBalance) || 0;
        accCopy.totalIncome = totalIncome + totalRefunds;
        accCopy.totalSpent = totalSpent + totalTransfersOut;
        accCopy.currentBalance = opening + totalIncome + totalTransfersIn + totalRefunds - totalSpent - totalTransfersOut;
      } else {
        const opening = Number(acc.openingOutstanding) || 0;
        const limit = Number(acc.creditLimit) || 0;
        accCopy.totalSpent = totalSpent;
        accCopy.paymentsMade = totalPaymentsMade;
        // Outstanding = Opening + Purchases - Payments - Refunds
        const outstanding = Math.max(0, opening + totalSpent - totalPaymentsMade - totalRefunds);
        accCopy.currentOutstanding = outstanding;
        accCopy.availableCredit = Math.max(0, limit - outstanding);
        accCopy.utilizationRate = limit > 0 ? ((outstanding / limit) * 100).toFixed(1) : 0;
      }

      return accCopy;
    });
  }

  async getAccountById(id) {
    const accounts = await this.getAccountsWithCalculatedBalances();
    return accounts.find(a => a.id === id) || null;
  }

  // Financial Position & Dashboard Metrics
  async getDashboardMetrics() {
    const accounts = await this.getAccountsWithCalculatedBalances();
    const transactions = await this.getAll(STORES.TRANSACTIONS);

    // Sum Assets (Debit Accounts)
    const debitAccounts = accounts.filter(a => a.category === 'debit');
    const totalAssets = debitAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    // Sum Liabilities (Credit Accounts)
    const creditAccounts = accounts.filter(a => a.category === 'credit');
    const totalLiabilities = creditAccounts.reduce((sum, a) => sum + (a.currentOutstanding || 0), 0);
    const totalCreditLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
    const totalCreditAvailable = creditAccounts.reduce((sum, a) => sum + (a.availableCredit || 0), 0);
    const overallCreditUtilization = totalCreditLimit > 0 ? ((totalLiabilities / totalCreditLimit) * 100).toFixed(1) : 0;

    const netPosition = totalAssets - totalLiabilities;

    // Current month calculations
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    const categorySpending = {};

    transactions.forEach(tx => {
      const txDate = new Date(tx.date || tx.createdTimestamp);
      const isThisMonth = txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
      const amt = Number(tx.amount) || 0;

      if (isThisMonth) {
        if (tx.type === 'income') {
          thisMonthIncome += amt;
        } else if (tx.type === 'expense') {
          thisMonthExpense += amt;
          const cat = tx.category || 'Other Expense';
          categorySpending[cat] = (categorySpending[cat] || 0) + amt;
        }
      }
    });

    const savingsThisMonth = thisMonthIncome - thisMonthExpense;
    const savingsRate = thisMonthIncome > 0 ? Math.max(0, ((savingsThisMonth / thisMonthIncome) * 100)).toFixed(1) : 0;

    // Upcoming credit card payments
    const upcomingPayments = creditAccounts
      .filter(a => (a.currentOutstanding || 0) > 0 && a.dueDate)
      .map(a => ({
        id: a.id,
        accountName: a.name,
        amountDue: a.currentOutstanding,
        dueDate: a.dueDate,
        billingCycle: a.billingCycle
      }))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Sort transactions by date descending
    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date || b.createdTimestamp) - new Date(a.date || a.createdTimestamp))
      .slice(0, 10);

    return {
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
  }

  // Transactions with filtering
  async getFilteredTransactions(filters = {}) {
    const transactions = await this.getAll(STORES.TRANSACTIONS);
    const accounts = await this.getAll(STORES.ACCOUNTS);
    const accMap = new Map(accounts.map(a => [a.id, a]));

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
          if (!matchDesc && !matchNotes && !matchCat && !matchSubcat && !matchAcc) {
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

        // Date range filter
        if (filters.startDate) {
          if (new Date(tx.date) < new Date(filters.startDate)) {
            return false;
          }
        }
        if (filters.endDate) {
          if (new Date(tx.date) > new Date(filters.endDate)) {
            return false;
          }
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
      .sort((a, b) => new Date(b.date || b.createdTimestamp) - new Date(a.date || a.createdTimestamp));
  }

  // Create Transaction with Audit Validation
  async addTransaction(txData) {
    const id = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const tx = {
      id,
      accountId: txData.accountId,
      targetAccountId: txData.targetAccountId || null,
      type: txData.type || 'expense',
      amount: Number(txData.amount) || 0,
      category: txData.category || 'Other Expense',
      subcategory: txData.subcategory || '',
      description: txData.description || 'Transaction',
      date: txData.date || new Date().toISOString().split('T')[0],
      paymentMethod: txData.paymentMethod || 'Other',
      notes: txData.notes || '',
      createdTimestamp: txData.createdTimestamp || Date.now(),
      aiAuditId: txData.aiAuditId || null
    };

    await this.put(STORES.TRANSACTIONS, tx);
    return tx;
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

  // Export and Backup
  async exportAllData() {
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
    if (!jsonData || !jsonData.accounts || !jsonData.transactions) {
      throw new Error('Invalid Track-Money backup JSON file format.');
    }

    // Clear and restore
    await this.clear(STORES.ACCOUNTS);
    await this.clear(STORES.TRANSACTIONS);
    await this.clear(STORES.CATEGORIES);
    await this.clear(STORES.RECURRING);

    for (const item of jsonData.accounts) await this.put(STORES.ACCOUNTS, item);
    for (const item of jsonData.transactions) await this.put(STORES.TRANSACTIONS, item);
    if (jsonData.categories) {
      for (const item of jsonData.categories) await this.put(STORES.CATEGORIES, item);
    }
    if (jsonData.recurring) {
      for (const item of jsonData.recurring) await this.put(STORES.RECURRING, item);
    }
    if (jsonData.settings) {
      for (const item of jsonData.settings) await this.put(STORES.SETTINGS, item);
    }
    return true;
  }
}

export const storage = new StorageEngine();
