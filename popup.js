// Popup script for extension action
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.checkApiKeyStatus();
    await this.loadRecentTemplates();
    this.setupEventListeners();
  }

  async checkApiKeyStatus() {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    const statusIndicator = document.getElementById('status-indicator');
    const apiStatus = document.getElementById('api-status');
    const apiText = apiStatus.querySelector('.api-text');
    const configureBtn = document.getElementById('configure-key');
    
    if (apiKey) {
      statusIndicator.querySelector('.status-dot').style.background = '#10b981';
      statusIndicator.querySelector('.status-text').textContent = 'Ready';
      statusIndicator.style.background = 'rgba(16, 185, 129, 0.1)';
      apiText.textContent = 'API Key Configured';
      apiStatus.querySelector('.api-icon').textContent = '✓';
      configureBtn.textContent = 'Update API Key';
    } else {
      statusIndicator.querySelector('.status-dot').style.background = '#ef4444';
      statusIndicator.querySelector('.status-text').textContent = 'Setup Required';
      statusIndicator.style.background = 'rgba(239, 68, 68, 0.1)';
      apiText.textContent = 'API Key Not Set';
      configureBtn.textContent = 'Configure API Key';
    }
  }

  async loadRecentTemplates() {
    const { templates = [] } = await chrome.storage.local.get('templates');
    const recentContainer = document.getElementById('recent-templates');
    
    const sortedTemplates = templates
      .filter(t => t.lastUsed)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 3);
    
    if (sortedTemplates.length === 0) {
      recentContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(0,0,0,0.5); font-size: 13px;">No recent templates</div>';
      return;
    }
    
    recentContainer.innerHTML = sortedTemplates.map(template => `
      <div class="template-item" data-id="${template.id}">
        <span class="template-name">${template.name}</span>
        <span class="template-count">${this.getUsageCount(template)}</span>
      </div>
    `).join('');
    
    // Add click handlers
    recentContainer.querySelectorAll('.template-item').forEach(item => {
      item.onclick = () => this.activateWithTemplate(item.dataset.id);
    });
  }

  getUsageCount(template) {
    if (!template.lastUsed) return 'New';
    const now = Date.now();
    const diff = now - template.lastUsed;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  setupEventListeners() {
    document.getElementById('activate-btn').onclick = () => this.activateQuickAI();
    document.getElementById('templates-btn').onclick = () => this.openTemplates();
    document.getElementById('history-btn').onclick = () => this.openHistory();
    document.getElementById('settings-btn').onclick = () => this.openSettings();
    document.getElementById('configure-key').onclick = () => this.toggleApiKeyInput();
    document.getElementById('save-key').onclick = () => this.saveApiKey();
  }

  toggleApiKeyInput() {
    const apiInput = document.getElementById('api-key');
    const saveBtn = document.getElementById('save-key');
    const configureBtn = document.getElementById('configure-key');
    
    if (apiInput.style.display === 'none') {
      apiInput.style.display = 'block';
      saveBtn.style.display = 'block';
      configureBtn.style.display = 'none';
      apiInput.focus();
    } else {
      apiInput.style.display = 'none';
      saveBtn.style.display = 'none';
      configureBtn.style.display = 'block';
    }
  }

  async saveApiKey() {
    const apiKey = document.getElementById('api-key').value.trim();
    
    if (!apiKey) {
      this.showNotification('Please enter a valid API key', 'error');
      return;
    }

    await chrome.storage.local.set({ apiKey });
    this.showNotification('API key saved successfully!', 'success');
    
    setTimeout(() => {
      document.getElementById('api-key').value = '';
      this.toggleApiKeyInput();
      this.checkApiKeyStatus();
    }, 1000);
  }

  async activateQuickAI() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'activate', mode: 'quick' });
      window.close();
    } catch (error) {
      this.showNotification('Please refresh the page and try again', 'error');
    }
  }

  async activateWithTemplate(templateId) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'activate', mode: 'quick', templateId });
      window.close();
    } catch (error) {
      this.showNotification('Please refresh the page and try again', 'error');
    }
  }

  showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  openHistory() {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  }

  openTemplates() {
    chrome.tabs.create({ url: chrome.runtime.getURL('templates.html') });
  }

  openSettings() {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});