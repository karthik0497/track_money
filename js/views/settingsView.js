// Track-Money: Minimal Settings View
import { PermissionsManager } from '../utils/permissions.js';
import { GeminiService } from '../ai/gemini.js';

export class SettingsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
  }

  async render(container) {
    const profile = (await this.storage.get('app_settings', 'profile')) || {
      name: 'User',
      currency: '₹'
    };
    const savedTheme = localStorage.getItem('tm_theme') || 'dark';
    const savedVoiceSpeed = localStorage.getItem('tm_voice_speed') || '1.2';

    container.innerHTML = `
      <div class="settings-container fade-in">
        <div class="page-header">
          <h2>Settings</h2>
        </div>

        <!-- Theme -->
        <div class="card theme-compact-card" style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <h4 style="margin: 0;">Theme</h4>
            <div class="theme-segmented-control" role="group" aria-label="Theme">
              <button type="button" class="theme-seg-btn ${savedTheme === 'dark' ? 'active' : ''}" data-theme="dark">
                🌙 Dark Mode
              </button>
              <button type="button" class="theme-seg-btn ${savedTheme === 'light' ? 'active' : ''}" data-theme="light">
                ☀️ Light Mode
              </button>
              <button type="button" class="theme-seg-btn ${savedTheme === 'system' ? 'active' : ''}" data-theme="system">
                ⚙️ Auto
              </button>
            </div>
          </div>
        </div>

        <!-- Profile & Currency -->
        <div class="card" style="margin-bottom: 1rem;">
          <form id="settings-profile-form">
            <div class="grid-2-col">
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label>Name</label>
                <input type="text" id="settings-login-id" class="form-input font-bold"
                       value="${this.escapeHtml(profile.loginId || profile.name || 'User')}" required>
              </div>
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label>Currency</label>
                <select id="settings-currency" class="form-input">
                  <option value="₹" ${profile.currency === '₹' ? 'selected' : ''}>₹ INR</option>
                  <option value="$" ${profile.currency === '$' ? 'selected' : ''}>$ USD</option>
                  <option value="€" ${profile.currency === '€' ? 'selected' : ''}>€ EUR</option>
                  <option value="£" ${profile.currency === '£' ? 'selected' : ''}>£ GBP</option>
                  <option value="AED" ${profile.currency === 'AED' ? 'selected' : ''}>AED</option>
                  <option value="SGD" ${profile.currency === 'SGD' ? 'selected' : ''}>SGD</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
          </form>
        </div>

        <!-- Backup & Restore -->
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-header" style="margin-bottom: 0.75rem;">
            <h4 style="margin: 0;">Data</h4>
          </div>
          <div class="backup-actions-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
            <button class="btn btn-outline btn-sm" id="settings-export-json">💾 Backup</button>
            <label class="btn btn-primary btn-sm" style="cursor: pointer; margin: 0; text-align: center;">
              📂 Restore
              <input type="file" id="input-restore-json" accept=".json" style="display: none;">
            </label>
            <button class="btn btn-outline btn-sm" id="settings-export-csv">📄 CSV</button>
            <button class="btn btn-outline btn-sm" id="settings-export-month-csv">📥 Month CSV</button>
          </div>
        </div>

        <!-- AI -->
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-header" style="margin-bottom: 0.75rem;">
            <h4 style="margin: 0;">AI</h4>
            <span class="text-xs" id="gemini-test-result" style="color: var(--color-primary); font-weight: 600;"></span>
          </div>
          <form id="settings-gemini-form">
            <div class="grid-2-col">
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label>API Key</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <input type="password" id="settings-gemini-key" class="form-input"
                         value="${this.escapeHtml(GeminiService.getApiKey())}" required style="padding-right: 36px;">
                  <button type="button" id="btn-toggle-key-visibility" class="btn btn-icon btn-sm"
                          style="position: absolute; right: 4px; background: transparent; border: none;" title="Show">👁️</button>
                </div>
              </div>
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label>Model</label>
                <select id="settings-gemini-model" class="form-input font-bold">
                  <option value="gemini-3.5-flash" ${GeminiService.getModel() === 'gemini-3.5-flash' ? 'selected' : ''}>gemini-3.5-flash</option>
                  <option value="gemini-1.5-pro" ${GeminiService.getModel() === 'gemini-1.5-pro' ? 'selected' : ''}>gemini-1.5-pro</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button type="submit" class="btn btn-primary btn-sm">Save</button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-test-gemini-connection">Test</button>
              <div class="radio-toggle-group" style="margin-left: auto;">
                <label class="radio-pill">
                  <input type="radio" name="voice_speed_opt" value="1.0" ${(savedVoiceSpeed === '1' || savedVoiceSpeed === '1.0') ? 'checked' : ''}>
                  <span>1.0x</span>
                </label>
                <label class="radio-pill">
                  <input type="radio" name="voice_speed_opt" value="1.2" ${(savedVoiceSpeed === '1.2' || savedVoiceSpeed === '1.20') ? 'checked' : ''}>
                  <span>1.2x</span>
                </label>
                <label class="radio-pill">
                  <input type="radio" name="voice_speed_opt" value="1.35" ${savedVoiceSpeed === '1.35' ? 'checked' : ''}>
                  <span>1.35x</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        <!-- App & Permissions -->
        <div class="card" style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <h4 style="margin: 0;">App</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button class="btn btn-outline btn-xs" id="btn-settings-install-app">📲 Install</button>
              <button class="btn btn-outline btn-xs" id="btn-request-mic">🎙️ Mic <span id="badge-mic-perm"></span></button>
              <button class="btn btn-outline btn-xs" id="btn-request-notif">🔔 Alerts <span id="badge-notif-perm"></span></button>
            </div>
          </div>
        </div>

        <!-- Reset -->
        <div class="card" style="border: 1px solid rgba(239, 68, 68, 0.35);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <h4 style="margin: 0; color: var(--danger-color);">Reset</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-outline text-danger btn-sm" id="btn-clear-accounts-tx">Clear</button>
              <button class="btn btn-danger btn-sm" id="btn-reset-all-data">Reset</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    // Profile & Currency
    container.querySelector('#settings-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newLoginId = container.querySelector('#settings-login-id').value.trim();
      const newCurrency = container.querySelector('#settings-currency').value;
      if (!newLoginId) return;

      await this.storage.saveProfile({
        loginId: newLoginId,
        name: newLoginId,
        currency: newCurrency
      });

      this.app.updateHeaderProfileBadge(newLoginId);
      this.app.showToast('Saved');
      await this.app.refreshCurrentView();
    });

    // Theme
    const themeButtons = container.querySelectorAll('.theme-seg-btn');
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        this.app.applyTheme(theme, true);
        themeButtons.forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    // Gemini AI Config
    const geminiForm = container.querySelector('#settings-gemini-form');
    const geminiKeyInput = container.querySelector('#settings-gemini-key');
    const geminiModelSelect = container.querySelector('#settings-gemini-model');
    const toggleKeyBtn = container.querySelector('#btn-toggle-key-visibility');
    const testGeminiBtn = container.querySelector('#btn-test-gemini-connection');
    const testResultSpan = container.querySelector('#gemini-test-result');

    toggleKeyBtn?.addEventListener('click', () => {
      if (geminiKeyInput.type === 'password') {
        geminiKeyInput.type = 'text';
        toggleKeyBtn.textContent = '🔒';
      } else {
        geminiKeyInput.type = 'password';
        toggleKeyBtn.textContent = '👁️';
      }
    });

    geminiForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = geminiKeyInput.value.trim();
      const model = geminiModelSelect.value.trim();
      GeminiService.saveConfig(key, model);
      this.app.showToast('Saved');
      if (testResultSpan) testResultSpan.textContent = 'Saved';
    });

    testGeminiBtn?.addEventListener('click', async () => {
      testGeminiBtn.disabled = true;
      testResultSpan.textContent = 'Testing...';
      const res = await GeminiService.testConnection();
      testGeminiBtn.disabled = false;
      if (res.success) {
        testResultSpan.textContent = `✓ ${res.latency}ms`;
      } else {
        testResultSpan.textContent = `✕ ${res.status || 'Error'}`;
      }
    });

    // Voice Speed
    container.querySelectorAll('input[name="voice_speed_opt"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value) || 1.2;
        localStorage.setItem('tm_voice_speed', speed.toString());
        this.app.showToast(`Voice ${speed}x`);
      });
    });

    // Install & Permissions
    container.querySelector('#btn-settings-install-app')?.addEventListener('click', () => {
      this.app.triggerInstallPrompt();
    });

    const micBadge = container.querySelector('#badge-mic-perm');
    const notifBadge = container.querySelector('#badge-notif-perm');
    const updatePermissionBadges = async () => {
      const perms = await PermissionsManager.getPermissionsStatus();
      if (micBadge) micBadge.textContent = perms.microphone === 'granted' ? '✓' : '';
      if (notifBadge) notifBadge.textContent = perms.notifications === 'granted' ? '✓' : '';
    };
    updatePermissionBadges();

    container.querySelector('#btn-request-mic')?.addEventListener('click', async () => {
      const res = await PermissionsManager.requestMicrophone();
      await updatePermissionBadges();
      this.app.showToast(res.message);
    });

    container.querySelector('#btn-request-notif')?.addEventListener('click', async () => {
      const res = await PermissionsManager.requestNotifications();
      await updatePermissionBadges();
      this.app.showToast(res.message);
    });

    // Backup JSON
    container.querySelector('#settings-export-json')?.addEventListener('click', async () => {
      const data = await this.storage.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track_money_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.app.showToast('Backup saved');
    });

    // Export All CSV
    container.querySelector('#settings-export-csv')?.addEventListener('click', async () => {
      const [transactions, accounts] = await Promise.all([
        this.storage.getAll('transactions'),
        this.storage.getAll('accounts')
      ]);
      const accMap = new Map(accounts.map(a => [a.id, a.name]));
      const headers = ['Transaction ID', 'Date', 'Type', 'Account', 'Category', 'Subcategory', 'Amount', 'Description', 'Payment Method', 'Notes'];
      const rows = transactions.map(t => [
        t.id,
        t.date,
        t.type,
        `"${(accMap.get(t.accountId) || t.accountId || '').replace(/"/g, '""')}"`,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        `"${(t.subcategory || '').replace(/"/g, '""')}"`,
        t.amount,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${(t.paymentMethod || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track_money_transactions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.app.showToast('CSV exported');
    });

    // Export Month CSV
    container.querySelector('#settings-export-month-csv')?.addEventListener('click', async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const report = await this.storage.getMonthlyReport(currentYear, currentMonth);
      if (!report.transactions || report.transactions.length === 0) {
        this.app.showToast('No transactions this month');
        return;
      }
      const accounts = await this.storage.getAll('accounts');
      const accMap = new Map(accounts.map(a => [a.id, a.name]));
      const headers = ['Transaction ID', 'Date', 'Type', 'Account', 'Category', 'Subcategory', 'Amount', 'Description', 'Payment Method', 'Notes'];
      const rows = report.transactions.map(t => [
        t.id,
        t.date,
        t.type,
        `"${(accMap.get(t.accountId) || t.accountName || t.accountId || '').replace(/"/g, '""')}"`,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        `"${(t.subcategory || '').replace(/"/g, '""')}"`,
        t.amount,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${(t.paymentMethod || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track_money_${currentYear}_${String(currentMonth + 1).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.app.showToast('CSV exported');
    });

    // Restore JSON
    container.querySelector('#input-restore-json')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target.result);
          await this.storage.importData(json);
          alert('Backup restored!');
          window.location.reload();
        } catch (err) {
          alert('Restore failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Reset All Data
    container.querySelector('#btn-reset-all-data')?.addEventListener('click', async () => {
      if (confirm('Reset all app data? Downloaded backups are not affected.')) {
        await this.storage.resetAllData();
        window.location.reload();
      }
    });

    // Clear Accounts & Transactions
    container.querySelector('#btn-clear-accounts-tx')?.addEventListener('click', async () => {
      if (confirm('Clear all accounts and transactions?')) {
        await this.storage.clearAllAccountsAndTransactions();
        window.location.reload();
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
