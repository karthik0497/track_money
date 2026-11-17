// Track-Money: Google Gemini Generative AI Engine & Action Coordinator
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';
import { APP_CONFIG } from '../config.js';

const lsGet = (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null);
const lsSet = (k, v) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); };

export class GeminiService {
  static DEFAULT_KEY = APP_CONFIG?.DEFAULT_GEMINI_KEY || '';
  static DEFAULT_MODEL = APP_CONFIG?.GEMINI_MODEL || 'gemini-3.5-flash';

  static getApiKey() {
    return lsGet('tm_gemini_api_key') || this.DEFAULT_KEY;
  }

  static getModel() {
    return lsGet('tm_gemini_model') || this.DEFAULT_MODEL;
  }

  static saveConfig(key, model) {
    if (key) lsSet('tm_gemini_api_key', key.trim());
    if (model) lsSet('tm_gemini_model', model.trim());
  }

  static isConfigured() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
  }

  static async testConnection() {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const startTime = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [{ text: "Hello Gemini, reply with 'Connected' in 1 word." }]
        }]
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const latency = Date.now() - startTime;
      if (!response.ok) {
        const errText = await response.text();
        return { success: false, status: response.status, error: errText, latency };
      }
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { success: true, text: text.trim(), latency, model };
    } catch (e) {
      return { success: false, error: e.message, latency: Date.now() - startTime };
    }
  }

  /**
   * Generates a generative AI response using the user's real financial context
   */
  static async generateResponse(userMessage, context, history = []) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const systemPrompt = this.buildSystemPrompt(context);

    // Build chat conversation turns (avoid duplicating userMessage if already pushed to history)
    const contents = [];
    const recentHistory = (history || []).slice(-6);
    const lastHist = recentHistory[recentHistory.length - 1];
    const historyToInclude = (lastHist && lastHist.sender === 'user' && lastHist.text === userMessage)
      ? recentHistory.slice(0, -1)
      : recentHistory;

    for (const h of historyToInclude) {
      if (h.sender === 'user' && h.text) {
        contents.push({ role: 'user', parts: [{ text: h.text }] });
      } else if (h.sender === 'ai' && h.text) {
        contents.push({ role: 'model', parts: [{ text: h.text }] });
      }
    }

    // Add current user message once
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 700
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const replyText = candidate?.content?.parts?.[0]?.text || 'I analyzed your data, but could not produce a response.';

      // Parse structured actions if Gemini produced any
      const { cleanText, action } = this.extractActionFromResponse(replyText, context);

      return {
        text: cleanText,
        action,
        model
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Gemini request timed out. Please check your internet connection.');
      }
      throw err;
    }
  }

  /**
   * Compact, High-Speed System Prompt incorporating real financial data & pre-computed analytics
   */
  static buildSystemPrompt(context) {
    const currency = lsGet('tm_currency') || '₹';
    const netPos = context?.netPosition ?? 0;
    const totalAssets = context?.totalAssets ?? 0;
    const liquidAssets = context?.liquidAssets ?? totalAssets;
    const investedAssets = context?.investedAssets ?? 0;
    const totalLiabilities = context?.totalLiabilities ?? 0;
    const income = context?.thisMonthIncome ?? 0;
    const expense = context?.thisMonthExpense ?? 0;
    const savings = context?.savingsThisMonth ?? 0;
    const savingsRate = context?.savingsRate ?? 0;
    const utilRate = context?.overallCreditUtilization ?? 0;

    const accountsStr = (context?.accounts || [])
      .map(a => `- ${a.name} (${a.type}): ${a.category === 'debit' ? `Bal ${currency}${a.balance}` : `Debt ${currency}${a.outstanding} / Limit ${currency}${a.limit} (Avail ${currency}${a.availableCredit}, ${a.utilizationRate}% util)`}`)
      .join('\n');

    const catSpendingStr = Object.entries(context?.categorySpending || {})
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `- ${cat}: ${currency}${amt}`)
      .join('\n') || 'None recorded yet';

    const recentTxStr = (context?.recentTransactions || []).slice(0, 15)
      .map(t => `- [${t.date}] ${t.type.toUpperCase()}: ${currency}${t.amount} (${t.category}) on "${t.accountName}"${t.targetAccountName ? ' -> "' + t.targetAccountName + '"' : ''}${t.description ? ' - ' + t.description : ''}`)
      .join('\n') || 'No recent transactions';

    const categoriesList = (context?.categories || []).map(c => typeof c === 'string' ? c : c.name).join(', ');

    const ins = context?.insights || {};
    const monthlyHistStr = (ins.monthlyHistory || [])
      .map(m => `- ${m.label}: Income ${currency}${m.income}, Expense ${currency}${m.expense}, Savings ${currency}${m.savings} (${m.savingsRate}%)`)
      .join('\n') || 'Single month only';

    const trendsStr = ins.trends?.previousPeriod
      ? `Vs ${ins.trends.previousPeriod}: Expenses ${ins.trends.expenseChange >= 0 ? '+' : ''}${currency}${ins.trends.expenseChange} (${ins.trends.expenseChangePct ?? 0}%). Rising: ${(ins.trends.risingCategories || []).map(c => `${c.category} +${currency}${c.delta}`).join(', ') || 'None'}.`
      : 'No prior month comparison yet.';

    const anomaliesStr = [
      ...(ins.anomalies?.unusualTransactions || []).map(t => `Outlier: ${currency}${t.amount} ${t.category} (${t.description}) on ${t.date} - ${t.reason}`),
      ...(ins.anomalies?.potentialDuplicates || []).map(d => `Possible duplicate: ${d.count}x ${currency}${d.amount} (${d.type}) on ${d.accountName} on ${d.date}`)
    ].join('\n') || 'None detected';

    const alertsStr = [
      ...(ins.highUtilizationCards || []).map(c => `High Util: ${c.name} at ${c.utilizationRate}% (pay ${currency}${c.payoffToReach30} to drop under 30%)`),
      ...(ins.liquidityAlerts || []).map(a => `Low Balance: ${a.accountName} (${currency}${a.accountBalance}) < recurring ${a.recurringTitle} (${currency}${a.recurringAmount})`),
      ...(ins.trends?.missingSalaryDetected ? [`Missing Salary: Previous month had ${currency}${ins.trends.previousSalaryAmount} salary; none logged this month yet.`] : [])
    ].join('\n') || 'None';

    return `You are Track-Money AI, a fast, data-driven personal finance advisor and in-app agent.
Ground EVERY answer strictly in the verified live data below. Never fabricate numbers or transactions.

### LIVE FINANCIAL STATE (${context?.activePeriod || 'Current'}):
- Net Worth: ${currency}${netPos.toLocaleString('en-IN')}
- Assets: ${currency}${totalAssets.toLocaleString('en-IN')} (Liquid: ${currency}${liquidAssets.toLocaleString('en-IN')} | Invested: ${currency}${investedAssets.toLocaleString('en-IN')})
- Debt: ${currency}${totalLiabilities.toLocaleString('en-IN')} (Overall Util: ${utilRate}%)
- This Month: Income ${currency}${income.toLocaleString('en-IN')} | Expenses ${currency}${expense.toLocaleString('en-IN')} | Savings ${currency}${savings.toLocaleString('en-IN')} (${savingsRate}%)

### ACCOUNTS:
${accountsStr || 'No accounts created yet'}

### THIS MONTH SPENDING BY CATEGORY:
${catSpendingStr}

### MONTHLY HISTORY:
${monthlyHistStr}

### TRENDS & PATTERNS:
${trendsStr}

### UNUSUAL SPENDING & ANOMALIES:
${anomaliesStr}

### ALERTS & RISKS:
${alertsStr}

### CATEGORIES:
${categoriesList}

### RECENT TRANSACTIONS (Top 15):
${recentTxStr}

### INSTRUCTIONS:
1. Give concise, specific, number-backed insights, trends, anomaly callouts, and personalized savings recommendations using ONLY the actual figures above.
2. When asked to perform an in-app action (create category, log expense/income, transfer money, pay credit card, create account), briefly describe it and append ONE JSON block at the very end:
   - create_category: {"action":"create_category","parameters":{"name":"...","type":"expense","icon":"🏷️","color":"#ef4444"}}
   - create_transaction: {"action":"create_transaction","parameters":{"type":"expense","amount":500,"accountName":"ICICI","category":"Food","subcategory":"Lunch","description":"..."}}
   - transfer_money: {"action":"transfer_money","parameters":{"fromAccount":"ICICI","toAccount":"IOB","amount":5000,"description":"...","isCreditCardPayment":false}}
   - create_account: {"action":"create_account","parameters":{"name":"SBI Savings","category":"debit","type":"Savings Account","openingBalance":10000}}`;
  }

  /**
   * Extract JSON action block from Gemini's response
   */
  static extractActionFromResponse(text, context) {
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);

    if (!match) {
      return { cleanText: text, action: null };
    }

    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action) {
        // Remove the json block from the displayed text for a clean UI
        const cleanText = text.replace(jsonRegex, '').trim();
        return { cleanText, action: parsed };
      }
    } catch (e) {
      console.warn('Could not parse Gemini action JSON:', e);
    }

    return { cleanText: text, action: null };
  }

  static _findAccountByName(accounts, nameQuery, preferredCategory = null) {
    const q = (nameQuery || '').trim().toLowerCase();
    if (!q) return null;
    const pool = preferredCategory ? accounts.filter(a => a.category === preferredCategory) : accounts;
    const exact = pool.find(a => (a.name || '').toLowerCase() === q)
      || accounts.find(a => (a.name || '').toLowerCase() === q);
    if (exact) return exact;
    return pool.find(a => (a.name || '').toLowerCase().includes(q) || q.includes((a.name || '').toLowerCase()))
      || accounts.find(a => (a.name || '').toLowerCase().includes(q) || q.includes((a.name || '').toLowerCase()))
      || null;
  }

  /**
   * Execute action directly against local IndexedDB storage
   */
  static async executeAction(action, storage) {
    if (!action || !action.action || !action.parameters) {
      throw new Error('Invalid action format');
    }

    const { action: actionType, parameters: params } = action;

    if (actionType === 'create_category') {
      const name = params.name?.trim();
      if (!name) throw new Error('Category name is required');
      const catObj = {
        name,
        type: params.type || 'expense',
        icon: params.icon || '🏷️',
        color: params.color || '#eab308',
        subcategories: params.subcategories || ['General']
      };
      await storage.put('categories', catObj);
      return {
        success: true,
        message: `Created new category "${name}" with icon ${catObj.icon} and tag ${catObj.color}!`
      };
    }

    if (actionType === 'create_transaction') {
      const accounts = await storage.getAccountsWithCalculatedBalances();
      const amount = Number(params.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Transaction amount must be greater than 0.');
      }

      let acc = this._findAccountByName(accounts, params.accountName);
      if (!acc) {
        acc = accounts.find(a => a.category === 'debit') || accounts[0];
      }
      if (!acc) throw new Error('No accounts available to attach transaction to.');

      const tx = {
        type: params.type || 'expense',
        amount,
        accountId: acc.id,
        category: params.category || (params.type === 'income' ? 'Other Income' : 'Other Expense'),
        subcategory: params.subcategory || '',
        description: params.description || '',
        date: params.date || new Date().toISOString().split('T')[0],
        paymentMethod: acc.category === 'credit' ? 'Credit Card' : 'UPI'
      };

      await storage.addTransaction(tx);
      const updated = await storage.getAccountById(acc.id);
      const balInfo = updated.category === 'credit'
        ? `Outstanding: ${AccountModel.formatCurrency(updated.currentOutstanding)}`
        : `New Balance: ${AccountModel.formatCurrency(updated.currentBalance)}`;

      return {
        success: true,
        message: `Recorded ${tx.type} of ${AccountModel.formatCurrency(tx.amount)} in ${acc.name} under ${tx.category}! (${balInfo})`
      };
    }

    if (actionType === 'transfer_money') {
      const accounts = await storage.getAccountsWithCalculatedBalances();
      const amount = Number(params.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Transfer amount must be greater than 0.');
      }

      const fromAcc = this._findAccountByName(accounts, params.fromAccount, 'debit')
        || accounts.find(a => a.category === 'debit');
      const preferToCat = params.isCreditCardPayment ? 'credit' : null;
      const toAcc = this._findAccountByName(accounts, params.toAccount, preferToCat);

      if (!fromAcc || !toAcc) {
        throw new Error(`Could not locate accounts for transfer: "${params.fromAccount}" to "${params.toAccount}"`);
      }
      if (fromAcc.id === toAcc.id) {
        throw new Error('Source and destination accounts must be different.');
      }

      const isCC = toAcc.category === 'credit' || params.isCreditCardPayment;

      await storage.addTransaction({
        type: isCC ? 'credit_card_payment' : 'transfer',
        accountId: fromAcc.id,
        targetAccountId: toAcc.id,
        amount,
        category: isCC ? 'Bills & Utilities' : 'Transfer',
        subcategory: isCC ? 'Credit Card Bill' : 'Account Transfer',
        description: params.description || (isCC ? `Card Bill Payment: ${fromAcc.name} ➔ ${toAcc.name}` : `Transfer: ${fromAcc.name} ➔ ${toAcc.name}`),
        date: params.date || new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank Transfer'
      });

      const [updatedFrom, updatedTo] = await Promise.all([
        storage.getAccountById(fromAcc.id),
        storage.getAccountById(toAcc.id)
      ]);

      return {
        success: true,
        message: `Transferred ${AccountModel.formatCurrency(amount)} from ${fromAcc.name} (${AccountModel.formatCurrency(updatedFrom.currentBalance)}) to ${toAcc.name} (${isCC ? 'Outstanding: ' + AccountModel.formatCurrency(updatedTo.currentOutstanding) : AccountModel.formatCurrency(updatedTo.currentBalance)})!`
      };
    }

    if (actionType === 'create_account') {
      const isCredit = params.category === 'credit' || (params.type && (params.type.includes('Credit') || params.type.includes('BNPL')));
      const accData = {
        name: params.name,
        category: isCredit ? 'credit' : (params.category || 'debit'),
        type: params.type || (isCredit ? 'Credit Card' : 'Bank Account'),
        openingBalance: params.openingBalance || 0,
        creditLimit: params.creditLimit || 0,
        dueDay: params.dueDay ? parseInt(params.dueDay, 10) : (params.dueDate ? AccountModel.parseDueDay({ dueDate: params.dueDate }) : 20),
        dueDate: params.dueDate || `${params.dueDay || 20}th of month`
      };
      const created = AccountModel.create(accData);
      await storage.put('accounts', created);
      return {
        success: true,
        message: `Created new ${created.type} account "${created.name}"${isCredit ? ` (Due on ${created.dueDay}th of every month)` : ''}!`
      };
    }

    throw new Error(`Unknown action: ${actionType}`);
  }
}
