// Track-Money: Local Natural Language Understanding (NLU) Engine
// 100% On-Device, Offline-First Intent Detection & Entity Extraction

export const CATEGORY_KEYWORDS = {
  Food: {
    Restaurant: ['lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'cafe', 'dine out', 'hotel food', 'mcdonalds', 'kfc', 'starbucks', 'dominos', 'pizza', 'burger', 'biryani'],
    Groceries: ['groceries', 'supermarket', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'vegetables', 'fruits', 'milk', 'bread', 'kirana', 'provisions'],
    Delivery: ['swiggy', 'zomato', 'food delivery', 'order food', 'takeaway'],
    Coffee: ['coffee', 'tea', 'chai', 'starbucks', 'cafe coffee day', 'beverage'],
    Snacks: ['snacks', 'chaat', 'samosa', 'biscuit', 'cookies', 'evening snack']
  },
  Shopping: {
    Amazon: ['amazon', 'flipkart', 'order online', 'e-commerce'],
    Clothing: ['clothes', 'shirt', 'pants', 'jeans', 'dress', 'zara', 'h&m', 'myntra', 'shopping', 'apparel', 'shoes', 'footwear', 'sneakers'],
    Electronics: ['gadget', 'headphones', 'mobile', 'laptop', 'charger', 'cable', 'electronics', 'ipad', 'croma', 'reliance digital'],
    Household: ['furniture', 'home decor', 'bedsheet', 'kitchenware', 'utensils']
  },
  Transportation: {
    Fuel: ['petrol', 'diesel', 'cng', 'fuel', 'gas station', 'shell', 'hpcl', 'bpcl', 'ioc'],
    'Taxi / Uber': ['uber', 'ola', 'rapido', 'cab', 'auto', 'rickshaw', 'taxi'],
    'Metro / Bus': ['metro', 'bus', 'train ticket', 'public transport', 'subway'],
    'Vehicle Service': ['car service', 'bike service', 'mechanic', 'puncture', 'car wash', 'vehicle repair'],
    Parking: ['parking', 'toll', 'fastag']
  },
  'Housing & Rent': {
    'House Rent': ['rent', 'house rent', 'flat rent', 'room rent', 'landlord'],
    Maintenance: ['society maintenance', 'building maintenance', 'plumber', 'electrician']
  },
  'Bills & Utilities': {
    Electricity: ['electricity bill', 'power bill', 'current bill', 'bescom', 'msedcl', 'bijli'],
    Water: ['water bill', 'water tanker'],
    'LPG Gas': ['gas cylinder', 'lpg', 'indane', 'hp gas', 'piped gas'],
    'Mobile Recharge': ['mobile recharge', 'phone bill', 'jio recharge', 'airtel recharge', 'postpaid bill'],
    'Broadband Wi-Fi': ['broadband', 'wifi', 'internet bill', 'airtel fiber', 'jio fiber', 'act fibernet'],
    'Credit Card Bill': ['credit card bill', 'card bill', 'cc bill', 'outstanding payment']
  },
  Entertainment: {
    Movies: ['movie', 'cinema', 'pvr', 'inox', 'bookmyshow', 'theatre'],
    Streaming: ['netflix', 'hotstar', 'prime video', 'youtube', 'spotify', 'subscription'],
    Gaming: ['playstation', 'steam', 'game', 'xbox'],
    'Concerts & Events': ['concert', 'show', 'party', 'club', 'pub', 'outing']
  },
  'Travel & Trips': {
    Flights: ['flight', 'airline', 'indigo', 'air india', 'ticket booking'],
    Hotels: ['hotel', 'resort', 'airbnb', 'stay', 'room booking'],
    Trains: ['irctc', 'train ticket', 'railway'],
    Sightseeing: ['trip', 'tour', 'vacation', 'holiday', 'travel']
  },
  Healthcare: {
    Medicines: ['medicine', 'pharmacy', 'chemist', 'apollo', '1mg', 'pharmeasy', 'tablets'],
    'Doctor Consult': ['doctor', 'clinic', 'hospital', 'consultation', 'dentist', 'eye checkup'],
    'Lab Tests': ['blood test', 'lab test', 'scan', 'xray']
  },
  Education: {
    Courses: ['course', 'udemy', 'coursera', 'training', 'classes'],
    Books: ['books', 'stationery', 'notebook', 'novel'],
    Tuition: ['school fees', 'college fees', 'tuition fees']
  },
  Subscriptions: {
    Netflix: ['netflix'],
    Spotify: ['spotify', 'apple music', 'music subscription'],
    'Amazon Prime': ['prime', 'amazon prime'],
    'Software / AI': ['chatgpt', 'gemini', 'claude', 'github', 'cloud storage', 'google one', 'icloud']
  },
  Investments: {
    'Mutual Fund SIP': ['sip', 'mutual fund', 'index fund', 'zerodha', 'groww'],
    'Direct Stocks': ['stocks', 'shares', 'equity', 'nifty'],
    Gold: ['gold', 'digital gold', 'silver']
  },
  'Personal & Care': {
    'Salon & Spa': ['salon', 'haircut', 'barber', 'spa', 'massage', 'parlour'],
    'Gym & Fitness': ['gym', 'fitness', 'workout', 'yoga', 'cult fit'],
    Cosmetics: ['makeup', 'perfume', 'skincare', 'nykaa']
  },
  // Income mappings
  Salary: {
    'Monthly Salary': ['salary', 'paycheck', 'wages', 'stipend'],
    Bonus: ['bonus', 'incentive', 'appraisal']
  },
  Freelance: {
    'Client Projects': ['freelance', 'client payment', 'consulting fee', 'gig', 'upwork', 'fiverr']
  },
  Business: {
    'Sales Revenue': ['business sale', 'revenue', 'customer payment', 'shop sale']
  },
  Interest: {
    'Savings Account Interest': ['interest credited', 'fd interest', 'bank interest']
  },
  Dividend: {
    'Stock Dividend': ['dividend', 'dividend payout']
  },
  'Cashback & Rewards': {
    'UPI Cashback': ['cashback', 'reward', 'gpay reward', 'cred cashback']
  },
  Refund: {
    'Ecommerce Return': ['refund', 'return refund', 'money back', 'reversal']
  }
};

export class NLUEngine {
  /**
   * Parse user query or statement
   * Returns structured intent object
   */
  static parse(text, availableAccounts = [], availableCategories = []) {
    const raw = text.trim();
    const clean = raw.toLowerCase();

    // 1. Check if it's a financial query / question
    if (this.isQueryIntent(clean)) {
      return {
        intent: 'query_finance',
        query: clean,
        rawText: raw
      };
    }

    // 2. Check if it's a transfer between accounts
    const transferMatch = this.detectTransfer(clean, availableAccounts);
    if (transferMatch) {
      return {
        intent: 'create_transfer',
        ...transferMatch,
        rawText: raw
      };
    }

    // 3. Check if it's a credit card payment
    const ccPayMatch = this.detectCreditCardPayment(clean, availableAccounts);
    if (ccPayMatch) {
      return {
        intent: 'pay_credit_card',
        ...ccPayMatch,
        rawText: raw
      };
    }

    // 4. Detect Income vs Expense
    const isIncome = this.detectIsIncome(clean);
    const intent = isIncome ? 'create_income' : 'create_expense';

    // Extract Entities
    const amount = this.extractAmount(clean);
    const date = this.extractDate(clean);
    const accountMatch = this.extractAccount(clean, availableAccounts);
    const categoryMatch = this.extractCategory(clean, availableCategories, isIncome);
    const description = this.extractDescription(raw, clean, amount);

    return {
      intent,
      type: isIncome ? 'income' : 'expense',
      amount,
      date,
      account: accountMatch.account,
      accountAmbiguous: accountMatch.ambiguous,
      accountCandidates: accountMatch.candidates,
      category: categoryMatch.category,
      subcategory: categoryMatch.subcategory,
      suggestedNewCategory: categoryMatch.suggestedNewCategory,
      description,
      rawText: raw,
      needsClarification: !amount || accountMatch.ambiguous || !accountMatch.account
    };
  }

  static isQueryIntent(text) {
    const questionWords = ['how much', 'what is', 'what was', 'show me', 'list my', 'tell me', 'can you show', 'my balance', 'biggest expense', 'how many', 'total spent', 'total income'];
    return questionWords.some(q => text.includes(q)) || text.endsWith('?');
  }

  static detectTransfer(text, accounts) {
    // "Transfer 10,000 from HDFC Bank to SBI Savings"
    // "Move 5000 from SBI to HDFC"
    const transferRegex = /(?:transfer|move|send)\s+(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:k|lakh)?\s+from\s+(.+?)\s+to\s+(.+?)(?:$|\.|\s+today|\s+yesterday)/i;
    const match = text.match(transferRegex);
    if (match) {
      const amount = this.parseAmountString(match[1]);
      const fromStr = match[2].trim();
      const toStr = match[3].trim();

      const fromAcc = this.fuzzyFindAccount(fromStr, accounts);
      const toAcc = this.fuzzyFindAccount(toStr, accounts);

      return {
        type: 'transfer',
        amount,
        fromAccount: fromAcc,
        toAccount: toAcc,
        fromRaw: fromStr,
        toRaw: toStr,
        date: this.extractDate(text),
        description: `Transfer from ${fromAcc ? fromAcc.name : fromStr} to ${toAcc ? toAcc.name : toStr}`
      };
    }
    return null;
  }

  static detectCreditCardPayment(text, accounts) {
    // "Paid 10,000 towards my HDFC credit card"
    // "Pay 5000 credit card bill"
    const ccPayRegex = /(?:paid|pay)\s+(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:towards|for|to)?\s*(?:my)?\s*(.+?)(?:credit card|cc|card bill|card|bill)/i;
    const match = text.match(ccPayRegex);
    if (match || text.includes('credit card bill') || text.includes('towards my hdfc')) {
      const amount = this.extractAmount(text);
      // Find credit account
      const creditAccounts = accounts.filter(a => a.category === 'credit');
      const debitAccounts = accounts.filter(a => a.category === 'debit');

      let targetCard = null;
      for (const card of creditAccounts) {
        const cname = card.name.toLowerCase();
        if (text.includes(cname) || text.includes(cname.replace('credit card', '').trim())) {
          targetCard = card;
          break;
        }
      }
      if (!targetCard && creditAccounts.length === 1) {
        targetCard = creditAccounts[0];
      }

      // Check if from account is mentioned ("from HDFC bank")
      let fromAccount = null;
      const fromMatch = text.match(/from\s+([a-z0-9\s]+)/i);
      if (fromMatch) {
        fromAccount = this.fuzzyFindAccount(fromMatch[1], debitAccounts);
      }
      if (!fromAccount && debitAccounts.length > 0) {
        fromAccount = debitAccounts.find(a => a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('salary')) || debitAccounts[0];
      }

      return {
        type: 'credit_card_payment',
        amount,
        targetAccount: targetCard,
        fromAccount,
        date: this.extractDate(text),
        description: `Payment towards ${targetCard ? targetCard.name : 'Credit Card'}`
      };
    }
    return null;
  }

  static detectIsIncome(text) {
    const incomeWords = [
      'salary', 'credited', 'received', 'got paid', 'earned', 'income',
      'freelance payment', 'dividend', 'bonus', 'cashback', 'refund'
    ];
    // Check if contains "received 5000" or "got 500" or "salary to"
    return incomeWords.some(word => text.includes(word));
  }

  static extractAmount(text) {
    // Matches: ₹500, 500, 25,000, 2.5k, 1 lakh, 500 rs
    // Check lakh first
    const lakhMatch = text.match(/([\d.]+)\s*(?:lakh|lac|lacs)/i);
    if (lakhMatch) {
      return parseFloat(lakhMatch[1]) * 100000;
    }

    // Check k (e.g. 2.5k -> 2500)
    const kMatch = text.match(/([\d.]+)\s*k\b/i);
    if (kMatch) {
      return parseFloat(kMatch[1]) * 1000;
    }

    // Check standard numbers: ₹ 500, 500 rupees, rs. 500, or standalone numbers
    const numRegex = /(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs|bucks)?/gi;
    let match;
    let candidates = [];
    while ((match = numRegex.exec(text)) !== null) {
      const valStr = match[1].replace(/,/g, '');
      const num = parseFloat(valStr);
      if (!isNaN(num) && num > 0) {
        candidates.push(num);
      }
    }

    if (candidates.length > 0) {
      // Pick the first valid non-year number (exclude 2024, 2025, 2026 if preceded by date words)
      for (const val of candidates) {
        if (val >= 2020 && val <= 2030 && (text.includes('year') || text.includes('in 202'))) {
          continue;
        }
        return val;
      }
      return candidates[0];
    }
    return null;
  }

  static parseAmountString(str) {
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  static extractDate(text) {
    const today = new Date();
    if (text.includes('yesterday')) {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    }
    if (text.includes('day before yesterday')) {
      const d = new Date(today);
      d.setDate(d.getDate() - 2);
      return d.toISOString().split('T')[0];
    }
    // Check explicit month names: "22 sep", "15 august", etc.
    const monthRegex = /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?/i;
    const mMatch = text.match(monthRegex);
    if (mMatch) {
      const day = parseInt(mMatch[1]);
      const monthStr = mMatch[2].substring(0, 3).toLowerCase();
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIdx = months.indexOf(monthStr);
      const year = mMatch[3] ? parseInt(mMatch[3]) : today.getFullYear();
      if (monthIdx !== -1) {
        const d = new Date(year, monthIdx, day);
        return d.toISOString().split('T')[0];
      }
    }

    return today.toISOString().split('T')[0];
  }

  static extractAccount(text, accounts) {
    if (!accounts || accounts.length === 0) {
      return { account: null, ambiguous: false, candidates: [] };
    }

    // 1. Check for exact full name matches first
    const exactMatches = accounts.filter(acc => text.includes(acc.name.toLowerCase()));
    if (exactMatches.length === 1) {
      return { account: exactMatches[0], ambiguous: false, candidates: [] };
    } else if (exactMatches.length > 1) {
      return { account: null, ambiguous: true, candidates: exactMatches };
    }

    // 2. Disambiguation for specific banks with both debit and credit
    const isCC = text.includes('credit') || text.includes('card') || text.includes('cc') || text.includes('limit');
    const isBank = text.includes('bank') || text.includes('savings') || text.includes('salary') || text.includes('debit');

    // Check HDFC
    if (text.includes('hdfc')) {
      const hdfcAccounts = accounts.filter(a => a.name.toLowerCase().includes('hdfc'));
      if (isCC) {
        const card = hdfcAccounts.find(a => a.category === 'credit' || a.type === 'Credit Card');
        if (card) return { account: card, ambiguous: false, candidates: [] };
      } else if (isBank) {
        const bank = hdfcAccounts.find(a => a.category === 'debit');
        if (bank) return { account: bank, ambiguous: false, candidates: [] };
      }
      return { account: null, ambiguous: true, candidates: hdfcAccounts };
    }

    // Check SBI
    if (text.includes('sbi')) {
      const sbiAccounts = accounts.filter(a => a.name.toLowerCase().includes('sbi'));
      if (sbiAccounts.length === 1) {
        return { account: sbiAccounts[0], ambiguous: false, candidates: [] };
      } else if (sbiAccounts.length > 1) {
        if (isCC) {
          const card = sbiAccounts.find(a => a.category === 'credit');
          if (card) return { account: card, ambiguous: false, candidates: [] };
        } else {
          const bank = sbiAccounts.find(a => a.category === 'debit');
          if (bank) return { account: bank, ambiguous: false, candidates: [] };
        }
        return { account: null, ambiguous: true, candidates: sbiAccounts };
      }
    }

    // Check Amazon Pay Later
    if (text.includes('amazon') || text.includes('pay later') || text.includes('bnpl')) {
      const amz = accounts.find(a => a.name.toLowerCase().includes('amazon') || a.type === 'BNPL');
      if (amz) return { account: amz, ambiguous: false, candidates: [] };
    }

    // Check Cash
    if (text.includes('cash') || text.includes('wallet')) {
      const cash = accounts.find(a => a.type === 'Cash' || a.name.toLowerCase().includes('cash'));
      if (cash) return { account: cash, ambiguous: false, candidates: [] };
    }

    // Check Demat / Stocks
    if (text.includes('demat') || text.includes('zerodha') || text.includes('groww')) {
      const demat = accounts.find(a => a.type === 'Demat Account' || a.name.toLowerCase().includes('demat'));
      if (demat) return { account: demat, ambiguous: false, candidates: [] };
    }

    // Fallback: token matching
    const matchedAccounts = [];
    for (const acc of accounts) {
      const accName = acc.name.toLowerCase();
      const tokens = accName.split(/\s+/).filter(t => t.length > 2 && t !== 'account' && t !== 'card');
      if (tokens.some(tok => text.includes(tok)) && !matchedAccounts.includes(acc)) {
        matchedAccounts.push(acc);
      }
    }

    if (matchedAccounts.length === 1) {
      return { account: matchedAccounts[0], ambiguous: false, candidates: [] };
    } else if (matchedAccounts.length > 1) {
      return { account: null, ambiguous: true, candidates: matchedAccounts };
    }

    // Account not mentioned at all
    return { account: null, ambiguous: true, candidates: accounts };
  }

  static fuzzyFindAccount(nameStr, accounts) {
    const q = nameStr.toLowerCase();
    return accounts.find(a => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase())) || null;
  }

  static extractCategory(text, availableCategories, isIncome) {
    // 1. Search in CATEGORY_KEYWORDS table
    for (const [catName, subMap] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const [subName, keywords] of Object.entries(subMap)) {
        for (const kw of keywords) {
          // match word boundary
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          if (regex.test(text)) {
            return {
              category: catName,
              subcategory: subName,
              suggestedNewCategory: null
            };
          }
        }
      }
    }

    // 2. Check if user mentioned one of the existing category names directly
    for (const cat of availableCategories) {
      if (text.includes(cat.name.toLowerCase())) {
        return {
          category: cat.name,
          subcategory: cat.subcategories && cat.subcategories.length > 0 ? cat.subcategories[0] : '',
          suggestedNewCategory: null
        };
      }
    }

    // 3. Fallback / Suggest new category if unknown concept mentioned
    // e.g. "dog's grooming" or "pet"
    if (text.includes('dog') || text.includes('cat') || text.includes('pet')) {
      return {
        category: 'Pets',
        subcategory: 'Pet Care',
        suggestedNewCategory: 'Pets'
      };
    }
    if (text.includes('gym') || text.includes('protein') || text.includes('fitness')) {
      return {
        category: 'Personal & Care',
        subcategory: 'Gym & Fitness',
        suggestedNewCategory: null
      };
    }

    return {
      category: isIncome ? 'Other Income' : 'Other Expense',
      subcategory: 'General',
      suggestedNewCategory: null
    };
  }

  static extractDescription(raw, clean, amount) {
    // Generate a clean concise description from user speech
    // e.g. "I spent ₹500 for lunch from HDFC bank" -> "Lunch"
    const forMatch = clean.match(/(?:for|on)\s+([a-z0-9\s]+?)(?:\s+(?:from|using|at|in|via|yesterday|today|with)|$)/i);
    if (forMatch && forMatch[1].trim().length > 1) {
      const desc = forMatch[1].trim();
      return desc.charAt(0).toUpperCase() + desc.slice(1);
    }
    if (clean.includes('lunch')) return 'Lunch';
    if (clean.includes('dinner')) return 'Dinner';
    if (clean.includes('groceries')) return 'Groceries';
    if (clean.includes('petrol')) return 'Petrol / Fuel';
    if (clean.includes('salary')) return 'Monthly Salary';
    if (clean.includes('freelance')) return 'Freelance Payment';
    if (clean.includes('shopping')) return 'Shopping';

    return 'Transaction';
  }
}
