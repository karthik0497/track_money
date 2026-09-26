// Track-Money: Conversational Financial Query Answering Engine
// Executes local analytics queries directly on user's IndexedDB data

import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class FinancialQueryEngine {
  /**
   * Evaluates natural-language financial questions and returns formatted answer
   */
  static async answer(query, storage) {
    const q = query.toLowerCase();
    const accounts = await storage.getAccountsWithCalculatedBalances();
    const transactions = await storage.getAll('transactions');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. "What is my [Account] balance?" or "HDFC balance"
    for (const acc of accounts) {
      const accName = acc.name.toLowerCase();
      if (q.includes(accName) || (accName.includes('hdfc') && q.includes('hdfc')) || (accName.includes('sbi') && q.includes('sbi'))) {
        if (q.includes('balance') || q.includes('how much in') || q.includes('how much money')) {
          if (acc.category === 'debit') {
            return {
              text: `Your current balance in **${acc.name}** is **${AccountModel.formatCurrency(acc.currentBalance)}**.\n\n` +
                    `• Opening Balance: ${AccountModel.formatCurrency(acc.openingBalance)}\n` +
                    `• Total Income: ${AccountModel.formatCurrency(acc.totalIncome)}\n` +
                    `• Total Spent: ${AccountModel.formatCurrency(acc.totalSpent)}`,
              type: 'account_balance',
              data: acc
            };
          } else {
            return {
              text: `For your **${acc.name}**:\n\n` +
                    `• Outstanding Balance: **${AccountModel.formatCurrency(acc.currentOutstanding)}**\n` +
                    `• Available Credit: **${AccountModel.formatCurrency(acc.availableCredit)}** (Limit: ${AccountModel.formatCurrency(acc.creditLimit)})\n` +
                    `• Credit Utilization: **${acc.utilizationRate}%**\n` +
                    `• Payment Due Date: **${TransactionModel.formatDate(acc.dueDate)}**`,
              type: 'credit_balance',
              data: acc
            };
          }
        }
      }
    }

    // 2. "How much credit card debt do I have?" or "outstanding"
    if (q.includes('debt') || q.includes('outstanding') || (q.includes('credit card') && (q.includes('owe') || q.includes('total')))) {
      const creditCards = accounts.filter(a => a.category === 'credit');
      const totalDebt = creditCards.reduce((sum, a) => sum + (a.currentOutstanding || 0), 0);
      const totalLimit = creditCards.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
      const utilRate = totalLimit > 0 ? ((totalDebt / totalLimit) * 100).toFixed(1) : 0;

      const breakdown = creditCards.map(c => `• **${c.name}**: ${AccountModel.formatCurrency(c.currentOutstanding)} (Limit: ${AccountModel.formatCurrency(c.creditLimit)})`).join('\n');

      return {
        text: `Your total credit card debt / outstanding balance is **${AccountModel.formatCurrency(totalDebt)}**.\n\n` +
              `• Overall Credit Utilization: **${utilRate}%**\n\n` +
              `**Account Breakdown:**\n${breakdown}`,
        type: 'credit_summary',
        data: { totalDebt, creditCards }
      };
    }

    // 3. "How much available credit do I have?"
    if (q.includes('available credit') || q.includes('credit available') || q.includes('credit left')) {
      const creditCards = accounts.filter(a => a.category === 'credit');
      const totalAvailable = creditCards.reduce((sum, a) => sum + (a.availableCredit || 0), 0);
      const totalLimit = creditCards.reduce((sum, a) => sum + (a.creditLimit || 0), 0);

      const breakdown = creditCards.map(c => `• **${c.name}**: ${AccountModel.formatCurrency(c.availableCredit)} available`).join('\n');

      return {
        text: `You have a total of **${AccountModel.formatCurrency(totalAvailable)}** available credit across all cards (out of ${AccountModel.formatCurrency(totalLimit)} limit).\n\n${breakdown}`,
        type: 'available_credit',
        data: { totalAvailable, creditCards }
      };
    }

    // 4. "What was my biggest expense this month?" or "highest expense"
    if (q.includes('biggest expense') || q.includes('highest expense') || q.includes('largest expense')) {
      const thisMonthExpenses = transactions.filter(tx => {
        const d = new Date(tx.date || tx.createdTimestamp);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth && tx.type === 'expense';
      });

      if (thisMonthExpenses.length === 0) {
        return { text: 'You have not recorded any expenses for this month yet.', type: 'info' };
      }

      thisMonthExpenses.sort((a, b) => Number(b.amount) - Number(a.amount));
      const biggest = thisMonthExpenses[0];

      return {
        text: `Your biggest expense this month is **${AccountModel.formatCurrency(biggest.amount)}** for **${biggest.description || biggest.category}** on ${TransactionModel.formatDate(biggest.date)}.\n\n` +
              `• Category: ${biggest.category} (${biggest.subcategory || 'General'})\n` +
              `• Notes: ${biggest.notes || 'None'}`,
        type: 'biggest_expense',
        data: biggest
      };
    }

    // 5. "How much salary did I receive this year?" or "total salary"
    if (q.includes('salary') && (q.includes('year') || q.includes('received') || q.includes('total'))) {
      const salaryTxs = transactions.filter(tx => {
        const d = new Date(tx.date || tx.createdTimestamp);
        return d.getFullYear() === currentYear && (tx.category === 'Salary' || (tx.description || '').toLowerCase().includes('salary'));
      });
      const totalSalary = salaryTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);

      return {
        text: `You have received a total of **${AccountModel.formatCurrency(totalSalary)}** in salary for ${currentYear} across ${salaryTxs.length} credit entries.`,
        type: 'salary_summary',
        data: { totalSalary, count: salaryTxs.length }
      };
    }

    // 6. Category query: "How much did I spend on food?" or "shopping" or "amazon"
    const categories = ['food', 'shopping', 'transportation', 'fuel', 'housing & rent', 'bills & utilities', 'entertainment', 'travel', 'healthcare', 'education', 'subscriptions', 'investments', 'amazon', 'petrol', 'rent'];
    for (const cat of categories) {
      if (q.includes(cat)) {
        const matchingTxs = transactions.filter(tx => {
          const d = new Date(tx.date || tx.createdTimestamp);
          const isThisMonth = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
          const matchCat = (tx.category || '').toLowerCase().includes(cat) ||
                           (tx.subcategory || '').toLowerCase().includes(cat) ||
                           (tx.description || '').toLowerCase().includes(cat);
          return isThisMonth && tx.type === 'expense' && matchCat;
        });

        const totalCat = matchingTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
        return {
          text: `You have spent **${AccountModel.formatCurrency(totalCat)}** on **${cat.toUpperCase()}** this month across ${matchingTxs.length} transactions.`,
          type: 'category_spending',
          data: { category: cat, total: totalCat, count: matchingTxs.length }
        };
      }
    }

    // 7. "How much did I spend this month?" or "expenses for September"
    if (q.includes('spend this month') || q.includes('spent this month') || q.includes('expenses for september') || q.includes('total spent')) {
      const thisMonthExpenses = transactions.filter(tx => {
        const d = new Date(tx.date || tx.createdTimestamp);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth && tx.type === 'expense';
      });
      const totalSpent = thisMonthExpenses.reduce((sum, tx) => sum + Number(tx.amount), 0);

      const thisMonthIncome = transactions.filter(tx => {
        const d = new Date(tx.date || tx.createdTimestamp);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth && tx.type === 'income';
      }).reduce((sum, tx) => sum + Number(tx.amount), 0);

      const savings = thisMonthIncome - totalSpent;

      return {
        text: `Here is your financial summary for this month:\n\n` +
              `• **Total Spent**: ${AccountModel.formatCurrency(totalSpent)}\n` +
              `• **Total Income**: ${AccountModel.formatCurrency(thisMonthIncome)}\n` +
              `• **Net Savings**: ${AccountModel.formatCurrency(savings)} (${thisMonthIncome > 0 ? ((savings / thisMonthIncome) * 100).toFixed(1) : 0}% savings rate)`,
        type: 'monthly_summary',
        data: { totalSpent, thisMonthIncome, savings }
      };
    }

    // 8. "What is my net position?" or "net worth"
    if (q.includes('net position') || q.includes('net worth') || q.includes('total assets')) {
      const metrics = await storage.getDashboardMetrics();
      return {
        text: `Your current overall Net Position is **${AccountModel.formatCurrency(metrics.netPosition)}**.\n\n` +
              `• Total Assets (Bank/Cash): **${AccountModel.formatCurrency(metrics.totalAssets)}**\n` +
              `• Total Liabilities (Credit/BNPL): **${AccountModel.formatCurrency(metrics.totalLiabilities)}**`,
        type: 'net_position',
        data: metrics
      };
    }

    // Fallback: General AI finance help
    return {
      text: "I can help you record transactions or answer questions about your money!\n\n" +
            "**Try asking me:**\n" +
            "• *\"How much did I spend this month?\"*\n" +
            "• *\"What is my HDFC balance?\"*\n" +
            "• *\"How much credit card debt do I have?\"*\n" +
            "• *\"What was my biggest expense this month?\"*\n" +
            "• *\"I spent ₹500 for lunch from HDFC bank\"*",
      type: 'help'
    };
  }
}
