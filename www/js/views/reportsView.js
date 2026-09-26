// Track-Money: Reports & Financial Analytics View
import { AccountModel } from '../models/account.js';
import { TransactionModel } from '../models/transaction.js';

export class ReportsView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
  }

  async render(container) {
    const metrics = await this.storage.getDashboardMetrics();
    const transactions = await this.storage.getAll('transactions');
    const accounts = await this.storage.getAccountsWithCalculatedBalances();

    // Group expenses by category
    const catEntries = Object.entries(metrics.categorySpending).sort((a, b) => b[1] - a[1]);
    const totalSpent = catEntries.reduce((sum, [, val]) => sum + val, 0);

    container.innerHTML = `
      <div class="reports-container fade-in">
        <div class="page-header">
          <div>
            <h2>Financial Reports & Analytics</h2>
            <p class="text-sm text-muted">Comprehensive breakdown of cash flow and balances</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-outline btn-sm" id="btn-export-csv">
              📥 Export CSV
            </button>
            <button class="btn btn-outline btn-sm" id="btn-export-json">
              💾 Full JSON Backup
            </button>
          </div>
        </div>

        <!-- Report Section 1: Monthly Cashflow Summary -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Monthly Cashflow Statement (September 2026)</h4>
            <span class="badge badge-subtle">Reconciled</span>
          </div>

          <div class="report-table-wrapper">
            <table class="report-table">
              <tbody>
                <tr class="report-row-highlight">
                  <td><strong>Total Operating Income</strong></td>
                  <td class="text-right text-success font-bold">+${AccountModel.formatCurrency(metrics.thisMonthIncome)}</td>
                </tr>
                <tr>
                  <td>Total Expenses & Outflows</td>
                  <td class="text-right text-danger font-bold">-${AccountModel.formatCurrency(metrics.thisMonthExpense)}</td>
                </tr>
                <tr class="report-row-total">
                  <td><strong>Net Monthly Savings</strong></td>
                  <td class="text-right font-bold ${metrics.savingsThisMonth >= 0 ? 'text-success' : 'text-danger'}">
                    ${AccountModel.formatCurrency(metrics.savingsThisMonth)} (${metrics.savingsRate}%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Report Section 2: Category Spending Breakdown -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h4>Category Spending Analysis</h4>
            <span class="text-xs text-muted">Total: ${AccountModel.formatCurrency(totalSpent)}</span>
          </div>

          <div class="report-table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th class="text-right">Amount</th>
                  <th class="text-right">Share (%)</th>
                  <th>Distribution Bar</th>
                </tr>
              </thead>
              <tbody>
                ${catEntries.length === 0 ? `
                  <tr><td colspan="4" class="text-center text-muted">No expenses recorded this month</td></tr>
                ` : catEntries.map(([cat, val]) => {
                  const pct = totalSpent > 0 ? ((val / totalSpent) * 100).toFixed(1) : 0;
                  return `
                    <tr>
                      <td class="font-bold">${cat}</td>
                      <td class="text-right font-bold text-danger">${AccountModel.formatCurrency(val)}</td>
                      <td class="text-right">${pct}%</td>
                      <td>
                        <div class="util-progress-bar" style="margin: 0;">
                          <div class="util-fill bg-primary" style="width: ${pct}%;"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Report Section 3: Balance Sheet Summary -->
        <div class="grid-2-col">
          <!-- Assets Column -->
          <div class="card">
            <div class="card-header">
              <h4>Assets Summary</h4>
              <span class="text-success font-bold">${AccountModel.formatCurrency(metrics.totalAssets)}</span>
            </div>
            <div class="report-table-wrapper">
              <table class="report-table">
                <tbody>
                  ${accounts.filter(a => a.category === 'debit').map(a => `
                    <tr>
                      <td>
                        <span style="margin-right: 6px;">${a.icon || '🏦'}</span>
                        <strong>${a.name}</strong>
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
              <h4>Liabilities Summary</h4>
              <span class="text-danger font-bold">${AccountModel.formatCurrency(metrics.totalLiabilities)}</span>
            </div>
            <div class="report-table-wrapper">
              <table class="report-table">
                <tbody>
                  ${accounts.filter(a => a.category === 'credit').map(a => `
                    <tr>
                      <td>
                        <span style="margin-right: 6px;">${a.icon || '💳'}</span>
                        <strong>${a.name}</strong>
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

        <!-- Net Position Summary -->
        <div class="card" style="margin-top: 1.5rem; text-align: center; padding: 2rem;">
          <span class="text-sm text-muted">CALCULATED NET POSITION</span>
          <div class="text-3xl font-bold" style="color: #6366f1; margin: 0.5rem 0;">
            ${AccountModel.formatCurrency(metrics.netPosition)}
          </div>
          <p class="text-xs text-muted">Total Assets (${AccountModel.formatCurrency(metrics.totalAssets)}) − Total Liabilities (${AccountModel.formatCurrency(metrics.totalLiabilities)})</p>
        </div>
      </div>
    `;

    this.attachEvents(container, transactions);
  }

  attachEvents(container, transactions) {
    // Export CSV
    container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      this.exportTransactionsToCSV(transactions);
    });

    // Export JSON
    container.querySelector('#btn-export-json')?.addEventListener('click', async () => {
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
  }

  exportTransactionsToCSV(transactions) {
    const headers = ['Transaction ID', 'Date', 'Type', 'Account ID', 'Category', 'Subcategory', 'Amount', 'Description', 'Payment Method', 'Notes'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.type,
      t.accountId,
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
    this.app.showToast('CSV file downloaded.');
  }
}
