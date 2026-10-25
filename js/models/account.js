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
        dueDay: AccountModel.parseDueDay(data),
        dueDate: data.dueDate || `${AccountModel.parseDueDay(data)}th of month`,
        interestRate: Number(data.interestRate) || 0,
        currency: data.currency || 'INR',
        description: data.description || '',
        color: data.color || '#dc2626',
        icon: data.icon || '💳',
        createdAt: new Date().toISOString()
      };
    }
  }

  static parseDueDay(account) {
    if (!account) return 20;
    if (account.dueDay && Number(account.dueDay) >= 1 && Number(account.dueDay) <= 31) {
      return Number(account.dueDay);
    }
    const dueStr = String(account.dueDate || '').trim();
    if (dueStr) {
      const isoMatch = dueStr.match(/^\d{4}-\d{2}-(\d{1,2})/);
      if (isoMatch) {
        return parseInt(isoMatch[1], 10);
      }
      const numMatch = dueStr.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i);
      if (numMatch) {
        const d = parseInt(numMatch[1], 10);
        if (d >= 1 && d <= 31) return d;
      }
      const parsedDate = new Date(dueStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.getDate();
      }
    }
    return 20;
  }

  /**
   * Calculates the exact Next Payment Due Date for a credit account.
   * Never needs to be updated every month: automatically rolls over to the current or next month.
   */
  static getNextDueDate(account, referenceDate = new Date()) {
    const dueDay = this.parseDueDay(account);
    const now = new Date(referenceDate);
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDate = now.getDate();

    let targetYear = year;
    let targetMonth = month;

    if (todayDate > dueDay) {
      const isRecentlyOverdue = (todayDate - dueDay) <= 7 && (account.currentOutstanding || 0) > 0;
      if (!isRecentlyOverdue) {
        targetMonth = month + 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear = year + 1;
        }
      }
    }

    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const validDay = Math.min(dueDay, daysInTargetMonth);

    const nextDueDate = new Date(targetYear, targetMonth, validDay, 23, 59, 59);
    const todayMidnight = new Date(year, month, todayDate);
    const dueMidnight = new Date(targetYear, targetMonth, validDay);
    const diffMs = dueMidnight.getTime() - todayMidnight.getTime();
    const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

    return {
      date: nextDueDate,
      dateString: nextDueDate.toISOString().split('T')[0],
      dueDay: validDay,
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
      isDueToday: daysUntilDue === 0,
      isDueSoon: daysUntilDue >= 0 && daysUntilDue <= 10
    };
  }

  static formatCurrency(amount, currency = null) {
    const num = Number(amount) || 0;
    const activeCurrency = currency || localStorage.getItem('tm_currency') || '₹';
    // Format according to standard currency locale
    const locale = activeCurrency === '₹' ? 'en-IN' : 'en-US';
    return activeCurrency + '\u00A0' + num.toLocaleString(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });
  }
}
