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
              <div class="ai-avatar-circle">✨</div>
              <div>
                <h3 class="font-bold">Track-Money AI Assistant</h3>
                <span class="text-xs text-muted" id="ai-voice-status">100% Offline • Voice & Natural Language</span>
              </div>
            </div>
            <button class="btn btn-icon" id="ai-drawer-close">✕</button>
          </div>

          <!-- Suggested Prompts Strip -->
          <div class="ai-suggestions-carousel">
            <span class="text-xs text-muted" style="margin-right: 6px; align-self: center;">Try:</span>
            <button class="ai-chip" data-prompt="I spent ₹500 for lunch from HDFC bank">"Spent ₹500 for lunch from HDFC"</button>
            <button class="ai-chip" data-prompt="Yesterday I spent 800 on petrol using my SBI account">"Yesterday 800 petrol SBI"</button>
            <button class="ai-chip" data-prompt="Add 25,000 salary to HDFC">"Add 25,000 salary to HDFC"</button>
            <button class="ai-chip" data-prompt="Paid 10,000 towards my HDFC credit card">"Paid 10k towards credit card"</button>
            <button class="ai-chip" data-prompt="Transfer ₹10,000 from HDFC Bank to SBI Savings">"Transfer 10k HDFC to SBI"</button>
            <button class="ai-chip" data-prompt="How much did I spend this month?">"How much spent this month?"</button>
            <button class="ai-chip" data-prompt="What is my HDFC balance?">"HDFC balance"</button>
            <button class="ai-chip" data-prompt="How much credit card debt do I have?">"Credit card debt"</button>
            <button class="ai-chip" data-prompt="What was my biggest expense this month?">"Biggest expense this month?"</button>
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
        this.handleSendMessage(text);
      }
    });

    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = inputEl.value;
        if (text && text.trim()) {
          inputEl.value = '';
          this.handleSendMessage(text);
        }
      }
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
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Process via AssistantCoordinator
    const response = await this.coordinator.processInput(text);
    if (!response) return;

    this.renderAiMessage(response);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  renderAiMessage(msg) {
    const msgContainer = document.getElementById('ai-chat-messages');
    if (!msgContainer) return;

    let contentHtml = '';

    if (msg.type === 'confirmation_card') {
      const data = msg.data;
      const isTransfer = data.type === 'transfer';
      const isCC = data.type === 'credit_card_payment';

      contentHtml = `
        <div class="msg-bubble confirmation-bubble fade-in">
          <div class="confirm-card-header">
            <span class="confirm-badge">SAFETY CHECK</span>
            <strong>Please Confirm Transaction</strong>
          </div>

          <div class="confirm-card-body">
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

            ${msg.suggestedNewCategory ? `
              <div class="suggested-cat-alert">
                💡 <strong>Suggested New Category:</strong> "${msg.suggestedNewCategory}"
              </div>
            ` : ''}
          </div>

          <div class="confirm-actions">
            <button class="btn btn-sm btn-primary confirm-action-btn" id="ai-confirm-yes">
              ✓ Confirm & Save
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

    // Attach click events on the specific newly created message element
    const confirmBtn = msgElement.querySelector('.confirm-action-btn');
    const editBtn = msgElement.querySelector('.confirm-edit-btn');
    const cancelBtn = msgElement.querySelector('.confirm-cancel-btn');

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
        const txData = this.coordinator.pendingAction?.transactionData;
        this.coordinator.cancelPendingAction();
        this.close();
        if (txData) {
          this.app.openTransactionModal({ prefill: txData });
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.coordinator.cancelPendingAction();
        this.renderAiMessage({
          sender: 'ai',
          text: '❌ Transaction cancelled.',
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
