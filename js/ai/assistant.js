// Track-Money: AI Conversational Coordinator & Safety Flow Manager
import { NLUEngine } from './nlu.js';
import { FinancialQueryEngine } from './queries.js';
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class AssistantCoordinator {
  constructor(storage, onUpdateCallback = () => {}) {
    this.storage = storage;
    this.onUpdate = onUpdateCallback;
    this.conversationHistory = [];
    this.pendingAction = null; // Holds structured action awaiting user confirmation
  }

  async processInput(userInput) {
    const text = userInput.trim();
    if (!text) return null;

    // Add user message to history
    this.conversationHistory.push({
      sender: 'user',
      text,
      timestamp: Date.now()
    });

    const accounts = await this.storage.getAccountsWithCalculatedBalances();
    const categories = await this.storage.getAll('categories');

    // Check if user is replying to a pending question (e.g. account selection or confirm)
    if (this.pendingAction) {
      const handled = await this.handlePendingClarification(text, accounts);
      if (handled) return handled;
    }

    // Parse input using NLU engine
    const nluResult = NLUEngine.parse(text, accounts, categories);

    // 0. Create Account Intent
    if (nluResult.intent === 'create_account') {
      return await this.prepareAccountConfirmation(nluResult, text);
    }

    // 1. Query Intent: Answer questions from DB
    if (nluResult.intent === 'query_finance') {
      const answer = await FinancialQueryEngine.answer(text, this.storage);
      const aiMsg = {
        sender: 'ai',
        text: answer.text,
        type: 'query_answer',
        data: answer.data,
        timestamp: Date.now()
      };
      this.conversationHistory.push(aiMsg);
      return aiMsg;
    }

    // 2. Transfer Intent
    if (nluResult.intent === 'create_transfer') {
      if (!nluResult.amount) {
        return this.askClarification("How much money would you like to transfer?", 'clarification_amount', { intent: 'create_transfer' });
      }
      if (!nluResult.fromAccount || !nluResult.toAccount) {
        return this.askAccountClarification(
          "Please select which accounts to transfer between:",
          accounts.filter(a => a.category === 'debit'),
          'transfer_accounts',
          nluResult
        );
      }

      // Prepare confirmation for Transfer
      return await this.prepareTransferConfirmation(nluResult, text);
    }

    // 3. Credit Card Payment Intent
    if (nluResult.intent === 'pay_credit_card') {
      if (!nluResult.amount) {
        return this.askClarification("How much did you pay towards the credit card?", 'clarification_amount', { intent: 'pay_credit_card' });
      }
      if (!nluResult.targetAccount) {
        const creditCards = accounts.filter(a => a.category === 'credit');
        return this.askAccountClarification(
          "Which credit card did you pay?",
          creditCards,
          'credit_card_selection',
          nluResult
        );
      }
      return await this.prepareCreditCardPaymentConfirmation(nluResult, text);
    }

    // 4. Expense or Income Intent
    if (nluResult.intent === 'create_expense' || nluResult.intent === 'create_income') {
      // Check if amount is missing
      if (!nluResult.amount) {
        return this.askClarification(
          `I understood you want to record a ${nluResult.type}, but how much was the amount?`,
          'clarification_amount',
          nluResult
        );
      }

      // Check if account is ambiguous or missing
      if (!nluResult.account || nluResult.accountAmbiguous) {
        const candidates = nluResult.accountCandidates.length > 0 ? nluResult.accountCandidates : accounts;
        return this.askAccountClarification(
          `Which account did you use for this ${AccountModel.formatCurrency(nluResult.amount)} ${nluResult.type}?`,
          candidates,
          'transaction_account',
          nluResult
        );
      }

      // Ready for Confirmation Card
      return await this.prepareTransactionConfirmation(nluResult, text);
    }

    // Fallback response
    const fallbackMsg = {
      sender: 'ai',
      text: "I didn't quite catch that. You can tell me things like:\n• *\"Create account Bank Saving Account 6599\"*\n• *\"Spent 500 on lunch from HDFC\"*\n• *\"Paid 10,000 towards my credit card\"*\n• *\"What is my HDFC balance?\"*",
      type: 'text',
      timestamp: Date.now()
    };
    this.conversationHistory.push(fallbackMsg);
    return fallbackMsg;
  }

  async handlePendingClarification(text, accounts) {
    const clean = text.toLowerCase();

    // Check if user confirmed or rejected
    if (this.pendingAction && this.pendingAction.type === 'awaiting_confirmation') {
      if (['yes', 'confirm', 'yup', 'correct', 'ok', 'save', 'add', 'sure', 'create'].includes(clean)) {
        return await this.executeConfirmedAction();
      }
      if (['no', 'cancel', 'stop', 'edit', 'change', 'nevermind'].includes(clean)) {
        const isAcc = this.pendingAction.actionType === 'create_account';
        const cancelledMsg = {
          sender: 'ai',
          text: isAcc ? "❌ Account creation cancelled. No account was added." : "❌ Transaction cancelled. No changes were made.",
          type: 'text',
          timestamp: Date.now()
        };
        await this.storage.updateAiAuditStatus(this.pendingAction.auditId, 'cancelled');
        this.pendingAction = null;
        this.conversationHistory.push(cancelledMsg);
        return cancelledMsg;
      }
    }

    // Check if user responded to account selection (by number or name)
    if (this.pendingAction && this.pendingAction.clarificationType === 'transaction_account') {
      const chosenAccount = this.matchAccountFromInput(text, this.pendingAction.candidates);
      if (chosenAccount) {
        const nluData = { ...this.pendingAction.nluData, account: chosenAccount };
        this.pendingAction = null;
        return await this.prepareTransactionConfirmation(nluData, nluData.rawText);
      }
    }

    // Check if user provided missing amount
    if (this.pendingAction && this.pendingAction.clarificationType === 'clarification_amount') {
      const amount = NLUEngine.extractAmount(text);
      if (amount) {
        const nluData = { ...this.pendingAction.nluData, amount };
        this.pendingAction = null;
        if (!nluData.account) {
          return this.askAccountClarification(
            `Which account did you use for this ${AccountModel.formatCurrency(amount)}?`,
            accounts,
            'transaction_account',
            nluData
          );
        }
        return await this.prepareTransactionConfirmation(nluData, nluData.rawText);
      }
    }

    return null;
  }

  matchAccountFromInput(text, candidates) {
    const clean = text.toLowerCase().trim();
    // Match by number (1, 2, 3...)
    const num = parseInt(clean);
    if (!isNaN(num) && num >= 1 && num <= candidates.length) {
      return candidates[num - 1];
    }
    // Match by name
    return NLUEngine.fuzzyFindAccount(clean, candidates);
  }

  askClarification(questionText, clarificationType, nluData) {
    this.pendingAction = {
      clarificationType,
      nluData
    };
    const msg = {
      sender: 'ai',
      text: questionText,
      type: 'clarification',
      timestamp: Date.now()
    };
    this.conversationHistory.push(msg);
    return msg;
  }

  askAccountClarification(prompt, candidates, clarificationType, nluData) {
    this.pendingAction = {
      clarificationType,
      candidates,
      nluData
    };

    const optionsList = candidates.map((acc, idx) => `${idx + 1}. **${acc.name}** (${acc.category === 'credit' ? 'Credit / Limit: ' + AccountModel.formatCurrency(acc.creditLimit) : 'Balance: ' + AccountModel.formatCurrency(acc.currentBalance)})`).join('\n');

    const msg = {
      sender: 'ai',
      text: `${prompt}\n\n${optionsList}`,
      type: 'account_choice',
      candidates,
      timestamp: Date.now()
    };
    this.conversationHistory.push(msg);
    return msg;
  }

  async prepareAccountConfirmation(nluResult, rawUtterance) {
    const isCredit = nluResult.isCredit;
    const audit = await this.storage.logAiAudit({
      originalMessage: rawUtterance,
      interpretedAction: {
        action: 'create_account',
        name: nluResult.name,
        category: nluResult.accountCategory,
        accountType: nluResult.accountType,
        amount: nluResult.amount
      },
      confirmationStatus: 'pending'
    });

    const accountData = {
      name: nluResult.name,
      category: nluResult.accountCategory,
      type: nluResult.accountType,
      openingBalance: isCredit ? 0 : (nluResult.amount || 0),
      creditLimit: isCredit ? (nluResult.amount || 0) : 0,
      openingOutstanding: 0,
      currentOutstanding: 0,
      availableCredit: isCredit ? (nluResult.amount || 0) : 0,
      billingCycle: isCredit ? '1st of month' : '',
      dueDate: isCredit ? '20th of month' : '',
      description: `Created via AI Assistant: "${rawUtterance}"`,
      aiAuditId: audit.id
    };

    this.pendingAction = {
      type: 'awaiting_confirmation',
      actionType: 'create_account',
      auditId: audit.id,
      accountData
    };

    const confirmMsg = {
      sender: 'ai',
      text: `Please confirm creating this **NEW ACCOUNT**:`,
      type: 'confirmation_card',
      data: {
        ...accountData,
        isAccount: true,
        actionType: 'create_account'
      },
      timestamp: Date.now()
    };
    this.conversationHistory.push(confirmMsg);
    return confirmMsg;
  }

  async prepareTransactionConfirmation(nluResult, rawUtterance) {
    const audit = await this.storage.logAiAudit({
      originalMessage: rawUtterance,
      interpretedAction: {
        action: 'create_transaction',
        type: nluResult.type,
        amount: nluResult.amount,
        account: nluResult.account.name,
        accountId: nluResult.account.id,
        category: nluResult.category,
        subcategory: nluResult.subcategory,
        date: nluResult.date,
        description: nluResult.description
      },
      confirmationStatus: 'pending'
    });

    this.pendingAction = {
      type: 'awaiting_confirmation',
      actionType: 'transaction',
      auditId: audit.id,
      transactionData: {
        accountId: nluResult.account.id,
        accountName: nluResult.account.name,
        type: nluResult.type,
        amount: nluResult.amount,
        category: nluResult.category,
        subcategory: nluResult.subcategory,
        date: nluResult.date,
        description: nluResult.description,
        paymentMethod: nluResult.account.category === 'credit' ? 'Credit Card' : 'UPI / Debit',
        notes: `Recorded via AI: "${rawUtterance}"`,
        aiAuditId: audit.id
      }
    };

    const confirmMsg = {
      sender: 'ai',
      text: `Please confirm this **${nluResult.type.toUpperCase()}**:`,
      type: 'confirmation_card',
      data: this.pendingAction.transactionData,
      suggestedNewCategory: nluResult.suggestedNewCategory,
      timestamp: Date.now()
    };
    this.conversationHistory.push(confirmMsg);
    return confirmMsg;
  }

  async prepareTransferConfirmation(nluResult, rawUtterance) {
    const audit = await this.storage.logAiAudit({
      originalMessage: rawUtterance,
      interpretedAction: {
        action: 'create_transfer',
        amount: nluResult.amount,
        fromAccount: nluResult.fromAccount.name,
        toAccount: nluResult.toAccount.name,
        date: nluResult.date
      },
      confirmationStatus: 'pending'
    });

    this.pendingAction = {
      type: 'awaiting_confirmation',
      actionType: 'transfer',
      auditId: audit.id,
      transactionData: {
        accountId: nluResult.fromAccount.id,
        targetAccountId: nluResult.toAccount.id,
        fromAccountName: nluResult.fromAccount.name,
        toAccountName: nluResult.toAccount.name,
        type: 'transfer',
        amount: nluResult.amount,
        category: 'Transfer',
        subcategory: 'Account Transfer',
        date: nluResult.date,
        description: `Transfer from ${nluResult.fromAccount.name} to ${nluResult.toAccount.name}`,
        paymentMethod: 'Bank Transfer',
        notes: `Recorded via AI: "${rawUtterance}"`,
        aiAuditId: audit.id
      }
    };

    const confirmMsg = {
      sender: 'ai',
      text: `Please confirm this **TRANSFER**:`,
      type: 'confirmation_card',
      data: this.pendingAction.transactionData,
      timestamp: Date.now()
    };
    this.conversationHistory.push(confirmMsg);
    return confirmMsg;
  }

  async prepareCreditCardPaymentConfirmation(nluResult, rawUtterance) {
    const audit = await this.storage.logAiAudit({
      originalMessage: rawUtterance,
      interpretedAction: {
        action: 'pay_credit_card',
        amount: nluResult.amount,
        targetAccount: nluResult.targetAccount.name,
        fromAccount: nluResult.fromAccount ? nluResult.fromAccount.name : 'Bank Account'
      },
      confirmationStatus: 'pending'
    });

    this.pendingAction = {
      type: 'awaiting_confirmation',
      actionType: 'credit_card_payment',
      auditId: audit.id,
      transactionData: {
        accountId: nluResult.fromAccount ? nluResult.fromAccount.id : 'acc_hdfc_bank',
        targetAccountId: nluResult.targetAccount.id,
        fromAccountName: nluResult.fromAccount ? nluResult.fromAccount.name : 'HDFC Bank',
        targetAccountName: nluResult.targetAccount.name,
        type: 'credit_card_payment',
        amount: nluResult.amount,
        category: 'Bills & Utilities',
        subcategory: 'Credit Card Bill',
        date: nluResult.date,
        description: `Payment towards ${nluResult.targetAccount.name}`,
        paymentMethod: 'Net Banking',
        notes: `Recorded via AI: "${rawUtterance}"`,
        aiAuditId: audit.id
      }
    };

    const confirmMsg = {
      sender: 'ai',
      text: `Please confirm this **CREDIT CARD PAYMENT**:`,
      type: 'confirmation_card',
      data: this.pendingAction.transactionData,
      timestamp: Date.now()
    };
    this.conversationHistory.push(confirmMsg);
    return confirmMsg;
  }

  async executeConfirmedAction() {
    if (!this.pendingAction) return null;

    if (this.pendingAction.actionType === 'create_account') {
      const accData = this.pendingAction.accountData;
      const auditId = this.pendingAction.auditId;

      const newAccount = AccountModel.create(accData);
      await this.storage.put('accounts', newAccount);
      await this.storage.updateAiAuditStatus(auditId, 'confirmed', newAccount.id);

      let successText = `✅ **Account Created Successfully!**\n\n` +
                        `Created **${newAccount.name}** (${newAccount.type}).\n`;
      if (newAccount.category === 'credit') {
        successText += `Credit Limit: **${AccountModel.formatCurrency(newAccount.creditLimit)}** (Available: ${AccountModel.formatCurrency(newAccount.availableCredit)})`;
      } else {
        successText += `Opening Balance: **${AccountModel.formatCurrency(newAccount.openingBalance)}**`;
      }

      this.pendingAction = null;
      const successMsg = {
        sender: 'ai',
        text: successText,
        type: 'account_success',
        data: newAccount,
        timestamp: Date.now()
      };
      this.conversationHistory.push(successMsg);

      // Trigger UI refresh
      this.onUpdate();

      return successMsg;
    }

    if (!this.pendingAction.transactionData) return null;

    const data = this.pendingAction.transactionData;
    const auditId = this.pendingAction.auditId;

    // Persist transaction to database
    const createdTx = await this.storage.addTransaction(data);
    await this.storage.updateAiAuditStatus(auditId, 'confirmed', createdTx.id);

    // Fetch updated balance for feedback
    const updatedAcc = await this.storage.getAccountById(data.accountId);

    let successText = `✅ **Transaction Created Successfully!**\n\n`;
    if (data.type === 'expense') {
      successText += `Recorded **-${AccountModel.formatCurrency(data.amount)}** (${data.category}) from **${updatedAcc.name}**.\n` +
                     `New Balance: **${AccountModel.formatCurrency(updatedAcc.currentBalance)}**`;
    } else if (data.type === 'income') {
      successText += `Credited **+${AccountModel.formatCurrency(data.amount)}** to **${updatedAcc.name}**.\n` +
                     `New Balance: **${AccountModel.formatCurrency(updatedAcc.currentBalance)}**`;
    } else if (data.type === 'transfer') {
      const toAcc = await this.storage.getAccountById(data.targetAccountId);
      successText += `Transferred **${AccountModel.formatCurrency(data.amount)}** from **${data.fromAccountName}** to **${toAcc ? toAcc.name : data.toAccountName}**.`;
    } else if (data.type === 'credit_card_payment') {
      const cardAcc = await this.storage.getAccountById(data.targetAccountId);
      successText += `Paid **${AccountModel.formatCurrency(data.amount)}** towards **${data.targetAccountName}**.\n` +
                     `New Outstanding: **${AccountModel.formatCurrency(cardAcc.currentOutstanding)}** (Available Credit: ${AccountModel.formatCurrency(cardAcc.availableCredit)})`;
    }

    this.pendingAction = null;
    const successMsg = {
      sender: 'ai',
      text: successText,
      type: 'transaction_success',
      data: createdTx,
      timestamp: Date.now()
    };
    this.conversationHistory.push(successMsg);

    // Trigger UI refresh
    this.onUpdate();

    return successMsg;
  }

  cancelPendingAction() {
    if (this.pendingAction && this.pendingAction.auditId) {
      this.storage.updateAiAuditStatus(this.pendingAction.auditId, 'cancelled');
    }
    this.pendingAction = null;
  }
}
