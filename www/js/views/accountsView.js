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

        <!-- Dedicated Account Details Drawer / Modal Container -->
        <div id="account-details-modal-root"></div>
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

    const modalRoot = document.getElementById('account-details-modal-root');
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
      this.openAddAccountModal();
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

  openAddAccountModal() {
    const modalRoot = document.getElementById('account-details-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="add-acc-backdrop">
        <div class="modal-card account-modal-card slide-up">
          <div class="modal-header">
            <div class="flex-align-center" style="gap: 8px;">
              <span id="modal-header-icon" style="font-size: 1.25rem;">🏦</span>
              <h3 id="modal-title-text" style="margin: 0;">Add Financial Account</h3>
            </div>
            <button class="btn btn-icon" id="close-add-acc">✕</button>
          </div>

          <form id="add-acc-form" class="unified-acc-form">
            <div class="account-modal-body">
              <!-- Symmetrical Equal-Width Category Segmented Selector -->
              <div class="category-segmented-control">
                <button type="button" class="cat-seg-btn active" data-category="debit" id="btn-seg-debit">
                  <span>🏦 Debit / Asset</span>
                </button>
                <button type="button" class="cat-seg-btn" data-category="credit" id="btn-seg-credit">
                  <span>💳 Credit / Card</span>
                </button>
              </div>
              <input type="hidden" name="accountCategory" id="hidden-account-category" value="debit">

              <!-- General Identity Section -->
              <div class="form-card-section">
                <span class="section-label">Account Identity</span>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                  <label>Account Name</label>
                  <input type="text" name="name" class="form-input" placeholder="e.g. HDFC Salary, ICICI Coral, Cash in Hand" required>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label>Account Type</label>
                  <select name="type" id="acc-type-select" class="form-input">
                    <optgroup label="Debit / Asset Types" id="debit-types">
                      ${ACCOUNT_TYPES.DEBIT.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </optgroup>
                    <optgroup label="Credit / Liability Types" id="credit-types" style="display:none;">
                      ${ACCOUNT_TYPES.CREDIT.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </optgroup>
                  </select>
                </div>
              </div>

              <!-- Financial Values Section (Equal sizing & alignment) -->
              <div class="form-card-section">
                <span class="section-label" id="section-financial-label">Financial Balances</span>
                
                <!-- Debit-specific fields -->
                <div id="debit-specific-fields">
                  <div class="form-compact-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Opening Balance (₹)</label>
                      <input type="number" name="openingBalance" class="form-input font-bold" placeholder="0" min="0" step="any" value="0">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Institution / Bank</label>
                      <input type="text" name="institution" class="form-input" placeholder="e.g. HDFC, SBI, Cash">
                    </div>
                  </div>
                </div>

                <!-- Credit-specific fields -->
                <div id="credit-specific-fields" style="display:none;">
                  <div class="form-compact-grid" style="margin-bottom: 0.75rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Credit Limit (₹)</label>
                      <input type="number" name="creditLimit" class="form-input font-bold" placeholder="e.g. 50000" min="0" step="any">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Outstanding (₹)</label>
                      <input type="number" name="openingOutstanding" class="form-input" placeholder="0" min="0" step="any" value="0">
                    </div>
                  </div>
                  <div class="form-compact-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Payment Due Date</label>
                      <input type="date" name="dueDate" class="form-input">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label>Billing Cycle</label>
                      <input type="text" name="billingCycle" class="form-input" placeholder="e.g. 15th">
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0.5rem;">
                <label>Optional Note</label>
                <input type="text" name="description" class="form-input" placeholder="e.g. Daily expenses, shopping rewards">
              </div>
            </div>

            <!-- Sticky Modal Footer -->
            <div class="modal-footer" style="margin-top: 1rem; padding-top: 0.75rem;">
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
    const debitTypes = document.getElementById('debit-types');
    const creditTypes = document.getElementById('credit-types');
    const typeSelect = document.getElementById('acc-type-select');
    const iconEl = document.getElementById('modal-header-icon');

    const setCategory = (cat) => {
      hiddenCat.value = cat;
      if (cat === 'credit') {
        segDebit.classList.remove('active');
        segCredit.classList.add('active');
        debitFields.style.display = 'none';
        creditFields.style.display = 'block';
        debitTypes.style.display = 'none';
        creditTypes.style.display = 'block';
        typeSelect.value = 'Credit Card';
        if (iconEl) iconEl.textContent = '💳';
      } else {
        segCredit.classList.remove('active');
        segDebit.classList.add('active');
        debitFields.style.display = 'block';
        creditFields.style.display = 'none';
        debitTypes.style.display = 'block';
        creditTypes.style.display = 'none';
        typeSelect.value = 'Bank Account';
        if (iconEl) iconEl.textContent = '🏦';
      }
    };

    segDebit?.addEventListener('click', () => setCategory('debit'));
    segCredit?.addEventListener('click', () => setCategory('credit'));

    document.getElementById('close-add-acc')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-add-acc')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('add-acc-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'add-acc-backdrop') modalRoot.innerHTML = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const category = formData.get('accountCategory');

      const newAccount = AccountModel.create({
        name: formData.get('name'),
        category,
        type: formData.get('type'),
        openingBalance: formData.get('openingBalance') || 0,
        creditLimit: formData.get('creditLimit') || 0,
        openingOutstanding: formData.get('openingOutstanding') || 0,
        dueDate: formData.get('dueDate') || '',
        billingCycle: formData.get('billingCycle') || '',
        description: formData.get('description') || ''
      });

      await this.storage.put('accounts', newAccount);
      modalRoot.innerHTML = '';
      this.render(document.getElementById('app-main-view'));
      this.app.showToast(`Account "${newAccount.name}" created!`);
    });
  }
}

