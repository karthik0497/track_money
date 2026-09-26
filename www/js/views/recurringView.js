// Track-Money: Recurring Transactions View
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class RecurringView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
  }

  async render(container) {
    const recurringList = await this.storage.getAll('recurring_transactions');
    const accounts = await this.storage.getAll('accounts');
    const accMap = new Map(accounts.map(a => [a.id, a]));

    const totalMonthlyRecurring = recurringList
      .filter(r => r.status === 'active' && r.type === 'expense')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const totalMonthlyIncomeRec = recurringList
      .filter(r => r.status === 'active' && r.type === 'income')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    container.innerHTML = `
      <div class="recurring-container fade-in">
        <div class="page-header">
          <div>
            <h2>Recurring Bills & Income</h2>
            <p class="text-sm text-muted">Automate fixed monthly expenses, subscriptions & salary</p>
          </div>
          <button class="btn btn-primary" id="btn-add-recurring">
            <span>➕ Add Recurring</span>
          </button>
        </div>

        <!-- Metric Strips -->
        <div class="stats-row">
          <div class="card stat-card">
            <span class="card-header-mini">Expected Monthly Inflow</span>
            <div class="stat-number text-success">+${AccountModel.formatCurrency(totalMonthlyIncomeRec)}</div>
            <span class="stat-trend text-muted">Fixed Salaries & Incomes</span>
          </div>
          <div class="card stat-card">
            <span class="card-header-mini">Committed Monthly Bills</span>
            <div class="stat-number text-danger">-${AccountModel.formatCurrency(totalMonthlyRecurring)}</div>
            <span class="stat-trend text-muted">Rent, SIP, Netflix, Subscriptions</span>
          </div>
          <div class="card stat-card">
            <span class="card-header-mini">Active Schedules</span>
            <div class="stat-number text-info">${recurringList.length}</div>
            <span class="stat-trend text-muted">Automated trackers</span>
          </div>
        </div>

        <!-- Recurring Items List -->
        <div class="card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h4>Recurring Schedules</h4>
            <span class="badge badge-subtle">Auto-Reminder Enabled</span>
          </div>

          ${recurringList.length === 0 ? `
            <div class="empty-placeholder">No recurring transactions added yet.</div>
          ` : `
            <div class="recurring-list">
              ${recurringList.map(rec => {
                const acc = accMap.get(rec.accountId);
                const isIncome = rec.type === 'income';
                return `
                  <div class="recurring-item">
                    <div class="rec-icon-box ${isIncome ? 'income' : 'expense'}">
                      ${isIncome ? '💰' : '🔄'}
                    </div>

                    <div class="rec-details">
                      <div class="font-bold rec-title">${rec.title}</div>
                      <div class="text-xs text-muted">
                        <span>${acc ? acc.name : 'Unknown Account'}</span>
                        <span>•</span>
                        <span>${rec.category}${rec.subcategory ? ' (' + rec.subcategory + ')' : ''}</span>
                        <span>•</span>
                        <span class="badge badge-subtle">${rec.frequency}</span>
                      </div>
                      <div class="text-xs text-warning" style="margin-top: 4px;">
                        Next Due: <strong>${TransactionModel.formatDate(rec.nextDueDate)}</strong>
                      </div>
                    </div>

                    <div class="rec-amount-col">
                      <div class="font-bold ${isIncome ? 'text-success' : 'text-danger'}">
                        ${isIncome ? '+' : '-'}${AccountModel.formatCurrency(rec.amount)}
                      </div>
                      <div class="rec-actions">
                        <button class="btn btn-xs btn-primary log-recurring-now" data-id="${rec.id}">
                          ✓ Log Now
                        </button>
                        <button class="btn-item-action delete-recurring-btn" data-id="${rec.id}">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div id="recurring-modal-root"></div>
      </div>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    container.querySelector('#btn-add-recurring')?.addEventListener('click', () => {
      this.openAddRecurringModal();
    });

    // Log Now button: creates transaction immediately and advances next due date
    container.querySelectorAll('.log-recurring-now').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const rec = await this.storage.get('recurring_transactions', id);
        if (rec) {
          await this.storage.addTransaction({
            accountId: rec.accountId,
            type: rec.type,
            amount: rec.amount,
            category: rec.category,
            subcategory: rec.subcategory,
            description: `${rec.title} (Recurring)`,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: 'Auto Debit / Scheduled',
            notes: `Logged from recurring schedule "${rec.title}"`
          });

          // Advance next due date by 1 month
          const currentDue = new Date(rec.nextDueDate || new Date());
          currentDue.setMonth(currentDue.getMonth() + 1);
          rec.nextDueDate = currentDue.toISOString().split('T')[0];
          await this.storage.put('recurring_transactions', rec);

          this.render(container);
          this.app.showToast(`Logged transaction for "${rec.title}"! Balances updated.`);
        }
      });
    });

    // Delete
    container.querySelectorAll('.delete-recurring-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this recurring schedule?')) {
          await this.storage.delete('recurring_transactions', id);
          this.render(container);
        }
      });
    });
  }

  async openAddRecurringModal() {
    const modalRoot = document.getElementById('recurring-modal-root');
    if (!modalRoot) return;

    const accounts = await this.storage.getAll('accounts');
    const categories = await this.storage.getAll('categories');

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="rec-modal-backdrop">
        <div class="modal-card slide-up">
          <div class="modal-header">
            <h3>Add Recurring Transaction</h3>
            <button class="btn btn-icon" id="close-rec-modal">✕</button>
          </div>
          <form id="add-rec-form">
            <div class="form-group">
              <label>Title / Description</label>
              <input type="text" name="title" class="form-input" placeholder="e.g. Netflix, Flat Rent, Nifty SIP" required>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>Type</label>
                <select name="type" class="form-input">
                  <option value="expense">Expense (Bill/Outflow)</option>
                  <option value="income">Income (Salary/Inflow)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Amount (₹)</label>
                <input type="number" name="amount" class="form-input" placeholder="0" min="1" step="any" required>
              </div>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>Account</label>
                <select name="accountId" class="form-input">
                  ${accounts.map(a => `<option value="${a.id}">${a.name} (${a.category})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Category</label>
                <select name="category" class="form-input">
                  ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>Frequency</label>
                <select name="frequency" class="form-input">
                  <option value="Monthly" selected>Monthly</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <div class="form-group">
                <label>Next Due Date</label>
                <input type="date" name="nextDueDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-rec-modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Schedule</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-rec-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-rec-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');

    document.getElementById('add-rec-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const newRec = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: fd.get('title'),
        type: fd.get('type'),
        amount: Number(fd.get('amount')) || 0,
        accountId: fd.get('accountId'),
        category: fd.get('category'),
        frequency: fd.get('frequency'),
        nextDueDate: fd.get('nextDueDate'),
        status: 'active'
      };

      await this.storage.put('recurring_transactions', newRec);
      modalRoot.innerHTML = '';
      this.render(document.getElementById('app-main-view'));
      this.app.showToast(`Recurring schedule for "${newRec.title}" saved!`);
    });
  }
}
