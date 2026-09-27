// Track-Money: Settings, Security (PIN Lock), and Audit Trail View
import { TransactionModel } from '../models/transaction.js';
import { PermissionsManager } from '../utils/permissions.js';

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

        <!-- 2. Web & Hybrid App Installation (No APK Needed) -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Download & Install as App</h4>
            <span class="badge badge-info" id="badge-pwa-status">Browser PWA</span>
          </div>
          <p class="text-sm text-muted">You do not need an APK file. You can install Track-Money directly from this browser onto your Android phone, iPhone/iPad, Windows, or Mac with 1 tap.</p>
          <div style="margin-top: 1rem; display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" id="btn-settings-install-app">
              📲 Install App on this Device
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
                <span class="perm-icon">📷</span>
                <div>
                  <div class="font-bold text-sm">Camera & Scanner</div>
                  <div class="text-xs text-muted">Scan paper receipts, UPI QR, and bills</div>
                </div>
              </div>
              <div class="perm-actions">
                <span class="badge badge-subtle" id="badge-cam-perm">Checking...</span>
                <button class="btn btn-outline btn-xs" id="btn-request-cam">Request</button>
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
            <h4>Data Backup & Portability</h4>
            <span class="badge badge-subtle">100% Local</span>
          </div>
          <p class="text-sm text-muted">All your accounts, transactions, and categories are saved locally on this device. You can export a full backup or restore your data anytime.</p>

          <div class="backup-actions-row" style="margin-top: 1rem; display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn btn-outline" id="settings-export-json">
              💾 Download Full JSON Backup
            </button>
            <label class="btn btn-outline" style="cursor: pointer;">
              📂 Restore Backup from JSON
              <input type="file" id="input-restore-json" accept=".json" style="display: none;">
            </label>
            <button class="btn btn-outline text-danger" id="btn-reset-db">
              ⚠️ Reset to Default Seed Data
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
      if (camBadge) {
        camBadge.textContent = perms.camera === 'granted' ? 'Granted ✅' : (perms.camera === 'denied' ? 'Denied ❌' : 'Prompt ⚠️');
        camBadge.className = `badge ${perms.camera === 'granted' ? 'badge-success' : (perms.camera === 'denied' ? 'badge-danger' : 'badge-warning')}`;
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

    container.querySelector('#btn-request-cam')?.addEventListener('click', async () => {
      const res = await PermissionsManager.requestCamera();
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

    // Reset DB
    container.querySelector('#btn-reset-db')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all data to default? This cannot be undone.')) {
        indexedDB.deleteDatabase('TrackMoneyDB');
        window.location.reload();
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
