// Track-Money: AI Conversational Assistant UI Component
import { SpeechEngine } from '../ai/speech.js';
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class AssistantView {
  constructor(assistantCoordinator, app) {
    this.coordinator = assistantCoordinator;
    this.app = app;
    this.isOpen = false;
    this.isRecording = false;
    this.lastInputWasVoice = false;

    this.speech = new SpeechEngine({
      onStart: () => {
        this.isRecording = true;
        this.updateVoiceStatus('Listening... Speak naturally');
      },
      onResult: (result) => {
        const inputEl = document.getElementById('ai-chat-input');
        if (inputEl) {
          inputEl.value = result.transcript;
        }
        if (result.isFinal) {
          this.lastInputWasVoice = true;
          this.handleSendMessage(result.transcript);
        }
      },
      onError: (err) => {
        this.isRecording = false;
        this.updateVoiceStatus('Mic stopped or unavailable');
      },
      onEnd: () => {
        this.isRecording = false;
        this.updateVoiceStatus('');
      }
    });
  }

  render(rootContainer) {
    rootContainer.innerHTML = `
      <!-- Floating AI Assistant Action Button (FAB) -->
      <button class="ai-fab" id="ai-fab-toggle" title="Open AI Financial Assistant">
        <div class="ai-fab-glow"></div>
        <span class="ai-fab-icon">✨</span>
        <span class="ai-fab-badge">AI</span>
      </button>

      <!-- Slide-Up AI Assistant Drawer -->
      <div class="ai-drawer-backdrop" id="ai-drawer-backdrop">
        <div class="ai-drawer-card slide-up" id="ai-drawer-card">
          <!-- Drawer Header -->
          <div class="ai-drawer-header">
            <div class="ai-header-brand">
              <div class="ai-avatar-circle" style="background: linear-gradient(135deg, #facc15, #eab308); color: #08080a;">✨</div>
              <div>
                <h3 class="font-bold">Track-Money AI Co-Pilot</h3>
                <span class="text-xs text-muted" id="ai-voice-status">Powered by Google Gemini 3.5 Flash • Real-Time Finance Advisor</span>
              </div>
            </div>
            <div class="ai-header-actions" style="display: flex; align-items: center; gap: 8px;">
              <button class="btn btn-outline btn-xs" id="btn-voice-speed-pill" title="Toggle AI voice speed">
                ⚡ ${this.speech.getSpeedRate()}x Speed
              </button>
              <button class="btn btn-icon" id="ai-drawer-close">✕</button>
            </div>
          </div>

          <!-- Suggested Prompts Strip -->
          <div class="ai-suggestions-carousel">
            <span class="text-xs text-muted" style="margin-right: 6px; align-self: center;">Try:</span>
            <button class="ai-chip" data-prompt="Where did I spend the most this month?">"Where did I spend most?"</button>
            <button class="ai-chip" data-prompt="Analyze my spending and suggest what I need to improve">"How can I save more?"</button>
            <button class="ai-chip" data-prompt="Create category Fitness with red tag">"Create category Fitness"</button>
            <button class="ai-chip" data-prompt="Show all my transactions for this month">"Say all transactions"</button>
            <button class="ai-chip" data-prompt="Transfer ₹5,000 from HDFC Bank to ICICI Credit Card">"Transfer 5k to Credit Card"</button>
            <button class="ai-chip" data-prompt="What is my total Net Position, Assets, and Debts?">"Net Position & Debt"</button>
            <button class="ai-chip" data-prompt="Spent ₹450 for lunch today from HDFC">"Spent 450 lunch HDFC"</button>
            <button class="ai-chip" data-prompt="Add 30,000 salary income to Savings">"Add 30k salary"</button>
          </div>

          <!-- Chat Conversation Log -->
          <div class="ai-chat-messages" id="ai-chat-messages">
            <!-- Messages inserted dynamically -->
          </div>

          <!-- Voice Pulse Visualizer Wave -->
          <div class="voice-wave-container" id="voice-wave" style="display: none;">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <span class="text-xs text-muted" style="margin-left: 8px;">Listening to your voice...</span>
          </div>

          <!-- Input Bar -->
          <div class="ai-input-bar">
            <button class="btn-voice-toggle" id="btn-voice-mic" title="Voice Input">
              🎙️
            </button>
            <input type="text" id="ai-chat-input" class="form-input ai-input" 
                   placeholder="Type or speak: 'Spent 450 for lunch'..." autocomplete="off">
            <button class="btn btn-primary btn-sm" id="btn-ai-send">
              Send
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
    this.renderInitialWelcome();
  }

  renderInitialWelcome() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    container.innerHTML = `
      <div class="chat-msg msg-ai fade-in">
        <div class="msg-avatar">✨</div>
        <div class="msg-bubble">
          <p>Hello! I am your <strong>Track-Money AI Assistant</strong>.</p>
          <p class="text-sm" style="margin-top: 4px;">
            You can type or speak financial commands naturally. For example:
          </p>
          <ul class="text-xs" style="margin-top: 4px; padding-left: 1.2rem; color: #94a3b8;">
            <li><em>"Create account Bank Saving Account 6599"</em></li>
            <li><em>"Add credit card ICICI Coral limit 50,000"</em></li>
            <li><em>"I spent ₹500 for lunch from HDFC bank"</em></li>
            <li><em>"Paid 5,000 towards my HDFC credit card"</em></li>
            <li><em>"Transfer 10,000 from HDFC to SBI"</em></li>
            <li><em>"How much did I spend on food this month?"</em></li>
          </ul>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const fab = document.getElementById('ai-fab-toggle');
    const drawerBackdrop = document.getElementById('ai-drawer-backdrop');
    const drawerClose = document.getElementById('ai-drawer-close');
    const sendBtn = document.getElementById('btn-ai-send');
    const inputEl = document.getElementById('ai-chat-input');
    const micBtn = document.getElementById('btn-voice-mic');

    fab?.addEventListener('click', () => this.open());
    drawerClose?.addEventListener('click', () => this.close());
    drawerBackdrop?.addEventListener('click', (e) => {
      if (e.target.id === 'ai-drawer-backdrop') this.close();
    });

    sendBtn?.addEventListener('click', () => {
      const text = inputEl.value;
      if (text && text.trim()) {
        inputEl.value = '';
        this.lastInputWasVoice = false;
        this.handleSendMessage(text);
      }
    });

    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = inputEl.value;
        if (text && text.trim()) {
          inputEl.value = '';
          this.lastInputWasVoice = false;
          this.handleSendMessage(text);
        }
      }
    });

    // Voice Speed Toggle (1.0x -> 1.2x Crisp -> 1.35x Fast)
    document.getElementById('btn-voice-speed-pill')?.addEventListener('click', () => {
      const speeds = [1.0, 1.2, 1.35];
      const current = this.speech.getSpeedRate();
      const currentRounded = Math.round(current * 100) / 100;
      let nextIdx = speeds.findIndex(s => Math.abs(s - currentRounded) < 0.05);
      if (nextIdx === -1) nextIdx = 0;
      else nextIdx = (nextIdx + 1) % speeds.length;
      
      const newSpeed = speeds[nextIdx];
      this.speech.setSpeedRate(newSpeed);
      const pill = document.getElementById('btn-voice-speed-pill');
      if (pill) pill.textContent = `⚡ ${newSpeed}x Speed`;
      this.speech.speak(`Voice speed set to ${newSpeed}x`);
    });

    micBtn?.addEventListener('click', () => {
      if (this.isRecording) {
        this.speech.stop();
      } else {
        const started = this.speech.start();
        if (!started) {
          alert('Microphone access is not supported or was blocked. You can still type your commands!');
        }
      }
    });

    // Quick chips
    document.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        this.handleSendMessage(prompt);
      });
    });
  }

  open() {
    this.isOpen = true;
    const drawer = document.getElementById('ai-drawer-backdrop');
    if (drawer) drawer.classList.add('open');
    document.getElementById('ai-chat-input')?.focus();
  }

  close() {
    this.isOpen = false;
    this.speech.stop();
    const drawer = document.getElementById('ai-drawer-backdrop');
    if (drawer) drawer.classList.remove('open');
  }

  updateVoiceStatus(statusText) {
    const statusEl = document.getElementById('ai-voice-status');
    const waveEl = document.getElementById('voice-wave');
    const micBtn = document.getElementById('btn-voice-mic');

    if (this.isRecording) {
      if (statusEl) statusEl.textContent = statusText || 'Listening...';
      if (waveEl) waveEl.style.display = 'flex';
      if (micBtn) micBtn.classList.add('mic-active');
    } else {
      if (statusEl) statusEl.textContent = '100% Offline • Voice & Natural Language';
      if (waveEl) waveEl.style.display = 'none';
      if (micBtn) micBtn.classList.remove('mic-active');
    }
  }

  async handleSendMessage(text) {
    const msgContainer = document.getElementById('ai-chat-messages');
    if (!msgContainer) return;

    // Append User Bubble
    const userMsgHtml = `
      <div class="chat-msg msg-user fade-in">
        <div class="msg-bubble">${this.escapeHtml(text)}</div>
      </div>
    `;
    msgContainer.insertAdjacentHTML('beforeend', userMsgHtml);

    // Instant Visual Feedback: Show thinking indicator
    const thinkingHtml = `
      <div class="chat-msg msg-ai fade-in" id="ai-thinking-indicator">
        <div class="msg-avatar">✨</div>
        <div class="msg-bubble thinking-bubble">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    msgContainer.insertAdjacentHTML('beforeend', thinkingHtml);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Process via AssistantCoordinator
    let response = null;
    try {
      response = await this.coordinator.processInput(text);
    } finally {
      const thinkingEl = document.getElementById('ai-thinking-indicator');
      if (thinkingEl) thinkingEl.remove();
    }
    if (!response) return;

    if (response.type === 'account_created' && response.data) {
      if (this.app?.showToast) {
        this.app.showToast(`Account "${response.data.name}" created!`);
      }
      if (this.speech) {
        this.speech.speak(`I have created your ${response.data.name} account.`);
      }
    }

    this.renderAiMessage(response);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  renderAiMessage(msg) {
    const msgContainer = document.getElementById('ai-chat-messages');
    if (!msgContainer) return;

    let contentHtml = '';

    if (msg.type === 'account_created') {
      const data = msg.data;
      const isCredit = data.category === 'credit';
      contentHtml = `
        <div class="msg-bubble confirmation-bubble fade-in">
          <div class="confirm-card-header">
            <span class="confirm-badge" style="background: rgba(16, 185, 129, 0.18); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35);">
              ✅ ACCOUNT CREATED
            </span>
            <strong>Account Added to Database</strong>
          </div>

          <div class="confirm-card-body">
            <div class="confirm-row">
              <span class="text-muted">Account Name:</span>
              <span class="font-bold text-lg">${this.escapeHtml(data.name)}</span>
            </div>
            <div class="confirm-row">
              <span class="text-muted">Category:</span>
              <span class="badge ${isCredit ? 'badge-danger' : 'badge-primary'}">
                ${isCredit ? '💳 Credit / Card' : '🏦 Debit / Asset'}
              </span>
            </div>
            <div class="confirm-row">
              <span class="text-muted">Account Type:</span>
              <span class="font-bold">${this.escapeHtml(data.type)}</span>
            </div>
            <div class="confirm-row">
              <span class="text-muted">${isCredit ? 'Credit Limit:' : 'Opening Balance:'}</span>
              <span class="font-bold text-xl ${isCredit ? 'text-warning' : 'text-primary'}">
                ${AccountModel.formatCurrency(isCredit ? data.creditLimit : data.openingBalance)}
              </span>
            </div>
            <p class="text-xs text-muted" style="margin-top: 6px;">
              Saved locally to your device memory. You can record expenses or income to this account immediately!
            </p>
          </div>

          <div class="confirm-actions" style="margin-top: 10px;">
            <button class="btn btn-sm btn-primary btn-view-created-acc" data-acc-id="${data.id}">
              🏦 View in Accounts
            </button>
            <button class="btn btn-sm btn-outline btn-edit-created-acc" data-acc-id="${data.id}">
              ✏ Edit
            </button>
            <button class="btn btn-sm btn-text text-danger btn-undo-created-acc" data-acc-id="${data.id}" data-acc-name="${this.escapeHtml(data.name)}">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    } else if (msg.type === 'confirmation_card') {
      const data = msg.data;
      const isAccount = data.isAccount || data.actionType === 'create_account';
      const isTransfer = data.type === 'transfer';
      const isCC = data.type === 'credit_card_payment';

      contentHtml = `
        <div class="msg-bubble confirmation-bubble fade-in">
          <div class="confirm-card-header">
            <span class="confirm-badge" style="${isAccount ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);' : ''}">
              ${isAccount ? 'NEW ACCOUNT' : 'SAFETY CHECK'}
            </span>
            <strong>${isAccount ? 'Please Confirm New Account' : 'Please Confirm Transaction'}</strong>
          </div>

          <div class="confirm-card-body">
            ${isAccount ? `
              <div class="confirm-row">
                <span class="text-muted">Account Name:</span>
                <span class="font-bold text-lg">${this.escapeHtml(data.name)}</span>
              </div>
              <div class="confirm-row">
                <span class="text-muted">Category:</span>
                <span class="badge ${data.category === 'credit' ? 'badge-danger' : 'badge-primary'}">
                  ${data.category === 'credit' ? '💳 Credit / Card' : '🏦 Debit / Asset'}
                </span>
              </div>
              <div class="confirm-row">
                <span class="text-muted">Account Type:</span>
                <span class="font-bold">${this.escapeHtml(data.type)}</span>
              </div>
              <div class="confirm-row">
                <span class="text-muted">${data.category === 'credit' ? 'Credit Limit:' : 'Opening Balance:'}</span>
                <span class="font-bold text-xl ${data.category === 'credit' ? 'text-warning' : 'text-primary'}">
                  ${AccountModel.formatCurrency(data.category === 'credit' ? data.creditLimit : data.openingBalance)}
                </span>
              </div>
            ` : `
              <div class="confirm-row">
                <span class="text-muted">Type:</span>
                <span class="font-bold text-uppercase">${data.type}</span>
              </div>
              <div class="confirm-row">
                <span class="text-muted">Amount:</span>
                <span class="font-bold text-xl text-primary">${AccountModel.formatCurrency(data.amount)}</span>
              </div>
              ${isTransfer ? `
                <div class="confirm-row">
                  <span class="text-muted">From:</span>
                  <span class="font-bold">${data.fromAccountName}</span>
                </div>
                <div class="confirm-row">
                  <span class="text-muted">To:</span>
                  <span class="font-bold">${data.toAccountName}</span>
                </div>
              ` : isCC ? `
                <div class="confirm-row">
                  <span class="text-muted">From Bank:</span>
                  <span class="font-bold">${data.fromAccountName}</span>
                </div>
                <div class="confirm-row">
                  <span class="text-muted">To Card:</span>
                  <span class="font-bold text-warning">${data.targetAccountName}</span>
                </div>
              ` : `
                <div class="confirm-row">
                  <span class="text-muted">Account:</span>
                  <span class="font-bold">${data.accountName}</span>
                </div>
                <div class="confirm-row">
                  <span class="text-muted">Category:</span>
                  <span>${data.category} ${data.subcategory ? '• ' + data.subcategory : ''}</span>
                </div>
                <div class="confirm-row">
                  <span class="text-muted">Description:</span>
                  <span>${data.description}</span>
                </div>
                <div class="confirm-row">
                  <span class="text-muted">Date:</span>
                  <span>${TransactionModel.formatDate(data.date)}</span>
                </div>
              `}
            `}

            ${msg.suggestedNewCategory ? `
              <div class="suggested-cat-alert">
                💡 <strong>Suggested New Category:</strong> "${msg.suggestedNewCategory}"
              </div>
            ` : ''}
          </div>

          <div class="confirm-actions">
            <button class="btn btn-sm btn-primary confirm-action-btn" id="ai-confirm-yes">
              ${isAccount ? '✓ Create Account' : '✓ Confirm & Save'}
            </button>
            <button class="btn btn-sm btn-outline confirm-edit-btn" id="ai-confirm-edit">
              ✏ Edit
            </button>
            <button class="btn btn-sm btn-text text-danger confirm-cancel-btn" id="ai-confirm-no">
              ✕ Cancel
            </button>
          </div>
        </div>
      `;
    } else if (msg.type === 'gemini_action_card') {
      const data = msg.data;
      const act = data.actionType;
      const params = data.parameters || {};

      let actionTitle = 'Financial Action Ready';
      let actionBody = '';

      if (act === 'create_category') {
        actionTitle = 'Create New Category';
        actionBody = `
          <div class="confirm-row">
            <span class="text-muted">Category:</span>
            <span class="font-bold text-yellow">${this.escapeHtml(params.name)}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Type:</span>
            <span class="badge ${params.type === 'income' ? 'badge-primary' : 'badge-danger'}">${(params.type || 'expense').toUpperCase()}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Tag & Icon:</span>
            <span>${params.icon || '🏷️'} <span class="badge" style="background: ${params.color || '#eab308'}25; color: ${params.color || '#eab308'}; border: 1px solid ${params.color || '#eab308'}50;">${params.color || '#eab308'}</span></span>
          </div>
        `;
      } else if (act === 'create_transaction') {
        actionTitle = `Record ${params.type === 'income' ? 'Income' : 'Expense'}`;
        actionBody = `
          <div class="confirm-row">
            <span class="text-muted">Amount:</span>
            <span class="font-bold text-xl ${params.type === 'income' ? 'text-yellow' : 'text-red'}">${AccountModel.formatCurrency(params.amount)}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Account:</span>
            <span class="font-bold">${this.escapeHtml(params.accountName || 'Primary Account')}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Category:</span>
            <span>${this.escapeHtml(params.category || 'General')} ${params.subcategory ? '• ' + this.escapeHtml(params.subcategory) : ''}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Description:</span>
            <span>${this.escapeHtml(params.description || 'Logged via AI')}</span>
          </div>
        `;
      } else if (act === 'transfer_money') {
        actionTitle = params.isCreditCardPayment ? 'Pay Credit Card Bill' : 'Transfer Money';
        actionBody = `
          <div class="confirm-row">
            <span class="text-muted">Amount:</span>
            <span class="font-bold text-xl text-yellow">${AccountModel.formatCurrency(params.amount)}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">From:</span>
            <span class="font-bold">${this.escapeHtml(params.fromAccount || 'Bank')}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">To:</span>
            <span class="font-bold ${params.isCreditCardPayment ? 'text-red' : ''}">${this.escapeHtml(params.toAccount || 'Card / Account')}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Note:</span>
            <span>${this.escapeHtml(params.description || '')}</span>
          </div>
        `;
      } else if (act === 'create_account') {
        actionTitle = 'Create New Account';
        actionBody = `
          <div class="confirm-row">
            <span class="text-muted">Account Name:</span>
            <span class="font-bold text-yellow">${this.escapeHtml(params.name)}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">Category:</span>
            <span class="badge ${params.category === 'credit' ? 'badge-danger' : 'badge-primary'}">${(params.category || 'debit').toUpperCase()}</span>
          </div>
          <div class="confirm-row">
            <span class="text-muted">${params.category === 'credit' ? 'Credit Limit:' : 'Opening Balance:'}</span>
            <span class="font-bold text-lg">${AccountModel.formatCurrency(params.category === 'credit' ? params.creditLimit : params.openingBalance)}</span>
          </div>
        `;
      }

      contentHtml = `
        <div class="msg-bubble confirmation-bubble fade-in">
          ${msg.text ? `<div style="margin-bottom: 8px;">${this.formatMarkdown(msg.text)}</div>` : ''}
          <div class="confirm-card-header">
            <span class="confirm-badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.4);">
              ✨ GEMINI ACTION
            </span>
            <strong>${actionTitle}</strong>
          </div>
          <div class="confirm-card-body">
            ${actionBody}
          </div>
          <div class="confirm-actions">
            <button class="btn btn-sm btn-primary gemini-confirm-btn">
              ✓ Confirm & Apply
            </button>
            <button class="btn btn-sm btn-text text-danger gemini-cancel-btn">
              ✕ Cancel
            </button>
          </div>
        </div>
      `;
    } else if (msg.type === 'account_choice') {
      contentHtml = `
        <div class="msg-bubble">
          <p class="font-bold">${this.escapeHtml(msg.text.split('\n\n')[0])}</p>
          <div class="account-choice-list" style="margin-top: 8px;">
            ${msg.candidates.map((acc, i) => `
              <button class="acc-choice-btn" data-account-name="${acc.name}">
                <span>${i + 1}. ${acc.name}</span>
                <span class="text-xs text-muted">(${acc.category === 'credit' ? 'Outstanding: ' + AccountModel.formatCurrency(acc.currentOutstanding) : 'Bal: ' + AccountModel.formatCurrency(acc.currentBalance)})</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      // Standard markdown/text response
      contentHtml = `
        <div class="msg-bubble">
          ${this.formatMarkdown(msg.text)}
          <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
            <button class="btn-bubble-speak" title="Listen to Theta AI voice" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #c7d2fe; font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;">
              <span>🔊</span> <span>Listen</span>
            </button>
          </div>
        </div>
      `;
    }

    const msgElement = document.createElement('div');
    msgElement.className = 'chat-msg msg-ai fade-in';
    msgElement.innerHTML = `
      <div class="msg-avatar">✨</div>
      ${contentHtml}
    `;
    msgContainer.appendChild(msgElement);

    // Speak button handler
    const speakBtn = msgElement.querySelector('.btn-bubble-speak');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        this.speech.speak(msg.text);
      });
    }

    // Auto-speak reply if user spoke via microphone
    if (this.lastInputWasVoice && msg.text && msg.type !== 'confirmation_card') {
      this.speech.speak(msg.text);
      this.lastInputWasVoice = false;
    }

    // Attach click events on the specific newly created message element
    const confirmBtn = msgElement.querySelector('.confirm-action-btn');
    const editBtn = msgElement.querySelector('.confirm-edit-btn');
    const cancelBtn = msgElement.querySelector('.confirm-cancel-btn');

    const geminiConfirmBtn = msgElement.querySelector('.gemini-confirm-btn');
    const geminiCancelBtn = msgElement.querySelector('.gemini-cancel-btn');

    if (geminiConfirmBtn) {
      geminiConfirmBtn.addEventListener('click', async () => {
        geminiConfirmBtn.disabled = true;
        const res = await this.coordinator.confirmGeminiAction();
        if (res) this.renderAiMessage(res);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      });
    }

    if (geminiCancelBtn) {
      geminiCancelBtn.addEventListener('click', async () => {
        geminiCancelBtn.disabled = true;
        const res = await this.coordinator.cancelGeminiAction();
        if (res) this.renderAiMessage(res);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        const res = await this.coordinator.executeConfirmedAction();
        if (res) this.renderAiMessage(res);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const isAcc = this.coordinator.pendingAction?.actionType === 'create_account';
        if (isAcc) {
          const accData = this.coordinator.pendingAction.accountData;
          this.coordinator.cancelPendingAction();
          this.close();
          if (this.app.openAddAccountModal) {
            this.app.openAddAccountModal(accData.category, accData);
          }
        } else {
          const txData = this.coordinator.pendingAction?.transactionData;
          this.coordinator.cancelPendingAction();
          this.close();
          if (txData) {
            this.app.openTransactionModal({ prefill: txData });
          }
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const isAcc = this.coordinator.pendingAction?.actionType === 'create_account';
        this.coordinator.cancelPendingAction();
        this.renderAiMessage({
          sender: 'ai',
          text: isAcc ? '❌ Account creation cancelled.' : '❌ Transaction cancelled.',
          type: 'text'
        });
        msgContainer.scrollTop = msgContainer.scrollHeight;
      });
    }

    // Account choice buttons
    msgElement.querySelectorAll('.acc-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const accName = e.currentTarget.dataset.accountName;
        this.handleSendMessage(accName);
      });
    });

    // View Created Account button
    msgElement.querySelectorAll('.btn-view-created-acc').forEach(btn => {
      btn.addEventListener('click', () => {
        this.close();
        if (this.app?.navigateTo) {
          this.app.navigateTo('accounts');
        }
      });
    });

    // Edit Created Account button
    msgElement.querySelectorAll('.btn-edit-created-acc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const accId = e.currentTarget.dataset.accId;
        this.close();
        const acc = await this.coordinator.storage.getAccountById(accId);
        if (acc && this.app?.openAddAccountModal) {
          this.app.openAddAccountModal(acc.category, acc, acc.id);
        }
      });
    });

    // Undo / Delete Created Account button
    msgElement.querySelectorAll('.btn-undo-created-acc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const accId = e.currentTarget.dataset.accId;
        const accName = e.currentTarget.dataset.accName;
        e.currentTarget.disabled = true;
        await this.coordinator.storage.delete('accounts', accId);
        await this.coordinator.storage.saveLocalEmergencySnapshot();
        if (this.coordinator.onUpdate) {
          this.coordinator.onUpdate();
        }
        if (this.app?.showToast) {
          this.app.showToast(`Account "${accName}" deleted`);
        }
        this.renderAiMessage({
          sender: 'ai',
          text: `🗑️ Deleted account **"${accName}"**.`,
          type: 'text'
        });
        msgContainer.scrollTop = msgContainer.scrollHeight;
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  formatMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italics
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Bullet lists
    html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
    if (html.includes('<li>')) {
      html = html.replace(/(<li>.+<\/li>)/s, '<ul style="margin: 4px 0; padding-left: 1.2rem;">$1</ul>');
    }
    // Newlines
    html = html.replace(/\n\n/g, '<p style="margin-top: 6px;"></p>').replace(/\n/g, '<br>');
    return html;
  }
}
