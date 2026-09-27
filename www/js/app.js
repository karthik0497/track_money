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
    this.deferredInstallPrompt = null;
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
  }

  async init() {
    // 0. Setup PWA install listeners
    this.setupPwaInstall();

    // 1. Check Profile & PIN Lock
    const profile = await this.storage.getProfile();
    this.updateHeaderProfileBadge(profile.loginId || profile.name || 'User');

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

    // 8. Frictionless Onboarding check for first-time visitors
    if (!localStorage.getItem('tm_onboarding_shown')) {
      setTimeout(() => this.showOnboardingModal(), 500);
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
    document.getElementById('header-install-btn')?.addEventListener('click', () => {
      this.triggerInstallPrompt();
    });

    document.getElementById('header-profile-btn')?.addEventListener('click', () => {
      this.openProfileModal();
    });

    document.getElementById('header-camera-btn')?.addEventListener('click', () => {
      this.openCameraScanner();
    });

    document.getElementById('header-voice-btn')?.addEventListener('click', () => {
      this.openAiAssistant();
    });

    document.getElementById('nav-install-app')?.addEventListener('click', () => {
      this.closeMoreSheet();
      this.triggerInstallPrompt();
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

    const profile = await this.storage.getProfile();
    this.updateHeaderProfileBadge(profile.loginId || profile.name || 'User');

    const headerInstallBtn = document.getElementById('header-install-btn');
    if (headerInstallBtn) {
      headerInstallBtn.style.display = this.isInstalled ? 'none' : 'inline-flex';
    }
  }

  updateHeaderProfileBadge(name) {
    const nameEl = document.getElementById('header-login-name');
    const avatarEl = document.getElementById('header-avatar-mini');
    const displayName = name || 'User';
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) {
      avatarEl.textContent = displayName.charAt(0).toUpperCase();
    }
  }

  setupPwaInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const headerInstallBtn = document.getElementById('header-install-btn');
      if (headerInstallBtn && !this.isInstalled) {
        headerInstallBtn.style.display = 'inline-flex';
      }
      const pwaBadge = document.getElementById('badge-pwa-status');
      if (pwaBadge) pwaBadge.textContent = 'Ready to Install ⚡';
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredInstallPrompt = null;
      const headerInstallBtn = document.getElementById('header-install-btn');
      if (headerInstallBtn) headerInstallBtn.style.display = 'none';
      const pwaBadge = document.getElementById('badge-pwa-status');
      if (pwaBadge) {
        pwaBadge.textContent = 'Installed ✓';
        pwaBadge.className = 'badge badge-success';
      }
      this.showToast('Track-Money installed as Hybrid App successfully!');
    });
  }

  async triggerInstallPrompt() {
    if (this.deferredInstallPrompt) {
      try {
        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          this.showToast('Installing Track-Money...');
          this.isInstalled = true;
          const headerInstallBtn = document.getElementById('header-install-btn');
          if (headerInstallBtn) headerInstallBtn.style.display = 'none';
        }
        this.deferredInstallPrompt = null;
      } catch (err) {
        console.warn('Install prompt error:', err);
        this.showInstallGuideModal();
      }
    } else {
      this.showInstallGuideModal();
    }
  }

  showInstallGuideModal() {
    const modalRoot = document.getElementById('global-modal-root');

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="install-guide-backdrop">
        <div class="modal-card slide-up" style="max-width: 500px;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.4rem;">📲</span>
              <h3 class="font-bold">Install as Hybrid App</h3>
            </div>
            <button class="btn btn-icon" id="close-install-guide">✕</button>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <p class="text-sm text-muted">
              Track-Money runs as an installable Progressive Web App (PWA). You can download and install it straight from your browser with zero APK downloads required!
            </p>
          </div>

          <div class="card" style="margin-bottom: 1rem; background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.25);">
            <div class="font-bold text-sm" style="color: #a5b4fc; margin-bottom: 6px;">📱 On Android (Chrome / Brave / Samsung)</div>
            <ol class="text-xs text-secondary" style="padding-left: 1.2rem; display: flex; flex-direction: column; gap: 4px;">
              <li>Tap the three dots menu (<strong>⋮</strong>) in the top right of your browser.</li>
              <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
              <li>Track-Money will install directly to your phone screen and app drawer!</li>
            </ol>
          </div>

          <div class="card" style="margin-bottom: 1rem; background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.25);">
            <div class="font-bold text-sm" style="color: #6ee7b7; margin-bottom: 6px;">🍏 On iPhone & iPad (Safari)</div>
            <ol class="text-xs text-secondary" style="padding-left: 1.2rem; display: flex; flex-direction: column; gap: 4px;">
              <li>Tap the <strong>Share</strong> button (box with upward arrow <span style="font-size: 1rem;">⎋</span>) at the bottom.</li>
              <li>Scroll down and tap <strong>"Add to Home Screen" (+)</strong>.</li>
              <li>Tap <strong>Add</strong> in the top right. It opens full screen like a native app!</li>
            </ol>
          </div>

          <div class="card" style="margin-bottom: 1.25rem; background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.25);">
            <div class="font-bold text-sm" style="color: #fde68a; margin-bottom: 6px;">💻 On Desktop / Laptop (Chrome / Edge / Mac)</div>
            <ol class="text-xs text-secondary" style="padding-left: 1.2rem; display: flex; flex-direction: column; gap: 4px;">
              <li>Click the <strong>Install</strong> icon (<span style="font-size: 1rem;">⊕</span>) on the right side of the URL address bar.</li>
              <li>Click <strong>Install</strong> to add it to your Desktop, Dock, or Start Menu.</li>
            </ol>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="btn-guide-ok" style="width: 100%;">
              Understood
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-install-guide')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('btn-guide-ok')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('install-guide-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'install-guide-backdrop') modalRoot.innerHTML = '';
    });
  }

  async showOnboardingModal() {
    const modalRoot = document.getElementById('global-modal-root');
    const profile = await this.storage.getProfile();
    const currentLoginId = (profile.loginId && profile.loginId !== 'User') ? profile.loginId : '';

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="onboarding-backdrop">
        <div class="modal-card slide-up" style="max-width: 480px; text-align: center;">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">💎</div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 6px;">Welcome to Track-Money</h3>
          <p class="text-sm text-muted" style="margin-bottom: 1.25rem;">
            100% Private, Local-First Personal Finance. All your records stay strictly in your device's browser memory (IndexedDB). Zero centralized servers or tracking.
          </p>

          <form id="onboarding-form" style="text-align: left;">
            <div class="form-group">
              <label>Choose your Login ID or Name</label>
              <input type="text" id="input-onboarding-login" class="form-input font-bold" 
                     placeholder="e.g. Karthik / Alex" value="${currentLoginId}" required autofocus>
              <span class="text-xs text-muted" style="display: block; margin-top: 4px;">No password needed. Next time you open, your workspace will be ready!</span>
            </div>

            <div class="form-group">
              <label>Preferred Currency</label>
              <select id="select-onboarding-currency" class="form-input">
                <option value="₹" selected>₹ INR (Indian Rupee)</option>
                <option value="$">$ USD (US Dollar)</option>
                <option value="€">€ EUR (Euro)</option>
                <option value="£">£ GBP (British Pound)</option>
                <option value="AED">AED (UAE Dirham)</option>
                <option value="SGD">SGD (Singapore Dollar)</option>
              </select>
            </div>

            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 8px;">
              <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.85rem;">
                🚀 Open My Private Workspace
              </button>
              <button type="button" class="btn btn-text text-muted" id="btn-onboarding-skip" style="width: 100%;">
                Continue as Guest (Setup later)
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('btn-onboarding-skip')?.addEventListener('click', () => {
      localStorage.setItem('tm_onboarding_shown', 'true');
      modalRoot.innerHTML = '';
    });

    document.getElementById('onboarding-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginId = document.getElementById('input-onboarding-login').value.trim() || 'User';
      const currency = document.getElementById('select-onboarding-currency').value || '₹';

      await this.storage.saveProfile({
        loginId,
        name: loginId,
        currency
      });

      localStorage.setItem('tm_onboarding_shown', 'true');
      this.updateHeaderProfileBadge(loginId);
      modalRoot.innerHTML = '';
      this.showToast(`Welcome, ${loginId}! Workspace initialized locally.`);
      await this.refreshCurrentView();
    });
  }

  async openProfileModal() {
    const modalRoot = document.getElementById('global-modal-root');
    const profile = await this.storage.getProfile();
    const txCount = (await this.storage.getAll('transactions')).length;
    const accCount = (await this.storage.getAll('accounts')).length;

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="profile-modal-backdrop">
        <div class="modal-card slide-up" style="max-width: 480px;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="profile-avatar-mini" style="width: 28px; height: 28px; font-size: 0.9rem;">
                ${(profile.loginId || 'U').charAt(0).toUpperCase()}
              </span>
              <h3 class="font-bold">Workspace: ${profile.loginId || 'User'}</h3>
            </div>
            <button class="btn btn-icon" id="close-profile-modal">✕</button>
          </div>

          <div class="card" style="margin-bottom: 1.25rem; background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.25);">
            <div class="text-xs text-muted">LOCAL IDENTITY GUARANTEE</div>
            <div class="font-bold text-sm" style="margin: 4px 0;">100% Private Device Memory (IndexedDB)</div>
            <div class="text-xs text-muted">Zero Cloud Servers • ${accCount} Accounts • ${txCount} Transactions</div>
          </div>

          <form id="edit-profile-quick-form">
            <div class="form-group">
              <label>Login ID / Profile Name</label>
              <input type="text" id="quick-login-id" class="form-input font-bold" value="${profile.loginId || 'User'}" required>
            </div>

            <div class="form-group">
              <label>Currency</label>
              <select id="quick-currency" class="form-input">
                <option value="₹" ${profile.currency === '₹' ? 'selected' : ''}>₹ INR (Indian Rupee)</option>
                <option value="$" ${profile.currency === '$' ? 'selected' : ''}>$ USD (US Dollar)</option>
                <option value="€" ${profile.currency === '€' ? 'selected' : ''}>€ EUR (Euro)</option>
                <option value="£" ${profile.currency === '£' ? 'selected' : ''}>£ GBP (British Pound)</option>
                <option value="AED" ${profile.currency === 'AED' ? 'selected' : ''}>AED (UAE Dirham)</option>
                <option value="SGD" ${profile.currency === 'SGD' ? 'selected' : ''}>SGD (Singapore Dollar)</option>
              </select>
            </div>

            <div class="modal-footer" style="padding-top: 0.5rem; justify-content: space-between;">
              <button type="button" class="btn btn-outline btn-xs" id="quick-export-json">
                💾 Backup JSON
              </button>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-outline btn-sm" id="cancel-profile-modal">Close</button>
                <button type="submit" class="btn btn-primary btn-sm">Save Changes</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-profile-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-profile-modal')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('profile-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'profile-modal-backdrop') modalRoot.innerHTML = '';
    });

    document.getElementById('quick-export-json')?.addEventListener('click', async () => {
      const data = await this.storage.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track_money_${profile.loginId || 'backup'}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Full JSON backup downloaded.');
    });

    document.getElementById('edit-profile-quick-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newId = document.getElementById('quick-login-id').value.trim();
      const newCur = document.getElementById('quick-currency').value;
      if (!newId) return;

      await this.storage.saveProfile({
        loginId: newId,
        name: newId,
        currency: newCur
      });

      this.updateHeaderProfileBadge(newId);
      modalRoot.innerHTML = '';
      this.showToast(`Login ID updated to ${newId}`);
      await this.refreshCurrentView();
    });
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
