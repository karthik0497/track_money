// Track-Money: Local Embedded Database Schema & Seed Data
// Uses IndexedDB with full ACID transaction guarantees

export const DB_NAME = 'TrackMoneyDB';
export const DB_VERSION = 2;

export const STORES = {
  USERS: 'users',
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  SUBCATEGORIES: 'subcategories',
  RECURRING: 'recurring_transactions',
  TRANSFERS: 'transfers',
  AI_AUDIT: 'ai_audit_logs',
  SETTINGS: 'app_settings'
};

export const DEFAULT_CATEGORIES = [
  // Expense Categories with Subcategories
  {
    name: 'Food',
    type: 'expense',
    icon: '🍔',
    color: '#f59e0b',
    subcategories: ['Restaurant', 'Groceries', 'Delivery', 'Coffee', 'Snacks']
  },
  {
    name: 'Shopping',
    type: 'expense',
    icon: '🛍️',
    color: '#ec4899',
    subcategories: ['Clothing', 'Electronics', 'Amazon', 'Household', 'Footwear']
  },
  {
    name: 'Transportation',
    type: 'expense',
    icon: '🚗',
    color: '#3b82f6',
    subcategories: ['Fuel', 'Taxi / Uber', 'Metro / Bus', 'Vehicle Service', 'Parking']
  },
  {
    name: 'Housing & Rent',
    type: 'expense',
    icon: '🏠',
    color: '#8b5cf6',
    subcategories: ['House Rent', 'Maintenance', 'Repairs', 'Furniture']
  },
  {
    name: 'Bills & Utilities',
    type: 'expense',
    icon: '⚡',
    color: '#06b6d4',
    subcategories: ['Electricity', 'Water', 'LPG Gas', 'Mobile Recharge', 'Broadband Wi-Fi']
  },
  {
    name: 'Entertainment',
    type: 'expense',
    icon: '🍿',
    color: '#f43f5e',
    subcategories: ['Movies', 'Streaming', 'Gaming', 'Concerts & Events', 'Hobbies']
  },
  {
    name: 'Travel & Trips',
    type: 'expense',
    icon: '✈️',
    color: '#14b8a6',
    subcategories: ['Flights', 'Hotels', 'Trains', 'Sightseeing', 'Food & Travel']
  },
  {
    name: 'Healthcare',
    type: 'expense',
    icon: '💊',
    color: '#ef4444',
    subcategories: ['Doctor Consult', 'Medicines', 'Health Insurance', 'Lab Tests', 'Dental']
  },
  {
    name: 'Education',
    type: 'expense',
    icon: '📚',
    color: '#6366f1',
    subcategories: ['Courses', 'Books', 'Tuition', 'Certifications']
  },
  {
    name: 'Subscriptions',
    type: 'expense',
    icon: '🔄',
    color: '#a855f7',
    subcategories: ['Netflix', 'Spotify', 'Amazon Prime', 'YouTube Premium', 'Software / AI']
  },
  {
    name: 'Investments',
    type: 'expense',
    icon: '📈',
    color: '#10b981',
    subcategories: ['Mutual Fund SIP', 'Direct Stocks', 'Gold', 'PPF', 'Crypto']
  },
  {
    name: 'Personal & Care',
    type: 'expense',
    icon: '✨',
    color: '#d946ef',
    subcategories: ['Salon & Spa', 'Gym & Fitness', 'Cosmetics', 'Gifts']
  },
  {
    name: 'Other Expense',
    type: 'expense',
    icon: '🏷️',
    color: '#64748b',
    subcategories: ['General', 'Donations', 'Cash Withdrawal', 'Miscellaneous']
  },

  // Income Categories with Subcategories
  {
    name: 'Salary',
    type: 'income',
    icon: '💼',
    color: '#10b981',
    subcategories: ['Monthly Salary', 'Bonus', 'Overtime', 'Incentives']
  },
  {
    name: 'Freelance',
    type: 'income',
    icon: '💻',
    color: '#3b82f6',
    subcategories: ['Client Projects', 'Consulting', 'Design Work', 'Writing']
  },
  {
    name: 'Business',
    type: 'income',
    icon: '🏢',
    color: '#8b5cf6',
    subcategories: ['Sales Revenue', 'Services', 'Partnership Share']
  },
  {
    name: 'Interest',
    type: 'income',
    icon: '🏦',
    color: '#06b6d4',
    subcategories: ['Savings Account Interest', 'FD Interest', 'Bonds']
  },
  {
    name: 'Dividend',
    type: 'income',
    icon: '📊',
    color: '#14b8a6',
    subcategories: ['Stock Dividend', 'Mutual Fund Dividend']
  },
  {
    name: 'Cashback & Rewards',
    type: 'income',
    icon: '🎁',
    color: '#f59e0b',
    subcategories: ['Credit Card Rewards', 'UPI Cashback', 'Discount Refunds']
  },
  {
    name: 'Refund',
    type: 'income',
    icon: '↩️',
    color: '#ec4899',
    subcategories: ['Ecommerce Return', 'Flight Cancellation', 'Tax Refund']
  },
  {
    name: 'Other Income',
    type: 'income',
    icon: '💰',
    color: '#10b981',
    subcategories: ['Gifts Received', 'Rental Income', 'Miscellaneous']
  }
];

export const DEFAULT_ACCOUNTS = [
  // Debit / Asset Accounts
  {
    id: 'acc_hdfc_bank',
    name: 'HDFC Bank',
    category: 'debit', // debit or credit
    type: 'Bank Account',
    openingBalance: 50000,
    currentBalance: 50000,
    currency: 'INR',
    description: 'Primary Salary & Daily Spend Account',
    color: '#1e40af',
    icon: '🏦',
    createdAt: new Date('2026-01-01').toISOString()
  },
  {
    id: 'acc_sbi_savings',
    name: 'SBI Savings',
    category: 'debit',
    type: 'Savings Account',
    openingBalance: 120000,
    currentBalance: 120000,
    currency: 'INR',
    description: 'Emergency Fund & Fixed Savings',
    color: '#047857',
    icon: '🏛️',
    createdAt: new Date('2026-01-01').toISOString()
  },
  {
    id: 'acc_demat',
    name: 'Demat Account',
    category: 'debit',
    type: 'Demat Account',
    openingBalance: 75000,
    currentBalance: 75000,
    currency: 'INR',
    description: 'Stocks & Mutual Fund Holdings',
    color: '#7c3aed',
    icon: '📈',
    createdAt: new Date('2026-01-01').toISOString()
  },
  {
    id: 'acc_cash',
    name: 'Cash in Wallet',
    category: 'debit',
    type: 'Cash',
    openingBalance: 5000,
    currentBalance: 5000,
    currency: 'INR',
    description: 'Physical Pocket Cash',
    color: '#b45309',
    icon: '💵',
    createdAt: new Date('2026-01-01').toISOString()
  },

  // Credit / Liability Accounts
  {
    id: 'acc_hdfc_cc',
    name: 'HDFC Credit Card',
    category: 'credit',
    type: 'Credit Card',
    creditLimit: 100000,
    openingOutstanding: 12500,
    currentOutstanding: 12500,
    availableCredit: 87500,
    billingCycle: '15th of month',
    dueDate: '2026-10-05',
    interestRate: 3.5,
    currency: 'INR',
    description: 'Regalia Gold Rewards Card',
    color: '#dc2626',
    icon: '💳',
    createdAt: new Date('2026-01-01').toISOString()
  },
  {
    id: 'acc_amazon_pay',
    name: 'Amazon Pay Later',
    category: 'credit',
    type: 'BNPL',
    creditLimit: 30000,
    openingOutstanding: 3500,
    currentOutstanding: 3500,
    availableCredit: 26500,
    billingCycle: 'Last day of month',
    dueDate: '2026-10-10',
    interestRate: 0,
    currency: 'INR',
    description: 'Monthly Online Shopping BNPL',
    color: '#d97706',
    icon: '📦',
    createdAt: new Date('2026-01-01').toISOString()
  }
];

export const DEFAULT_RECURRING = [
  {
    id: 'rec_salary',
    title: 'Monthly Job Salary',
    accountId: 'acc_hdfc_bank',
    type: 'income',
    amount: 85000,
    category: 'Salary',
    subcategory: 'Monthly Salary',
    frequency: 'Monthly',
    dayOfMonth: 1,
    nextDueDate: '2026-10-01',
    status: 'active'
  },
  {
    id: 'rec_rent',
    title: 'House Rent',
    accountId: 'acc_hdfc_bank',
    type: 'expense',
    amount: 22000,
    category: 'Housing & Rent',
    subcategory: 'House Rent',
    frequency: 'Monthly',
    dayOfMonth: 5,
    nextDueDate: '2026-10-05',
    status: 'active'
  },
  {
    id: 'rec_netflix',
    title: 'Netflix Premium',
    accountId: 'acc_hdfc_cc',
    type: 'expense',
    amount: 649,
    category: 'Subscriptions',
    subcategory: 'Netflix',
    frequency: 'Monthly',
    dayOfMonth: 18,
    nextDueDate: '2026-10-18',
    status: 'active'
  },
  {
    id: 'rec_sip',
    title: 'Nifty 50 Index SIP',
    accountId: 'acc_hdfc_bank',
    type: 'expense',
    amount: 10000,
    category: 'Investments',
    subcategory: 'Mutual Fund SIP',
    frequency: 'Monthly',
    dayOfMonth: 10,
    nextDueDate: '2026-10-10',
    status: 'active'
  }
];

export const DEFAULT_TRANSACTIONS = [
  {
    id: 'tx_001',
    accountId: 'acc_hdfc_bank',
    type: 'income',
    amount: 85000,
    category: 'Salary',
    subcategory: 'Monthly Salary',
    description: 'Monthly Salary Credited',
    date: '2026-09-01',
    paymentMethod: 'Bank Transfer',
    notes: 'August month salary payout',
    createdTimestamp: Date.now() - 21 * 86400000
  },
  {
    id: 'tx_002',
    accountId: 'acc_hdfc_bank',
    type: 'expense',
    amount: 22000,
    category: 'Housing & Rent',
    subcategory: 'House Rent',
    description: 'Flat Rent for September',
    date: '2026-09-05',
    paymentMethod: 'UPI',
    notes: 'Paid via GPay to Owner',
    createdTimestamp: Date.now() - 17 * 86400000
  },
  {
    id: 'tx_003',
    accountId: 'acc_hdfc_bank',
    type: 'expense',
    amount: 10000,
    category: 'Investments',
    subcategory: 'Mutual Fund SIP',
    description: 'Monthly Index SIP Auto-debit',
    date: '2026-09-10',
    paymentMethod: 'Auto Debit',
    notes: 'Groww Mutual Fund SIP',
    createdTimestamp: Date.now() - 12 * 86400000
  },
  {
    id: 'tx_004',
    accountId: 'acc_hdfc_cc',
    type: 'expense',
    amount: 3450,
    category: 'Food',
    subcategory: 'Restaurant',
    description: 'Family Weekend Dinner at Barbeque Nation',
    date: '2026-09-14',
    paymentMethod: 'Credit Card',
    notes: 'Celebration dinner',
    createdTimestamp: Date.now() - 8 * 86400000
  },
  {
    id: 'tx_005',
    accountId: 'acc_hdfc_cc',
    type: 'expense',
    amount: 4200,
    category: 'Shopping',
    subcategory: 'Amazon',
    description: 'Noise Cancelling Headphones on Amazon',
    date: '2026-09-16',
    paymentMethod: 'Credit Card',
    notes: 'Amazon Great Indian Sale prep',
    createdTimestamp: Date.now() - 6 * 86400000
  },
  {
    id: 'tx_006',
    accountId: 'acc_sbi_savings',
    type: 'expense',
    amount: 1800,
    category: 'Transportation',
    subcategory: 'Fuel',
    description: 'Full Tank Petrol',
    date: '2026-09-18',
    paymentMethod: 'Debit Card',
    notes: 'Shell Petrol Pump',
    createdTimestamp: Date.now() - 4 * 86400000
  },
  {
    id: 'tx_007',
    accountId: 'acc_hdfc_bank',
    type: 'expense',
    amount: 1250,
    category: 'Bills & Utilities',
    subcategory: 'Broadband Wi-Fi',
    description: 'Airtel Fiber Broadband Bill',
    date: '2026-09-19',
    paymentMethod: 'UPI',
    notes: 'Monthly high speed internet',
    createdTimestamp: Date.now() - 3 * 86400000
  },
  {
    id: 'tx_008',
    accountId: 'acc_cash',
    type: 'expense',
    amount: 450,
    category: 'Food',
    subcategory: 'Snacks',
    description: 'Office Snacks & Evening Tea',
    date: '2026-09-20',
    paymentMethod: 'Cash',
    notes: 'Paid cash at stall',
    createdTimestamp: Date.now() - 2 * 86400000
  },
  {
    id: 'tx_009',
    accountId: 'acc_amazon_pay',
    type: 'expense',
    amount: 1650,
    category: 'Shopping',
    subcategory: 'Clothing',
    description: 'Cotton Shirts from Myntra',
    date: '2026-09-21',
    paymentMethod: 'BNPL',
    notes: 'Amazon Pay Later checkout',
    createdTimestamp: Date.now() - 1 * 86400000
  },
  {
    id: 'tx_010',
    accountId: 'acc_hdfc_bank',
    type: 'credit_card_payment',
    targetAccountId: 'acc_hdfc_cc',
    amount: 5000,
    category: 'Bills & Utilities',
    subcategory: 'Credit Card Bill',
    description: 'Part payment towards HDFC Credit Card bill',
    date: '2026-09-21',
    paymentMethod: 'Net Banking',
    notes: 'Card payment transaction',
    createdTimestamp: Date.now() - 1 * 86400000
  }
];
