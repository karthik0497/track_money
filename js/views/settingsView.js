// Track-Money: Settings, Security (PIN Lock), and Audit Trail View
import { TransactionModel } from '../models/transaction.js';
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
      currency: '₹',
      pinEnabled: false,
      pinCode: null
    };

    const auditLogs = await this.storage.getAll('ai_audit_logs');
    const sortedAudit = [...auditLogs].sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = `
      <div class="settings-container fade-in">
        <div class="page-header">
          <div>
            <h2>Settings & Security</h2>
            <p class="text-sm text-muted">Manage your local Login ID, offline app install, and AI voice preferences</p>
          </div>
        </div>

        <!-- 1. User Identity & Login ID (100% Local-First) -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>User Identity & Login ID</h4>
            <span class="badge badge-success">100% Local Profile</span>
          </div>
          <p class="text-sm text-muted">Your Login ID personalizes your dashboard. All records are saved strictly in your device's browser memory (IndexedDB) with zero centralized servers or tracking.</p>

          <form id="settings-profile-form" style="margin-top: 1rem;">
            <div class="grid-2-col">
              <div class="form-group">
                <label>Login ID / Workspace Name</label>
                <input type="text" id="settings-login-id" class="form-input font-bold" 
                       value="${profile.loginId || profile.name || 'User'}" required placeholder="e.g. Karthik">
              </div>
              <div class="form-group">
                <label>Currency Symbol</label>
                <select id="settings-currency" class="form-input">
                  <option value="₹" ${profile.currency === '₹' ? 'selected' : ''}>₹ INR (Indian Rupee)</option>
                  <option value="$" ${profile.currency === '$' ? 'selected' : ''}>$ USD (US Dollar)</option>
                  <option value="€" ${profile.currency === '€' ? 'selected' : ''}>€ EUR (Euro)</option>
                  <option value="£" ${profile.currency === '£' ? 'selected' : ''}>£ GBP (British Pound)</option>
                  <option value="AED" ${profile.currency === 'AED' ? 'selected' : ''}>AED (UAE Dirham)</option>
                  <option value="SGD" ${profile.currency === 'SGD' ? 'selected' : ''}>SGD (Singapore Dollar)</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 0.5rem; flex-wrap: wrap;">
              <button type="submit" class="btn btn-primary btn-sm">💾 Save Login ID & Currency</button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-switch-login-id">🔄 Switch / New Login ID</button>
            </div>
          </form>
        </div>

        <!-- 2. Google Gemini Generative AI Configuration -->
        <div class="card" style="margin-bottom: 1.5rem; border: 1px solid rgba(234, 179, 8, 0.4); background: linear-gradient(180deg, rgba(234, 179, 8, 0.05) 0%, var(--bg-surface) 100%);">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="text-lg">✨</span>
              <h4>Google Gemini Generative AI</h4>
            </div>
            <span class="badge badge-success" id="badge-gemini-status">Active & Connected</span>
          </div>
          <p class="text-sm text-muted">Your personal AI finance co-pilot uses Google Gemini 3.5 Flash with full visibility into your live balances, cash flow, and categories to answer queries, track expenses, and execute money actions.</p>

          <form id="settings-gemini-form" style="margin-top: 1rem;">
            <div class="grid-2-col">
              <div class="form-group">
                <label>Gemini API Key</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <input type="password" id="settings-gemini-key" class="form-input" 
                         value="${GeminiService.getApiKey()}" required placeholder="Enter Gemini API key..." style="padding-right: 40px;">
                  <button type="button" id="btn-toggle-key-visibility" class="btn btn-icon btn-sm" 
                          style="position: absolute; right: 4px; background: transparent; border: none;" title="Show/Hide Key">👁️</button>
                </div>
              </div>
              <div class="form-group">
                <label>AI Model</label>
                <select id="settings-gemini-model" class="form-input font-bold">
                  <option value="gemini-3.5-flash" ${GeminiService.getModel() === 'gemini-3.5-flash' ? 'selected' : ''}>gemini-3.5-flash (Default • High Speed & Low Latency)</option>
                  <option value="gemini-1.5-pro" ${GeminiService.getModel() === 'gemini-1.5-pro' ? 'selected' : ''}>gemini-1.5-pro (Extended Reasoning)</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 0.75rem; flex-wrap: wrap; align-items: center;">
              <button type="submit" class="btn btn-primary btn-sm">💾 Save Gemini Config</button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-test-gemini-connection">⚡ Test Live Connection</button>
              <span class="text-xs" id="gemini-test-result" style="color: var(--color-primary); font-weight: 600;"></span>
            </div>
          </form>
        </div>

        <!-- 3. Appearance & Theme (Dark Mode / Light Mode) -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="text-lg">🎨</span>
              <h4>Appearance & Theme</h4>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-primary" id="badge-theme-mode">${localStorage.getItem('tm_theme') === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
              <button type="button" class="btn btn-outline btn-xs" id="btn-quick-theme-toggle" title="Quick toggle between Light and Dark mode">
                ${localStorage.getItem('tm_theme') === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
              </button>
            </div>
          </div>
          <p class="text-sm text-muted">Choose your preferred visual theme. Select Dark Mode for deep OLED blacks or Light Mode for clean high-contrast daytime readability.</p>
          <div style="margin-top: 1rem;">
            <div class="radio-toggle-group" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
              <label class="radio-pill" style="padding: 12px 14px; cursor: pointer; text-align: center;">
                <input type="radio" name="app_theme_opt" value="dark" ${(!localStorage.getItem('tm_theme') || localStorage.getItem('tm_theme') === 'dark') ? 'checked' : ''}>
                <span style="font-weight: 600;">🌙 Dark Mode</span>
              </label>
              <label class="radio-pill" style="padding: 12px 14px; cursor: pointer; text-align: center;">
                <input type="radio" name="app_theme_opt" value="light" ${localStorage.getItem('tm_theme') === 'light' ? 'checked' : ''}>
                <span style="font-weight: 600;">☀️ Light Mode</span>
              </label>
              <label class="radio-pill" style="padding: 12px 14px; cursor: pointer; text-align: center;">
                <input type="radio" name="app_theme_opt" value="system" ${localStorage.getItem('tm_theme') === 'system' ? 'checked' : ''}>
                <span style="font-weight: 600;">⚙️ System Auto</span>
              </label>
            </div>
          </div>
        </div>


        <!-- 3. Web & Hybrid App Installation -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Install as Hybrid App</h4>
            <span class="badge badge-info" id="badge-pwa-status">Hybrid App</span>
          </div>
          <p class="text-sm text-muted">You can install Track-Money directly from this browser onto your Android phone, iPhone, iPad, Windows, or Mac with 1 tap. Runs offline in standalone mode with embedded local database.</p>
          <div style="margin-top: 1rem; display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" id="btn-settings-install-app">
              📲 Install Hybrid App on this Device
            </button>
            <button class="btn btn-outline btn-sm" id="btn-settings-install-guide">
              ℹ️ How to Install (iOS / Android / PC)
            </button>
          </div>
        </div>

        <!-- 3. Theta AI Voice Configuration -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Theta AI Voice Speed</h4>
            <span class="badge badge-ai" id="badge-voice-speed">${localStorage.getItem('tm_voice_speed') || '1.20'}x Speed</span>
          </div>
          <p class="text-sm text-muted">Fine-tune the speech playback speed for Theta AI conversational responses.</p>
          <div style="margin-top: 1rem; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div class="radio-toggle-group">
              <label class="radio-pill">
                <input type="radio" name="voice_speed_opt" value="1.0" ${(localStorage.getItem('tm_voice_speed') === '1' || localStorage.getItem('tm_voice_speed') === '1.0') ? 'checked' : ''}>
                <span>1.0x Normal</span>
              </label>
              <label class="radio-pill">
                <input type="radio" name="voice_speed_opt" value="1.2" ${(!localStorage.getItem('tm_voice_speed') || localStorage.getItem('tm_voice_speed') === '1.2' || localStorage.getItem('tm_voice_speed') === '1.20') ? 'checked' : ''}>
                <span>1.2x Crisp ⚡</span>
              </label>
              <label class="radio-pill">
                <input type="radio" name="voice_speed_opt" value="1.35" ${localStorage.getItem('tm_voice_speed') === '1.35' ? 'checked' : ''}>
                <span>1.35x Fast</span>
              </label>
            </div>
            <button class="btn btn-outline btn-xs" id="btn-test-ai-voice">
              🔊 Test Voice
            </button>
          </div>
        </div>

        <!-- 4. Hardware & Device Permissions -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Hardware & Device Permissions</h4>
            <button class="btn btn-xs btn-primary" id="btn-grant-all-permissions">
              ⚡ Grant All Permissions
            </button>
          </div>
          <p class="text-sm text-muted">Allow access to phone hardware for voice AI assistant, live receipt scanner, and push alerts.</p>

          <div class="permissions-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 10px;">
            <div class="perm-row">
              <div class="perm-info">
                <span class="perm-icon">🎙️</span>
                <div>
                  <div class="font-bold text-sm">Microphone / Voice Audio</div>
                  <div class="text-xs text-muted">Speech-to-text for hands-free AI commands</div>
                </div>
              </div>
              <div class="perm-actions">
                <span class="badge badge-subtle" id="badge-mic-perm">Checking...</span>
                <button class="btn btn-outline btn-xs" id="btn-request-mic">Request</button>
              </div>
            </div>



            <div class="perm-row">
              <div class="perm-info">
                <span class="perm-icon">🔔</span>
                <div>
                  <div class="font-bold text-sm">Push Notifications</div>
                  <div class="text-xs text-muted">Credit card due date and budget alerts</div>
                </div>
              </div>
              <div class="perm-actions">
                <span class="badge badge-subtle" id="badge-notif-perm">Checking...</span>
                <button class="btn btn-outline btn-xs" id="btn-request-notif">Request</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Security & App Lock -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>App Security & PIN Lock</h4>
            <span class="badge ${profile.pinEnabled ? 'badge-success' : 'badge-subtle'}">
              ${profile.pinEnabled ? 'Lock Active' : 'Unlocked'}
            </span>
          </div>
          <p class="text-sm text-muted">Protect your private financial records with a 4-digit PIN lock when launching the app.</p>

          <div style="margin-top: 1rem;">
            <label class="toggle-switch-label">
              <input type="checkbox" id="toggle-pin-lock" ${profile.pinEnabled ? 'checked' : ''}>
              <span class="font-bold">Enable PIN Security Lock</span>
            </label>
          </div>

          <div id="pin-setup-box" style="${profile.pinEnabled ? '' : 'display: none;'} margin-top: 1rem;">
            <div class="form-group" style="max-width: 260px;">
              <label>Enter 4-digit Security PIN</label>
              <input type="password" id="input-pin-code" class="form-input" maxlength="4" 
                     placeholder="••••" value="${profile.pinCode || ''}" autocomplete="off">
            </div>
            <button class="btn btn-primary btn-sm" id="btn-save-pin">Update PIN</button>
          </div>
        </div>

        <!-- Data Backup & Portability -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="text-lg">💾</span>
              <h4>Data Backup, Restore & Export</h4>
            </div>
            <span class="badge badge-subtle">100% Local</span>
          </div>
          <p class="text-sm text-muted">All your accounts, transactions, and categories are saved locally on this device. You can export a full backup, download CSV spreadsheets, or restore data anytime.</p>

          <div class="backup-actions-grid" style="margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
            <button class="btn btn-outline" id="settings-export-json">
              💾 Full JSON Backup
            </button>
            <label class="btn btn-primary" style="cursor: pointer; margin: 0; text-align: center;">
              📂 Restore JSON Backup
              <input type="file" id="input-restore-json" accept=".json" style="display: none;">
            </label>
            <button class="btn btn-outline" id="settings-export-csv">
              📄 Export All CSV
            </button>
            <button class="btn btn-outline" id="settings-export-month-csv">
              📥 Export This Month CSV
            </button>
          </div>
        </div>


        <!-- Danger Zone: Reset All Data -->
        <div class="card" style="margin-bottom: 1.5rem; border: 1.5px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.03);">
          <div class="card-header">
            <h4 style="color: var(--danger-color);">⚠️ Reset All Application Data</h4>
            <span class="badge badge-danger">Danger Zone</span>
          </div>
          <p class="text-sm text-muted">
            Completely clear all application data, including transactions, financial accounts, custom categories, recurring rules, settings, and audit logs.
          </p>
          <div class="alert-box" style="margin-top: 0.75rem; padding: 10px 14px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid var(--danger-color); font-size: 0.85rem; color: #fca5a5;">
            <strong>Notice:</strong> This action permanently erases all in-app data on this browser. Any backup files (.json / .csv) already downloaded to your device will NOT be deleted. You can restore your data from a backup file at any time.
          </div>
          <div style="margin-top: 1rem; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-danger btn-sm" id="btn-reset-all-data">
              ⚠️ Reset All Data (Factory Reset)
            </button>
            <button class="btn btn-outline text-danger btn-sm" id="btn-clear-accounts-tx">
              🗑️ Clear Accounts & Transactions Only
            </button>
          </div>
        </div>

        <!-- AI Audit Trail Log -->
        <div class="card">
          <div class="card-header">
            <h4>AI Transparency & Audit Trail</h4>
            <span class="badge badge-ai">${sortedAudit.length} AI Events</span>
          </div>
          <p class="text-sm text-muted">Audit log of how the AI parsed and executed your spoken and typed financial transactions.</p>

          <div class="audit-log-list" style="margin-top: 1rem;">
            ${sortedAudit.length === 0 ? `
              <div class="empty-placeholder">No AI actions logged yet.</div>
            ` : sortedAudit.map(log => `
              <div class="audit-item">
                <div class="audit-header">
                  <span class="font-bold text-sm">"${this.escapeHtml(log.originalMessage)}"</span>
                  <span class="badge ${log.confirmationStatus === 'confirmed' ? 'badge-success' : 'badge-warning'} text-xs">
                    ${log.confirmationStatus}
                  </span>
                </div>
                <div class="audit-interpreted text-xs">
                  <pre>${this.escapeHtml(JSON.stringify(log.interpretedAction, null, 2))}</pre>
                </div>
                <div class="audit-footer text-xs text-muted">
                  <span>Logged on: ${new Date(log.timestamp).toLocaleString()}</span>
                  ${log.resultingTransactionId ? `<span>• Resulting Tx ID: <code>${log.resultingTransactionId}</code></span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container, profile);
  }

  attachEvents(container, profile) {
    // 0. Profile & Login ID Form Logic
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
      this.app.showToast(`Login ID updated to "${newLoginId}" with currency ${newCurrency}`);
      await this.app.refreshCurrentView();
    });

    container.querySelector('#btn-switch-login-id')?.addEventListener('click', () => {
      this.app.openProfileModal();
    });

    // Gemini AI Configuration Handlers
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
      this.app.showToast(`✨ Gemini Configuration Saved (${model})`);
      if (testResultSpan) testResultSpan.textContent = 'Config saved!';
    });

    testGeminiBtn?.addEventListener('click', async () => {
      testGeminiBtn.disabled = true;
      testResultSpan.textContent = 'Connecting to Google Gemini...';
      const res = await GeminiService.testConnection();
      testGeminiBtn.disabled = false;
      if (res.success) {
        testResultSpan.innerHTML = `✅ Connected in ${res.latency}ms (${res.model})`;
        this.app.showToast(`Gemini is online & verified! (${res.latency}ms)`);
      } else {
        testResultSpan.innerHTML = `❌ Error: ${res.status || 'Failed'} (${res.latency}ms)`;
        this.app.showToast(`Gemini error: ${res.error || 'Connection failed'}`);
      }
    });

    // Quick Theme Toggle Button in Settings
    container.querySelector('#btn-quick-theme-toggle')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      this.app.applyTheme(nextTheme, true);
      const radio = container.querySelector(`input[name="app_theme_opt"][value="${nextTheme}"]`);
      if (radio) radio.checked = true;
      const badge = container.querySelector('#badge-theme-mode');
      if (badge) badge.textContent = nextTheme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';
      const btn = container.querySelector('#btn-quick-theme-toggle');
      if (btn) btn.textContent = nextTheme === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light';
    });

    // Theme Mode Change Handlers
    container.querySelectorAll('input[name="app_theme_opt"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const theme = e.target.value;
        this.app.applyTheme(theme, true);
        const resolved = document.documentElement.getAttribute('data-theme') || theme;
        const badge = container.querySelector('#badge-theme-mode');
        if (badge) {
          badge.textContent = resolved === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';
        }
        const btn = container.querySelector('#btn-quick-theme-toggle');
        if (btn) {
          btn.textContent = resolved === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light';
        }
      });
    });


    // PWA Install Handlers
    container.querySelector('#btn-settings-install-app')?.addEventListener('click', () => {
      this.app.triggerInstallPrompt();
    });

    container.querySelector('#btn-settings-install-guide')?.addEventListener('click', () => {
      this.app.showInstallGuideModal();
    });

    // Theta AI Voice Speed Handlers
    container.querySelectorAll('input[name="voice_speed_opt"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value) || 1.2;
        localStorage.setItem('tm_voice_speed', speed.toString());
        const badge = container.querySelector('#badge-voice-speed');
        if (badge) badge.textContent = `${speed}x Speed`;
        this.app.showToast(`Theta AI Voice speed set to ${speed}x`);
      });
    });

    container.querySelector('#btn-test-ai-voice')?.addEventListener('click', () => {
      const speed = localStorage.getItem('tm_voice_speed') || '1.20';
      if (this.app.assistantView && this.app.assistantView.speech) {
        this.app.assistantView.speech.speak(`Hello! This is Theta AI speaking briskly at ${speed} times speed. Your financial records are 100 percent private and stored locally on your device.`);
      }
    });

    // 1. Hardware & Device Permissions Logic
    const micBadge = container.querySelector('#badge-mic-perm');
    const camBadge = container.querySelector('#badge-cam-perm');
    const notifBadge = container.querySelector('#badge-notif-perm');

    const updatePermissionBadges = async () => {
      const perms = await PermissionsManager.getPermissionsStatus();
      if (micBadge) {
        micBadge.textContent = perms.microphone === 'granted' ? 'Granted ✅' : (perms.microphone === 'denied' ? 'Denied ❌' : 'Prompt ⚠️');
        micBadge.className = `badge ${perms.microphone === 'granted' ? 'badge-success' : (perms.microphone === 'denied' ? 'badge-danger' : 'badge-warning')}`;
      }

      if (notifBadge) {
        notifBadge.textContent = perms.notifications === 'granted' ? 'Granted ✅' : (perms.notifications === 'denied' ? 'Denied ❌' : 'Default ⚠️');
        notifBadge.className = `badge ${perms.notifications === 'granted' ? 'badge-success' : (perms.notifications === 'denied' ? 'badge-danger' : 'badge-subtle')}`;
      }
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

    container.querySelector('#btn-grant-all-permissions')?.addEventListener('click', async () => {
      this.app.showToast('Requesting all device permissions...');
      await PermissionsManager.requestAllPermissions();
      await updatePermissionBadges();
      this.app.showToast('Permissions updated successfully!');
    });

    const pinToggle = container.querySelector('#toggle-pin-lock');
    const pinBox = container.querySelector('#pin-setup-box');
    const pinInput = container.querySelector('#input-pin-code');
    const savePinBtn = container.querySelector('#btn-save-pin');

    pinToggle?.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      pinBox.style.display = enabled ? 'block' : 'none';
      if (!enabled) {
        profile.pinEnabled = false;
        profile.pinCode = null;
        await this.storage.put('app_settings', profile);
        this.app.showToast('PIN Lock disabled.');
      }
    });

    savePinBtn?.addEventListener('click', async () => {
      const code = pinInput.value.trim();
      if (code.length !== 4 || isNaN(parseInt(code))) {
        alert('Please enter a valid 4-digit PIN code.');
        return;
      }
      profile.pinEnabled = true;
      profile.pinCode = code;
      await this.storage.put('app_settings', profile);
      this.app.showToast('Security PIN saved!');
    });

    // JSON Export
    container.querySelector('#settings-export-json')?.addEventListener('click', async () => {
      const data = await this.storage.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track_money_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.app.showToast('Full JSON backup downloaded.');
    });

    // CSV Export
    container.querySelector('#settings-export-csv')?.addEventListener('click', async () => {
      const transactions = await this.storage.getAll('transactions');
      const accounts = await this.storage.getAll('accounts');
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
      this.app.showToast('CSV transactions downloaded.');
    });

    // Month CSV Export
    container.querySelector('#settings-export-month-csv')?.addEventListener('click', async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const report = await this.storage.getMonthlyReport(currentYear, currentMonth);
      if (!report.transactions || report.transactions.length === 0) {
        this.app.showToast('No transactions found for current month.');
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
      this.app.showToast('Current month CSV transactions downloaded.');
    });

    // JSON Restore

    container.querySelector('#input-restore-json')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target.result);
          await this.storage.importData(json);
          alert('Backup restored successfully! The application will refresh.');
          window.location.reload();
        } catch (err) {
          alert('Failed to restore backup: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Reset All Data (Complete Factory Reset)
    container.querySelector('#btn-reset-all-data')?.addEventListener('click', async () => {
      const confirmWarning = 
        '⚠️ WARNING: ARE YOU SURE YOU WANT TO RESET ALL DATA?\n\n' +
        '• This will completely delete ALL transactions, accounts, custom categories, recurring rules, settings, and logs from this browser.\n' +
        '• Downloaded backup files (.json / .csv) on your computer/phone will NOT be affected.\n\n' +
        'Click OK to confirm and permanently reset all application data.';
      
      if (confirm(confirmWarning)) {
        await this.storage.resetAllData();
        alert('All application data has been completely reset. The app will now reload with fresh defaults.');
        window.location.reload();
      }
    });

    // Clear Accounts & Transactions Only
    container.querySelector('#btn-clear-accounts-tx')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all accounts and transactions to start completely fresh? Standard categories and profile settings will be kept.')) {
        await this.storage.clearAllAccountsAndTransactions();
        alert('All accounts and transactions have been cleared. Starting with a fresh empty ledger!');
        window.location.reload();
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
