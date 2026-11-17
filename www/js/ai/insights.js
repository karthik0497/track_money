// Track-Money: Real-Data Financial Intelligence & Analytics Engine
// Analyzes actual income, expenses, transactions, account balances, trends, anomalies, and savings opportunities.

import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

const round2 = (n) => {
  const v = Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
};

const LIQUID_ACCOUNT_TYPES = new Set([
  'Bank Account',
  'Savings Account',
  'Current Account',
  'Cash',
  'Custom Asset'
]);

const DISCRETIONARY_CATEGORIES = new Set([
  'shopping',
  'outside food',
  'online food',
  'entertainment',
  'travel',
  'travel & trips',
  'personal & care',
  'subscriptions'
]);

const ESSENTIAL_CATEGORIES = new Set([
  'car emi',
  'housing & rent',
  'bills & utilities',
  'water bill',
  'current bill',
  'healthcare',
  'education',
  'giving to dad',
  'investments'
]);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class FinancialInsightsEngine {
  /**
   * Computes comprehensive, real-data financial analytics from live storage data.
   */
  static analyze({ accounts = [], transactions = [], recurring = [], metrics = null, referenceDate = new Date() }) {
    const ref = new Date(referenceDate);
    const accMap = new Map(accounts.map(a => [a.id, a]));

    // 1. Group transactions by YYYY-MM
    const monthlyMap = new Map();
    let allTimeIncome = 0;
    let allTimeExpense = 0;
    let allTimeTransfers = 0;
    let allTimeCCPayments = 0;
    const allTimeCategoryTotals = {};
    const allTimeIncomeByCategory = {};
    const allTimeExpenseTxs = [];

    for (const tx of transactions) {
      const d = TransactionModel.parseLocalDate(tx.date || tx.createdTimestamp);
      if (isNaN(d.getTime())) continue;
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          key,
          year,
          month,
          label: `${MONTH_NAMES[month]} ${year}`,
          income: 0,
          expense: 0,
          transfers: 0,
          ccPayments: 0,
          savings: 0,
          savingsRate: 0,
          txCount: 0,
          expenseCount: 0,
          incomeCount: 0,
          categoryTotals: {},
          categoryCounts: {},
          incomeByCategory: {},
          expenses: [],
          incomes: []
        });
      }

      const bucket = monthlyMap.get(key);
      const amt = Number(tx.amount) || 0;
      bucket.txCount++;

      if (tx.type === 'income') {
        bucket.income = round2(bucket.income + amt);
        bucket.incomeCount++;
        const cat = tx.category || 'Other Income';
        bucket.incomeByCategory[cat] = round2((bucket.incomeByCategory[cat] || 0) + amt);
        bucket.incomes.push(tx);
        allTimeIncome = round2(allTimeIncome + amt);
        allTimeIncomeByCategory[cat] = round2((allTimeIncomeByCategory[cat] || 0) + amt);
      } else if (tx.type === 'expense' || tx.type === 'purchase') {
        bucket.expense = round2(bucket.expense + amt);
        bucket.expenseCount++;
        const cat = tx.category || 'Other Expense';
        bucket.categoryTotals[cat] = round2((bucket.categoryTotals[cat] || 0) + amt);
        bucket.categoryCounts[cat] = (bucket.categoryCounts[cat] || 0) + 1;
        bucket.expenses.push(tx);
        allTimeExpense = round2(allTimeExpense + amt);
        allTimeCategoryTotals[cat] = round2((allTimeCategoryTotals[cat] || 0) + amt);
        allTimeExpenseTxs.push(tx);
      } else if (tx.type === 'transfer') {
        bucket.transfers = round2(bucket.transfers + amt);
        allTimeTransfers = round2(allTimeTransfers + amt);
      } else if (tx.type === 'credit_card_payment') {
        bucket.ccPayments = round2(bucket.ccPayments + amt);
        allTimeCCPayments = round2(allTimeCCPayments + amt);
      }
    }

    for (const bucket of monthlyMap.values()) {
      bucket.savings = round2(bucket.income - bucket.expense);
      bucket.savingsRate = bucket.income > 0
        ? Number(((bucket.savings / bucket.income) * 100).toFixed(1))
        : 0;
    }

    const monthlyHistory = Array.from(monthlyMap.values())
      .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    // Determine primary active month (current calendar month if it has data, else latest active month)
    const refKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    const currentBucket = monthlyMap.get(refKey) || (monthlyHistory.length > 0 ? monthlyHistory[monthlyHistory.length - 1] : null);

    let previousBucket = null;
    if (currentBucket) {
      const prevDate = new Date(currentBucket.year, currentBucket.month - 1, 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      previousBucket = monthlyMap.get(prevKey) || null;
      if (!previousBucket && monthlyHistory.length > 1) {
        const idx = monthlyHistory.findIndex(m => m.key === currentBucket.key);
        if (idx > 0) previousBucket = monthlyHistory[idx - 1];
      }
    }

    // 2. Account & Liquidity Analysis
    const debitAccounts = accounts.filter(a => a.category === 'debit');
    const creditAccounts = accounts.filter(a => a.category === 'credit');
    const totalAssets = round2(debitAccounts.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0));
    const totalLiabilities = round2(creditAccounts.reduce((s, a) => s + (Number(a.currentOutstanding) || 0), 0));
    const netPosition = round2(totalAssets - totalLiabilities);
    const totalCreditLimit = round2(creditAccounts.reduce((s, a) => s + (Number(a.creditLimit) || 0), 0));
    const totalCreditAvailable = round2(creditAccounts.reduce((s, a) => s + (Number(a.availableCredit) || 0), 0));
    const overallCreditUtilization = totalCreditLimit > 0
      ? Number(((totalLiabilities / totalCreditLimit) * 100).toFixed(1))
      : 0;

    const liquidAssets = round2(
      debitAccounts
        .filter(a => LIQUID_ACCOUNT_TYPES.has(a.type))
        .reduce((s, a) => s + (Number(a.currentBalance) || 0), 0)
    );
    const investedAssets = round2(totalAssets - liquidAssets);

    const highUtilizationCards = creditAccounts
      .filter(a => Number(a.utilizationRate) > 30 && (Number(a.currentOutstanding) || 0) > 0)
      .map(a => {
        const limit = Number(a.creditLimit) || 0;
        const outstanding = Number(a.currentOutstanding) || 0;
        const target30 = round2(limit * 0.30);
        const payoffToReach30 = Math.max(0, Math.ceil(outstanding - target30));
        return {
          id: a.id,
          name: a.name,
          outstanding,
          limit,
          utilizationRate: Number(a.utilizationRate),
          payoffToReach30
        };
      })
      .sort((a, b) => b.utilizationRate - a.utilizationRate);

    const liquidityAlerts = [];
    for (const rec of recurring) {
      if (rec.status !== 'active' || rec.type !== 'expense') continue;
      const linkedAcc = accMap.get(rec.accountId);
      if (linkedAcc && linkedAcc.category === 'debit') {
        const bal = Number(linkedAcc.currentBalance) || 0;
        const billAmt = Number(rec.amount) || 0;
        if (billAmt > 0 && bal < billAmt) {
          liquidityAlerts.push({
            recurringTitle: rec.title,
            recurringAmount: billAmt,
            accountId: linkedAcc.id,
            accountName: linkedAcc.name,
            accountBalance: bal,
            shortfall: round2(billAmt - bal),
            nextDueDate: rec.nextDueDate
          });
        }
      }
    }

    // 3. Expense & Category Breakdown (Current Active Month + All-Time)
    const activeExpenses = currentBucket ? currentBucket.expenses : [];
    const activeExpenseTotal = currentBucket ? currentBucket.expense : 0;
    const activeIncomeTotal = currentBucket ? currentBucket.income : 0;
    const activeCatTotals = currentBucket ? currentBucket.categoryTotals : {};
    const activeCatCounts = currentBucket ? currentBucket.categoryCounts : {};

    const topCategories = Object.entries(activeCatTotals)
      .map(([name, amount]) => {
        const count = activeCatCounts[name] || 1;
        return {
          name,
          amount: round2(amount),
          percentage: activeExpenseTotal > 0 ? Number(((amount / activeExpenseTotal) * 100).toFixed(1)) : 0,
          count,
          avgPerTx: round2(amount / count),
          classification: DISCRETIONARY_CATEGORIES.has(name.toLowerCase())
            ? 'discretionary'
            : (ESSENTIAL_CATEGORIES.has(name.toLowerCase()) ? 'essential' : 'variable')
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const discretionaryTotal = round2(
      topCategories.filter(c => c.classification === 'discretionary').reduce((s, c) => s + c.amount, 0)
    );
    const essentialTotal = round2(
      topCategories.filter(c => c.classification === 'essential').reduce((s, c) => s + c.amount, 0)
    );
    const variableTotal = round2(activeExpenseTotal - discretionaryTotal - essentialTotal);

    const topExpenses = [...activeExpenses]
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount) || 0,
        category: t.category,
        description: t.description || t.category,
        accountName: accMap.get(t.accountId)?.name || 'Account'
      }));

    // Daily burn rate & projection for current month
    let dailyBurnRate = 0;
    let projectedMonthlyExpense = activeExpenseTotal;
    if (currentBucket && activeExpenseTotal > 0) {
      const isCurrentCalMonth = currentBucket.year === ref.getFullYear() && currentBucket.month === ref.getMonth();
      const daysInMonth = new Date(currentBucket.year, currentBucket.month + 1, 0).getDate();
      const elapsedDays = isCurrentCalMonth ? Math.max(1, ref.getDate()) : daysInMonth;
      dailyBurnRate = round2(activeExpenseTotal / elapsedDays);
      projectedMonthlyExpense = isCurrentCalMonth ? round2(dailyBurnRate * daysInMonth) : activeExpenseTotal;
    }

    // 4. Month-over-Month Spending & Income Trends
    const trends = {
      currentPeriod: currentBucket?.label || null,
      previousPeriod: previousBucket?.label || null,
      expenseChange: null,
      expenseChangePct: null,
      incomeChange: null,
      incomeChangePct: null,
      risingCategories: [],
      fallingCategories: [],
      missingSalaryDetected: false,
      previousSalaryAmount: 0
    };

    if (currentBucket && previousBucket) {
      trends.expenseChange = round2(currentBucket.expense - previousBucket.expense);
      trends.expenseChangePct = previousBucket.expense > 0
        ? Number(((trends.expenseChange / previousBucket.expense) * 100).toFixed(1))
        : null;

      trends.incomeChange = round2(currentBucket.income - previousBucket.income);
      trends.incomeChangePct = previousBucket.income > 0
        ? Number(((trends.incomeChange / previousBucket.income) * 100).toFixed(1))
        : null;

      const prevSalary = previousBucket.incomeByCategory['Salary'] || 0;
      const currSalary = currentBucket.incomeByCategory['Salary'] || 0;
      if (prevSalary > 0 && currSalary === 0) {
        trends.missingSalaryDetected = true;
        trends.previousSalaryAmount = prevSalary;
      }

      const allCats = new Set([
        ...Object.keys(currentBucket.categoryTotals),
        ...Object.keys(previousBucket.categoryTotals)
      ]);
      const catDeltas = [];
      for (const cat of allCats) {
        const currAmt = currentBucket.categoryTotals[cat] || 0;
        const prevAmt = previousBucket.categoryTotals[cat] || 0;
        const delta = round2(currAmt - prevAmt);
        const pctChange = prevAmt > 0 ? Number(((delta / prevAmt) * 100).toFixed(1)) : (currAmt > 0 ? null : 0);
        catDeltas.push({ category: cat, previous: prevAmt, current: currAmt, delta, pctChange });
      }

      trends.risingCategories = catDeltas
        .filter(c => c.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5);

      trends.fallingCategories = catDeltas
        .filter(c => c.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 5);
    }

    // 5. Unusual Spending & Anomaly Detection
    const unusualTransactions = [];
    const categorySpikes = [];
    const potentialDuplicates = [];

    // 5a. Statistical outlier expense transactions (across all expenses for robust baseline)
    const expAmounts = allTimeExpenseTxs.map(t => Number(t.amount) || 0).filter(a => a > 0);
    if (expAmounts.length >= 4) {
      const mean = expAmounts.reduce((s, v) => s + v, 0) / expAmounts.length;
      const variance = expAmounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / expAmounts.length;
      const stdDev = Math.sqrt(variance);
      const outlierThreshold = Math.max(mean + 1.5 * stdDev, mean * 2.5);

      // Compute per-category averages
      const catStats = {};
      for (const t of allTimeExpenseTxs) {
        const cat = t.category || 'Other Expense';
        if (!catStats[cat]) catStats[cat] = { sum: 0, count: 0 };
        catStats[cat].sum += Number(t.amount) || 0;
        catStats[cat].count++;
      }

      const candidatePool = activeExpenses.length > 0 ? activeExpenses : allTimeExpenseTxs;
      for (const tx of candidatePool) {
        const amt = Number(tx.amount) || 0;
        const cat = tx.category || 'Other Expense';
        const cStat = catStats[cat];
        const catAvg = cStat && cStat.count >= 3 ? cStat.sum / cStat.count : null;

        const isGlobalOutlier = amt >= outlierThreshold;
        const isCategoryOutlier = catAvg !== null && amt >= catAvg * 2.5 && amt >= 500;
        const isMajorShare = activeExpenseTotal > 0 && (amt / activeExpenseTotal) >= 0.25 && amt >= 1000;

        if (isGlobalOutlier || isCategoryOutlier || isMajorShare) {
          let reason = '';
          if (isCategoryOutlier) {
            reason = `${(amt / catAvg).toFixed(1)}x your typical ${cat} expense (avg ${AccountModel.formatCurrency(round2(catAvg))})`;
          } else if (isGlobalOutlier) {
            reason = `${(amt / mean).toFixed(1)}x higher than your average expense (${AccountModel.formatCurrency(round2(mean))})`;
          } else {
            reason = `${((amt / activeExpenseTotal) * 100).toFixed(1)}% of total ${currentBucket?.label || 'monthly'} spending`;
          }
          unusualTransactions.push({
            id: tx.id,
            date: tx.date,
            amount: amt,
            category: cat,
            description: tx.description || cat,
            accountName: accMap.get(tx.accountId)?.name || 'Account',
            reason
          });
        }
      }
      unusualTransactions.sort((a, b) => b.amount - a.amount);
    }

    // 5b. Category Spikes (MoM jump >= 50% and >= 500)
    if (trends.risingCategories.length > 0) {
      for (const item of trends.risingCategories) {
        if ((item.pctChange !== null && item.pctChange >= 50 && item.delta >= 500) || (item.previous === 0 && item.current >= 2000)) {
          categorySpikes.push(item);
        }
      }
    }

    // 5c. Potential Duplicate Entries (same date + accountId + type + amount)
    const seenSig = new Map();
    for (const tx of transactions) {
      const sig = `${tx.date}|${tx.accountId}|${tx.type}|${Number(tx.amount)}`;
      if (!seenSig.has(sig)) {
        seenSig.set(sig, [tx]);
      } else {
        seenSig.get(sig).push(tx);
      }
    }
    for (const list of seenSig.values()) {
      if (list.length > 1) {
        const sample = list[0];
        potentialDuplicates.push({
          count: list.length,
          date: sample.date,
          type: sample.type,
          amount: Number(sample.amount),
          category: sample.category,
          accountName: accMap.get(sample.accountId)?.name || 'Account',
          ids: list.map(t => t.id)
        });
      }
    }

    // 6. Personalized, Data-Backed Savings Suggestions & Recommendations
    const recommendations = [];
    let estimatedMonthlySavingsPotential = 0;

    // R1: High Credit Card Utilization
    for (const card of highUtilizationCards) {
      recommendations.push({
        priority: 'high',
        type: 'credit_utilization',
        title: `Lower ${card.name} credit utilization`,
        detail: `**${card.name}** is at **${card.utilizationRate}%** utilization (${AccountModel.formatCurrency(card.outstanding)} / ${AccountModel.formatCurrency(card.limit)}). Paying **${AccountModel.formatCurrency(card.payoffToReach30)}** brings it under the 30% credit-score threshold.`,
        potentialSavings: 0
      });
    }

    // R2: Liquidity / Recurring Bill Coverage Alert
    for (const alert of liquidityAlerts) {
      recommendations.push({
        priority: 'high',
        type: 'liquidity_warning',
        title: `Fund ${alert.accountName} before ${alert.recurringTitle}`,
        detail: `**${alert.accountName}** has **${AccountModel.formatCurrency(alert.accountBalance)}**, which is **${AccountModel.formatCurrency(alert.shortfall)}** short of your recurring **${alert.recurringTitle}** (${AccountModel.formatCurrency(alert.recurringAmount)}). Keep a buffer ready to avoid bounce fees.`,
        potentialSavings: 0
      });
    }

    // R3: Discretionary Spending Trim Opportunity
    const discretionaryCats = topCategories.filter(c => c.classification === 'discretionary' && c.amount > 0);
    if (discretionaryTotal > 0) {
      const trim20 = round2(discretionaryTotal * 0.20);
      estimatedMonthlySavingsPotential = round2(estimatedMonthlySavingsPotential + trim20);
      const catSummary = discretionaryCats
        .slice(0, 3)
        .map(c => `${c.name} (${AccountModel.formatCurrency(c.amount)})`)
        .join(', ');
      recommendations.push({
        priority: 'medium',
        type: 'discretionary_savings',
        title: 'Trim discretionary spending by 20%',
        detail: `Discretionary categories — ${catSummary} — total **${AccountModel.formatCurrency(discretionaryTotal)}** (${activeExpenseTotal > 0 ? ((discretionaryTotal / activeExpenseTotal) * 100).toFixed(1) : 0}% of ${currentBucket?.label || 'monthly'} expenses). Cutting 20% saves **${AccountModel.formatCurrency(trim20)}/month** (**${AccountModel.formatCurrency(round2(trim20 * 12))}/year**).`,
        potentialSavings: trim20
      });
    }

    // R4: Combined Food & Dining Optimization
    const foodCats = topCategories.filter(c => ['food', 'outside food', 'online food'].includes(c.name.toLowerCase()));
    const combinedFood = round2(foodCats.reduce((s, c) => s + c.amount, 0));
    const diningOut = round2(
      foodCats.filter(c => c.name.toLowerCase() !== 'food').reduce((s, c) => s + c.amount, 0)
    );
    if (diningOut >= 500) {
      const diningSave = round2(diningOut * 0.30);
      if (!discretionaryCats.some(c => c.name.toLowerCase() === 'outside food' || c.name.toLowerCase() === 'online food')) {
        estimatedMonthlySavingsPotential = round2(estimatedMonthlySavingsPotential + diningSave);
      }
      recommendations.push({
        priority: 'medium',
        type: 'food_optimization',
        title: 'Optimize dining & delivery spend',
        detail: `Total food spend is **${AccountModel.formatCurrency(combinedFood)}** (including **${AccountModel.formatCurrency(diningOut)}** on outside/online food). Shifting 30% of outside orders to home meals saves **${AccountModel.formatCurrency(diningSave)}/month**.`,
        potentialSavings: diningSave
      });
    }

    // R5: Major Category Spike Follow-up
    const nonEmiSpikes = categorySpikes.filter(s => s.category.toLowerCase() !== 'car emi');
    if (nonEmiSpikes.length > 0) {
      const topSpike = nonEmiSpikes[0];
      const spikeSave = round2(topSpike.delta * 0.25);
      recommendations.push({
        priority: 'medium',
        type: 'category_spike',
        title: `Review ${topSpike.category} surge`,
        detail: `**${topSpike.category}** jumped by **+${AccountModel.formatCurrency(topSpike.delta)}**${topSpike.pctChange !== null ? ` (+${topSpike.pctChange}%)` : ''} from ${AccountModel.formatCurrency(topSpike.previous)} in ${previousBucket.label} to **${AccountModel.formatCurrency(topSpike.current)}** in ${currentBucket.label}. Setting a monthly cap can recover **${AccountModel.formatCurrency(spikeSave)}/month**.`,
        potentialSavings: spikeSave
      });
    }

    // R6: Cash Flow Deficit / Missing Salary Context
    if (currentBucket && currentBucket.savings < 0) {
      const deficit = Math.abs(currentBucket.savings);
      if (trends.missingSalaryDetected) {
        recommendations.push({
          priority: 'info',
          type: 'income_timing',
          title: 'Record monthly salary when credited',
          detail: `${currentBucket.label} currently shows a **${AccountModel.formatCurrency(deficit)}** cash-flow deficit because no **Salary** entry has been logged yet (last month's salary was **${AccountModel.formatCurrency(trends.previousSalaryAmount)}**).`,
          potentialSavings: 0
        });
      } else {
        recommendations.push({
          priority: 'high',
          type: 'cashflow_deficit',
          title: 'Close monthly cash-flow deficit',
          detail: `Expenses (${AccountModel.formatCurrency(currentBucket.expense)}) exceeded income (${AccountModel.formatCurrency(currentBucket.income)}) by **${AccountModel.formatCurrency(deficit)}** in ${currentBucket.label}. Pause non-essential purchases until income catches up.`,
          potentialSavings: round2(deficit * 0.25)
        });
      }
    }

    // R7: Potential Duplicate Verification
    if (potentialDuplicates.length > 0) {
      const dup = potentialDuplicates[0];
      recommendations.push({
        priority: 'low',
        type: 'duplicate_check',
        title: 'Verify potential duplicate entries',
        detail: `Found **${dup.count}** identical **${AccountModel.formatCurrency(dup.amount)}** ${dup.type} entries on **${dup.accountName}** on ${TransactionModel.formatDate(dup.date)}. Confirm whether all are intentional.`,
        potentialSavings: 0
      });
    }

    // 7. Income Summary Object
    const incomeInsights = {
      currentPeriod: currentBucket?.label || null,
      currentMonthIncome: activeIncomeTotal,
      previousMonthIncome: previousBucket ? previousBucket.income : 0,
      allTimeIncome,
      currentMonthByCategory: currentBucket ? currentBucket.incomeByCategory : {},
      allTimeByCategory: allTimeIncomeByCategory,
      missingSalaryDetected: trends.missingSalaryDetected,
      previousSalaryAmount: trends.previousSalaryAmount
    };

    return {
      generatedAt: new Date().toISOString(),
      activePeriod: currentBucket?.label || `${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`,
      previousPeriod: previousBucket?.label || null,
      summary: {
        netPosition,
        totalAssets,
        liquidAssets,
        investedAssets,
        totalLiabilities,
        totalCreditLimit,
        totalCreditAvailable,
        overallCreditUtilization,
        activeMonthIncome: activeIncomeTotal,
        activeMonthExpense: activeExpenseTotal,
        activeMonthSavings: currentBucket ? currentBucket.savings : 0,
        activeMonthSavingsRate: currentBucket ? currentBucket.savingsRate : 0,
        allTimeIncome,
        allTimeExpense,
        allTimeTransfers,
        allTimeCCPayments,
        dailyBurnRate,
        projectedMonthlyExpense,
        accountCount: accounts.length,
        transactionCount: transactions.length
      },
      expenses: {
        total: activeExpenseTotal,
        essentialTotal,
        discretionaryTotal,
        variableTotal,
        topCategories,
        topExpenses,
        allTimeCategoryTotals
      },
      income: incomeInsights,
      trends,
      anomalies: {
        unusualTransactions: unusualTransactions.slice(0, 6),
        categorySpikes,
        potentialDuplicates
      },
      alerts: {
        highUtilizationCards,
        liquidityAlerts,
        upcomingPayments: metrics?.upcomingPayments || []
      },
      recommendations,
      estimatedMonthlySavingsPotential,
      monthlyHistory: monthlyHistory.map(m => ({
        key: m.key,
        label: m.label,
        income: m.income,
        expense: m.expense,
        savings: m.savings,
        savingsRate: m.savingsRate,
        txCount: m.txCount
      }))
    };
  }

  // --- CONCISE, DATA-GROUNDED FORMATTERS ---

  static formatOverallSummary(insights) {
    const s = insights.summary;
    const lines = [
      `📊 **Financial Summary (${insights.activePeriod})**`,
      ``,
      `• **Net Worth:** ${AccountModel.formatCurrency(s.netPosition)} (Assets: ${AccountModel.formatCurrency(s.totalAssets)} | Debt: ${AccountModel.formatCurrency(s.totalLiabilities)})`,
      `• **Asset Split:** Liquid Cash/Bank **${AccountModel.formatCurrency(s.liquidAssets)}** | Invested (PF/FD/Demat) **${AccountModel.formatCurrency(s.investedAssets)}**`,
      `• **${insights.activePeriod} Cash Flow:** Income **${AccountModel.formatCurrency(s.activeMonthIncome)}** | Expenses **${AccountModel.formatCurrency(s.activeMonthExpense)}** | Net **${AccountModel.formatCurrency(s.activeMonthSavings)}** (${s.activeMonthSavingsRate}%)`,
      `• **Credit Utilization:** **${s.overallCreditUtilization}%** overall (${AccountModel.formatCurrency(s.totalLiabilities)} of ${AccountModel.formatCurrency(s.totalCreditLimit)})`
    ];

    if (insights.expenses.topCategories.length > 0) {
      const top3 = insights.expenses.topCategories.slice(0, 3)
        .map(c => `**${c.name}** ${AccountModel.formatCurrency(c.amount)} (${c.percentage}%)`)
        .join(', ');
      lines.push(`• **Top Spending:** ${top3}`);
    }

    if (insights.recommendations.length > 0) {
      lines.push('', '**Top Action Items:**');
      insights.recommendations.slice(0, 3).forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec.detail}`);
      });
    }

    return lines.join('\n');
  }

  static formatExpenseInsights(insights) {
    const e = insights.expenses;
    if (e.total === 0) {
      return `No expenses have been recorded for **${insights.activePeriod}** yet.`;
    }
    const lines = [
      `📉 **Expense Insights (${insights.activePeriod})**`,
      ``,
      `• **Total Spent:** ${AccountModel.formatCurrency(e.total)} (Daily avg: ${AccountModel.formatCurrency(insights.summary.dailyBurnRate)}/day)`,
      `• **Mix:** Essential **${AccountModel.formatCurrency(e.essentialTotal)}** | Discretionary **${AccountModel.formatCurrency(e.discretionaryTotal)}** | Variable **${AccountModel.formatCurrency(e.variableTotal)}**`,
      ``,
      `**Top Categories:**`
    ];
    e.topCategories.slice(0, 5).forEach((c, idx) => {
      lines.push(`${idx + 1}. **${c.name}**: ${AccountModel.formatCurrency(c.amount)} (${c.percentage}% • ${c.count} tx)`);
    });
    if (e.topExpenses.length > 0) {
      lines.push('', `**Largest Single Expense:** **${AccountModel.formatCurrency(e.topExpenses[0].amount)}** — ${e.topExpenses[0].description} (${e.topExpenses[0].category}) on ${TransactionModel.formatDate(e.topExpenses[0].date)}`);
    }
    return lines.join('\n');
  }

  static formatIncomeInsights(insights) {
    const inc = insights.income;
    const lines = [
      `📈 **Income Insights (${insights.activePeriod})**`,
      ``,
      `• **${insights.activePeriod} Income:** ${AccountModel.formatCurrency(inc.currentMonthIncome)}`,
      `• **All-Time Recorded Income:** ${AccountModel.formatCurrency(inc.allTimeIncome)}`
    ];
    if (insights.previousPeriod) {
      lines.push(`• **Previous Month (${insights.previousPeriod}):** ${AccountModel.formatCurrency(inc.previousMonthIncome)}`);
    }
    const byCat = Object.entries(inc.currentMonthByCategory).sort((a, b) => b[1] - a[1]);
    if (byCat.length > 0) {
      lines.push('', `**${insights.activePeriod} Breakdown:**`);
      byCat.forEach(([cat, amt]) => {
        lines.push(`• **${cat}**: ${AccountModel.formatCurrency(amt)}`);
      });
    }
    if (inc.missingSalaryDetected) {
      lines.push('', `💡 Note: No **Salary** entry has been logged yet for ${insights.activePeriod} (previous month salary was **${AccountModel.formatCurrency(inc.previousSalaryAmount)}**).`);
    }
    return lines.join('\n');
  }

  static formatSpendingTrends(insights) {
    const t = insights.trends;
    if (!t.previousPeriod) {
      return `Only **${insights.activePeriod}** has recorded transactions so far (Total Spent: **${AccountModel.formatCurrency(insights.summary.activeMonthExpense)}**, Daily avg: **${AccountModel.formatCurrency(insights.summary.dailyBurnRate)}/day**). Add another month of data to unlock month-over-month trend comparisons.`;
    }
    const expSign = t.expenseChange >= 0 ? '+' : '';
    const lines = [
      `📈 **Spending Trends: ${t.previousPeriod} ➔ ${t.currentPeriod}**`,
      ``,
      `• **Total Expenses:** ${expSign}${AccountModel.formatCurrency(t.expenseChange)}${t.expenseChangePct !== null ? ` (${expSign}${t.expenseChangePct}%)` : ''} — now **${AccountModel.formatCurrency(insights.summary.activeMonthExpense)}**`,
      `• **Daily Burn Rate:** ${AccountModel.formatCurrency(insights.summary.dailyBurnRate)}/day (Projected month-end: **${AccountModel.formatCurrency(insights.summary.projectedMonthlyExpense)}**)`
    ];
    if (t.risingCategories.length > 0) {
      lines.push('', '**Biggest Increases:**');
      t.risingCategories.slice(0, 4).forEach(c => {
        const pct = c.pctChange !== null ? ` (+${c.pctChange}%)` : ' (new)';
        lines.push(`• **${c.category}**: ${AccountModel.formatCurrency(c.previous)} ➔ **${AccountModel.formatCurrency(c.current)}** (+${AccountModel.formatCurrency(c.delta)}${pct})`);
      });
    }
    if (t.fallingCategories.length > 0) {
      lines.push('', '**Biggest Reductions:**');
      t.fallingCategories.slice(0, 3).forEach(c => {
        lines.push(`• **${c.category}**: ${AccountModel.formatCurrency(c.previous)} ➔ **${AccountModel.formatCurrency(c.current)}** (${AccountModel.formatCurrency(c.delta)})`);
      });
    }
    return lines.join('\n');
  }

  static formatUnusualSpending(insights) {
    const { unusualTransactions, categorySpikes, potentialDuplicates } = insights.anomalies;
    const lines = [`🔍 **Unusual Spending & Anomaly Check (${insights.activePeriod})**`];

    if (unusualTransactions.length === 0 && categorySpikes.length === 0 && potentialDuplicates.length === 0) {
      lines.push('', '✅ No unusual spending spikes or outlier transactions detected in your recent data.');
      return lines.join('\n');
    }

    if (unusualTransactions.length > 0) {
      lines.push('', '**High-Value / Outlier Transactions:**');
      unusualTransactions.slice(0, 4).forEach(tx => {
        lines.push(`• **${AccountModel.formatCurrency(tx.amount)}** — ${tx.description} (${tx.category}, ${tx.accountName}, ${TransactionModel.formatDate(tx.date)}): ${tx.reason}`);
      });
    }

    if (categorySpikes.length > 0) {
      lines.push('', '**Category Spending Spikes:**');
      categorySpikes.slice(0, 3).forEach(s => {
        const pct = s.pctChange !== null ? `+${s.pctChange}%` : 'new high spend';
        lines.push(`• **${s.category}**: ${AccountModel.formatCurrency(s.previous)} ➔ **${AccountModel.formatCurrency(s.current)}** (${pct})`);
      });
    }

    if (potentialDuplicates.length > 0) {
      lines.push('', '**Possible Duplicate Entries:**');
      potentialDuplicates.slice(0, 3).forEach(d => {
        lines.push(`• ${d.count}x **${AccountModel.formatCurrency(d.amount)}** (${d.type}, ${d.category}) on **${d.accountName}** on ${TransactionModel.formatDate(d.date)}`);
      });
    }

    return lines.join('\n');
  }

  static formatSavingsSuggestions(insights) {
    const lines = [`💡 **Personalized Savings & Financial Recommendations (${insights.activePeriod})**`];

    if (insights.estimatedMonthlySavingsPotential > 0) {
      lines.push('', `• **Estimated Monthly Savings Opportunity:** **${AccountModel.formatCurrency(insights.estimatedMonthlySavingsPotential)}/month** (**${AccountModel.formatCurrency(round2(insights.estimatedMonthlySavingsPotential * 12))}/year**)`);
    }

    if (insights.recommendations.length === 0) {
      lines.push('', '✅ Your finances look balanced! Keep tracking expenses and maintaining credit utilization below 30%.');
      return lines.join('\n');
    }

    lines.push('');
    insights.recommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1}. **${rec.title}:** ${rec.detail}`);
    });

    return lines.join('\n');
  }

  static formatFullAnalysis(insights) {
    const parts = [
      this.formatOverallSummary(insights),
      this.formatSpendingTrends(insights),
      this.formatUnusualSpending(insights),
      this.formatSavingsSuggestions(insights)
    ];
    return parts.join('\n\n---\n\n');
  }
}
