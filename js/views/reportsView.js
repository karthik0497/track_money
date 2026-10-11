// Track-Money: Reports & Financial Analytics View
// Monthly Expense Report with Interactive Category Pie Chart, Month/Year Selector, & Resilient Backup/Restore
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class ReportsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
    
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth();
    this.expandedCategories = new Set();
  }

  async render(container) {
    // 1. Discover available periods or select month with recent data if current month is empty
    const availablePeriods = await this.storage.getAvailableReportPeriods();
    
    // Auto-select latest month with transactions if first load and current month has 0 tx
    if (this._initialSelectionDone !== true) {
      this._initialSelectionDone = true;
      const currentMonthReport = await this.storage.getMonthlyReport(this.selectedYear, this.selectedMonth);
      if (currentMonthReport.txCount === 0 && availablePeriods.length > 0) {
        // Find first period with transactions
        for (const p of availablePeriods) {
          const checkRep = await this.storage.getMonthlyReport(p.year, p.month);
          if (checkRep.txCount > 0) {
            this.selectedYear = p.year;
            this.selectedMonth = p.month;
            break;
          }
        }
      }
    }

    const report = await this.storage.getMonthlyReport(this.selectedYear, this.selectedMonth);
    const allAccounts = await this.storage.getAccountsWithCalculatedBalances();
    const allTransactions = await this.storage.getAll('transactions');

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Compute years for selector (2024 to 2030, ensuring selectedYear is included)
    const yearsList = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
    if (!yearsList.includes(this.selectedYear)) {
      yearsList.push(this.selectedYear);
      yearsList.sort();
    }

    const totalExpense = report.expense;
    const catList = report.categoryBreakdown;

    // SVG Pie/Donut Chart Calculation
    const chartSvgHtml = this.generateDonutChartSvg(catList, totalExpense, report.monthName, report.year);

    container.innerHTML = `
      <div class="reports-container fade-in">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h2>Financial Reports & Analytics</h2>
            <p class="text-sm text-muted">Monthly expense breakdown, interactive category charts, and spending trends</p>
          </div>
        </div>


        <!-- Month & Year Selector Toolbar -->
        <div class="report-period-bar">
          <div class="report-period-selectors">
            <button class="btn btn-outline btn-xs" id="btn-prev-month" title="Previous Month">
              ◀ Prev Month
            </button>

            <!-- Month Dropdown -->
            <select class="form-input form-select" id="select-report-month" style="width: auto; font-weight: 600; padding: 6px 12px; min-height: 38px;">
              ${monthNames.map((m, idx) => `
                <option value="${idx}" ${idx === this.selectedMonth ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>

            <!-- Year Dropdown -->
            <select class="form-input form-select" id="select-report-year" style="width: auto; font-weight: 600; padding: 6px 12px; min-height: 38px;">
              ${yearsList.map(y => `
                <option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>${y}</option>
              `).join('')}
            </select>

            <button class="btn btn-outline btn-xs" id="btn-next-month" title="Next Month">
              Next Month ▶
            </button>
          </div>

          <div class="report-period-meta">
            <span class="badge badge-subtle">
              ${report.txCount} Transactions in ${report.monthName}
            </span>
            <button class="btn btn-outline btn-xs" id="btn-curr-month" title="Jump to Current Month">
              Today / Current Month
            </button>
          </div>
        </div>

        <!-- Section 1: Monthly Cashflow Highlights (4 Cards) -->
        <div class="report-stats-grid">
          <div class="report-stat-card">
            <span class="text-xs text-muted">MONTHLY INCOME</span>
            <div class="text-xl font-bold text-success">
              +${AccountModel.formatCurrency(report.income)}
            </div>
            <span class="text-xs text-muted">${report.transactions.filter(t => t.type === 'income').length} deposits</span>
          </div>

          <div class="report-stat-card">
            <span class="text-xs text-muted">TOTAL EXPENSES</span>
            <div class="text-xl font-bold text-danger">
              -${AccountModel.formatCurrency(report.expense)}
            </div>
            <span class="text-xs text-muted">${report.transactions.filter(t => t.type === 'expense').length} outflows</span>
          </div>

          <div class="report-stat-card">
            <span class="text-xs text-muted">NET SAVINGS</span>
            <div class="text-xl font-bold ${report.savings >= 0 ? 'text-success' : 'text-danger'}">
              ${AccountModel.formatCurrency(report.savings)}
            </div>
            <span class="text-xs text-muted">${report.savings >= 0 ? 'Surplus Cashflow' : 'Deficit Outflow'}</span>
          </div>

          <div class="report-stat-card">
            <span class="text-xs text-muted">SAVINGS RATE</span>
            <div class="text-xl font-bold" style="color: #06b6d4;">
              ${report.savingsRate}%
            </div>
            <span class="text-xs text-muted">of total monthly earnings</span>
          </div>
        </div>

        <!-- Section 2: Monthly Expense Report with Interactive Pie/Donut Chart -->
        <div class="pie-chart-card">
          <div class="card-header" style="padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div>
              <h4 style="margin: 0;">Monthly Expense Report — Category Breakdown</h4>
              <p class="text-xs text-muted" style="margin-top: 2px;">
                Spending distribution across categories for <strong>${report.monthName} ${report.year}</strong>
              </p>
            </div>
            <span class="badge ${totalExpense > 0 ? 'badge-primary' : 'badge-subtle'}">
              ${totalExpense > 0 ? AccountModel.formatCurrency(totalExpense) + ' Total' : 'No Expenses'}
            </span>
          </div>

          <div class="pie-chart-container">
            <!-- Left: SVG Donut Chart -->
            <div class="pie-svg-wrapper">
              ${chartSvgHtml}
            </div>

            <!-- Right: Interactive Legend with Amounts & Percentages -->
            <div class="pie-legend-grid">
              <div class="text-xs text-muted font-bold" style="text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                Category Breakdown (${catList.length} Categories)
              </div>
              ${catList.length === 0 ? `
                <div class="empty-placeholder" style="padding: 1.5rem; text-align: center;">
                  No expense records found for ${report.monthName} ${report.year}.
                </div>
              ` : catList.map(cat => `
                <div class="legend-item" data-category="${this.escapeHtml(cat.name)}">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="legend-dot" style="background: ${cat.color};"></div>
                    <span style="margin-right: 4px;">${cat.icon}</span>
                    <strong class="text-sm">${this.escapeHtml(cat.name)}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="font-bold text-danger text-sm">${AccountModel.formatCurrency(cat.amount)}</span>
                    <span class="badge badge-subtle text-xs" style="min-width: 48px; text-align: center;">${cat.percentage}%</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Section 3: Detailed Category Breakdown Table with Progress Bars -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Detailed Category Spending Analysis</h4>
            <span class="text-xs text-muted">Sorted by highest expenditure</span>
          </div>

          <div class="report-table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th class="text-center">Transactions</th>
                  <th class="text-right">Amount</th>
                  <th class="text-right">Share (%)</th>
                  <th>Distribution Bar</th>
                </tr>
              </thead>
              <tbody>
                ${catList.length === 0 ? `
                  <tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">No expenses recorded for this month.</td></tr>
                ` : catList.map(cat => {
                  return `
                    <tr class="cat-row-clickable" data-category="${this.escapeHtml(cat.name)}" style="cursor: pointer;">
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 1.2rem;">${cat.icon}</span>
                          <div>
                            <strong>${this.escapeHtml(cat.name)}</strong>
                            <div class="text-xs text-muted">${cat.count} transaction${cat.count > 1 ? 's' : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td class="text-center font-bold">${cat.count}</td>
                      <td class="text-right font-bold text-danger">${AccountModel.formatCurrency(cat.amount)}</td>
                      <td class="text-right font-bold">${cat.percentage}%</td>
                      <td>
                        <div class="util-progress-bar" style="margin: 0; background: rgba(255,255,255,0.06);">
                          <div class="util-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 4: Monthly Cashflow Statement Table -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Monthly Cashflow Statement (${report.monthName} ${report.year})</h4>
            <span class="badge badge-subtle">Reconciled</span>
          </div>

          <div class="report-table-wrapper">
            <table class="report-table">
              <tbody>
                <tr class="report-row-highlight">
                  <td><strong>Total Operating Income</strong></td>
                  <td class="text-right text-success font-bold">+${AccountModel.formatCurrency(report.income)}</td>
                </tr>
                <tr>
                  <td>Total Expenses & Outflows</td>
                  <td class="text-right text-danger font-bold">-${AccountModel.formatCurrency(report.expense)}</td>
                </tr>
                <tr class="report-row-total">
                  <td><strong>Net Monthly Savings</strong></td>
                  <td class="text-right font-bold ${report.savings >= 0 ? 'text-success' : 'text-danger'}">
                    ${AccountModel.formatCurrency(report.savings)} (${report.savingsRate}%)
                  </td>
                </tr>
                ${report.transferCount > 0 ? `
                  <tr>
                    <td>Internal Account Transfers</td>
                    <td class="text-right text-muted">${report.transferCount} transfers recorded</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 5: Current Balance Sheet Summary (Assets & Liabilities) -->
        <div class="grid-2-col">
          <!-- Assets Column -->
          <div class="card">
            <div class="card-header">
              <h4>Asset Accounts</h4>
              <span class="text-success font-bold">
                ${AccountModel.formatCurrency(allAccounts.filter(a => a.category === 'debit').reduce((s, a) => s + (a.currentBalance || 0), 0))}
              </span>
            </div>
            <div class="report-table-wrapper">
              <table class="report-table">
                <tbody>
                  ${allAccounts.filter(a => a.category === 'debit').map(a => `
                    <tr>
                      <td>
                        <span style="margin-right: 6px;">${a.icon || '🏦'}</span>
                        <strong>${this.escapeHtml(a.name)}</strong>
                        <div class="text-xs text-muted">${a.type}</div>
                      </td>
                      <td class="text-right text-success font-bold">${AccountModel.formatCurrency(a.currentBalance)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Liabilities Column -->
          <div class="card">
            <div class="card-header">
              <h4>Credit / Liabilities</h4>
              <span class="text-danger font-bold">
                ${AccountModel.formatCurrency(allAccounts.filter(a => a.category === 'credit').reduce((s, a) => s + (a.currentOutstanding || 0), 0))}
              </span>
            </div>
            <div class="report-table-wrapper">
              <table class="report-table">
                <tbody>
                  ${allAccounts.filter(a => a.category === 'credit').map(a => `
                    <tr>
                      <td>
                        <span style="margin-right: 6px;">${a.icon || '💳'}</span>
                        <strong>${this.escapeHtml(a.name)}</strong>
                        <div class="text-xs text-muted">Limit: ${AccountModel.formatCurrency(a.creditLimit)}</div>
                      </td>
                      <td class="text-right text-danger font-bold">${AccountModel.formatCurrency(a.currentOutstanding)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container, report, allTransactions);
  }

  // Generates interactive, high-fidelity SVG Donut / Pie Chart
  generateDonutChartSvg(categories, totalSpent, monthName, year) {
    if (!categories || categories.length === 0 || totalSpent <= 0) {
      return `
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle cx="100" cy="100" r="60" fill="transparent" stroke="rgba(255, 255, 255, 0.1)" stroke-width="20" stroke-dasharray="6 6" />
          <text x="100" y="96" text-anchor="middle" font-size="14" font-weight="600" fill="#94a3b8">No Expenses</text>
          <text x="100" y="114" text-anchor="middle" font-size="10" fill="#64748b">${this.escapeHtml(monthName)}</text>
        </svg>
      `;
    }

    const radius = 60;
    const circumference = 2 * Math.PI * radius; // ~376.99
    let accumulatedOffset = 0;

    const circles = categories.map((cat, i) => {
      const pct = Math.max(0, cat.percentage);
      const dashLength = (pct / 100) * circumference;
      const dashOffset = -accumulatedOffset;
      accumulatedOffset += dashLength;

      return `
        <circle class="pie-slice"
                cx="100" cy="100" r="${radius}"
                fill="transparent"
                stroke="${cat.color}"
                stroke-width="26"
                stroke-dasharray="${dashLength} ${circumference - dashLength}"
                stroke-dashoffset="${dashOffset}"
                transform="rotate(-90 100 100)"
                data-category="${this.escapeHtml(cat.name)}"
                data-amount="${cat.amount}"
                data-pct="${cat.percentage}">
          <title>${cat.name}: ${AccountModel.formatCurrency(cat.amount)} (${cat.percentage}%)</title>
        </circle>
      `;
    }).join('');

    const formattedTotal = AccountModel.formatCurrency(totalSpent);

    return `
      <svg viewBox="0 0 200 200" width="200" height="200">
        <!-- Background Track -->
        <circle cx="100" cy="100" r="${radius}" fill="transparent" stroke="rgba(255, 255, 255, 0.05)" stroke-width="26" />
        
        <!-- Categorical Slices -->
        ${circles}

        <!-- Center Donut Content -->
        <text x="100" y="94" text-anchor="middle" font-size="15" font-weight="700" fill="#f8fafc" id="pie-center-amount">
          ${formattedTotal}
        </text>
        <text x="100" y="110" text-anchor="middle" font-size="10" font-weight="500" fill="#94a3b8" id="pie-center-label">
          Total Spent
        </text>
      </svg>
    `;
  }

  attachEvents(container, report, allTransactions) {
    const monthSelect = container.querySelector('#select-report-month');
    const yearSelect = container.querySelector('#select-report-year');
    const prevBtn = container.querySelector('#btn-prev-month');
    const nextBtn = container.querySelector('#btn-next-month');
    const currBtn = container.querySelector('#btn-curr-month');

    // Month & Year dropdown changes
    monthSelect?.addEventListener('change', (e) => {
      this.selectedMonth = parseInt(e.target.value, 10);
      this.render(container);
    });

    yearSelect?.addEventListener('change', (e) => {
      this.selectedYear = parseInt(e.target.value, 10);
      this.render(container);
    });

    // Previous month button
    prevBtn?.addEventListener('click', () => {
      if (this.selectedMonth === 0) {
        this.selectedMonth = 11;
        this.selectedYear -= 1;
      } else {
        this.selectedMonth -= 1;
      }
      this.render(container);
    });

    // Next month button
    nextBtn?.addEventListener('click', () => {
      if (this.selectedMonth === 11) {
        this.selectedMonth = 0;
        this.selectedYear += 1;
      } else {
        this.selectedMonth += 1;
      }
      this.render(container);
    });

    // Current month button
    currBtn?.addEventListener('click', () => {
      const now = new Date();
      this.selectedYear = now.getFullYear();
      this.selectedMonth = now.getMonth();
      this.render(container);
    });

    // Donut chart hover/tap interaction to highlight center text
    const pieCenterAmount = container.querySelector('#pie-center-amount');
    const pieCenterLabel = container.querySelector('#pie-center-label');
    const originalAmount = AccountModel.formatCurrency(report.expense);

    container.querySelectorAll('.pie-slice, .legend-item').forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const cat = e.currentTarget.dataset.category;
        const matched = report.categoryBreakdown.find(c => c.name === cat);
        if (matched && pieCenterAmount && pieCenterLabel) {
          pieCenterAmount.textContent = AccountModel.formatCurrency(matched.amount);
          pieCenterLabel.textContent = `${matched.name} (${matched.percentage}%)`;
        }
      });
      el.addEventListener('mouseleave', () => {
        if (pieCenterAmount && pieCenterLabel) {
          pieCenterAmount.textContent = originalAmount;
          pieCenterLabel.textContent = 'Total Spent';
        }
      });
    });

    }

  exportTransactionsToCSV(transactions, filename) {
    if (!transactions || transactions.length === 0) {
      this.app.showToast('No transactions found to export.');
      return;
    }

    const headers = ['Transaction ID', 'Date', 'Type', 'Account', 'Category', 'Subcategory', 'Amount', 'Description', 'Payment Method', 'Notes'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.type,
      `"${(t.accountName || t.accountId || '').replace(/"/g, '""')}"`,
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
    a.download = filename || `track_money_transactions.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.app.showToast('CSV downloaded successfully.');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
