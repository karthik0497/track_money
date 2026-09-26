// Track-Money: Categories & Subcategories Manager View
export class CategoriesView {
  constructor(storage, app) {
    this.storage = storage;
    this.app = app;
    this.activeType = 'expense'; // 'expense' or 'income'
  }

  async render(container) {
    const allCategories = await this.storage.getAll('categories');
    const filtered = allCategories.filter(c => c.type === this.activeType);

    container.innerHTML = `
      <div class="categories-container fade-in">
        <div class="page-header">
          <div>
            <h2>Categories & Subcategories</h2>
            <p class="text-sm text-muted">Organize your spending habits and revenue sources</p>
          </div>
          <button class="btn btn-primary" id="btn-add-category">
            <span>➕ Add Category</span>
          </button>
        </div>

        <!-- Segmented Toggle -->
        <div class="tabs-segmented">
          <button class="tab-btn ${this.activeType === 'expense' ? 'active' : ''}" data-type="expense">
            Expense Categories (${allCategories.filter(c => c.type === 'expense').length})
          </button>
          <button class="tab-btn ${this.activeType === 'income' ? 'active' : ''}" data-type="income">
            Income Categories (${allCategories.filter(c => c.type === 'income').length})
          </button>
        </div>

        <!-- Category Grid -->
        <div class="categories-tree-grid">
          ${filtered.map(cat => `
            <div class="card category-tree-card" data-cat-name="${cat.name}">
              <div class="cat-card-header">
                <div class="cat-title-box">
                  <span class="cat-icon" style="background: ${cat.color || '#6366f1'}20; color: ${cat.color || '#6366f1'};">
                    ${cat.icon || '🏷️'}
                  </span>
                  <div>
                    <h4 class="font-bold">${cat.name}</h4>
                    <span class="text-xs text-muted">${(cat.subcategories || []).length} subcategories</span>
                  </div>
                </div>
                <div class="cat-actions">
                  <button class="btn-item-action add-subcat-btn" data-cat="${cat.name}" title="Add Subcategory">➕</button>
                  <button class="btn-item-action delete-cat-btn" data-cat="${cat.name}" title="Delete Category">🗑</button>
                </div>
              </div>

              <!-- Subcategories Badges List -->
              <div class="subcat-list">
                ${(cat.subcategories && cat.subcategories.length > 0) ? cat.subcategories.map(sub => `
                  <div class="subcat-chip">
                    <span>${sub}</span>
                    <button class="remove-subcat-btn" data-cat="${cat.name}" data-sub="${sub}">✕</button>
                  </div>
                `).join('') : `
                  <span class="text-xs text-muted">No subcategories yet. Tap ➕ to add one.</span>
                `}
              </div>
            </div>
          `).join('')}
        </div>

        <div id="cat-modal-root"></div>
      </div>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    // Type switcher
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeType = e.currentTarget.dataset.type;
        this.render(container);
      });
    });

    // Add category button
    container.querySelector('#btn-add-category')?.addEventListener('click', () => {
      this.openAddCategoryModal();
    });

    // Add subcategory button
    container.querySelectorAll('.add-subcat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const catName = e.currentTarget.dataset.cat;
        this.openAddSubcategoryPrompt(catName);
      });
    });

    // Delete category
    container.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const catName = e.currentTarget.dataset.cat;
        if (confirm(`Delete category "${catName}"?`)) {
          await this.storage.delete('categories', catName);
          this.render(container);
          this.app.showToast(`Deleted category "${catName}"`);
        }
      });
    });

    // Remove subcategory
    container.querySelectorAll('.remove-subcat-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const catName = e.currentTarget.dataset.cat;
        const subName = e.currentTarget.dataset.sub;
        const cat = await this.storage.get('categories', catName);
        if (cat) {
          cat.subcategories = (cat.subcategories || []).filter(s => s !== subName);
          await this.storage.put('categories', cat);
          this.render(container);
        }
      });
    });
  }

  openAddCategoryModal() {
    const modalRoot = document.getElementById('cat-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop fade-in" id="add-cat-backdrop">
        <div class="modal-card slide-up">
          <div class="modal-header">
            <h3>Add New Category</h3>
            <button class="btn btn-icon" id="close-add-cat">✕</button>
          </div>
          <form id="add-cat-form">
            <div class="form-group">
              <label>Category Type</label>
              <select name="type" class="form-input">
                <option value="expense" ${this.activeType === 'expense' ? 'selected' : ''}>Expense</option>
                <option value="income" ${this.activeType === 'income' ? 'selected' : ''}>Income</option>
              </select>
            </div>

            <div class="form-group">
              <label>Category Name</label>
              <input type="text" name="name" class="form-input" placeholder="e.g. Pets, Freelance, Gym" required>
            </div>

            <div class="grid-2-col">
              <div class="form-group">
                <label>Emoji / Icon</label>
                <input type="text" name="icon" class="form-input" placeholder="🐾" value="🏷️">
              </div>
              <div class="form-group">
                <label>Color Accent</label>
                <input type="color" name="color" class="form-input" value="#6366f1" style="height: 44px; padding: 4px;">
              </div>
            </div>

            <div class="form-group">
              <label>Initial Subcategories (comma-separated)</label>
              <input type="text" name="subcategories" class="form-input" placeholder="e.g. Food, Vet Care, Toys, Grooming">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-add-cat">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Category</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-add-cat')?.addEventListener('click', () => modalRoot.innerHTML = '');
    document.getElementById('cancel-add-cat')?.addEventListener('click', () => modalRoot.innerHTML = '');

    document.getElementById('add-cat-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      const type = fd.get('type');
      const icon = fd.get('icon') || '🏷️';
      const color = fd.get('color') || '#6366f1';
      const subsRaw = fd.get('subcategories') || '';
      const subcategories = subsRaw.split(',').map(s => s.trim()).filter(Boolean);

      await this.storage.put('categories', {
        name,
        type,
        icon,
        color,
        subcategories
      });

      modalRoot.innerHTML = '';
      this.render(document.getElementById('app-main-view'));
      this.app.showToast(`Category "${name}" added!`);
    });
  }

  async openAddSubcategoryPrompt(catName) {
    const subName = prompt(`Add new subcategory for "${catName}":`);
    if (subName && subName.trim()) {
      const cat = await this.storage.get('categories', catName);
      if (cat) {
        cat.subcategories = cat.subcategories || [];
        if (!cat.subcategories.includes(subName.trim())) {
          cat.subcategories.push(subName.trim());
          await this.storage.put('categories', cat);
          this.render(document.getElementById('app-main-view'));
          this.app.showToast(`Subcategory "${subName.trim()}" added to ${catName}.`);
        }
      }
    }
  }
}
