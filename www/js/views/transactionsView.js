// Track-Money: Transaction History & Advanced Filtering View
import { TransactionModel, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '../models/transaction.js';
import { AccountModel } from '../models/account.js';

export class TransactionsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
    this.filters = {
      search: '',
      datePreset: 'this_month',
      startDate: '',
      endDate: '',
      accountId: 'all',
      category: 'all',
      type: 'all',
      minAmount: '',
      maxAmount: ''
    };
  }

  async render(container) {
    this.applyDatePreset(this.filters.datePreset);

    const accounts = await this.storage.getAll('accounts');
    const categories = await this.storage.getAll('categories');
    const filteredTx = await this.storage.getFilteredTransactions(this.filters);

    // Calculate totals for currently filtered list
    let totalIncome = 0;
    let totalExpense = 0;
    filteredTx.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income' || tx.type === 'refund') totalIncome += amt;
      if (tx.type === 'expense') totalExpense += amt;
    });

    container.innerHTML = `
      <div class="transactions-container fade-in">
        <div class="page-header">
          <div>
            <h2>Transactions History</h2>
            <p class="text-sm text-muted">Review, filter, and audit your financial records</p>
          </div>
          <button class="btn btn-primary" id="btn-add-tx-main">
            <span>➕ Add Transaction</span>
          </button>
        </div>

        <!-- Filter Strip -->
        <div class="card filter-card">
          <div class="search-box-row">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" id="tx-search-input" class="form-input search-input" 
                     placeholder="Search by description, notes, merchant, category..." 
                     value="${this.filters.search}">
            </div>
            <button class="btn btn-outline btn-sm" id="btn-toggle-filters">
              <span>⚙️ Advanced Filters</span>
            </button>
            <button class="btn btn-text text-sm" id="btn-reset-filters">Reset</button>
          </div>

          <!-- Collapsible Filter Controls -->
          <div class="advanced-filter-panel" id="advanced-filters" style="margin-top: 1rem;">
            <div class="filter-grid">
              <!-- Date Presets -->
              <div class="form-group">
                <label>Date Range</label>
                <select id="filter-date-preset" class="form-input">
                  <option value="all" ${this.filters.datePreset === 'all' ? 'selected' : ''}>All Time</option>
                  <option value="today" ${this.filters.datePreset === 'today' ? 'selected' : ''}>Today</option>
                  <option value="yesterday" ${this.filters.datePreset === 'yesterday' ? 'selected' : ''}>Yesterday</option>
                  <option value="this_month" ${this.filters.datePreset === 'this_month' ? 'selected' : ''}>This Month (Sep 2026)</option>
                  <option value="last_month" ${this.filters.datePreset === 'last_month' ? 'selected' : ''}>Last Month (Aug 2026)</option>
                  <option value="custom" ${this.filters.datePreset === 'custom' ? 'selected' : ''}>Custom Dates</option>
                </select>
              </div>

              <!-- Custom Dates (if custom chosen) -->
              <div class="form-group" id="custom-date-group" style="${this.filters.datePreset === 'custom' ? '' : 'display:none;'}">
                <label>Custom Range</label>
                <div class="grid-2-col">
                  <input type="date" id="filter-start-date" class="form-input" value="${this.filters.startDate}">
                  <input type="date" id="filter-end-date" class="form-input" value="${this.filters.endDate}">
                </div>
              </div>

              <!-- Account Filter -->
              <div class="form-group">
                <label>Account</label>
                <select id="filter-account" class="form-input">
                  <option value="all">All Accounts</option>
                  ${accounts.map(a => `
                    <option value="${a.id}" ${this.filters.accountId === a.id ? 'selected' : ''}>
                      ${a.name} (${a.category === 'credit' ? 'Credit' : 'Debit'})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Category Filter -->
              <div class="form-group">
                <label>Category</label>
                <select id="filter-category" class="form-input">
                  <option value="all">All Categories</option>
                  ${categories.map(c => `
                    <option value="${c.name}" ${this.filters.category === c.name ? 'selected' : ''}>
                      ${c.icon || '🏷️'} ${c.name}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Transaction Type -->
              <div class="form-group">
                <label>Type</label>
                <select id="filter-type" class="form-input">
                  <option value="all">All Types</option>
                  ${Object.entries(TRANSACTION_TYPE_LABELS).map(([key, val]) => `
                    <option value="${key}" ${this.filters.type === key ? 'selected' : ''}>${val}</option>
                  `).join('')}
                </select>
              </div>

              <!-- Amount Min / Max -->
              <div class="form-group">
                <label>Amount Range (₹)</label>
                <div class="grid-2-col">
                  <input type="number" id="filter-min-amt" class="form-input" placeholder="Min" value="${this.filters.minAmount}">
                  <input type="number" id="filter-max-amt" class="form-input" placeholder="Max" value="${this.filters.maxAmount}">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Summary Bar -->
        <div class="filtered-totals-bar">
          <span class="text-sm font-bold text-muted">${filteredTx.length} records matching</span>
          <div class="filtered-chips">
            <span class="pill pill-success text-xs">Inflow: +${AccountModel.formatCurrency(totalIncome)}</span>
            <span class="pill pill-danger text-xs">Outflow: -${AccountModel.formatCurrency(totalExpense)}</span>
          </div>
        </div>

        <!-- Transactions List -->
        <div class="card tx-card-list-wrapper">
          ${filteredTx.length === 0 ? `
            <div class="empty-state-card">
              <div class="empty-icon">📂</div>
              <h4>No Transactions Found</h4>
              <p class="text-sm text-muted">Try adjusting your filters or use the AI assistant to add a new transaction.</p>
              <button class="btn btn-primary btn-sm" id="empty-add-btn" style="margin-top: 1rem;">+ Add Transaction</button>
            </div>
          ` : `
            <div class="transaction-list">
              ${filteredTx.map(tx => {
                const amtFormatted = TransactionModel.formatAmount(tx.amount, tx.type);
                return `
                  <div class="tx-item" data-tx-id="${tx.id}">
                    <div class="tx-icon-col">
                      <div class="tx-icon-circle ${tx.type}">
                        ${tx.type === 'income' ? '↗' : (tx.type === 'transfer' ? '⇄' : (tx.type === 'credit_card_payment' ? '💳' : '↘'))}
                      </div>
                    </div>

                    <div class="tx-details-col">
                      <div class="tx-title-row">
                        <span class="tx-title font-bold">${tx.description || tx.category}</span>
                        ${tx.aiAuditId ? `<span class="badge badge-ai text-xs" title="Created by AI Voice/Text">✨ AI</span>` : ''}
                      </div>
                      <div class="tx-sub text-xs text-muted">
                        <span class="tx-acc-tag">${tx.accountName}${tx.targetAccountName ? ' ➔ ' + tx.targetAccountName : ''}</span>
                        <span>•</span>
                        <span>${tx.category}${tx.subcategory ? ' (' + tx.subcategory + ')' : ''}</span>
                        <span>•</span>
                        <span>${TransactionModel.formatDate(tx.date)}</span>
                      </div>
                      ${tx.notes ? `<div class="tx-notes text-xs text-muted">Note: ${tx.notes}</div>` : ''}
                    </div>

                    <div class="tx-amount-col">
                      <div class="tx-amount font-bold ${amtFormatted.class}">
                        ${amtFormatted.text}
                      </div>
                      <div class="tx-method text-xs text-muted">
                        ${tx.paymentMethod || 'Manual'}
                      </div>
                      <div class="tx-item-actions">
                        <button class="btn-item-action delete-tx-btn" data-id="${tx.id}" title="Delete Record">🗑</button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    this.attachEvents(container);
  }

  applyDatePreset(preset) {
    const today = new Date();
    if (preset === 'today') {
      const d = today.toISOString().split('T')[0];
      this.filters.startDate = d;
      this.filters.endDate = d;
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      this.filters.startDate = d;
      this.filters.endDate = d;
    } else if (preset === 'this_month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      this.filters.startDate = `${year}-${month}-01`;
      this.filters.endDate = `${year}-${month}-31`;
    } else if (preset === 'last_month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const year = lastMonth.getFullYear();
      const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
      this.filters.startDate = `${year}-${month}-01`;
      this.filters.endDate = `${year}-${month}-31`;
    } else if (preset === 'all') {
      this.filters.startDate = '';
      this.filters.endDate = '';
    }
  }

  attachEvents(container) {
    container.querySelector('#btn-add-tx-main')?.addEventListener('click', () => {
      this.app.openTransactionModal();
    });

    container.querySelector('#empty-add-btn')?.addEventListener('click', () => {
      this.app.openTransactionModal();
    });

    // Search input with debounce
    let timer;
    container.querySelector('#tx-search-input')?.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.filters.search = e.target.value;
        this.render(container);
      }, 300);
    });

    // Date preset change
    container.querySelector('#filter-date-preset')?.addEventListener('change', (e) => {
      this.filters.datePreset = e.target.value;
      this.render(container);
    });

    // Custom date changes
    container.querySelector('#filter-start-date')?.addEventListener('change', (e) => {
      this.filters.startDate = e.target.value;
      this.render(container);
    });
    container.querySelector('#filter-end-date')?.addEventListener('change', (e) => {
      this.filters.endDate = e.target.value;
      this.render(container);
    });

    // Account change
    container.querySelector('#filter-account')?.addEventListener('change', (e) => {
      this.filters.accountId = e.target.value;
      this.render(container);
    });

    // Category change
    container.querySelector('#filter-category')?.addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.render(container);
    });

    // Type change
    container.querySelector('#filter-type')?.addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.render(container);
    });

    // Min / Max amount
    container.querySelector('#filter-min-amt')?.addEventListener('change', (e) => {
      this.filters.minAmount = e.target.value;
      this.render(container);
    });
    container.querySelector('#filter-max-amt')?.addEventListener('change', (e) => {
      this.filters.maxAmount = e.target.value;
      this.render(container);
    });

    // Reset filters
    container.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
      this.filters = {
        search: '',
        datePreset: 'all',
        startDate: '',
        endDate: '',
        accountId: 'all',
        category: 'all',
        type: 'all',
        minAmount: '',
        maxAmount: ''
      };
      this.render(container);
    });

    // Delete transaction
    container.querySelectorAll('.delete-tx-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this transaction? Balances will automatically update.')) {
          await this.storage.delete('transactions', id);
          this.render(container);
          this.app.showToast('Transaction deleted and balances updated.');
        }
      });
    });
  }
}
