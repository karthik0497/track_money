// Track-Money: Conversational Financial Query & Intelligence Engine
// Executes real-data analytics, trend detection, anomaly detection, savings advice, and exact DB queries locally.

import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';
import { FinancialInsightsEngine } from './insights.js';

export class FinancialQueryEngine {
  /**
   * Evaluates natural-language financial questions & advisory prompts using live DB data.
   */
  static async answer(query, storage) {
    const q = (query || '').toLowerCase().trim();
    const [accounts, transactions, categories, insights] = await Promise.all([
      storage.getAccountsWithCalculatedBalances(),
      storage.getAll('transactions'),
      storage.getAll('categories'),
      storage.getFinancialInsights()
    ]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. Unusual Spending / Anomalies / Spikes / Duplicates
    if (
      q.includes('unusual') || q.includes('anomal') || q.includes('outlier') ||
      q.includes('spike') || q.includes('duplicate') || q.includes('weird') ||
      q.includes('suspicious')
    ) {
      return {
        text: FinancialInsightsEngine.formatUnusualSpending(insights),
        type: 'unusual_spending',
        data: insights.anomalies
      };
    }

    // 2. Spending Trends / Month-over-Month Comparison / Patterns
    if (
      q.includes('trend') || q.includes('pattern') || q.includes('compare') ||
      q.includes('vs last month') || q.includes('month over month') || q.includes('burn rate') ||
      q.includes('projected') || q.includes('forecast')
    ) {
      return {
        text: FinancialInsightsEngine.formatSpendingTrends(insights),
        type: 'spending_trends',
        data: insights.trends
      };
    }

    // 3. Personalized Savings Suggestions / Recommendations / Improve
    if (
      q.includes('save more') || q.includes('how can i save') || q.includes('how to save') ||
      q.includes('suggest') || q.includes('recommend') || q.includes('advice') ||
      q.includes('improve') || q.includes('cut down') || q.includes('reduce spending') ||
      q.includes('saving tip') || q.includes('savings tip') || q.includes('opportunity') ||
      q.includes('opportunities')
    ) {
      return {
        text: FinancialInsightsEngine.formatSavingsSuggestions(insights),
        type: 'savings_suggestions',
        data: {
          recommendations: insights.recommendations,
          estimatedMonthlySavingsPotential: insights.estimatedMonthlySavingsPotential
        }
      };
    }

    // 4. Income Insights / Income Analysis (must precede generic 'analyze my')
    if (
      q.includes('income insight') || q.includes('income analysis') || q.includes('income summary') ||
      q.includes('analyze my income') || q.includes('total income') || q.includes('my income') ||
      (q.includes('salary') && (q.includes('year') || q.includes('received') || q.includes('total') || q.includes('how much')))
    ) {
      if (q.includes('salary')) {
        const salaryTxs = transactions.filter(tx => {
          const d = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
          return d.getFullYear() === currentYear &&
            tx.type === 'income' &&
            ((tx.category || '').toLowerCase() === 'salary' || (tx.description || '').toLowerCase().includes('salary'));
        });
        const totalSalary = salaryTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        return {
          text: `You have received **${AccountModel.formatCurrency(totalSalary)}** in salary in ${currentYear} across ${salaryTxs.length} credit ${salaryTxs.length === 1 ? 'entry' : 'entries'}.` +
            (insights.income.missingSalaryDetected ? `\n\n💡 Note: No salary has been logged yet for **${insights.activePeriod}**.` : ''),
          type: 'salary_summary',
          data: { totalSalary, count: salaryTxs.length }
        };
      }
      return {
        text: FinancialInsightsEngine.formatIncomeInsights(insights),
        type: 'income_insights',
        data: insights.income
      };
    }

    // 5. Where did I spend most / Expense Insights / Top Categories
    if (
      q.includes('spend the most') || q.includes('spend most') || q.includes('spent most') ||
      q.includes('spent the most') || q.includes('top categories') || q.includes('top spending') ||
      q.includes('expense insight') || q.includes('expense analysis') || q.includes('spending breakdown') ||
      q.includes('expense breakdown') || q.includes('where is my money going')
    ) {
      return {
        text: FinancialInsightsEngine.formatExpenseInsights(insights),
        type: 'expense_insights',
        data: insights.expenses
      };
    }

    // 6. Overall Financial Summary / Full Analysis / Overview / Financial Health
    if (
      q.includes('financial summary') || q.includes('overall summary') || q.includes('full analysis') ||
      q.includes('analyze my') || q.includes('financial health') || q.includes('overview') ||
      (q.includes('summary') && !q.includes('salary'))
    ) {
      const isFull = q.includes('full') || q.includes('analyze') || q.includes('deep') || q.includes('complete');
      return {
        text: isFull
          ? FinancialInsightsEngine.formatFullAnalysis(insights)
          : FinancialInsightsEngine.formatOverallSummary(insights),
        type: 'financial_summary',
        data: insights
      };
    }

    // 7. List / Show Transactions (with optional threshold e.g. "transactions above 2000")
    if (
      q.includes('all transactions') || q.includes('my transactions') ||
      q.includes('recent transactions') || q.includes('show transactions') ||
      q.includes('list transactions') || q.includes('transactions above') ||
      q.includes('last 5') || q.includes('last 10')
    ) {
      const accNameMap = new Map(accounts.map(a => [a.id, a.name]));
      const aboveMatch = q.match(/(?:above|over|more than|greater than|>)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
      const minAmt = aboveMatch ? parseFloat(aboveMatch[1].replace(/,/g, '')) : null;
      const limitMatch = q.match(/last\s+(\d+)/i);
      const limit = limitMatch ? Math.min(25, Math.max(1, parseInt(limitMatch[1], 10))) : 10;

      let pool = [...transactions];
      if (q.includes('this month')) {
        pool = pool.filter(tx => {
          const d = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
      }
      if (q.includes('expense')) {
        pool = pool.filter(tx => tx.type === 'expense');
      } else if (q.includes('income')) {
        pool = pool.filter(tx => tx.type === 'income');
      }
      if (minAmt !== null && !isNaN(minAmt)) {
        pool = pool.filter(tx => (Number(tx.amount) || 0) >= minAmt);
      }

      pool.sort((a, b) => {
        const diff = TransactionModel.parseLocalDate(b.date || b.createdTimestamp) - TransactionModel.parseLocalDate(a.date || a.createdTimestamp);
        return diff !== 0 ? diff : (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
      });

      if (pool.length === 0) {
        return { text: 'No matching transactions found.', type: 'transaction_list', data: [] };
      }

      const shown = pool.slice(0, limit);
      const lines = shown.map(t =>
        `• **${TransactionModel.formatDate(t.date)}** — ${t.type.toUpperCase()} **${AccountModel.formatCurrency(t.amount)}** (${t.category}) on ${accNameMap.get(t.accountId) || 'Account'}${t.description ? ` — ${t.description}` : ''}`
      );
      return {
        text: `Showing **${shown.length}** of **${pool.length}** matching transactions:\n\n${lines.join('\n')}`,
        type: 'transaction_list',
        data: shown
      };
    }

    // 8. Account Balance Query (handles multiple accounts with same name, e.g. HDFC Credit Card + HDFC Fixed Deposit)
    if (q.includes('balance') || q.includes('how much in') || q.includes('how much money') || q.includes('all accounts')) {
      const matchedAccounts = accounts.filter(acc => {
        const name = (acc.name || '').toLowerCase();
        if (!name) return false;
        if (q.includes(name)) return true;
        const tokens = name.split(/\s+/).filter(t => t.length > 2 && !['bank', 'account', 'card', 'credit', 'debit', 'savings'].includes(t));
        return tokens.some(tok => new RegExp(`\\b${tok}\\b`, 'i').test(q));
      });

      // Narrow down if user explicitly asked for credit card vs bank/fd
      let targetAccounts = matchedAccounts;
      if (matchedAccounts.length > 1) {
        if (q.includes('credit') || q.includes('card')) {
          const creditOnly = matchedAccounts.filter(a => a.category === 'credit');
          if (creditOnly.length > 0) targetAccounts = creditOnly;
        } else if (q.includes('fd') || q.includes('fixed deposit') || q.includes('bank') || q.includes('savings')) {
          const debitOnly = matchedAccounts.filter(a => a.category === 'debit');
          if (debitOnly.length > 0) targetAccounts = debitOnly;
        }
      }

      if (targetAccounts.length === 1) {
        const acc = targetAccounts[0];
        if (acc.category === 'debit') {
          return {
            text: `Your current balance in **${acc.name}** (${acc.type}) is **${AccountModel.formatCurrency(acc.currentBalance)}**.\n\n` +
                  `• Opening Balance: ${AccountModel.formatCurrency(acc.openingBalance)}\n` +
                  `• Total Income: ${AccountModel.formatCurrency(acc.totalIncome)}\n` +
                  `• Transfers In: ${AccountModel.formatCurrency(acc.totalTransfersIn || 0)}\n` +
                  `• Total Outflow: ${AccountModel.formatCurrency(acc.totalSpent)}`,
            type: 'account_balance',
            data: acc
          };
        } else {
          const due = AccountModel.getNextDueDate(acc);
          return {
            text: `For your **${acc.name}** (${acc.type}):\n\n` +
                  `• Outstanding Balance: **${AccountModel.formatCurrency(acc.currentOutstanding)}**\n` +
                  `• Available Credit: **${AccountModel.formatCurrency(acc.availableCredit)}** (Limit: ${AccountModel.formatCurrency(acc.creditLimit)})\n` +
                  `• Credit Utilization: **${acc.utilizationRate}%**${Number(acc.utilizationRate) > 30 ? ' ⚠️ (Above 30%)' : ''}\n` +
                  `• Next Due Date: **${TransactionModel.formatDate(due.dateString)}** (every ${due.dueDay}th)`,
            type: 'credit_balance',
            data: acc
          };
        }
      } else if (targetAccounts.length > 1) {
        const lines = targetAccounts.map(acc =>
          acc.category === 'debit'
            ? `• **${acc.name}** (${acc.type}): **${AccountModel.formatCurrency(acc.currentBalance)}**`
            : `• **${acc.name}** (${acc.type}): Outstanding **${AccountModel.formatCurrency(acc.currentOutstanding)}** | Available **${AccountModel.formatCurrency(acc.availableCredit)}** (${acc.utilizationRate}% util)`
        );
        return {
          text: `Found **${targetAccounts.length}** matching accounts:\n\n${lines.join('\n')}`,
          type: 'account_balances',
          data: targetAccounts
        };
      } else if (q.includes('all') || q.includes('my balance') || q.includes('account balance')) {
        const lines = accounts.map(acc =>
          acc.category === 'debit'
            ? `• **${acc.name}** (${acc.type}): **${AccountModel.formatCurrency(acc.currentBalance)}**`
            : `• **${acc.name}** (${acc.type}): Debt **${AccountModel.formatCurrency(acc.currentOutstanding)}** / Limit ${AccountModel.formatCurrency(acc.creditLimit)} (${acc.utilizationRate}%)`
        );
        return {
          text: `**All Account Balances (${accounts.length} accounts):**\n\n${lines.join('\n')}\n\n• **Total Assets:** ${AccountModel.formatCurrency(insights.summary.totalAssets)} | **Total Debt:** ${AccountModel.formatCurrency(insights.summary.totalLiabilities)} | **Net Worth:** ${AccountModel.formatCurrency(insights.summary.netPosition)}`,
          type: 'account_balances',
          data: accounts
        };
      }
    }

    // 9. Credit Card Debt / Outstanding / Utilization
    if (
      q.includes('debt') || q.includes('outstanding') || q.includes('credit utilization') ||
      (q.includes('credit card') && (q.includes('owe') || q.includes('total') || q.includes('due')))
    ) {
      const creditCards = accounts.filter(a => a.category === 'credit');
      const totalDebt = insights.summary.totalLiabilities;
      const totalLimit = insights.summary.totalCreditLimit;
      const utilRate = insights.summary.overallCreditUtilization;

      const breakdown = creditCards.map(c =>
        `• **${c.name}**: **${AccountModel.formatCurrency(c.currentOutstanding)}** / ${AccountModel.formatCurrency(c.creditLimit)} (${c.utilizationRate}% util${Number(c.utilizationRate) > 30 ? ' ⚠️' : ''})`
      ).join('\n');

      const warnings = insights.alerts.highUtilizationCards.map(c =>
        `⚠️ Pay **${AccountModel.formatCurrency(c.payoffToReach30)}** on **${c.name}** to drop below 30% utilization.`
      ).join('\n');

      return {
        text: `Your total credit card debt is **${AccountModel.formatCurrency(totalDebt)}** across ${creditCards.length} cards.\n\n` +
              `• Overall Credit Utilization: **${utilRate}%** (Limit: ${AccountModel.formatCurrency(totalLimit)})\n\n` +
              `**Card Breakdown:**\n${breakdown}` +
              (warnings ? `\n\n${warnings}` : ''),
        type: 'credit_summary',
        data: { totalDebt, utilRate, creditCards, highUtilizationCards: insights.alerts.highUtilizationCards }
      };
    }

    // 10. Available Credit
    if (q.includes('available credit') || q.includes('credit available') || q.includes('credit left')) {
      const creditCards = accounts.filter(a => a.category === 'credit');
      const totalAvailable = insights.summary.totalCreditAvailable;
      const totalLimit = insights.summary.totalCreditLimit;
      const breakdown = creditCards.map(c => `• **${c.name}**: **${AccountModel.formatCurrency(c.availableCredit)}** available (Limit: ${AccountModel.formatCurrency(c.creditLimit)})`).join('\n');

      return {
        text: `You have **${AccountModel.formatCurrency(totalAvailable)}** available credit across all cards (out of ${AccountModel.formatCurrency(totalLimit)} total limit).\n\n${breakdown}`,
        type: 'available_credit',
        data: { totalAvailable, creditCards }
      };
    }

    // 11. Biggest / Largest Expense
    if (q.includes('biggest expense') || q.includes('highest expense') || q.includes('largest expense')) {
      const top = insights.expenses.topExpenses;
      if (top.length === 0) {
        return { text: `No expenses recorded for **${insights.activePeriod}** yet.`, type: 'info' };
      }
      const biggest = top[0];
      return {
        text: `Your biggest expense in **${insights.activePeriod}** is **${AccountModel.formatCurrency(biggest.amount)}** for **${biggest.description}** on ${TransactionModel.formatDate(biggest.date)}.\n\n` +
              `• Category: ${biggest.category}\n` +
              `• Account: ${biggest.accountName}`,
        type: 'biggest_expense',
        data: biggest
      };
    }

    // 12. Dynamic Category Spending Query (checks ALL DB categories + common keywords)
    const dynamicCategoryNames = categories.map(c => c.name);
    const extraKeywords = ['fuel', 'petrol', 'rent', 'amazon', 'swiggy', 'zomato', 'grocery', 'groceries', 'emi'];
    const allSearchTerms = [...new Set([...dynamicCategoryNames, ...extraKeywords])]
      .sort((a, b) => b.length - a.length);

    for (const term of allSearchTerms) {
      const lowTerm = term.toLowerCase();
      if (lowTerm.length >= 3 && q.includes(lowTerm)) {
        const useAllTime = q.includes('all time') || q.includes('overall') || q.includes('total ever');
        const matchingTxs = transactions.filter(tx => {
          if (tx.type !== 'expense' && tx.type !== 'purchase') return false;
          if (!useAllTime) {
            const d = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
            if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return false;
          }
          const catMatch = (tx.category || '').toLowerCase().includes(lowTerm);
          const subMatch = (tx.subcategory || '').toLowerCase().includes(lowTerm);
          const descMatch = (tx.description || '').toLowerCase().includes(lowTerm);
          return catMatch || subMatch || descMatch;
        });

        const totalCat = matchingTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const scopeLabel = useAllTime ? 'all time' : 'this month';
        return {
          text: `You spent **${AccountModel.formatCurrency(totalCat)}** on **${term}** (${scopeLabel}) across ${matchingTxs.length} ${matchingTxs.length === 1 ? 'transaction' : 'transactions'}.`,
          type: 'category_spending',
          data: { category: term, total: totalCat, count: matchingTxs.length }
        };
      }
    }

    // 13. Monthly Spend / Cash Flow Summary
    if (q.includes('spend this month') || q.includes('spent this month') || q.includes('total spent') || q.includes('cash flow')) {
      const s = insights.summary;
      return {
        text: `**${insights.activePeriod} Cash Flow:**\n\n` +
              `• **Total Spent:** ${AccountModel.formatCurrency(s.activeMonthExpense)}\n` +
              `• **Total Income:** ${AccountModel.formatCurrency(s.activeMonthIncome)}\n` +
              `• **Net Savings:** ${AccountModel.formatCurrency(s.activeMonthSavings)} (${s.activeMonthSavingsRate}% savings rate)\n` +
              `• **Daily Burn Rate:** ${AccountModel.formatCurrency(s.dailyBurnRate)}/day`,
        type: 'monthly_summary',
        data: s
      };
    }

    // 14. Net Position / Net Worth / Total Assets
    if (q.includes('net position') || q.includes('net worth') || q.includes('total assets')) {
      const s = insights.summary;
      return {
        text: `Your current **Net Worth** is **${AccountModel.formatCurrency(s.netPosition)}**.\n\n` +
              `• **Total Assets:** ${AccountModel.formatCurrency(s.totalAssets)} (Liquid: ${AccountModel.formatCurrency(s.liquidAssets)} | Invested: ${AccountModel.formatCurrency(s.investedAssets)})\n` +
              `• **Total Liabilities:** ${AccountModel.formatCurrency(s.totalLiabilities)} (${s.overallCreditUtilization}% credit utilization)`,
        type: 'net_position',
        data: s
      };
    }

    // Default intelligent response: return concise overall summary instead of generic help
    if (transactions.length > 0 || accounts.length > 0) {
      return {
        text: FinancialInsightsEngine.formatOverallSummary(insights),
        type: 'financial_summary',
        data: insights
      };
    }

    return {
      text: "Add accounts and transactions to unlock real-time spending insights, anomaly alerts, and personalized savings recommendations!",
      type: 'help'
    };
  }
}
