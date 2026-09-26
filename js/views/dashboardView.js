// Track-Money: Dashboard View Component
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class DashboardView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
  }

  async render(container) {
    const metrics = await this.storage.getDashboardMetrics();
    const isNegativeNet = metrics.netPosition < 0;

    container.innerHTML = `
      <div class="dashboard-container fade-in">
        <!-- Top Executive Hero Banner: Net Position -->
        <div class="hero-net-card ${isNegativeNet ? 'hero-negative' : 'hero-positive'}">
          <div class="hero-header">
            <div class="hero-label">
              <span class="hero-icon">💎</span>
              <span>TOTAL NET POSITION</span>
            </div>
            <div class="hero-badge">Assets − Liabilities</div>
          </div>
          <div class="hero-amount">
            ${AccountModel.formatCurrency(metrics.netPosition)}
          </div>
          <div class="hero-subtext">
            Transaction-verified across ${metrics.debitAccounts.length + metrics.creditAccounts.length} accounts
          </div>

          <div class="hero-grid">
            <div class="hero-stat-item" id="nav-to-assets" style="cursor: pointer;">
              <div class="stat-title">
                <span class="dot dot-success"></span>
                <span>Total Assets</span>
              </div>
              <div class="stat-value text-success">
                ${AccountModel.formatCurrency(metrics.totalAssets)}
              </div>
              <div class="stat-caption">Bank, Savings, Demat, Cash</div>
            </div>

            <div class="hero-stat-item" id="nav-to-liabilities" style="cursor: pointer;">
              <div class="stat-title">
                <span class="dot dot-danger"></span>
                <span>Total Liabilities</span>
              </div>
              <div class="stat-value text-danger">
                ${AccountModel.formatCurrency(metrics.totalLiabilities)}
              </div>
              <div class="stat-caption">Credit Cards & Pay Later</div>
            </div>
          </div>
        </div>

        <!-- Quick Action Bar -->
        <div class="quick-actions-bar">
          <button class="btn btn-primary" id="dash-btn-add-tx">
            <span>➕ Add Transaction</span>
          </button>
          <button class="btn btn-secondary" id="dash-btn-transfer">
            <span>⇄ Transfer Money</span>
          </button>
          <button class="btn btn-ai-sparkle" id="dash-btn-voice-ai">
            <span>✨ AI Voice / Text</span>
          </button>
        </div>

        <!-- Monthly Performance Metrics -->
        <div class="section-title">
          <h3>September 2026 Cash Flow</h3>
          <span class="badge badge-subtle">Real-Time</span>
        </div>

        <div class="stats-row">
          <div class="card stat-card card-income">
            <div class="card-header-mini">
              <span>This Month Income</span>
              <span class="mini-icon">📈</span>
            </div>
            <div class="stat-number text-success">
              ${AccountModel.formatCurrency(metrics.thisMonthIncome)}
            </div>
            <div class="stat-trend text-muted">Primary salary & receipts</div>
          </div>

          <div class="card stat-card card-expense">
            <div class="card-header-mini">
              <span>This Month Spending</span>
              <span class="mini-icon">📉</span>
            </div>
            <div class="stat-number text-danger">
              ${AccountModel.formatCurrency(metrics.thisMonthExpense)}
            </div>
            <div class="stat-trend text-muted">Living costs, shopping, bills</div>
          </div>

          <div class="card stat-card card-savings">
            <div class="card-header-mini">
              <span>Net Savings</span>
              <span class="mini-icon">💰</span>
            </div>
            <div class="stat-number ${metrics.savingsThisMonth >= 0 ? 'text-success' : 'text-danger'}">
              ${AccountModel.formatCurrency(metrics.savingsThisMonth)}
            </div>
            <div class="stat-trend">
              <span class="pill pill-success">${metrics.savingsRate}% saved</span>
            </div>
          </div>
        </div>

        <!-- Credit Utilization & Upcoming Payments -->
        <div class="grid-2-col">
          <!-- Credit Utilization Card -->
          <div class="card credit-util-card">
            <div class="card-header">
              <h4>Credit Utilization</h4>
              <span class="badge ${metrics.overallCreditUtilization > 30 ? 'badge-warning' : 'badge-success'}">
                ${metrics.overallCreditUtilization}%
              </span>
            </div>
            <p class="text-sm text-muted">Recommended under 30% for a prime credit score</p>
            
            <div class="util-progress-bar">
              <div class="util-fill ${metrics.overallCreditUtilization > 30 ? 'bg-warning' : 'bg-primary'}" 
                   style="width: ${Math.min(100, metrics.overallCreditUtilization)}%;"></div>
            </div>

            <div class="credit-limits-row">
              <div>
                <span class="text-xs text-muted">Total Outstanding:</span>
                <div class="font-bold text-danger">${AccountModel.formatCurrency(metrics.totalLiabilities)}</div>
              </div>
              <div style="text-align: right;">
                <span class="text-xs text-muted">Available Credit:</span>
                <div class="font-bold text-success">${AccountModel.formatCurrency(metrics.totalCreditAvailable)}</div>
              </div>
            </div>
          </div>

          <!-- Upcoming Bill Payments -->
          <div class="card upcoming-bills-card">
            <div class="card-header">
              <h4>Upcoming Credit Dues</h4>
              <span class="badge badge-subtle">${metrics.upcomingPayments.length} Active</span>
            </div>
            ${metrics.upcomingPayments.length === 0 ? `
              <div class="empty-placeholder">No upcoming credit dues recorded! 🎉</div>
            ` : `
              <div class="bills-list">
                ${metrics.upcomingPayments.map(bill => `
                  <div class="bill-item">
                    <div class="bill-info">
                      <div class="bill-name font-bold">${bill.accountName}</div>
                      <div class="bill-due text-xs text-warning">Due: ${TransactionModel.formatDate(bill.dueDate)}</div>
                    </div>
                    <div class="bill-action">
                      <div class="bill-amount text-danger font-bold">${AccountModel.formatCurrency(bill.amountDue)}</div>
                      <button class="btn btn-xs btn-outline pay-bill-btn" data-account-id="${bill.id}" data-amount="${bill.amountDue}">
                        Pay Now
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Spending by Category Chart & Accounts Mini View -->
        <div class="grid-2-col" style="margin-top: 1.5rem;">
          <!-- Category Spending Donut Chart -->
          <div class="card chart-card">
            <div class="card-header">
              <h4>Spending by Category</h4>
              <span class="text-xs text-muted">September</span>
            </div>
            <div class="chart-container" id="category-chart-container">
              ${this.renderCategoryChart(metrics.categorySpending)}
            </div>
          </div>

          <!-- Account Balances Snapshot -->
          <div class="card accounts-snapshot-card">
            <div class="card-header">
              <h4>Account Balances</h4>
              <button class="btn btn-text text-sm" id="view-all-accounts">View All →</button>
            </div>
            <div class="mini-accounts-list">
              ${metrics.debitAccounts.slice(0, 3).map(acc => `
                <div class="mini-account-row">
                  <div class="acc-badge" style="background: ${acc.color}20; color: ${acc.color};">
                    ${acc.icon || '🏦'}
                  </div>
                  <div class="acc-text">
                    <div class="font-bold">${acc.name}</div>
                    <div class="text-xs text-muted">${acc.type}</div>
                  </div>
                  <div class="acc-bal text-success font-bold">
                    ${AccountModel.formatCurrency(acc.currentBalance)}
                  </div>
                </div>
              `).join('')}

              ${metrics.creditAccounts.slice(0, 2).map(acc => `
                <div class="mini-account-row">
                  <div class="acc-badge" style="background: ${acc.color}20; color: ${acc.color};">
                    ${acc.icon || '💳'}
                  </div>
                  <div class="acc-text">
                    <div class="font-bold">${acc.name}</div>
                    <div class="text-xs text-muted">Outstanding</div>
                  </div>
                  <div class="acc-bal text-danger font-bold">
                    ${AccountModel.formatCurrency(acc.currentOutstanding)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="card recent-tx-card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h4>Recent Transactions</h4>
            <button class="btn btn-text text-sm" id="view-all-transactions">See All History →</button>
          </div>
          <div class="transaction-list">
            ${metrics.recentTransactions.length === 0 ? `
              <div class="empty-placeholder">No transactions found. Try saying "Spent 500 on lunch"!</div>
            ` : metrics.recentTransactions.map(tx => {
              const amtFormatted = TransactionModel.formatAmount(tx.amount, tx.type);
              return `
                <div class="tx-item">
                  <div class="tx-icon-col">
                    <div class="tx-icon-circle ${tx.type}">
                      ${tx.type === 'income' ? '↗' : (tx.type === 'transfer' ? '⇄' : (tx.type === 'credit_card_payment' ? '💳' : '↘'))}
                    </div>
                  </div>
                  <div class="tx-details-col">
                    <div class="tx-title font-bold">${tx.description || tx.category}</div>
                    <div class="tx-sub text-xs text-muted">
                      <span>${tx.category}${tx.subcategory ? ' • ' + tx.subcategory : ''}</span>
                      <span>•</span>
                      <span>${TransactionModel.formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <div class="tx-amount-col">
                    <div class="tx-amount font-bold ${amtFormatted.class}">
                      ${amtFormatted.text}
                    </div>
                    <div class="tx-method text-xs text-muted">
                      ${tx.paymentMethod || 'Manual'}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container);
  }

  renderCategoryChart(categorySpending) {
    const entries = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return `<div class="empty-placeholder text-muted">No expense categories yet</div>`;
    }

    const total = entries.reduce((sum, [, val]) => sum + val, 0);
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e', '#a855f7', '#64748b'];

    // Render interactive SVG donut chart + legend
    let cumulativeAngle = 0;
    const slices = entries.map(([cat, val], idx) => {
      const percentage = (val / total) * 100;
      const angle = (val / total) * 360;
      const color = colors[idx % colors.length];

      // Donut slice path
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const x1 = 100 + 75 * Math.cos(Math.PI * (startAngle - 90) / 180);
      const y1 = 100 + 75 * Math.sin(Math.PI * (startAngle - 90) / 180);
      const x2 = 100 + 75 * Math.cos(Math.PI * (endAngle - 90) / 180);
      const y2 = 100 + 75 * Math.sin(Math.PI * (endAngle - 90) / 180);

      const largeArc = angle > 180 ? 1 : 0;
      const pathD = entries.length === 1 
        ? `M 100 25 A 75 75 0 1 1 99.99 25`
        : `M ${x1} ${y1} A 75 75 0 ${largeArc} 1 ${x2} ${y2}`;

      return {
        pathD,
        color,
        cat,
        val,
        percentage: percentage.toFixed(1)
      };
    });

    return `
      <div class="donut-chart-layout">
        <svg viewBox="0 0 200 200" class="donut-svg">
          <circle cx="100" cy="100" r="75" fill="none" stroke="#1e293b" stroke-width="26" />
          ${slices.map(s => `
            <path d="${s.pathD}" fill="none" stroke="${s.color}" stroke-width="26" stroke-linecap="round" />
          `).join('')}
          <text x="100" y="95" text-anchor="middle" font-size="12" fill="#94a3b8">Total Spent</text>
          <text x="100" y="118" text-anchor="middle" font-size="16" font-weight="bold" fill="#f8fafc">
            ${AccountModel.formatCurrency(total)}
          </text>
        </svg>

        <div class="chart-legend">
          ${slices.slice(0, 5).map(s => `
            <div class="legend-row">
              <span class="legend-dot" style="background: ${s.color};"></span>
              <span class="legend-label">${s.cat}</span>
              <span class="legend-val font-bold">${AccountModel.formatCurrency(s.val)}</span>
              <span class="legend-pct text-muted text-xs">(${s.percentage}%)</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  attachEvents(container) {
    container.querySelector('#dash-btn-add-tx')?.addEventListener('click', () => {
      this.app.openTransactionModal();
    });

    container.querySelector('#dash-btn-transfer')?.addEventListener('click', () => {
      this.app.openTransferModal();
    });

    container.querySelector('#dash-btn-voice-ai')?.addEventListener('click', () => {
      this.app.openAiAssistant();
    });

    container.querySelector('#nav-to-assets')?.addEventListener('click', () => {
      this.app.navigateTo('accounts', { filter: 'debit' });
    });

    container.querySelector('#nav-to-liabilities')?.addEventListener('click', () => {
      this.app.navigateTo('accounts', { filter: 'credit' });
    });

    container.querySelector('#view-all-accounts')?.addEventListener('click', () => {
      this.app.navigateTo('accounts');
    });

    container.querySelector('#view-all-transactions')?.addEventListener('click', () => {
      this.app.navigateTo('transactions');
    });

    container.querySelectorAll('.pay-bill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cardId = e.currentTarget.dataset.accountId;
        const amount = e.currentTarget.dataset.amount;
        this.app.openCreditCardPayModal(cardId, amount);
      });
    });
  }
}
