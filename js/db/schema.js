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
  // User Everyday Expense Categories
  {
    name: 'Bike Expense',
    type: 'expense',
    icon: '🏍️',
    color: '#f97316',
    subcategories: ['Petrol / Fuel', 'Bike Service', 'Repairs & Parts', 'Insurance', 'Puncture & Air', 'Accessories']
  },
  {
    name: 'Car Expense',
    type: 'expense',
    icon: '🚗',
    color: '#2563eb',
    subcategories: ['Petrol / Diesel', 'Car Wash & Detailing', 'Service & Maintenance', 'Toll & FASTag', 'Parking', 'Car Insurance']
  },
  {
    name: 'Travel',
    type: 'expense',
    icon: '🧳',
    color: '#06b6d4',
    subcategories: ['Bus & Metro', 'Train / IRCTC', 'Flight Tickets', 'Hotel & Stay', 'Auto / Taxi', 'Trip Expenses']
  },
  {
    name: 'Outside Food',
    type: 'expense',
    icon: '🍽️',
    color: '#e11d48',
    subcategories: ['Restaurant Dining', 'Street Food & Chaat', 'Office Lunch', 'Tea & Coffee / Snacks', 'Weekend Outing']
  },
  {
    name: 'Online Food',
    type: 'expense',
    icon: '🛵',
    color: '#ea580c',
    subcategories: ['Zomato', 'Swiggy', 'Blinkit / Instamart', 'Pizza / Burger Delivery', 'Late Night Food']
  },
  {
    name: 'Water Bill',
    type: 'expense',
    icon: '💧',
    color: '#0284c7',
    subcategories: ['Monthly Water Bill', 'Water Tanker', 'Drinking Water Cans', 'Plumbing Maintenance']
  },
  {
    name: 'Current Bill',
    type: 'expense',
    icon: '⚡',
    color: '#eab308',
    subcategories: ['Monthly Current Bill', 'Meter Charges', 'Inverter / Power Backup', 'Electricity Deposit']
  },
  {
    name: 'Giving to Dad',
    type: 'expense',
    icon: '👨‍👧‍👦',
    color: '#8b5cf6',
    subcategories: ['Monthly Allowance', 'Medicines & Health', 'Home Maintenance', 'Festival & Gifts', 'Family Support']
  },
  {
    name: 'Car EMI',
    type: 'expense',
    icon: '🚘',
    color: '#ec4899',
    subcategories: ['Monthly Car Loan EMI', 'Loan Prepayment', 'Down Payment', 'Processing & Finance Fees']
  },

  // General Expense Categories with Subcategories
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

export const DEFAULT_ACCOUNTS = [];

export const DEFAULT_RECURRING = [];

export const DEFAULT_TRANSACTIONS = [];
