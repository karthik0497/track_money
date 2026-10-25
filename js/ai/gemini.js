// Track-Money: Google Gemini Generative AI Engine & Action Coordinator
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

let localDefaultKey = '';
let localDefaultModel = 'gemini-3.5-flash';
try {
  const localModule = await import('../config.local.js').catch(() => null);
  if (localModule?.LOCAL_CONFIG) {
    localDefaultKey = localModule.LOCAL_CONFIG.GEMINI_API_KEY || '';
    localDefaultModel = localModule.LOCAL_CONFIG.GEMINI_MODEL || 'gemini-3.5-flash';
  }
} catch (e) {
  // config.local.js is git-ignored and optional
}

export class GeminiService {
  static DEFAULT_KEY = localDefaultKey;
  static DEFAULT_MODEL = localDefaultModel;

  static getApiKey() {
    return localStorage.getItem('tm_gemini_api_key') || this.DEFAULT_KEY;
  }

  static getModel() {
    return localStorage.getItem('tm_gemini_model') || this.DEFAULT_MODEL;
  }

  static saveConfig(key, model) {
    if (key) localStorage.setItem('tm_gemini_api_key', key.trim());
    if (model) localStorage.setItem('tm_gemini_model', model.trim());
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

    // Build chat conversation turns
    const contents = [];

    // Add recent conversation history (up to last 6 turns)
    const recentHistory = (history || []).slice(-6);
    for (const h of recentHistory) {
      if (h.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: h.text }] });
      } else if (h.sender === 'ai' && h.text) {
        contents.push({ role: 'model', parts: [{ text: h.text }] });
      }
    }

    // Add current user message
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
        temperature: 0.3,
        maxOutputTokens: 1200
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
   * System Prompt incorporating real financial data & instructions
   */
  static buildSystemPrompt(context) {
    const currency = localStorage.getItem('tm_currency') || '₹';
    const netPos = context?.netPosition ?? 0;
    const totalAssets = context?.totalAssets ?? 0;
    const totalLiabilities = context?.totalLiabilities ?? 0;
    const income = context?.thisMonthIncome ?? 0;
    const expense = context?.thisMonthExpense ?? 0;
    const savings = context?.savingsThisMonth ?? 0;
    const savingsRate = context?.savingsRate ?? 0;
    const utilRate = context?.overallCreditUtilization ?? 0;

    const accountsStr = (context?.accounts || [])
      .map(a => `- ${a.name} (${a.type}): ${a.category === 'debit' ? `Balance ${currency}${a.balance}` : `Outstanding ${currency}${a.outstanding} (Limit ${currency}${a.limit}, ${a.utilizationRate}% util)`}`)
      .join('\n');

    const catSpendingStr = Object.entries(context?.categorySpending || {})
      .map(([cat, amt]) => `- ${cat}: ${currency}${amt}`)
      .join('\n') || 'None recorded yet';

    const recentTxStr = (context?.recentTransactions || []).slice(0, 25)
      .map(t => `- [${t.date}] ${t.type.toUpperCase()}: ${currency}${t.amount} (${t.category}${t.subcategory ? ' / ' + t.subcategory : ''}) on "${t.accountName}" - "${t.description || 'No description'}"`)
      .join('\n') || 'No recent transactions';

    const categoriesList = (context?.categories || []).map(c => c.name).join(', ');

    return `You are Track-Money AI Co-Pilot, the user's personal financial advisor and intelligent in-app agent.
You have direct, real-time read access to all the user's financial data, and write access via structured actions.

### USER'S LIVE FINANCIAL STATE:
- Currency: ${currency}
- Net Position (Net Worth): ${currency}${netPos.toLocaleString('en-IN')}
- Total Liquid Assets: ${currency}${totalAssets.toLocaleString('en-IN')}
- Total Liabilities (Credit Debt): ${currency}${totalLiabilities.toLocaleString('en-IN')}
- Overall Credit Utilization: ${utilRate}%
- This Month's Income: ${currency}${income.toLocaleString('en-IN')}
- This Month's Expenses: ${currency}${expense.toLocaleString('en-IN')}
- Net Savings This Month: ${currency}${savings.toLocaleString('en-IN')} (${savingsRate}% savings rate)

### ACCOUNTS:
${accountsStr || 'No accounts created yet'}

### THIS MONTH'S SPENDING BY CATEGORY:
${catSpendingStr}

### EXISTING CATEGORIES:
${categoriesList}

### RECENT TRANSACTIONS (Latest 25):
${recentTxStr}

### YOUR ROLE & INSTRUCTIONS:
1. **Financial Advisory & Insights**:
   - When asked what to improve, what they spend too much on, or how to save: deeply analyze their category spending and transaction history.
   - Point out specific spending leaks (e.g., dining, quick commerce, subscriptions, impulse shopping).
   - If Credit Card utilization > 30%, explicitly warn them that it harms their credit score and recommend paying it down immediately.
   - Give realistic, numbered, highly motivating recommendations with specific numbers.

2. **Transaction Queries**:
   - When asked about their transactions (e.g. "What did I spend on food?", "List all transactions above 2000", "Show my last 5 expenses"), calculate the exact numbers from the data above and list them cleanly.

3. **In-App Action Execution (Crucial)**:
   Whenever the user asks you to take an action inside the app, describe what you are doing in your text, and ALWAYS output a single JSON block at the very end of your response with the action structure:

   A) **Create Category** (e.g. "create category Gym with red tag" or "add a new category for Pet Care"):
   \`\`\`json
   {
     "action": "create_category",
     "parameters": {
       "name": "Category Name",
       "type": "expense",
       "icon": "🏷️",
       "color": "#ef4444"
     }
   }
   \`\`\`

   B) **Log Transaction** (Expense or Income):
   \`\`\`json
   {
     "action": "create_transaction",
     "parameters": {
       "type": "expense",
       "amount": 500,
       "accountName": "HDFC Bank",
       "category": "Food & Dining",
       "subcategory": "Lunch",
       "description": "Lunch with team"
     }
   }
   \`\`\`

   C) **Transfer Money or Pay Credit Card**:
   \`\`\`json
   {
     "action": "transfer_money",
     "parameters": {
       "fromAccount": "HDFC Bank",
       "toAccount": "ICICI Credit Card",
       "amount": 5000,
       "description": "Credit card bill payment",
       "isCreditCardPayment": true
     }
   }
   \`\`\`

   D) **Create Account**:
   \`\`\`json
   {
     "action": "create_account",
     "parameters": {
       "name": "SBI Savings",
       "category": "debit",
       "type": "Savings Account",
       "openingBalance": 10000
     }
   }
   \`\`\`

4. **Tone & Style**:
   - Modern, executive, punchy, concise, and helpful.
   - Use bold numbers and clear formatting.
   - Do not make up fake transactions; only ground your answers in the real data provided above.`;
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
      const accounts = await storage.getAll('accounts');
      let acc = accounts.find(a => (a.name || '').toLowerCase() === (params.accountName || '').toLowerCase());
      if (!acc) {
        // Fallback to first debit account or first account
        acc = accounts.find(a => a.category === 'debit') || accounts[0];
      }
      if (!acc) throw new Error('No accounts available to attach transaction to.');

      const tx = {
        type: params.type || 'expense',
        amount: Number(params.amount) || 0,
        accountId: acc.id,
        category: params.category || 'General',
        subcategory: params.subcategory || '',
        description: params.description || '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: acc.category === 'credit' ? 'Credit Card' : 'UPI'
      };

      await storage.addTransaction(tx);
      return {
        success: true,
        message: `Recorded ${tx.type} of ${AccountModel.formatCurrency(tx.amount)} in ${acc.name} under ${tx.category}!`
      };
    }

    if (actionType === 'transfer_money') {
      const accounts = await storage.getAll('accounts');
      const fromAcc = accounts.find(a => (a.name || '').toLowerCase().includes((params.fromAccount || '').toLowerCase())) || accounts.find(a => a.category === 'debit');
      const toAcc = accounts.find(a => (a.name || '').toLowerCase().includes((params.toAccount || '').toLowerCase()));

      if (!fromAcc || !toAcc) {
        throw new Error(`Could not locate accounts for transfer: "${params.fromAccount}" to "${params.toAccount}"`);
      }

      const amount = Number(params.amount) || 0;
      const isCC = toAcc.category === 'credit' || params.isCreditCardPayment;

      await storage.addTransaction({
        type: isCC ? 'credit_card_payment' : 'transfer',
        accountId: fromAcc.id,
        targetAccountId: toAcc.id,
        amount,
        category: isCC ? 'Credit Card Payment' : 'Transfer',
        subcategory: isCC ? 'Card Payoff' : 'Account Transfer',
        description: params.description || (isCC ? `Card Bill Payment: ${fromAcc.name} ➔ ${toAcc.name}` : `Transfer: ${fromAcc.name} ➔ ${toAcc.name}`),
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank Transfer'
      });

      return {
        success: true,
        message: `Successfully transferred ${AccountModel.formatCurrency(amount)} from ${fromAcc.name} to ${toAcc.name}${isCC ? ' (Debt Reduced!)' : ''}!`
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
