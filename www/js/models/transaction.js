// Track-Money: Transaction Domain Model

export const TRANSACTION_TYPES = {
  EXPENSE: 'expense',
  INCOME: 'income',
  TRANSFER: 'transfer',
  CREDIT_CARD_PAYMENT: 'credit_card_payment',
  ADJUSTMENT: 'adjustment',
  REFUND: 'refund'
};

export const TRANSACTION_TYPE_LABELS = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  credit_card_payment: 'Credit Card Payment',
  adjustment: 'Adjustment',
  refund: 'Refund'
};

export const PAYMENT_METHODS = [
  'UPI',
  'Debit Card',
  'Credit Card',
  'Net Banking',
  'Cash',
  'Auto Debit',
  'BNPL',
  'Cheque',
  'Other'
];

export class TransactionModel {
  static parseLocalDate(dateValue) {
    if (!dateValue) return new Date(NaN);
    if (dateValue instanceof Date) return new Date(dateValue.getTime());
    if (typeof dateValue === 'string') {
      const m = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }
    }
    return new Date(dateValue);
  }

  static formatAmount(amount, type, currency = null) {
    const num = Number(amount) || 0;
    const storedCurrency = typeof localStorage !== 'undefined' ? localStorage.getItem('tm_currency') : null;
    const activeCurrency = currency || storedCurrency || '₹';
    const locale = activeCurrency === '₹' ? 'en-IN' : 'en-US';
    const formatted = activeCurrency + '\u00A0' + num.toLocaleString(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });

    if (type === 'income' || type === 'refund') {
      return { text: `+${formatted}`, class: 'text-success' };
    } else if (type === 'expense') {
      return { text: `-${formatted}`, class: 'text-danger' };
    } else if (type === 'credit_card_payment') {
      return { text: `-${formatted}`, class: 'text-warning' };
    } else {
      return { text: `${formatted}`, class: 'text-info' };
    }
  }

  static formatDate(dateString) {
    if (!dateString) return '';
    const date = this.parseLocalDate(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
