(function () {
  'use strict';

  class TemplateManager {
    constructor() {
      this.templates = [];
      this.filteredTemplates = [];
      this.languages = [];
      this.filteredLanguages = [];
      this.editingTemplate = null;
      this.editingLanguage = null;
      this.currentTab = 'templates';
      this.init();
    }

    async init() {
      await this.loadTemplates();
      await this.loadLanguages();
      this.setupEventListeners();
      this.renderTemplates();
      this.renderLanguages();
    }

    async loadTemplates() {
      const { templates = [] } = await chrome.storage.local.get('templates');
      this.templates = templates;
      this.filteredTemplates = [...templates];
    }

    async loadLanguages() {
      const { translationLanguages = [] } = await chrome.storage.local.get('translationLanguages');
      this.languages = translationLanguages;
      this.filteredLanguages = [...translationLanguages];
    }

    setupEventListeners() {
      document.getElementById('add-btn').onclick = () => this.handleAdd();
      document.getElementById('import-btn').onclick = () => this.importData();
      document.getElementById('export-btn').onclick = () => this.exportData();
      
      document.getElementById('cancel-template').onclick = () => this.hideModal();
      document.getElementById('close-template-modal').onclick = () => this.hideModal();
      document.getElementById('template-form').onsubmit = (e) => this.saveTemplate(e);
      document.getElementById('search-templates').oninput = () => this.filterTemplates();
      document.getElementById('category-filter').onchange = () => this.filterTemplates();
      document.getElementById('sort-templates').onchange = () => this.sortTemplates();

      document.getElementById('cancel-language').onclick = () => this.hideLanguageModal();
      document.getElementById('close-language-modal').onclick = () => this.hideLanguageModal();
      document.getElementById('language-form').onsubmit = (e) => this.saveLanguage(e);
      document.getElementById('search-languages').oninput = () => this.filterLanguages();
      document.getElementById('sort-languages').onchange = () => this.sortLanguages();

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => this.switchTab(btn.dataset.tab);
      });

      document.getElementById('template-modal').onclick = (e) => {
        if (e.target.classList.contains('modal-overlay')) this.hideModal();
      };

      document.getElementById('language-modal').onclick = (e) => {
        if (e.target.classList.contains('modal-overlay')) this.hideLanguageModal();
      };
    }

    filterTemplates() {
      const search = document.getElementById('search-templates').value.toLowerCase();
      const category = document.getElementById('category-filter').value;

      this.filteredTemplates = this.templates.filter(t => {
        const matchSearch = !search || t.name.toLowerCase().includes(search) || t.prompt.toLowerCase().includes(search);
        const matchCategory = !category || t.category === category;
        return matchSearch && matchCategory;
      });

      this.sortTemplates();
    }

    sortTemplates() {
      const sort = document.getElementById('sort-templates').value;
      if (sort === 'recent') {
        this.filteredTemplates.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
      } else if (sort === 'popular') {
        this.filteredTemplates.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      } else if (sort === 'name') {
        this.filteredTemplates.sort((a, b) => a.name.localeCompare(b.name));
      }
      this.renderTemplates();
    }

    switchTab(tab) {
      this.currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
      });
    }

    handleAdd() {
      if (this.currentTab === 'templates') {
        this.showModal();
      } else {
        this.showLanguageModal();
      }
    }

    renderTemplates() {
      document.getElementById('templates-count').textContent = this.templates.length;
      
      const favoritesSection = document.getElementById('favorites-section');
      const favoritesGrid = document.getElementById('favorites-grid');
      const categoriesContainer = document.getElementById('categories-container');
      const emptyState = document.getElementById('templates-empty');

      if (this.filteredTemplates.length === 0) {
        favoritesSection.style.display = 'none';
        categoriesContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      // Render favorites
      const favorites = this.filteredTemplates.filter(t => t.isFavorite);
      if (favorites.length > 0) {
        favoritesSection.style.display = 'block';
        favoritesGrid.innerHTML = favorites.map(t => this.renderTemplateCard(t)).join('');
      } else {
        favoritesSection.style.display = 'none';
      }

      // Group by category
      const categories = {};
      this.filteredTemplates.forEach(t => {
        if (!categories[t.category]) categories[t.category] = [];
        categories[t.category].push(t);
      });

      categoriesContainer.innerHTML = Object.entries(categories).map(([cat, temps]) => `
        <div class="section-group">
          <h3 class="section-title">${this.getCategoryIcon(cat)} ${this.capitalize(cat)}</h3>
          <div class="cards-grid">
            ${temps.map(t => this.renderTemplateCard(t)).join('')}
          </div>
        </div>
      `).join('');

      // Add event listeners
      document.querySelectorAll('.template-card').forEach(card => {
        const id = card.dataset.id;
        card.querySelector('.star-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFavorite(id);
        });
        card.querySelector('.card-action-btn[title="Edit"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.editTemplate(id);
        });
        card.querySelector('.card-action-btn[title="Duplicate"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.duplicateTemplate(id);
        });
        card.querySelector('.card-action-btn[title="Delete"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteTemplate(id);
        });
      });
    }

    renderTemplateCard(t) {
      return `
        <div class="template-card" data-id="${t.id}">
          <div class="card-header">
            <div>
              <div class="card-title">${this.escapeHtml(t.name)}</div>
              <span class="card-category">${t.category}</span>
            </div>
            <div class="card-actions">
              <button class="star-btn ${t.isFavorite ? 'starred' : ''}" title="Favorite">${t.isFavorite ? '⭐' : '☆'}</button>
              <button class="card-action-btn" title="Edit">✏️</button>
              <button class="card-action-btn" title="Duplicate">📋</button>
              <button class="card-action-btn" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="card-description">${this.escapeHtml(t.prompt)}</div>
          <div class="card-footer">
            <div class="card-meta">
              <span class="card-meta-item">📊 ${t.usageCount || 0} uses</span>
              <span class="card-meta-item">🕐 ${this.formatTime(t.lastUsed)}</span>
            </div>
          </div>
        </div>
      `;
    }

    getCategoryIcon(category) {
      const icons = {
        editing: '✏️',
        communication: '💬',
        analysis: '📊',
        style: '🎨',
        creative: '✨'
      };
      return icons[category] || '📝';
    }

    capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    async toggleFavorite(id) {
      const template = this.templates.find(t => t.id === id);
      if (template) {
        template.isFavorite = !template.isFavorite;
        await chrome.storage.local.set({ templates: this.templates });
        await this.loadTemplates();
        this.filterTemplates();
      }
    }

    showModal(template = null) {
      this.editingTemplate = template;
      const modal = document.getElementById('template-modal');
      const title = document.getElementById('modal-title');

      if (template) {
        title.textContent = 'Edit Template';
        document.getElementById('template-name').value = template.name;
        document.getElementById('template-category').value = template.category;
        document.getElementById('template-prompt').value = template.prompt;
        document.getElementById('template-system').value = template.systemInstruction || '';
      } else {
        title.textContent = 'New Template';
        document.getElementById('template-form').reset();
      }

      modal.classList.add('active');
    }

    hideModal() {
      document.getElementById('template-modal').classList.remove('active');
      this.editingTemplate = null;
    }

    async saveTemplate(e) {
      e.preventDefault();

      const name = document.getElementById('template-name').value.trim();
      const category = document.getElementById('template-category').value;
      const prompt = document.getElementById('template-prompt').value.trim();
      const systemInstruction = document.getElementById('template-system').value.trim();

      if (!name || !prompt) {
        alert('Please fill in name and prompt');
        return;
      }

      const template = {
        id: this.editingTemplate ? this.editingTemplate.id : Date.now().toString(),
        name,
        category,
        prompt,
        systemInstruction: systemInstruction || null,
        isFavorite: this.editingTemplate ? this.editingTemplate.isFavorite : false,
        usageCount: this.editingTemplate ? this.editingTemplate.usageCount : 0,
        lastUsed: this.editingTemplate ? this.editingTemplate.lastUsed : 0,
        createdAt: this.editingTemplate ? this.editingTemplate.createdAt : Date.now()
      };

      if (this.editingTemplate) {
        const index = this.templates.findIndex(t => t.id === this.editingTemplate.id);
        this.templates[index] = template;
      } else {
        this.templates.push(template);
      }

      await chrome.storage.local.set({ templates: this.templates });
      await this.loadTemplates();
      this.filterTemplates();
      this.hideModal();
    }

    editTemplate(id) {
      const template = this.templates.find(t => t.id === id);
      if (template) this.showModal(template);
    }

    renderLanguages() {
      document.getElementById('languages-count').textContent = this.languages.length;
      const container = document.getElementById('languages-grid');
      const emptyState = document.getElementById('languages-empty');
      
      if (this.filteredLanguages.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }
      
      emptyState.style.display = 'none';
      container.innerHTML = this.filteredLanguages.map(lang => `
        <div class="language-card" data-id="${lang.id}">
          ${lang.isDefault ? '<div class="language-default-badge">⭐ Default</div>' : ''}
          <div class="language-flag">${this.getLanguageFlag(lang.name)}</div>
          <div class="card-title">${this.escapeHtml(lang.name)}</div>
          <div class="card-description">${this.escapeHtml(lang.instruction)}</div>
          <div class="card-footer">
            <div class="card-meta">
              <span class="card-meta-item">🕐 ${this.formatTime(lang.lastUsed)}</span>
            </div>
            <div class="card-actions">
              ${!lang.isDefault ? `<button class="card-action-btn" title="Set Default" onclick="templateManager.setDefaultLanguage('${lang.id}')">⭐</button>` : ''}
              <button class="card-action-btn" title="Edit" onclick="templateManager.editLanguage('${lang.id}')">✏️</button>
              ${!lang.isDefault ? `<button class="card-action-btn" title="Delete" onclick="templateManager.deleteLanguage('${lang.id}')">🗑️</button>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }

    getLanguageFlag(name) {
      const flags = {
        'English': '🇬🇧', 'Spanish': '🇪🇸', 'French': '🇫🇷', 'German': '🇩🇪',
        'Hindi': '🇮🇳', 'Arabic': '🇸🇦', 'Chinese': '🇨🇳', 'Japanese': '🇯🇵',
        'Portuguese': '🇵🇹', 'Russian': '🇷🇺', 'Italian': '🇮🇹', 'Korean': '🇰🇷'
      };
      return flags[name] || '🌍';
    }

    filterLanguages() {
      const search = document.getElementById('search-languages').value.toLowerCase();
      this.filteredLanguages = this.languages.filter(l => l.name.toLowerCase().includes(search));
      this.sortLanguages();
    }

    sortLanguages() {
      const sort = document.getElementById('sort-languages').value;
      if (sort === 'recent') {
        this.filteredLanguages.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
      } else if (sort === 'name') {
        this.filteredLanguages.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sort === 'usage') {
        this.filteredLanguages.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      }
      this.renderLanguages();
    }

    showLanguageModal(language = null) {
      this.editingLanguage = language;
      const modal = document.getElementById('language-modal');
      const title = document.getElementById('language-modal-title');
      if (language) {
        title.textContent = 'Edit Language';
        document.getElementById('language-name').value = language.name;
        document.getElementById('language-instruction').value = language.instruction;
        document.getElementById('language-default').checked = language.isDefault;
      } else {
        title.textContent = 'New Language';
        document.getElementById('language-form').reset();
      }
      modal.classList.add('active');
    }

    hideLanguageModal() {
      document.getElementById('language-modal').classList.remove('active');
      this.editingLanguage = null;
    }

    async saveLanguage(e) {
      e.preventDefault();
      const name = document.getElementById('language-name').value.trim();
      const instruction = document.getElementById('language-instruction').value.trim();
      const isDefault = document.getElementById('language-default').checked;

      if (!name || !instruction) {
        alert('Please fill in all fields');
        return;
      }

      if (isDefault) {
        this.languages.forEach(l => l.isDefault = false);
      }

      const language = {
        id: this.editingLanguage ? this.editingLanguage.id : 'lang-' + Date.now(),
        name,
        instruction,
        isDefault,
        lastUsed: this.editingLanguage ? this.editingLanguage.lastUsed : 0,
        createdAt: this.editingLanguage ? this.editingLanguage.createdAt : Date.now()
      };

      if (this.editingLanguage) {
        const index = this.languages.findIndex(l => l.id === this.editingLanguage.id);
        this.languages[index] = language;
      } else {
        this.languages.push(language);
      }

      await chrome.storage.local.set({ translationLanguages: this.languages });
      await this.loadLanguages();
      this.sortLanguages();
      this.hideLanguageModal();
    }

    editLanguage(id) {
      const language = this.languages.find(l => l.id === id);
      if (language) this.showLanguageModal(language);
    }

    async setDefaultLanguage(id) {
      this.languages.forEach(l => l.isDefault = l.id === id);
      await chrome.storage.local.set({ translationLanguages: this.languages });
      await this.loadLanguages();
      this.sortLanguages();
    }

    async deleteLanguage(id) {
      if (confirm('Delete this language?')) {
        this.languages = this.languages.filter(l => l.id !== id);
        await chrome.storage.local.set({ translationLanguages: this.languages });
        await this.loadLanguages();
        this.sortLanguages();
      }
    }

    formatTime(timestamp) {
      if (!timestamp) return 'Never';
      const diff = Date.now() - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} min ago`;
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    async duplicateTemplate(id) {
      const template = this.templates.find(t => t.id === id);
      if (template) {
        const newTemplate = {
          ...template,
          id: Date.now().toString(),
          name: template.name + ' (Copy)',
          isFavorite: false,
          usageCount: 0,
          lastUsed: 0,
          createdAt: Date.now()
        };
        this.templates.push(newTemplate);
        await chrome.storage.local.set({ templates: this.templates });
        await this.loadTemplates();
        this.filterTemplates();
      }
    }

    importData() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.templates) {
          this.templates = [...this.templates, ...data.templates];
          await chrome.storage.local.set({ templates: this.templates });
        }
        if (data.languages) {
          this.languages = [...this.languages, ...data.languages];
          await chrome.storage.local.set({ translationLanguages: this.languages });
        }
        await this.loadTemplates();
        await this.loadLanguages();
        this.filterTemplates();
        this.sortLanguages();
      };
      input.click();
    }

    exportData() {
      const data = {
        templates: this.templates,
        languages: this.languages,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quickai-backup-${Date.now()}.json`;
      a.click();
    }

    async deleteTemplate(id) {
      if (confirm('Delete this template?')) {
        this.templates = this.templates.filter(t => t.id !== id);
        await chrome.storage.local.set({ templates: this.templates });
        await this.loadTemplates();
        this.filterTemplates();
      }
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.templateManager = new TemplateManager());
  } else {
    window.templateManager = new TemplateManager();
  }

})();