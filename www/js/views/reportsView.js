// Track-Money: Simple Monthly Reports — Pie Chart & Full Category List
import { AccountModel } from '../models/account.js';

export class ReportsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;

    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth();
  }

  async render(container) {
    const availablePeriods = await this.storage.getAvailableReportPeriods();

    // Auto-select latest month with transactions on first load if current month is empty
    if (this._initialSelectionDone !== true) {
      this._initialSelectionDone = true;
      const currentMonthReport = await this.storage.getMonthlyReport(this.selectedYear, this.selectedMonth);
      if (currentMonthReport.txCount === 0 && availablePeriods.length > 0) {
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

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const yearsList = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
    if (!yearsList.includes(this.selectedYear)) {
      yearsList.push(this.selectedYear);
      yearsList.sort();
    }

    const totalExpense = report.expense;
    const catList = report.categoryBreakdown;
    const chartSvgHtml = this.generateDonutChartSvg(catList, totalExpense, report.monthName);

    container.innerHTML = `
      <div class="reports-container fade-in">
        <!-- Period Selector -->
        <div class="report-period-bar" style="margin-bottom: 1rem;">
          <div class="report-period-selectors">
            <button class="btn btn-outline btn-xs" id="btn-prev-month" title="Previous Month">◀</button>
            <select class="form-input form-select" id="select-report-month" style="width: auto; font-weight: 600; padding: 5px 10px; min-height: 34px;">
              ${monthNames.map((m, idx) => `
                <option value="${idx}" ${idx === this.selectedMonth ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
            <select class="form-input form-select" id="select-report-year" style="width: auto; font-weight: 600; padding: 5px 10px; min-height: 34px;">
              ${yearsList.map(y => `
                <option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>${y}</option>
              `).join('')}
            </select>
            <button class="btn btn-outline btn-xs" id="btn-next-month" title="Next Month">▶</button>
          </div>
          <div class="report-period-meta">
            <span class="badge badge-subtle">${report.txCount} Tx</span>
            <button class="btn btn-outline btn-xs" id="btn-curr-month">Today</button>
          </div>
        </div>

        <!-- 4 Summary Metrics -->
        <div class="report-stats-grid" style="margin-bottom: 1rem;">
          <div class="report-stat-card">
            <span class="text-xs text-muted">INCOME</span>
            <div class="text-lg font-bold text-success">+${AccountModel.formatCurrency(report.income)}</div>
          </div>
          <div class="report-stat-card">
            <span class="text-xs text-muted">EXPENSE</span>
            <div class="text-lg font-bold text-danger">-${AccountModel.formatCurrency(report.expense)}</div>
          </div>
          <div class="report-stat-card">
            <span class="text-xs text-muted">SAVINGS</span>
            <div class="text-lg font-bold ${report.savings >= 0 ? 'text-success' : 'text-danger'}">${AccountModel.formatCurrency(report.savings)}</div>
          </div>
          <div class="report-stat-card">
            <span class="text-xs text-muted">RATE</span>
            <div class="text-lg font-bold" style="color: #06b6d4;">${report.savingsRate}%</div>
          </div>
        </div>

        <!-- Simple Pie Chart & Full Category List -->
        <div class="pie-chart-card">
          <div class="card-header" style="padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <h4 style="margin: 0;">${report.monthName} ${report.year}</h4>
            <span class="badge ${totalExpense > 0 ? 'badge-primary' : 'badge-subtle'}">
              ${totalExpense > 0 ? AccountModel.formatCurrency(totalExpense) : 'No Expenses'}
            </span>
          </div>

          <div class="pie-chart-container">
            <div class="pie-svg-wrapper">
              ${chartSvgHtml}
            </div>

            <div class="pie-legend-grid">
              ${catList.length === 0 ? `
                <div class="empty-placeholder" style="padding: 1rem; text-align: center;">
                  No expenses in ${report.monthName} ${report.year}.
                </div>
              ` : catList.map(cat => `
                <div class="legend-item" data-category="${this.escapeHtml(cat.name)}">
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <div class="legend-dot" style="background: ${cat.color};"></div>
                    <span>${cat.icon}</span>
                    <strong class="text-sm" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(cat.name)}</strong>
                    <span class="text-xs text-muted">(${cat.count})</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <span class="font-bold text-danger text-sm">${AccountModel.formatCurrency(cat.amount)}</span>
                    <span class="badge badge-subtle text-xs" style="min-width: 44px; text-align: center;">${cat.percentage}%</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container, report);
  }

  generateDonutChartSvg(categories, totalSpent, monthName) {
    if (!categories || categories.length === 0 || totalSpent <= 0) {
      return `
        <svg viewBox="0 0 200 200" width="190" height="190">
          <circle cx="100" cy="100" r="60" fill="transparent" stroke="rgba(255, 255, 255, 0.1)" stroke-width="20" stroke-dasharray="6 6" />
          <text x="100" y="96" text-anchor="middle" font-size="14" font-weight="600" fill="#94a3b8">No Expenses</text>
          <text x="100" y="114" text-anchor="middle" font-size="10" fill="#64748b">${this.escapeHtml(monthName)}</text>
        </svg>
      `;
    }

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    const circles = categories.map(cat => {
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
      <svg viewBox="0 0 200 200" width="190" height="190">
        <circle cx="100" cy="100" r="${radius}" fill="transparent" stroke="rgba(255, 255, 255, 0.05)" stroke-width="26" />
        ${circles}
        <text x="100" y="94" text-anchor="middle" font-size="15" font-weight="700" fill="#f8fafc" id="pie-center-amount">
          ${formattedTotal}
        </text>
        <text x="100" y="110" text-anchor="middle" font-size="10" font-weight="500" fill="#94a3b8" id="pie-center-label">
          Total Spent
        </text>
      </svg>
    `;
  }

  attachEvents(container, report) {
    container.querySelector('#select-report-month')?.addEventListener('change', (e) => {
      this.selectedMonth = parseInt(e.target.value, 10);
      this.render(container);
    });

    container.querySelector('#select-report-year')?.addEventListener('change', (e) => {
      this.selectedYear = parseInt(e.target.value, 10);
      this.render(container);
    });

    container.querySelector('#btn-prev-month')?.addEventListener('click', () => {
      if (this.selectedMonth === 0) {
        this.selectedMonth = 11;
        this.selectedYear -= 1;
      } else {
        this.selectedMonth -= 1;
      }
      this.render(container);
    });

    container.querySelector('#btn-next-month')?.addEventListener('click', () => {
      if (this.selectedMonth === 11) {
        this.selectedMonth = 0;
        this.selectedYear += 1;
      } else {
        this.selectedMonth += 1;
      }
      this.render(container);
    });

    container.querySelector('#btn-curr-month')?.addEventListener('click', () => {
      const now = new Date();
      this.selectedYear = now.getFullYear();
      this.selectedMonth = now.getMonth();
      this.render(container);
    });

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
      el.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.category;
        const matched = report.categoryBreakdown.find(c => c.name === cat);
        if (matched && pieCenterAmount && pieCenterLabel) {
          pieCenterAmount.textContent = AccountModel.formatCurrency(matched.amount);
          pieCenterLabel.textContent = `${matched.name} (${matched.percentage}%)`;
        }
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
