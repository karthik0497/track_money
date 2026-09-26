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
  static formatAmount(amount, type, currency = '₹') {
    const num = Number(amount) || 0;
    const formatted = currency + ' ' + num.toLocaleString('en-IN', {
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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
