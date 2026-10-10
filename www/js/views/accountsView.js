// Track-Money: Accounts Management & Details View
import { AccountModel, ACCOUNT_TYPES } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class AccountsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
    this.activeTab = 'all'; // 'all', 'debit', 'credit'
    this.selectedAccountId = null;
  }

  async render(container, options = {}) {
    if (options.filter) {
      this.activeTab = options.filter;
    }
    if (options.selectedAccountId) {
      this.selectedAccountId = options.selectedAccountId;
    }

    const accounts = await this.storage.getAccountsWithCalculatedBalances();
    const debitAccounts = accounts.filter(a => a.category === 'debit');
    const creditAccounts = accounts.filter(a => a.category === 'credit');

    const totalAssets = debitAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const totalLiabilities = creditAccounts.reduce((sum, a) => sum + (a.currentOutstanding || 0), 0);
    const totalLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
    const overallUtil = totalLimit > 0 ? ((totalLiabilities / totalLimit) * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="accounts-container fade-in">
        <!-- Accounts Header & Switcher -->
        <div class="page-header">
          <div>
            <h2>Financial Accounts</h2>
            <p class="text-sm text-muted">Manage your asset and credit portfolios</p>
          </div>
          <button class="btn btn-primary" id="btn-add-account">
            <span>➕ New Account</span>
          </button>
        </div>

        <!-- Segmented Tab Switcher -->
        <div class="tabs-segmented">
          <button class="tab-btn ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all">
            All Accounts (${accounts.length})
          </button>
          <button class="tab-btn ${this.activeTab === 'debit' ? 'active' : ''}" data-tab="debit">
            Assets / Debit (${debitAccounts.length})
          </button>
          <button class="tab-btn ${this.activeTab === 'credit' ? 'active' : ''}" data-tab="credit">
            Credit & BNPL (${creditAccounts.length})
          </button>
        </div>

        <!-- Summary Metric Strips -->
        <div class="accounts-summary-row">
          <div class="summary-chip debit-summary">
            <span class="chip-label">Total Assets</span>
            <span class="chip-val text-success">${AccountModel.formatCurrency(totalAssets)}</span>
          </div>
          <div class="summary-chip credit-summary">
            <span class="chip-label">Total Outstanding</span>
            <span class="chip-val text-danger">${AccountModel.formatCurrency(totalLiabilities)}</span>
          </div>
          <div class="summary-chip util-summary">
            <span class="chip-label">Credit Utilization</span>
            <span class="chip-val text-warning">${overallUtil}%</span>
          </div>
        </div>

        <!-- SECTION A: Debit / Asset Accounts -->
        ${(this.activeTab === 'all' || this.activeTab === 'debit') ? `
          <div class="account-section">
            <div class="section-title">
              <div class="title-with-icon">
                <span class="section-badge badge-success">ASSETS</span>
                <h3>Debit & Bank Accounts</h3>
              </div>
              <span class="text-xs text-muted">${debitAccounts.length} active</span>
            </div>

            <div class="accounts-card-grid">
              ${debitAccounts.map(acc => `
                <div class="card account-card debit-card" data-account-id="${acc.id}">
                  <div class="card-top-row">
                    <div class="acc-brand">
                      <div class="acc-icon-box" style="background: ${acc.color}25; color: ${acc.color};">
                        ${acc.icon || '🏦'}
                      </div>
                      <div>
                        <h4 class="acc-name">${acc.name}</h4>
                        <span class="badge badge-subtle text-xs">${acc.type}</span>
                      </div>
                    </div>
                    <button class="btn btn-icon btn-sm view-acc-btn" data-id="${acc.id}" title="View Details">
                      ➔
                    </button>
                  </div>

                  <div class="acc-balance-block">
                    <span class="balance-label">Current Balance</span>
                    <div class="balance-number text-success">
                      ${AccountModel.formatCurrency(acc.currentBalance)}
                    </div>
                  </div>

                  <div class="acc-footer-stats">
                    <div class="acc-stat-col">
                      <span class="text-xs text-muted">Income</span>
                      <span class="font-bold text-xs text-success">+${AccountModel.formatCurrency(acc.totalIncome)}</span>
                    </div>
                    <div class="acc-stat-col">
                      <span class="text-xs text-muted">Spent</span>
                      <span class="font-bold text-xs text-danger">-${AccountModel.formatCurrency(acc.totalSpent)}</span>
                    </div>
                    <div class="acc-stat-col">
                      <span class="text-xs text-muted">Opening</span>
                      <span class="font-bold text-xs">${AccountModel.formatCurrency(acc.openingBalance)}</span>
                    </div>
                  </div>

                  <div class="card-quick-actions">
                    <button class="btn btn-xs btn-outline quick-add-tx" data-id="${acc.id}">+ Expense/Income</button>
                    <button class="btn btn-xs btn-outline quick-transfer" data-id="${acc.id}">Transfer</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- SECTION B: Credit / Liability Accounts -->
        ${(this.activeTab === 'all' || this.activeTab === 'credit') ? `
          <div class="account-section" style="margin-top: 2rem;">
            <div class="section-title">
              <div class="title-with-icon">
                <span class="section-badge badge-danger">LIABILITIES</span>
                <h3>Credit & BNPL Accounts</h3>
              </div>
              <span class="text-xs text-muted">${creditAccounts.length} active</span>
            </div>

            <div class="accounts-card-grid">
              ${creditAccounts.map(acc => {
                const util = Number(acc.utilizationRate) || 0;
                return `
                  <div class="card account-card credit-card" data-account-id="${acc.id}">
                    <div class="card-top-row">
                      <div class="acc-brand">
                        <div class="acc-icon-box" style="background: ${acc.color}25; color: ${acc.color};">
                          ${acc.icon || '💳'}
                        </div>
                        <div>
                          <h4 class="acc-name">${acc.name}</h4>
                          <span class="badge badge-subtle text-xs">${acc.type}</span>
                        </div>
                      </div>
                      <span class="badge ${util > 30 ? 'badge-warning' : 'badge-success'}">${util}% util</span>
                    </div>

                    <div class="credit-card-balances">
                      <div>
                        <span class="balance-label">Outstanding Balance</span>
                        <div class="balance-number text-danger">
                          ${AccountModel.formatCurrency(acc.currentOutstanding)}
                        </div>
                      </div>
                      <div style="text-align: right;">
                        <span class="balance-label">Available Credit</span>
                        <div class="balance-number text-success" style="font-size: 1.15rem;">
                          ${AccountModel.formatCurrency(acc.availableCredit)}
                        </div>
                      </div>
                    </div>

                    <!-- Progress bar for credit limit utilization -->
                    <div class="util-progress-bar">
                      <div class="util-fill ${util > 30 ? 'bg-warning' : 'bg-danger'}" style="width: ${Math.min(100, util)}%;"></div>
                    </div>

                    <div class="acc-footer-stats">
                      <div class="acc-stat-col">
                        <span class="text-xs text-muted">Total Limit</span>
                        <span class="font-bold text-xs">${AccountModel.formatCurrency(acc.creditLimit)}</span>
                      </div>
                      <div class="acc-stat-col">
                        <span class="text-xs text-muted">Due Date</span>
                        <span class="font-bold text-xs text-warning">${acc.dueDate ? TransactionModel.formatDate(acc.dueDate) : 'N/A'}</span>
                      </div>
                      <div class="acc-stat-col">
                        <span class="text-xs text-muted">Cycle</span>
                        <span class="font-bold text-xs">${acc.billingCycle || 'Monthly'}</span>
                      </div>
                    </div>

                    <div class="card-quick-actions">
                      <button class="btn btn-xs btn-primary quick-pay-bill" data-id="${acc.id}" data-amount="${acc.currentOutstanding}">
                        💳 Pay Bill
                      </button>
                      <button class="btn btn-xs btn-outline quick-add-tx" data-id="${acc.id}">
                        + Add Spend
                      </button>
                      <button class="btn btn-xs btn-text view-acc-btn" data-id="${acc.id}">
                        Details →
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.attachEvents(container);

    // If an account was requested directly:
    if (this.selectedAccountId) {
      this.openAccountDetails(this.selectedAccountId);
      this.selectedAccountId = null;
    }
  }

  async openAccountDetails(accountId) {
    const acc = await this.storage.getAccountById(accountId);
    if (!acc) return;

    const allTx = await this.storage.getAll('transactions');
    const accountTxs = allTx.filter(tx => tx.accountId === acc.id || tx.targetAccountId === acc.id)
      .sort((a, b) => new Date(b.date || b.createdTimestamp) - new Date(a.date || a.createdTimestamp));

    const modalRoot = document.getElementById('global-modal-root') || document.body;
    if (!modalRoot) return;

    const isCredit = acc.category === 'credit';

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="acc-detail-backdrop">
        <div class="modal-card modal-lg slide-up">
          <div class="modal-header">
            <div class="acc-brand">
              <div class="acc-icon-box" style="background: ${acc.color}25; color: ${acc.color};">
                ${acc.icon || (isCredit ? '💳' : '🏦')}
              </div>
              <div>
                <h3>${acc.name}</h3>
                <span class="badge ${isCredit ? 'badge-danger' : 'badge-success'}">${acc.type}</span>
              </div>
            </div>
            <button class="btn btn-icon" id="close-acc-modal">✕</button>
          </div>

          <div class="modal-body">
            <!-- Balances Banner -->
            <div class="detail-banner ${isCredit ? 'banner-credit' : 'banner-debit'}">
              ${isCredit ? `
                <div class="detail-stat-row">
                  <div>
                    <span class="text-xs text-muted">Outstanding Balance:</span>
                    <div class="text-2xl font-bold text-danger">${AccountModel.formatCurrency(acc.currentOutstanding)}</div>
                  </div>
                  <div>
                    <span class="text-xs text-muted">Available Credit:</span>
                    <div class="text-xl font-bold text-success">${AccountModel.formatCurrency(acc.availableCredit)}</div>
                  </div>
                  <div>
                    <span class="text-xs text-muted">Credit Limit:</span>
                    <div class="text-xl font-bold">${AccountModel.formatCurrency(acc.creditLimit)}</div>
                  </div>
                </div>
                <div class="util-progress-bar" style="margin-top: 1rem;">
                  <div class="util-fill ${acc.utilizationRate > 30 ? 'bg-warning' : 'bg-primary'}" style="width: ${acc.utilizationRate}%;"></div>
                </div>
                <div class="detail-meta-row" style="margin-top: 0.5rem;">
                  <span>Utilization: <strong>${acc.utilizationRate}%</strong></span>
                  <span>Due Date: <strong>${acc.dueDate ? TransactionModel.formatDate(acc.dueDate) : 'N/A'}</strong></span>
                  <span>Billing Cycle: <strong>${acc.billingCycle || 'Monthly'}</strong></span>
                </div>
              ` : `
                <div class="detail-stat-row">
                  <div>
                    <span class="text-xs text-muted">Current Balance:</span>
                    <div class="text-3xl font-bold text-success">${AccountModel.formatCurrency(acc.currentBalance)}</div>
                  </div>
                  <div>
                    <span class="text-xs text-muted">Total Inflow:</span>
                    <div class="text-lg font-bold text-success">+${AccountModel.formatCurrency(acc.totalIncome)}</div>
                  </div>
                  <div>
                    <span class="text-xs text-muted">Total Outflow:</span>
                    <div class="text-lg font-bold text-danger">-${AccountModel.formatCurrency(acc.totalSpent)}</div>
                  </div>
                </div>
                <div class="detail-meta-row" style="margin-top: 1rem;">
                  <span>Opening Balance: <strong>${AccountModel.formatCurrency(acc.openingBalance)}</strong></span>
                  <span>Created: <strong>${TransactionModel.formatDate(acc.createdAt)}</strong></span>
                  <span>Description: <em>${acc.description || 'Personal account'}</em></span>
                </div>
              `}
            </div>

            <!-- Action Toolbar for Account -->
            <div class="detail-actions-bar">
              <button class="btn btn-primary btn-sm" id="detail-add-tx">
                ➕ Add Transaction
              </button>
              ${isCredit ? `
                <button class="btn btn-warning btn-sm" id="detail-pay-bill">
                  💳 Pay Credit Bill
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm" id="detail-transfer">
                  ⇄ Transfer Money
                </button>
              `}
              <button class="btn btn-outline btn-sm text-danger" id="detail-delete-acc">
                🗑 Delete Account
              </button>
            </div>

            <!-- Account Transactions Timeline -->
            <div class="account-tx-history">
              <h4>Account Transactions (${accountTxs.length})</h4>
              ${accountTxs.length === 0 ? `
                <div class="empty-placeholder">No transactions found for this account.</div>
              ` : `
                <div class="transaction-list">
                  ${accountTxs.map(tx => {
                    const amt = TransactionModel.formatAmount(tx.amount, tx.type);
                    return `
                      <div class="tx-item">
                        <div class="tx-icon-circle ${tx.type}">
                          ${tx.type === 'income' ? '↗' : (tx.type === 'transfer' ? '⇄' : (tx.type === 'credit_card_payment' ? '💳' : '↘'))}
                        </div>
                        <div class="tx-details-col">
                          <div class="font-bold">${tx.description || tx.category}</div>
                          <div class="text-xs text-muted">
                            ${tx.category} • ${TransactionModel.formatDate(tx.date)}
                          </div>
                        </div>
                        <div class="tx-amount-col">
                          <div class="font-bold ${amt.class}">${amt.text}</div>
                          <div class="text-xs text-muted">${tx.paymentMethod || ''}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-acc-modal')?.addEventListener('click', () => {
      modalRoot.innerHTML = '';
    });
    document.getElementById('acc-detail-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'acc-detail-backdrop') modalRoot.innerHTML = '';
    });

    document.getElementById('detail-add-tx')?.addEventListener('click', () => {
      modalRoot.innerHTML = '';
      this.app.openTransactionModal({ preselectedAccountId: acc.id });
    });

    document.getElementById('detail-pay-bill')?.addEventListener('click', () => {
      modalRoot.innerHTML = '';
      this.app.openCreditCardPayModal(acc.id, acc.currentOutstanding);
    });

    document.getElementById('detail-transfer')?.addEventListener('click', () => {
      modalRoot.innerHTML = '';
      this.app.openTransferModal({ fromAccountId: acc.id });
    });

    document.getElementById('detail-delete-acc')?.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete "${acc.name}"? This account will be removed.`)) {
        await this.storage.delete('accounts', acc.id);
        modalRoot.innerHTML = '';
        this.render(document.getElementById('app-main-view'));
      }
    });
  }

  attachEvents(container) {
    // Tabs
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.currentTarget.dataset.tab;
        this.render(container);
      });
    });

    // Add Account
    container.querySelector('#btn-add-account')?.addEventListener('click', () => {
      this.openAddAccountModal(this.activeTab === 'credit' ? 'credit' : 'debit');
    });

    // View details
    container.querySelectorAll('.view-acc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openAccountDetails(e.currentTarget.dataset.id);
      });
    });

    // Quick Add Tx
    container.querySelectorAll('.quick-add-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.openTransactionModal({ preselectedAccountId: e.currentTarget.dataset.id });
      });
    });

    // Quick Transfer
    container.querySelectorAll('.quick-transfer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.openTransferModal({ fromAccountId: e.currentTarget.dataset.id });
      });
    });

    // Quick Pay Bill
    container.querySelectorAll('.quick-pay-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const amt = e.currentTarget.dataset.amount;
        this.app.openCreditCardPayModal(id, amt);
      });
    });
  }

  openAddAccountModal(preferredCategory = null, prefill = null) {
    const modalRoot = document.getElementById('global-modal-root') || document.body;
    if (!modalRoot) return;

    const initialCategory = prefill?.category || preferredCategory || (this.activeTab === 'credit' ? 'credit' : 'debit');
    const currency = localStorage.getItem('tm_currency') || '₹';

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="add-acc-backdrop">
        <div class="modal-card account-modal-card slide-up">
          <div class="modal-header">
            <div class="flex-align-center" style="gap: 8px;">
              <span id="modal-header-icon" style="font-size: 1.35rem;">${initialCategory === 'credit' ? '💳' : '🏦'}</span>
              <div>
                <h3 id="modal-title-text" style="margin: 0; font-size: 1.15rem;">
                  ${initialCategory === 'credit' ? 'Add Credit / Card Account' : 'Add Financial / Asset Account'}
                </h3>
                <span class="text-xs text-muted" id="modal-subtitle-text">
                  ${initialCategory === 'credit' ? 'Configure card limits, billing & dues' : 'Bank accounts, savings, deposits & cash'}
                </span>
              </div>
            </div>
            <button class="btn btn-icon" id="close-add-acc" aria-label="Close modal">✕</button>
          </div>

          <!-- Pinned, Perfectly Aligned Category Switcher Tabs -->
          <div class="modal-tabs-header">
            <div class="category-segmented-control">
              <button type="button" class="cat-seg-btn ${initialCategory === 'debit' ? 'active' : ''}" data-category="debit" id="btn-seg-debit">
                <span>🏦 Debit / Asset</span>
              </button>
              <button type="button" class="cat-seg-btn ${initialCategory === 'credit' ? 'active' : ''}" data-category="credit" id="btn-seg-credit">
                <span>💳 Credit / Card</span>
              </button>
            </div>
          </div>

          <form id="add-acc-form" class="unified-acc-form">
            <input type="hidden" name="accountCategory" id="hidden-account-category" value="${initialCategory}">

            <div class="account-modal-body">
              <!-- General Identity Section -->
              <div class="form-card-section">
                <span class="section-label">Account Identity</span>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                  <label for="acc-name-input">Account Name <span class="text-danger">*</span></label>
                  <input type="text" name="name" id="acc-name-input" class="form-input" 
                         placeholder="${initialCategory === 'credit' ? 'e.g. ICICI Coral, Amazon ICICI, OneCard' : 'e.g. HDFC Salary, SBI Savings, Cash in Hand'}" required>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label for="acc-type-select">Account Type</label>
                  <select name="type" id="acc-type-select" class="form-input">
                    <!-- Populated dynamically via JS -->
                  </select>
                </div>
              </div>

              <!-- Financial Values Section -->
              <div class="form-card-section">
                <span class="section-label" id="section-financial-label">
                  ${initialCategory === 'credit' ? `Credit Limits & Balances (${currency})` : `Financial Balances (${currency})`}
                </span>
                
                <!-- Debit-specific fields -->
                <div id="debit-specific-fields" style="${initialCategory === 'debit' ? 'display:block;' : 'display:none;'}">
                  <div class="form-compact-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Opening Balance (${currency})</label>
                      <input type="number" name="openingBalance" class="form-input font-bold" placeholder="0" min="0" step="any" value="0">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Institution / Bank</label>
                      <input type="text" name="institution" class="form-input" placeholder="e.g. HDFC, SBI, Cash">
                    </div>
                  </div>
                </div>

                <!-- Credit-specific fields: Always visible when Credit is selected -->
                <div id="credit-specific-fields" style="${initialCategory === 'credit' ? 'display:block;' : 'display:none;'}">
                  <div class="form-compact-grid" style="margin-bottom: 0.75rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Credit Limit (${currency}) <span class="text-danger">*</span></span>
                        <span class="text-xs text-muted" style="font-weight: normal;">Total Limit</span>
                      </label>
                      <input type="number" name="creditLimit" id="acc-credit-limit-input" class="form-input font-bold" 
                             placeholder="e.g. 50000" min="0" step="any" ${initialCategory === 'credit' ? 'required' : ''}>
                      <span class="text-xs text-muted" style="display: block; margin-top: 2px;">Maximum approved credit limit</span>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Current Outstanding (${currency})</span>
                      </label>
                      <input type="number" name="openingOutstanding" class="form-input" placeholder="0" min="0" step="any" value="0">
                      <span class="text-xs text-muted" style="display: block; margin-top: 2px;">Current unpaid bill / amount</span>
                    </div>
                  </div>
                  <div class="form-compact-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Payment Due Date</label>
                      <input type="date" name="dueDate" class="form-input">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Billing Cycle / Statement Date</label>
                      <input type="text" name="billingCycle" class="form-input" placeholder="e.g. 15th of month">
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0.5rem;">
                <label>Optional Note</label>
                <input type="text" name="description" class="form-input" placeholder="e.g. Daily expenses, shopping rewards, backup card">
              </div>
            </div>

            <!-- Sticky Modal Footer -->
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-add-acc">Cancel</button>
              <button type="submit" class="btn btn-primary" id="submit-save-acc">Save Account</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById('add-acc-form');
    const segDebit = document.getElementById('btn-seg-debit');
    const segCredit = document.getElementById('btn-seg-credit');
    const hiddenCat = document.getElementById('hidden-account-category');
    const debitFields = document.getElementById('debit-specific-fields');
    const creditFields = document.getElementById('credit-specific-fields');
    const typeSelect = document.getElementById('acc-type-select');
    const iconEl = document.getElementById('modal-header-icon');
    const titleEl = document.getElementById('modal-title-text');
    const subtitleEl = document.getElementById('modal-subtitle-text');
    const financialLabel = document.getElementById('section-financial-label');
    const nameInput = document.getElementById('acc-name-input');
    const creditLimitInput = document.getElementById('acc-credit-limit-input');

    const updateTypeSelectOptions = (cat, selectedType = null) => {
      const types = cat === 'credit' ? ACCOUNT_TYPES.CREDIT : ACCOUNT_TYPES.DEBIT;
      const defaultChoice = selectedType && types.includes(selectedType) ? selectedType : (cat === 'credit' ? 'Credit Card' : 'Bank Account');
      typeSelect.innerHTML = types.map(t => `<option value="${t}" ${t === defaultChoice ? 'selected' : ''}>${t}</option>`).join('');
    };

    const setCategory = (cat, desiredType = null) => {
      hiddenCat.value = cat;
      if (cat === 'credit') {
        segDebit.classList.remove('active');
        segCredit.classList.add('active');
        debitFields.style.display = 'none';
        creditFields.style.display = 'block';
        if (financialLabel) financialLabel.textContent = `Credit Limits & Balances (${currency})`;
        if (titleEl) titleEl.textContent = 'Add Credit / Card Account';
        if (subtitleEl) subtitleEl.textContent = 'Configure card limits, billing & dues';
        if (iconEl) iconEl.textContent = '💳';
        if (nameInput && !nameInput.value) nameInput.placeholder = 'e.g. ICICI Coral, Amazon ICICI, OneCard';
        if (creditLimitInput) creditLimitInput.required = true;
        updateTypeSelectOptions('credit', desiredType);
      } else {
        segCredit.classList.remove('active');
        segDebit.classList.add('active');
        debitFields.style.display = 'block';
        creditFields.style.display = 'none';
        if (financialLabel) financialLabel.textContent = `Asset Balances (${currency})`;
        if (titleEl) titleEl.textContent = 'Add Financial / Asset Account';
        if (subtitleEl) subtitleEl.textContent = 'Bank accounts, savings, deposits & cash';
        if (iconEl) iconEl.textContent = '🏦';
        if (nameInput && !nameInput.value) nameInput.placeholder = 'e.g. HDFC Salary, SBI Savings, Cash in Hand';
        if (creditLimitInput) creditLimitInput.required = false;
        updateTypeSelectOptions('debit', desiredType);
      }
    };

    // Initialize with active category
    setCategory(initialCategory, prefill?.type);

    if (prefill) {
      if (nameInput && prefill.name) nameInput.value = prefill.name;
      if (prefill.category === 'credit' && creditLimitInput && prefill.creditLimit) {
        creditLimitInput.value = prefill.creditLimit;
      }
      if (prefill.category === 'debit') {
        const openBalInput = form.querySelector('input[name="openingBalance"]');
        if (openBalInput && (prefill.openingBalance !== undefined && prefill.openingBalance !== null)) {
          openBalInput.value = prefill.openingBalance;
        }
      }
    }

    // Segmented button listeners
    segDebit?.addEventListener('click', () => setCategory('debit'));
    segCredit?.addEventListener('click', () => setCategory('credit'));

    // Dynamic type change listener: If user selects an account type from dropdown, auto-switch category
    typeSelect?.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      if (ACCOUNT_TYPES.CREDIT.includes(selectedType)) {
        if (hiddenCat.value !== 'credit') {
          setCategory('credit', selectedType);
        }
      } else if (ACCOUNT_TYPES.DEBIT.includes(selectedType)) {
        if (hiddenCat.value !== 'debit') {
          setCategory('debit', selectedType);
        }
      }
    });

    document.getElementById('close-add-acc')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-add-acc')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('add-acc-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'add-acc-backdrop') modalRoot.innerHTML = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const category = formData.get('accountCategory') || 'debit';
      const selectedType = formData.get('type') || (category === 'credit' ? 'Credit Card' : 'Bank Account');
      const isCredit = category === 'credit' || ACCOUNT_TYPES.CREDIT.includes(selectedType);

      const rawLimit = formData.get('creditLimit');
      const limitVal = isCredit ? (rawLimit !== null && rawLimit !== '' ? Number(rawLimit) : 0) : 0;

      const newAccount = AccountModel.create({
        name: (formData.get('name') || '').trim(),
        category: isCredit ? 'credit' : 'debit',
        type: selectedType,
        openingBalance: isCredit ? 0 : (Number(formData.get('openingBalance')) || 0),
        creditLimit: limitVal,
        openingOutstanding: isCredit ? (Number(formData.get('openingOutstanding')) || 0) : 0,
        dueDate: formData.get('dueDate') || '',
        billingCycle: formData.get('billingCycle') || '',
        description: formData.get('description') || ''
      });

      await this.storage.put('accounts', newAccount);
      modalRoot.innerHTML = '';
      if (this.activeTab !== 'all') {
        this.activeTab = newAccount.category;
      }
      this.render(document.getElementById('app-main-view'));
      this.app.showToast(`Account "${newAccount.name}" created!`);
    });
  }
}

