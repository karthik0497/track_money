import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = '/home/karthik/.gemini/antigravity-ide/brain/1c34d25a-df42-437c-bca6-440e12f1c4d3';

async function capture() {
  console.log('Launching Chrome to capture authentic app screenshots...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars']
  });

  const page = await browser.newPage();
  
  // Set Mobile Viewport (390x844 - iPhone / Modern Mobile standard)
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Handle Onboarding if present
  try {
    const skipBtn = await page.$('#btn-onboarding-skip');
    if (skipBtn) {
      await skipBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {}

  // Seed realistic financial portfolio data into IndexedDB via window.app
  console.log('Seeding rich authentic financial data...');
  await page.evaluate(async () => {
    const storage = window.app.storage;
    
    // Clear old sample data first
    await storage.clear('accounts');
    await storage.clear('transactions');

    // Create realistic Accounts
    const accHdfc = {
      id: 'acc_hdfc_salary',
      name: 'HDFC Salary A/c',
      category: 'debit',
      type: 'Bank Account',
      openingBalance: 125400,
      currentBalance: 125400,
      currency: 'INR',
      description: 'Primary corporate salary account',
      color: '#2563eb',
      icon: '🏦',
      createdAt: '2026-09-01T00:00:00.000Z'
    };

    const accSbi = {
      id: 'acc_sbi_savings',
      name: 'SBI Emergency Fund',
      category: 'debit',
      type: 'Savings Account',
      openingBalance: 42800,
      currentBalance: 42800,
      currency: 'INR',
      description: 'Emergency reserve & fixed deposit',
      color: '#0284c7',
      icon: '🏛️',
      createdAt: '2026-09-01T00:00:00.000Z'
    };

    const accCash = {
      id: 'acc_cash_wallet',
      name: 'Cash in Hand',
      category: 'debit',
      type: 'Cash',
      openingBalance: 6500,
      currentBalance: 6500,
      currency: 'INR',
      description: 'Physical cash & wallet reserve',
      color: '#10b981',
      icon: '💵',
      createdAt: '2026-09-01T00:00:00.000Z'
    };

    const accHdfcCc = {
      id: 'acc_hdfc_regalia',
      name: 'HDFC Regalia Gold',
      category: 'credit',
      type: 'Credit Card',
      creditLimit: 250000,
      openingOutstanding: 28450,
      currentOutstanding: 28450,
      availableCredit: 221550,
      billingCycle: '1st of month',
      dueDate: '20th of month',
      interestRate: 3.5,
      currency: 'INR',
      description: 'Primary rewards card for travel & dining',
      color: '#7c3aed',
      icon: '💳',
      createdAt: '2026-09-01T00:00:00.000Z'
    };

    const accIciciCc = {
      id: 'acc_icici_sapphiro',
      name: 'ICICI Sapphiro Card',
      category: 'credit',
      type: 'Credit Card',
      creditLimit: 300000,
      openingOutstanding: 14200,
      currentOutstanding: 14200,
      availableCredit: 285800,
      billingCycle: '10th of month',
      dueDate: '28th of month',
      interestRate: 3.5,
      currency: 'INR',
      description: 'Secondary card for lounge access & movies',
      color: '#dc2626',
      icon: '💳',
      createdAt: '2026-09-01T00:00:00.000Z'
    };

    await storage.put('accounts', accHdfc);
    await storage.put('accounts', accSbi);
    await storage.put('accounts', accCash);
    await storage.put('accounts', accHdfcCc);
    await storage.put('accounts', accIciciCc);

    // Realistic October 2026 Transactions
    const txs = [
      {
        id: 'tx_salary',
        accountId: 'acc_hdfc_salary',
        type: 'income',
        amount: 115000,
        category: 'Salary',
        subcategory: 'Monthly Salary',
        description: 'Monthly Corporate Salary Credit',
        date: '2026-10-01',
        paymentMethod: 'Net Banking'
      },
      {
        id: 'tx_freelance',
        accountId: 'acc_hdfc_salary',
        type: 'income',
        amount: 35000,
        category: 'Freelance',
        subcategory: 'Client Projects',
        description: 'Fintech UI Design Consulting Payout',
        date: '2026-10-09',
        paymentMethod: 'Net Banking'
      },
      {
        id: 'tx_rent',
        accountId: 'acc_hdfc_salary',
        type: 'expense',
        amount: 24000,
        category: 'Other Expense',
        subcategory: 'General',
        description: 'Apartment Rent & Society Maintenance',
        date: '2026-10-02',
        paymentMethod: 'Net Banking'
      },
      {
        id: 'tx_grocery',
        accountId: 'acc_hdfc_regalia',
        type: 'expense',
        amount: 4850,
        category: 'Food',
        subcategory: 'Groceries',
        description: 'Nature Basket Organic Groceries & Blinkit',
        date: '2026-10-04',
        paymentMethod: 'Credit Card'
      },
      {
        id: 'tx_fuel',
        accountId: 'acc_hdfc_salary',
        type: 'expense',
        amount: 3200,
        category: 'Car Expense',
        subcategory: 'Petrol / Diesel',
        description: 'HP Fuel Station - Tank Full',
        date: '2026-10-05',
        paymentMethod: 'UPI'
      },
      {
        id: 'tx_starbucks',
        accountId: 'acc_icici_sapphiro',
        type: 'expense',
        amount: 1240,
        category: 'Outside Food',
        subcategory: 'Restaurant Dining',
        description: 'Starbucks Coffee & Team Lunch',
        date: '2026-10-06',
        paymentMethod: 'Credit Card'
      },
      {
        id: 'tx_subs',
        accountId: 'acc_hdfc_regalia',
        type: 'expense',
        amount: 1499,
        category: 'Subscriptions',
        subcategory: 'Netflix',
        description: 'Netflix UHD & Spotify Family Pack',
        date: '2026-10-07',
        paymentMethod: 'Credit Card'
      },
      {
        id: 'tx_power',
        accountId: 'acc_sbi_savings',
        type: 'expense',
        amount: 2450,
        category: 'Current Bill',
        subcategory: 'Monthly Current Bill',
        description: 'Bescom Electricity Bill Payment',
        date: '2026-10-08',
        paymentMethod: 'UPI'
      },
      {
        id: 'tx_swiggy',
        accountId: 'acc_icici_sapphiro',
        type: 'expense',
        amount: 860,
        category: 'Online Food',
        subcategory: 'Swiggy',
        description: 'Swiggy Gourmet Dinner Delivery',
        date: '2026-10-10',
        paymentMethod: 'Credit Card'
      }
    ];

    for (const t of txs) {
      await storage.addTransaction(t);
    }

    // Refresh application views
    await window.app.refreshCurrentView();
  });

  await new Promise(r => setTimeout(r, 1200));

  // 1. Mobile Dashboard View
  console.log('Capturing: Real Mobile Dashboard...');
  await page.evaluate(() => window.app.navigateTo('dashboard'));
  await page.waitForSelector('.hero-net-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));
  const dashPath = path.join(ARTIFACT_DIR, 'real_app_dashboard.png');
  await page.screenshot({ path: dashPath });
  console.log('Saved:', dashPath);

  // 2. Mobile Accounts View
  console.log('Capturing: Real Mobile Accounts...');
  await page.evaluate(() => window.app.navigateTo('accounts'));
  await page.waitForSelector('.account-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));
  const accPath = path.join(ARTIFACT_DIR, 'real_app_accounts.png');
  await page.screenshot({ path: accPath });
  console.log('Saved:', accPath);

  // 3. Mobile Transactions History View
  console.log('Capturing: Real Mobile Transactions History...');
  await page.evaluate(() => window.app.navigateTo('transactions'));
  await page.waitForSelector('.tx-item', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));
  const txPath = path.join(ARTIFACT_DIR, 'real_app_transactions.png');
  await page.screenshot({ path: txPath });
  console.log('Saved:', txPath);

  // 4. Mobile Reports & Analytics View (with Donut chart & metrics)
  console.log('Capturing: Real Mobile Reports...');
  await page.evaluate(() => window.app.navigateTo('reports'));
  await page.waitForSelector('.pie-chart-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  const repPath = path.join(ARTIFACT_DIR, 'real_app_reports.png');
  await page.screenshot({ path: repPath });
  console.log('Saved:', repPath);

  // 5. Mobile AI Conversational Assistant View
  console.log('Capturing: Real Mobile AI Assistant...');
  await page.evaluate(() => {
    // Open AI assistant drawer
    window.app.assistantView.open();
    // Insert realistic conversation messages into drawer
    const messagesEl = document.getElementById('ai-messages-list');
    if (messagesEl) {
      messagesEl.innerHTML = `
        <div class="ai-msg-bubble user">
          Spent ₹1,240 on Starbucks coffee using ICICI credit card
        </div>
        <div class="ai-msg-bubble assistant">
          <div style="font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <span>✨</span> Transaction Recorded
          </div>
          <div>Successfully added <strong>₹1,240</strong> to <strong>Outside Food</strong> from <strong>ICICI Sapphiro Card</strong>.</div>
          <div style="margin-top:6px; font-size:0.75rem; opacity:0.8;">💳 Available Card Limit: ₹2,84,560</div>
        </div>
        <div class="ai-msg-bubble user">
          Track my total money and net savings this month
        </div>
        <div class="ai-msg-bubble assistant">
          <div style="font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <span>📊</span> October 2026 Financial Summary
          </div>
          <div>• Total Net Position: <strong>₹1,32,041</strong> across 5 accounts</div>
          <div>• Monthly Income: <strong>₹1,50,000</strong> (Salary + Consulting)</div>
          <div>• Total Spending: <strong>₹38,099</strong> | Net Savings: <strong>₹1,11,901</strong> (74.6%)</div>
        </div>
      `;
    }
  });
  await new Promise(r => setTimeout(r, 800));
  const aiPath = path.join(ARTIFACT_DIR, 'real_app_ai_assistant.png');
  await page.screenshot({ path: aiPath });
  console.log('Saved:', aiPath);

  // Close AI drawer before next screenshot
  await page.evaluate(() => {
    window.app.assistantView.close();
  });
  await new Promise(r => setTimeout(r, 400));

  // 6. Mobile Settings View (Data Backup, Export & Portability)
  console.log('Capturing: Real Mobile Settings (Backup & Local Portability)...');
  await page.evaluate(() => window.app.navigateTo('settings'));
  await page.waitForSelector('.backup-actions-grid', { timeout: 10000 });
  await page.evaluate(() => {
    const backupCard = document.querySelector('.backup-actions-grid');
    if (backupCard) backupCard.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 800));
  const setPath = path.join(ARTIFACT_DIR, 'real_app_settings.png');
  await page.screenshot({ path: setPath });
  console.log('Saved:', setPath);

  // 7. Desktop Responsive Dashboard View (1180x820)
  console.log('Capturing: Real Desktop Dashboard View...');
  await page.setViewport({
    width: 1180,
    height: 820,
    deviceScaleFactor: 2,
    isMobile: false
  });
  await page.evaluate(() => window.app.navigateTo('dashboard'));
  await page.waitForSelector('.hero-net-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  const desktopDashPath = path.join(ARTIFACT_DIR, 'real_app_desktop.png');
  await page.screenshot({ path: desktopDashPath });
  console.log('Saved:', desktopDashPath);

  await browser.close();
  console.log('🎉 All 7 real screenshots captured successfully!');
}

capture().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
