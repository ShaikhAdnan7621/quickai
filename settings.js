(function () {
  'use strict';

  class SettingsManager {
    constructor() {
      this.init();
    }

    async init() {
      await this.loadStats();
      await this.loadSettings();
      this.setupEventListeners();
      this.initTooltips();
    }

    async loadStats() {
      const { templates = [], quickHistory = [], chatHistory = [] } = await chrome.storage.local.get(['templates', 'quickHistory', 'chatHistory']);
      document.getElementById('templates-count').textContent = templates.length;
      document.getElementById('quick-count').textContent = quickHistory.length;
      document.getElementById('chat-count').textContent = chatHistory.length;
    }

    async loadSettings() {
      const { apiKey, settings = {} } = await chrome.storage.local.get(['apiKey', 'settings']);
      
      if (apiKey) {
        document.getElementById('api-key-display').value = '••••••••••••••••••••';
        document.getElementById('api-key-display').dataset.key = apiKey;
      }
      
      document.getElementById('model-select').value = settings.selectedModel || 'gemini-2.5-flash';
      document.getElementById('popup-position').value = settings.popupPosition?.type || 'cursor';
      document.getElementById('popup-size').value = settings.popupSize || 'medium';
    }

    setupEventListeners() {
      document.getElementById('help-btn').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
      document.getElementById('toggle-key').onclick = () => this.toggleApiKey();
      document.getElementById('save-api-key').onclick = () => this.saveApiKey();
      document.getElementById('test-api-key').onclick = () => this.testApiKey();
      document.getElementById('save-model').onclick = () => this.saveModel();
      document.getElementById('save-interface').onclick = () => this.saveInterface();
      document.getElementById('export-settings').onclick = () => this.exportSettings();
      document.getElementById('import-settings').onclick = () => document.getElementById('import-file').click();
      document.getElementById('import-file').onchange = (e) => this.importSettings(e);
      document.getElementById('reset-templates').onclick = () => this.resetTemplates();
      document.getElementById('clear-quick-history').onclick = () => this.clearQuickHistory();
      document.getElementById('clear-chat-history').onclick = () => this.clearChatHistory();
      document.getElementById('reset-all').onclick = () => this.resetAll();
    }

    toggleApiKey() {
      const input = document.getElementById('api-key-display');
      const btn = document.getElementById('toggle-key');
      
      if (input.type === 'password') {
        input.type = 'text';
        input.value = input.dataset.key || '';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        input.value = '••••••••••••••••••••';
        btn.textContent = '👁️';
      }
    }

    async saveApiKey() {
      const newKey = document.getElementById('new-api-key').value.trim();
      
      if (!newKey) {
        this.showNotification('Please enter an API key', 'error');
        return;
      }
      
      await chrome.storage.local.set({ apiKey: newKey });
      document.getElementById('api-key-display').value = '••••••••••••••••••••';
      document.getElementById('api-key-display').dataset.key = newKey;
      document.getElementById('new-api-key').value = '';
      this.showNotification('✅ API key saved successfully!');
    }

    async testApiKey() {
      const { apiKey } = await chrome.storage.local.get('apiKey');
      
      if (!apiKey) {
        this.showNotification('Please save an API key first', 'error');
        return;
      }
      
      const btn = document.getElementById('test-api-key');
      btn.disabled = true;
      btn.textContent = '🔄 Testing...';
      
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'callGemini',
          prompt: 'Say "Connection successful"',
          text: '',
          model: 'gemini-2.5-flash'
        });
        
        if (response.success) {
          this.showNotification('✅ Connection successful!');
        } else {
          this.showNotification('❌ ' + (response.error || 'Connection failed'), 'error');
        }
      } catch (error) {
        this.showNotification('❌ Connection failed', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔌 Test Connection';
      }
    }

    async saveModel() {
      const { settings = {} } = await chrome.storage.local.get('settings');
      settings.selectedModel = document.getElementById('model-select').value;
      await chrome.storage.local.set({ settings });
      this.showNotification('✅ Model preference saved!');
    }

    async saveInterface() {
      const { settings = {} } = await chrome.storage.local.get('settings');
      settings.popupPosition = { type: document.getElementById('popup-position').value };
      settings.popupSize = document.getElementById('popup-size').value;
      await chrome.storage.local.set({ settings });
      this.showNotification('✅ Interface settings saved!');
    }

    async exportSettings() {
      const data = await chrome.storage.local.get(null);
      const exportData = {
        settings: data.settings,
        templates: data.templates,
        translationLanguages: data.translationLanguages,
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quickai-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showNotification('✅ Settings exported!');
    }

    async importSettings(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.settings) await chrome.storage.local.set({ settings: data.settings });
        if (data.templates) await chrome.storage.local.set({ templates: data.templates });
        if (data.translationLanguages) await chrome.storage.local.set({ translationLanguages: data.translationLanguages });
        
        this.showNotification('✅ Settings imported successfully!');
        setTimeout(() => location.reload(), 1000);
      } catch (error) {
        this.showNotification('❌ Failed to import settings', 'error');
      }
    }

    async resetTemplates() {
      if (!confirm('Reset all templates to defaults? Custom templates will be lost.')) return;
      
      const defaultTemplates = [
        { id: 'grammar-fix', name: 'Grammar Fix', prompt: 'Fix grammar and spelling errors. Return ONLY the corrected text without explanations or markdown formatting:', category: 'editing', systemInstruction: 'You are a grammar correction assistant. Return only the corrected text, no explanations, no markdown, no formatting.', lastUsed: 0 },
        { id: 'summarize', name: 'Summarize', prompt: 'Provide a concise summary:', category: 'analysis', systemInstruction: 'You are a summarization assistant. Provide clear, concise summaries without markdown formatting.', lastUsed: 0 },
        { id: 'email-professional', name: 'Professional Email', prompt: 'Rewrite as a professional email:', category: 'communication', systemInstruction: 'You are an email writing assistant. Write professional emails without markdown formatting.', lastUsed: 0 },
        { id: 'make-shorter', name: 'Make Shorter', prompt: 'Make this text shorter while keeping the key points:', category: 'editing', systemInstruction: 'Condense text to essential information only.', lastUsed: 0 },
        { id: 'make-longer', name: 'Make Longer', prompt: 'Expand this text with more details and examples:', category: 'editing', systemInstruction: 'Add relevant details and examples to expand the content.', lastUsed: 0 }
      ];
      
      await chrome.storage.local.set({ templates: defaultTemplates });
      this.showNotification('✅ Templates reset to defaults!');
      await this.loadStats();
    }

    async clearQuickHistory() {
      if (!confirm('Clear all Quick AI history? This cannot be undone.')) return;
      
      await chrome.storage.local.set({ quickHistory: [] });
      this.showNotification('✅ Quick AI history cleared!');
      await this.loadStats();
    }

    async clearChatHistory() {
      if (!confirm('Clear all chat history? This cannot be undone.')) return;
      
      await chrome.storage.local.set({ chatHistory: [] });
      this.showNotification('✅ Chat history cleared!');
      await this.loadStats();
    }

    async resetAll() {
      if (!confirm('Reset ALL settings to defaults? This will keep your API key but reset everything else.')) return;
      
      const { apiKey } = await chrome.storage.local.get('apiKey');
      
      await chrome.storage.local.clear();
      
      if (apiKey) await chrome.storage.local.set({ apiKey });
      
      const defaultSettings = {
        selectedModel: 'gemini-2.5-flash',
        popupPosition: { type: 'cursor' },
        popupSize: 'medium'
      };
      
      await chrome.storage.local.set({ settings: defaultSettings });
      
      this.showNotification('✅ All settings reset!');
      setTimeout(() => location.reload(), 1000);
    }

    initTooltips() {
      document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', (e) => this.showTooltip(e));
        el.addEventListener('mouseleave', () => this.hideTooltip());
      });
    }

    showTooltip(e) {
      const text = e.target.dataset.tooltip;
      if (!text) return;
      
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);
      
      const rect = e.target.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
      tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
      
      this.currentTooltip = tooltip;
    }

    hideTooltip() {
      if (this.currentTooltip) {
        this.currentTooltip.remove();
        this.currentTooltip = null;
      }
    }

    showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        font-size: 14px;
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SettingsManager());
  } else {
    new SettingsManager();
  }
})();
