// Track-Money: Clean Reports — Compact Month / Custom Date Range + Pie Chart & Category List
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class ReportsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;

    const now = new Date();
    this.mode = 'month'; // 'month' | 'range'
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth();

    const pad = (n) => String(n).padStart(2, '0');
    this.startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    this.endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  async render(container) {
    const availablePeriods = await this.storage.getAvailableReportPeriods();

    // Auto-select latest active month on first load if current month has no data
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

    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Only include real years (actual transaction years + current year) — no 2029/2030 bloat
    const currentYear = new Date().getFullYear();
    const yearSet = new Set([currentYear, this.selectedYear]);
    availablePeriods.forEach(p => {
      if (p.year <= currentYear) yearSet.add(p.year);
    });
    const yearsList = Array.from(yearSet).sort((a, b) => b - a);

    const report = this.mode === 'range'
      ? await this.storage.getRangeReport(this.startDate, this.endDate)
      : await this.storage.getMonthlyReport(this.selectedYear, this.selectedMonth);

    const periodTitle = this.mode === 'range'
      ? `${TransactionModel.formatDate(this.startDate)} – ${TransactionModel.formatDate(this.endDate)}`
      : `${report.monthName} ${report.year}`;

    const totalExpense = report.expense;
    const catList = report.categoryBreakdown;
    const chartSvgHtml = this.generateDonutChartSvg(catList, totalExpense, periodTitle);

    container.innerHTML = `
      <div class="reports-container fade-in">
        <!-- Clean Compact Period Bar -->
        <div class="report-period-bar" style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
            <div class="tabs-segmented" style="margin: 0; flex: 1; max-width: 220px;">
              <button type="button" class="tab-btn ${this.mode === 'month' ? 'active' : ''}" id="btn-mode-month" style="padding: 5px 10px; font-size: 0.78rem;">Month</button>
              <button type="button" class="tab-btn ${this.mode === 'range' ? 'active' : ''}" id="btn-mode-range" style="padding: 5px 10px; font-size: 0.78rem;">Date Range</button>
            </div>
            <span class="badge badge-subtle">${report.txCount} Tx</span>
          </div>

          ${this.mode === 'month' ? `
            <div class="report-period-selectors" style="width: 100%; justify-content: space-between;">
              <button class="btn btn-outline btn-xs" id="btn-prev-month" title="Previous">◀</button>
              <div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center;">
                <select class="form-input form-select" id="select-report-month" style="width: auto; font-weight: 600; padding: 4px 10px; min-height: 34px;">
                  ${monthShort.map((m, idx) => `
                    <option value="${idx}" ${idx === this.selectedMonth ? 'selected' : ''}>${m}</option>
                  `).join('')}
                </select>
                <select class="form-input form-select" id="select-report-year" style="width: auto; font-weight: 600; padding: 4px 10px; min-height: 34px;">
                  ${yearsList.map(y => `
                    <option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>${y}</option>
                  `).join('')}
                </select>
              </div>
              <button class="btn btn-outline btn-xs" id="btn-next-month" title="Next">▶</button>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 6px; width: 100%;">
              <input type="date" id="report-start-date" class="form-input" value="${this.startDate}" style="flex: 1; min-width: 0; padding: 5px 8px; font-size: 0.82rem; min-height: 36px;">
              <span class="text-xs text-muted">to</span>
              <input type="date" id="report-end-date" class="form-input" value="${this.endDate}" style="flex: 1; min-width: 0; padding: 5px 8px; font-size: 0.82rem; min-height: 36px;">
            </div>
          `}
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
            <h4 style="margin: 0; font-size: 0.95rem;">${this.escapeHtml(periodTitle)}</h4>
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
                  No expenses in this period.
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

  generateDonutChartSvg(categories, totalSpent, periodLabel) {
    if (!categories || categories.length === 0 || totalSpent <= 0) {
      return `
        <svg viewBox="0 0 200 200" width="190" height="190">
          <circle cx="100" cy="100" r="60" fill="transparent" stroke="rgba(255, 255, 255, 0.1)" stroke-width="20" stroke-dasharray="6 6" />
          <text x="100" y="96" text-anchor="middle" font-size="14" font-weight="600" fill="#94a3b8">No Expenses</text>
          <text x="100" y="114" text-anchor="middle" font-size="10" fill="#64748b">${this.escapeHtml(periodLabel)}</text>
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
    container.querySelector('#btn-mode-month')?.addEventListener('click', () => {
      this.mode = 'month';
      this.render(container);
    });

    container.querySelector('#btn-mode-range')?.addEventListener('click', () => {
      this.mode = 'range';
      this.render(container);
    });

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

    container.querySelector('#report-start-date')?.addEventListener('change', (e) => {
      this.startDate = e.target.value;
      if (this.endDate && this.startDate > this.endDate) {
        this.endDate = this.startDate;
      }
      this.render(container);
    });

    container.querySelector('#report-end-date')?.addEventListener('change', (e) => {
      this.endDate = e.target.value;
      if (this.startDate && this.endDate < this.startDate) {
        this.startDate = this.endDate;
      }
      this.render(container);
    });

    const pieCenterAmount = container.querySelector('#pie-center-amount');
    const pieCenterLabel = container.querySelector('#pie-center-label');
    const originalAmount = AccountModel.formatCurrency(report.expense);

    container.querySelectorAll('.pie-slice, .legend-item').forEach(el => {
      const highlight = (e) => {
        const cat = e.currentTarget.dataset.category;
        const matched = report.categoryBreakdown.find(c => c.name === cat);
        if (matched && pieCenterAmount && pieCenterLabel) {
          pieCenterAmount.textContent = AccountModel.formatCurrency(matched.amount);
          pieCenterLabel.textContent = `${matched.name} (${matched.percentage}%)`;
        }
      };
      el.addEventListener('mouseenter', highlight);
      el.addEventListener('click', highlight);
      el.addEventListener('mouseleave', () => {
        if (pieCenterAmount && pieCenterLabel) {
          pieCenterAmount.textContent = originalAmount;
          pieCenterLabel.textContent = 'Total Spent';
        }
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
