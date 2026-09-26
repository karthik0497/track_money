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
            <p class="text-sm text-muted">Configure security lock, device permissions, and inspect AI audit trail</p>
          </div>
        </div>

        <!-- Hardware & Device Permissions -->
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
