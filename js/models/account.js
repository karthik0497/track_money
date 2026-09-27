// Track-Money: Account Domain Model

export const ACCOUNT_TYPES = {
  DEBIT: [
    'Bank Account',
    'Savings Account',
    'PF Account',
    'Demat Account',
    'Cash',
    'Current Account',
    'Fixed Deposit',
    'Custom Asset'
  ],
  CREDIT: [
    'Credit Card',
    'Amazon Pay Later',
    'BNPL',
    'Personal Credit',
    'Personal Loan',
    'Custom Credit'
  ]
};

export class AccountModel {
  static create(data) {
    const isCredit = data.category === 'credit' || ACCOUNT_TYPES.CREDIT.includes(data.type);
    const category = isCredit ? 'credit' : 'debit';
    const id = data.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    if (category === 'debit') {
      return {
        id,
        name: data.name.trim(),
        category: 'debit',
        type: data.type || 'Bank Account',
        openingBalance: Number(data.openingBalance) || 0,
        currentBalance: Number(data.openingBalance) || 0,
        currency: data.currency || 'INR',
        description: data.description || '',
        color: data.color || '#3b82f6',
        icon: data.icon || (data.type === 'Cash' ? '💵' : '🏦'),
        createdAt: new Date().toISOString()
      };
    } else {
      return {
        id,
        name: data.name.trim(),
        category: 'credit',
        type: data.type || 'Credit Card',
        creditLimit: Number(data.creditLimit) || 0,
        openingOutstanding: Number(data.openingOutstanding) || 0,
        currentOutstanding: Number(data.openingOutstanding) || 0,
        availableCredit: Math.max(0, (Number(data.creditLimit) || 0) - (Number(data.openingOutstanding) || 0)),
        billingCycle: data.billingCycle || '1st of month',
        dueDate: data.dueDate || '',
        interestRate: Number(data.interestRate) || 0,
        currency: data.currency || 'INR',
        description: data.description || '',
        color: data.color || '#dc2626',
        icon: data.icon || '💳',
        createdAt: new Date().toISOString()
      };
    }
  }

  static formatCurrency(amount, currency = null) {
    const num = Number(amount) || 0;
    const activeCurrency = currency || localStorage.getItem('tm_currency') || '₹';
    // Format according to standard currency locale
    const locale = activeCurrency === '₹' ? 'en-IN' : 'en-US';
    return activeCurrency + ' ' + num.toLocaleString(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });
  }
}
