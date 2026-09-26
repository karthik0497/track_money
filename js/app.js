// Track-Money: Main Application Coordinator & Router
import { storage } from './db/storage.js';
import { AssistantCoordinator } from './ai/assistant.js';
import { AssistantView } from './views/assistantView.js';
import { DashboardView } from './views/dashboardView.js';
import { AccountsView } from './views/accountsView.js';
import { TransactionsView } from './views/transactionsView.js';
import { CategoriesView } from './views/categoriesView.js';
import { RecurringView } from './views/recurringView.js';
import { ReportsView } from './views/reportsView.js';
import { SettingsView } from './views/settingsView.js';
import { CameraScannerModal } from './views/cameraScanner.js';
import { PAYMENT_METHODS } from './models/transaction.js';
import { AccountModel } from './models/account.js';

class TrackMoneyApp {
  constructor() {
    this.storage = storage;
    this.currentView = 'dashboard';
    this.viewInstances = {};
    this.assistantCoordinator = null;
    this.assistantView = null;
    this.cameraScanner = new CameraScannerModal(this);
  }

  async init() {
    // 1. Check Security PIN Lock
    const profile = await this.storage.get('app_settings', 'profile');
    if (profile && profile.pinEnabled && profile.pinCode) {
      const unlocked = await this.showPinLockScreen(profile.pinCode);
      if (!unlocked) return;
    }

    // 2. Initialize Views
    this.viewInstances = {
      dashboard: new DashboardView(this.storage, this),
      accounts: new AccountsView(this.storage, this),
      transactions: new TransactionsView(this.storage, this),
      categories: new CategoriesView(this.storage, this),
      recurring: new RecurringView(this.storage, this),
      reports: new ReportsView(this.storage, this),
      settings: new SettingsView(this.storage, this)
    };

    // 3. Initialize AI Assistant
    this.assistantCoordinator = new AssistantCoordinator(this.storage, () => {
      this.refreshCurrentView();
    });
    this.assistantView = new AssistantView(this.assistantCoordinator, this);
    const aiContainer = document.getElementById('ai-assistant-container');
    if (aiContainer) {
      this.assistantView.render(aiContainer);
    }

    // 4. Setup Navigation Handlers
    this.setupNavigation();

    // 5. Setup Global Modal Container
    this.setupGlobalModals();

    // 6. Navigate to initial view
    await this.navigateTo('dashboard');

    // 7. Register Service Worker for offline PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('SW registration skipped:', err);
      });
    }
  }

  setupNavigation() {
    // Bottom nav bar items
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const viewName = e.currentTarget.dataset.view;
        if (viewName === 'more') {
          this.toggleMoreSheet();
        } else if (viewName) {
          this.closeMoreSheet();
          this.navigateTo(viewName);
        }
      });
    });

    // More Sheet action items
    document.querySelectorAll('.more-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const viewName = e.currentTarget.dataset.view;
        if (viewName) {
          this.closeMoreSheet();
          this.navigateTo(viewName);
        }
      });
    });

    document.getElementById('nav-camera-scan')?.addEventListener('click', () => {
      this.closeMoreSheet();
      this.openCameraScanner();
    });

    document.getElementById('nav-voice-assistant')?.addEventListener('click', () => {
      this.closeMoreSheet();
      this.openAiAssistant();
    });

    document.getElementById('close-more-sheet')?.addEventListener('click', () => {
      this.closeMoreSheet();
    });

    document.getElementById('more-sheet-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'more-sheet-backdrop') {
        this.closeMoreSheet();
      }
    });

    // Header buttons
    document.getElementById('header-camera-btn')?.addEventListener('click', () => {
      this.openCameraScanner();
    });

    document.getElementById('header-voice-btn')?.addEventListener('click', () => {
      this.openAiAssistant();
    });
  }

  toggleMoreSheet() {
    const sheet = document.getElementById('more-sheet-backdrop');
    if (sheet) {
      sheet.classList.toggle('open');
    }
  }

  closeMoreSheet() {
    const sheet = document.getElementById('more-sheet-backdrop');
    if (sheet) {
      sheet.classList.remove('open');
    }
  }

  openCameraScanner() {
    this.cameraScanner.open();
  }

  async navigateTo(viewName, options = {}) {
    if (!this.viewInstances[viewName]) return;

    this.currentView = viewName;
    this.closeMoreSheet();

    // Update bottom nav active state
    const isSecondary = ['categories', 'recurring', 'settings'].includes(viewName);
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.dataset.view === 'more') {
        el.classList.toggle('active', isSecondary);
      } else {
        el.classList.toggle('active', el.dataset.view === viewName);
      }
    });

    // Update main container
    const mainViewEl = document.getElementById('app-main-view');
    if (mainViewEl) {
      mainViewEl.scrollTop = 0;
      await this.viewInstances[viewName].render(mainViewEl, options);
    }

    // Update header net position preview
    this.updateHeaderSummary();
  }

  async refreshCurrentView() {
    const mainViewEl = document.getElementById('app-main-view');
    if (mainViewEl && this.viewInstances[this.currentView]) {
      await this.viewInstances[this.currentView].render(mainViewEl);
      this.updateHeaderSummary();
    }
  }

  async updateHeaderSummary() {
    const metrics = await this.storage.getDashboardMetrics();
    const netEl = document.getElementById('header-net-pill');
    if (netEl) {
      netEl.textContent = `Net: ${AccountModel.formatCurrency(metrics.netPosition)}`;
      netEl.className = `pill ${metrics.netPosition >= 0 ? 'pill-success' : 'pill-danger'}`;
    }
  }

  openAiAssistant() {
    if (this.assistantView) {
      this.assistantView.open();
    }
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  setupGlobalModals() {
    // Global modal container
    if (!document.getElementById('global-modal-root')) {
      const root = document.createElement('div');
      root.id = 'global-modal-root';
      document.body.appendChild(root);
    }
  }

  // Transaction Modal (Add / Edit)
  async openTransactionModal(options = {}) {
    const modalRoot = document.getElementById('global-modal-root');
    const accounts = await this.storage.getAll('accounts');
    const categories = await this.storage.getAll('categories');

    const prefill = options.prefill || {};
    const defaultAccId = options.preselectedAccountId || prefill.accountId || (accounts[0] ? accounts[0].id : '');

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="tx-modal-backdrop">
        <div class="modal-card slide-up">
          <div class="modal-header">
            <h3>Record Transaction</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-outline btn-xs" id="tx-scan-receipt-btn" title="Scan receipt with camera">📷 Scan Bill</button>
              <button class="btn btn-icon" id="close-tx-modal">✕</button>
            </div>
          </div>
          <form id="global-tx-form">
            <div class="form-group">
              <label>Transaction Type</label>
              <div class="radio-toggle-group">
                <label class="radio-pill">
                  <input type="radio" name="type" value="expense" ${(!prefill.type || prefill.type === 'expense') ? 'checked' : ''}>
                  <span>Expense</span>
                </label>
                <label class="radio-pill">
                  <input type="radio" name="type" value="income" ${prefill.type === 'income' ? 'checked' : ''}>
                  <span>Income</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Amount (₹)</label>
              <input type="number" name="amount" class="form-input" style="font-size: 1.25rem; font-weight: bold;" 
                     placeholder="0.00" min="0.01" step="any" value="${prefill.amount || ''}" required autofocus>
            </div>

            <div class="form-group">
              <label>Account</label>
              <select name="accountId" class="form-input" required>
                ${accounts.map(a => `
                  <option value="${a.id}" ${a.id === defaultAccId ? 'selected' : ''}>
                    ${a.icon || '🏦'} ${a.name} (${a.category === 'credit' ? 'Credit / Limit: ' + AccountModel.formatCurrency(a.creditLimit) : 'Bal: ' + AccountModel.formatCurrency(a.currentBalance)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>Category</label>
                <select name="category" id="tx-cat-select" class="form-input" required>
                  ${categories.map(c => `
                    <option value="${c.name}" ${c.name === prefill.category ? 'selected' : ''}>
                      ${c.icon || '🏷️'} ${c.name}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label>Subcategory</label>
                <input type="text" name="subcategory" class="form-input" placeholder="e.g. Lunch, Fuel" value="${prefill.subcategory || ''}">
              </div>
            </div>

            <div class="form-group">
              <label>Description / Merchant</label>
              <input type="text" name="description" class="form-input" placeholder="e.g. Team Lunch, Shell Petrol, Amazon" value="${prefill.description || ''}" required>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>Date</label>
                <input type="date" name="date" class="form-input" value="${prefill.date || new Date().toISOString().split('T')[0]}" required>
              </div>

              <div class="form-group">
                <label>Payment Method</label>
                <select name="paymentMethod" class="form-input">
                  ${PAYMENT_METHODS.map(m => `
                    <option value="${m}" ${m === prefill.paymentMethod ? 'selected' : ''}>${m}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Notes (Optional)</label>
              <input type="text" name="notes" class="form-input" placeholder="Additional details..." value="${prefill.notes || ''}">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-tx-modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Transaction</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('tx-scan-receipt-btn')?.addEventListener('click', () => {
      this.openCameraScanner();
    });
    document.getElementById('close-tx-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-tx-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('tx-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'tx-modal-backdrop') modalRoot.innerHTML = '';
    });

    document.getElementById('global-tx-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const tx = await this.storage.addTransaction({
        type: fd.get('type'),
        amount: Number(fd.get('amount')),
        accountId: fd.get('accountId'),
        category: fd.get('category'),
        subcategory: fd.get('subcategory'),
        description: fd.get('description'),
        date: fd.get('date'),
        paymentMethod: fd.get('paymentMethod'),
        notes: fd.get('notes')
      });

      modalRoot.innerHTML = '';
      await this.refreshCurrentView();
      this.showToast(`Recorded ${tx.type.toUpperCase()}: ${AccountModel.formatCurrency(tx.amount)}`);
    });
  }

  // Transfer Modal
  async openTransferModal(options = {}) {
    const modalRoot = document.getElementById('global-modal-root');
    const accounts = await this.storage.getAll('accounts');
    const debitAccounts = accounts.filter(a => a.category === 'debit');

    if (debitAccounts.length < 2) {
      alert('You need at least two debit/asset accounts to make a transfer.');
      return;
    }

    const defaultFrom = options.fromAccountId || debitAccounts[0].id;
    const defaultTo = debitAccounts.find(a => a.id !== defaultFrom)?.id || debitAccounts[1].id;

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="transfer-modal-backdrop">
        <div class="modal-card slide-up">
          <div class="modal-header">
            <h3>Transfer Between Accounts</h3>
            <button class="btn btn-icon" id="close-transfer-modal">✕</button>
          </div>
          <form id="transfer-form">
            <div class="form-group">
              <label>Amount to Transfer (₹)</label>
              <input type="number" name="amount" class="form-input font-bold" style="font-size: 1.25rem;" 
                     placeholder="0.00" min="1" step="any" required autofocus>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>From Account (Debit)</label>
                <select name="fromAccountId" id="from-acc-select" class="form-input" required>
                  ${debitAccounts.map(a => `
                    <option value="${a.id}" ${a.id === defaultFrom ? 'selected' : ''}>${a.name}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label>To Account (Credit)</label>
                <select name="toAccountId" id="to-acc-select" class="form-input" required>
                  ${debitAccounts.map(a => `
                    <option value="${a.id}" ${a.id === defaultTo ? 'selected' : ''}>${a.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Transfer Date</label>
              <input type="date" name="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
            </div>

            <div class="form-group">
              <label>Description / Note</label>
              <input type="text" name="description" class="form-input" placeholder="e.g. Moved to Savings Fund">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-transfer-modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Complete Transfer</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-transfer-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-transfer-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');

    document.getElementById('transfer-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fromId = fd.get('fromAccountId');
      const toId = fd.get('toAccountId');
      const amount = Number(fd.get('amount'));

      if (fromId === toId) {
        alert('Source and destination accounts must be different.');
        return;
      }

      const fromAcc = accounts.find(a => a.id === fromId);
      const toAcc = accounts.find(a => a.id === toId);

      await this.storage.addTransaction({
        type: 'transfer',
        accountId: fromId,
        targetAccountId: toId,
        amount,
        category: 'Transfer',
        subcategory: 'Account Transfer',
        description: fd.get('description') || `Transfer: ${fromAcc?.name} ➔ ${toAcc?.name}`,
        date: fd.get('date'),
        paymentMethod: 'Bank Transfer'
      });

      modalRoot.innerHTML = '';
      await this.refreshCurrentView();
      this.showToast(`Transferred ${AccountModel.formatCurrency(amount)} successfully!`);
    });
  }

  // Credit Card Payment Modal
  async openCreditCardPayModal(cardId, suggestedAmount) {
    const modalRoot = document.getElementById('global-modal-root');
    const accounts = await this.storage.getAll('accounts');
    const creditAccount = accounts.find(a => a.id === cardId);
    const debitAccounts = accounts.filter(a => a.category === 'debit');

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="pay-bill-backdrop">
        <div class="modal-card slide-up">
          <div class="modal-header">
            <h3>Pay Credit Card Bill</h3>
            <button class="btn btn-icon" id="close-pay-bill">✕</button>
          </div>
          <form id="pay-bill-form">
            <div class="form-group">
              <label>Card / BNPL Account</label>
              <div class="card" style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
                <div class="font-bold">${creditAccount?.name}</div>
                <div class="text-xs text-muted">Outstanding: <span class="text-danger font-bold">${AccountModel.formatCurrency(creditAccount?.currentOutstanding || suggestedAmount)}</span></div>
              </div>
            </div>

            <div class="form-group">
              <label>Amount to Pay (₹)</label>
              <input type="number" name="amount" class="form-input font-bold" style="font-size: 1.25rem;" 
                     value="${suggestedAmount || creditAccount?.currentOutstanding || ''}" min="1" step="any" required autofocus>
            </div>

            <div class="form-group">
              <label>Pay From Bank Account</label>
              <select name="fromAccountId" class="form-input" required>
                ${debitAccounts.map(a => `
                  <option value="${a.id}">${a.name} (Bal: ${AccountModel.formatCurrency(a.currentBalance)})</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Payment Date</label>
              <input type="date" name="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-pay-bill">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit Card Payment</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-pay-bill')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-pay-bill')?.addEventListener('click', () => modalRoot.innerHTML = '');

    document.getElementById('pay-bill-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fromId = fd.get('fromAccountId');
      const amount = Number(fd.get('amount'));

      await this.storage.addTransaction({
        type: 'credit_card_payment',
        accountId: fromId,
        targetAccountId: cardId,
        amount,
        category: 'Bills & Utilities',
        subcategory: 'Credit Card Bill',
        description: `Payment towards ${creditAccount?.name}`,
        date: fd.get('date'),
        paymentMethod: 'Net Banking'
      });

      modalRoot.innerHTML = '';
      await this.refreshCurrentView();
      this.showToast(`Paid ${AccountModel.formatCurrency(amount)} towards ${creditAccount?.name}!`);
    });
  }

  // App Lock Screen
  async showPinLockScreen(correctPin) {
    return new Promise((resolve) => {
      const lockRoot = document.createElement('div');
      lockRoot.className = 'pin-lock-overlay fade-in';
      lockRoot.innerHTML = `
        <div class="pin-lock-box slide-up">
          <div class="pin-lock-icon">🔒</div>
          <h2>Track-Money</h2>
          <p class="text-sm text-muted">Enter your 4-digit PIN to unlock</p>
          <div class="pin-digits-row" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>
          <input type="password" id="pin-hidden-input" maxlength="4" autofocus style="position: absolute; opacity: 0; pointer-events: none;">
          <div class="pin-numpad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="numpad-btn" data-val="${n}">${n}</button>`).join('')}
            <button class="numpad-btn numpad-clear" data-val="C">C</button>
            <button class="numpad-btn" data-val="0">0</button>
            <button class="numpad-btn numpad-back" data-val="⌫">⌫</button>
          </div>
        </div>
      `;
      document.body.appendChild(lockRoot);

      let entered = '';
      const updateDots = () => {
        const dots = lockRoot.querySelectorAll('.pin-dot');
        dots.forEach((dot, idx) => {
          dot.classList.toggle('filled', idx < entered.length);
        });

        if (entered.length === 4) {
          if (entered === correctPin) {
            lockRoot.remove();
            resolve(true);
          } else {
            entered = '';
            updateDots();
            alert('Incorrect PIN. Please try again.');
          }
        }
      };

      lockRoot.querySelectorAll('.numpad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          if (val === 'C') {
            entered = '';
          } else if (val === '⌫') {
            entered = entered.slice(0, -1);
          } else if (entered.length < 4) {
            entered += val;
          }
          updateDots();
        });
      });
    });
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new TrackMoneyApp();
  app.init();
});
