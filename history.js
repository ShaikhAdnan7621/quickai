(function () {
  'use strict';

  class HistoryManager {
    constructor() {
      this.quickHistory = [];
      this.chatHistory = [];
      this.filteredQuick = [];
      this.filteredChat = [];
      this.currentTab = 'quick';
      this.init();
    }

    async init() {
      await this.loadHistory();
      this.setupTabs();
      this.setupEventListeners();
      this.setupFilters();
      this.renderHistory();
    }

    async loadHistory() {
      const { quickHistory = [], chatHistory = [] } = await chrome.storage.local.get(['quickHistory', 'chatHistory']);
      this.quickHistory = quickHistory.sort((a, b) => b.timestamp - a.timestamp);
      this.chatHistory = chatHistory.sort((a, b) => b.timestamp - a.timestamp);
      this.filteredQuick = [...this.quickHistory];
      this.filteredChat = [...this.chatHistory];
    }

    setupTabs() {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          this.currentTab = btn.dataset.tab;
          document.querySelector(`[data-content="${this.currentTab}"]`).classList.add('active');
        };
      });
    }

    setupEventListeners() {
      document.getElementById('search-quick').oninput = () => this.filterQuick();
      document.getElementById('template-filter').onchange = () => this.filterQuick();
      document.getElementById('date-filter-quick').onchange = () => this.filterQuick();
      document.getElementById('search-chat').oninput = () => this.filterChat();
      document.getElementById('date-filter-chat').onchange = () => this.filterChat();
      document.getElementById('clear-history').onclick = () => this.clearHistory();
      document.getElementById('export-history').onclick = () => this.exportHistory();
      document.getElementById('help-btn').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
    }

    setupFilters() {
      const templates = [...new Set(this.quickHistory.map(item => item.template).filter(Boolean))];
      const templateFilter = document.getElementById('template-filter');
      
      templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template;
        option.textContent = template;
        templateFilter.appendChild(option);
      });
    }

    filterQuick() {
      const searchTerm = document.getElementById('search-quick').value.toLowerCase();
      const templateFilter = document.getElementById('template-filter').value;
      const dateFilter = document.getElementById('date-filter-quick').value;

      this.filteredQuick = this.quickHistory.filter(item => {
        const matchesSearch = !searchTerm || 
          item.originalText?.toLowerCase().includes(searchTerm) ||
          item.output?.toLowerCase().includes(searchTerm) ||
          item.prompt?.toLowerCase().includes(searchTerm);

        const matchesTemplate = !templateFilter || item.template === templateFilter;
        const matchesDate = this.matchesDateFilter(item.timestamp, dateFilter);

        return matchesSearch && matchesTemplate && matchesDate;
      });

      this.renderQuick();
    }

    filterChat() {
      const searchTerm = document.getElementById('search-chat').value.toLowerCase();
      const dateFilter = document.getElementById('date-filter-chat').value;

      this.filteredChat = this.chatHistory.filter(item => {
        const matchesSearch = !searchTerm || 
          item.title?.toLowerCase().includes(searchTerm) ||
          item.messages?.some(m => m.content.toLowerCase().includes(searchTerm));

        const matchesDate = this.matchesDateFilter(item.timestamp, dateFilter);

        return matchesSearch && matchesDate;
      });

      this.renderChat();
    }

    matchesDateFilter(timestamp, filter) {
      if (!filter) return true;
      const itemDate = new Date(timestamp);
      const now = new Date();
      
      switch (filter) {
        case 'today':
          return itemDate.toDateString() === now.toDateString();
        case 'week':
          return now - itemDate < 7 * 86400000;
        case 'month':
          return now - itemDate < 30 * 86400000;
        default:
          return true;
      }
    }

    renderHistory() {
      this.renderQuick();
      this.renderChat();
    }

    renderQuick() {
      const container = document.getElementById('quick-container');
      const emptyState = document.getElementById('quick-empty');
      
      if (this.filteredQuick.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';
      const grouped = this.groupByDate(this.filteredQuick);
      
      container.innerHTML = Object.entries(grouped).map(([date, items]) => `
        <div class="section-group">
          <h3 class="section-title">${date}</h3>
          <div class="card-grid">
            ${items.map(item => this.renderQuickCard(item)).join('')}
          </div>
        </div>
      `).join('');

      this.attachQuickListeners();
    }

    renderChat() {
      const container = document.getElementById('chat-container');
      const emptyState = document.getElementById('chat-empty');
      
      if (this.filteredChat.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';
      const grouped = this.groupByDate(this.filteredChat);
      
      container.innerHTML = Object.entries(grouped).map(([date, items]) => `
        <div class="section-group">
          <h3 class="section-title">${date}</h3>
          <div class="card-grid">
            ${items.map(item => this.renderChatCard(item)).join('')}
          </div>
        </div>
      `).join('');

      this.attachChatListeners();
    }

    groupByDate(items) {
      const groups = {};
      const now = new Date();
      const today = now.toDateString();
      const yesterday = new Date(now.getTime() - 86400000).toDateString();

      items.forEach(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toDateString();
        
        let label;
        if (dateStr === today) label = '📅 Today';
        else if (dateStr === yesterday) label = '📅 Yesterday';
        else if (now - date < 7 * 86400000) label = '📅 This Week';
        else label = '📅 ' + date.toLocaleDateString();

        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
      });

      return groups;
    }

    renderQuickCard(item) {
      const hasTimeline = item.timeline && item.timeline.length > 1;
      return `
        <div class="template-card history-card" data-id="${item.id}">
          <div class="card-header">
            <div>
              <div class="card-title">${this.formatTime(item.timestamp)}</div>
              ${item.template ? `<span class="card-category">${item.template}</span>` : ''}
              ${hasTimeline ? `<span class="timeline-badge">${item.timeline.length} steps</span>` : ''}
            </div>
            <div class="card-actions">
              <button class="card-action-btn quick-copy" title="Copy Output" data-tooltip="Copy final output">📋</button>
              <button class="card-action-btn quick-delete" title="Delete" data-tooltip="Delete this entry">🗑️</button>
            </div>
          </div>
          <div class="history-preview">
            <div class="history-text">${this.escapeHtml(item.originalText?.substring(0, 100) || '')}${item.originalText?.length > 100 ? '...' : ''}</div>
            <button class="history-toggle">Show more ▼</button>
          </div>
          <div class="history-details">
            <div class="history-section">
              <h4>Original Text</h4>
              <div class="history-text">${this.escapeHtml(item.originalText || '')}</div>
            </div>
            ${hasTimeline ? `
              <div class="history-section">
                <div class="timeline-header">
                  <h4>Timeline</h4>
                  <div class="timeline-nav">
                    <button class="timeline-nav-btn" data-action="prev" data-tooltip="Previous step">◀</button>
                    <span class="timeline-position">1/${item.timeline.length}</span>
                    <button class="timeline-nav-btn" data-action="next" data-tooltip="Next step">▶</button>
                  </div>
                </div>
                <div class="timeline-viewer">
                  ${item.timeline.map((step, idx) => `
                    <div class="timeline-step ${idx === 0 ? 'active' : ''}" data-step="${idx}">
                      <div class="timeline-step-header">
                        <span class="timeline-step-num">${step.step || idx + 1}</span>
                        <span class="timeline-step-type">${this.getStepIcon(step.type)} ${step.type}</span>
                        <span class="timeline-step-time">${this.formatTime(step.timestamp)}</span>
                      </div>
                      ${step.prompt ? `<div class="timeline-step-prompt">💬 ${this.escapeHtml(step.prompt)}</div>` : ''}
                      ${step.output ? `<div class="timeline-step-output">${this.renderMarkdown(step.output)}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : `
              <div class="history-section">
                <h4>Prompt</h4>
                <div class="history-text history-prompt">${this.escapeHtml(item.prompt || '')}</div>
              </div>
              <div class="history-section">
                <h4>AI Output</h4>
                <div class="history-text history-output">${this.renderMarkdown(item.output || '')}</div>
              </div>
            `}
            <div class="history-meta">
              ${item.model ? `🤖 ${item.model}` : ''}
              ${item.pageUrl ? ` • 🌐 ${this.getDomain(item.pageUrl)}` : ''}
              ${item.stats ? ` • ${item.stats.followupCount} followups` : ''}
            </div>
          </div>
        </div>
      `;
    }

    renderChatCard(item) {
      const messageCount = item.messages?.length || 0;
      const firstUserMsg = item.messages?.find(m => m.role === 'user')?.content || '';
      
      return `
        <div class="template-card history-card chat-card" data-id="${item.id}">
          <div class="card-header">
            <div>
              <div class="card-title">${item.title || this.formatTime(item.timestamp)}</div>
              <span class="card-category">${messageCount} messages</span>
            </div>
            <div class="card-actions">
              <button class="card-action-btn chat-copy" title="Copy Conversation">📋</button>
              <button class="card-action-btn chat-delete" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="history-preview">
            <div class="history-text">${this.escapeHtml(firstUserMsg.substring(0, 100))}${firstUserMsg.length > 100 ? '...' : ''}</div>
            <button class="history-toggle">Show conversation ▼</button>
          </div>
          <div class="history-details">
            <div class="chat-messages">
              ${item.messages?.map(msg => `
                <div class="chat-message ${msg.role}">
                  <div class="message-role">${msg.role === 'user' ? '👤 You' : '🤖 AI'}</div>
                  <div class="message-content">${msg.role === 'assistant' ? this.renderMarkdown(msg.content) : this.escapeHtml(msg.content)}</div>
                  <div class="message-time">${this.formatTime(msg.timestamp)}</div>
                </div>
              `).join('') || ''}
            </div>
            <div class="history-meta">
              ${item.model ? `🤖 ${item.model}` : ''}
              ${item.pageUrl ? ` • 🌐 ${this.getDomain(item.pageUrl)}` : ''}
            </div>
          </div>
        </div>
      `;
    }

    attachQuickListeners() {
      document.querySelectorAll('#quick-container .history-card').forEach(card => {
        const id = card.dataset.id;
        card.querySelector('.quick-copy')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.copyQuickOutput(id);
        });
        card.querySelector('.quick-delete')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteQuick(id);
        });
        card.querySelector('.history-toggle')?.addEventListener('click', () => {
          card.classList.toggle('expanded');
          const btn = card.querySelector('.history-toggle');
          btn.textContent = card.classList.contains('expanded') ? 'Show less ▲' : 'Show more ▼';
        });
        
        // Timeline navigation
        const timelineNav = card.querySelectorAll('.timeline-nav-btn');
        timelineNav.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateTimeline(card, btn.dataset.action);
          });
        });
      });
      
      this.initTooltips();
    }

    attachChatListeners() {
      document.querySelectorAll('#chat-container .history-card').forEach(card => {
        const id = card.dataset.id;
        card.querySelector('.chat-copy')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.copyChatConversation(id);
        });
        card.querySelector('.chat-delete')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteChat(id);
        });
        card.querySelector('.history-toggle')?.addEventListener('click', () => {
          card.classList.toggle('expanded');
          const btn = card.querySelector('.history-toggle');
          btn.textContent = card.classList.contains('expanded') ? 'Hide conversation ▲' : 'Show conversation ▼';
        });
      });
      
      this.initTooltips();
    }

    navigateTimeline(card, direction) {
      const viewer = card.querySelector('.timeline-viewer');
      const steps = viewer.querySelectorAll('.timeline-step');
      const position = card.querySelector('.timeline-position');
      const currentIdx = Array.from(steps).findIndex(s => s.classList.contains('active'));
      
      let newIdx = currentIdx;
      if (direction === 'next' && currentIdx < steps.length - 1) newIdx++;
      if (direction === 'prev' && currentIdx > 0) newIdx--;
      
      if (newIdx !== currentIdx) {
        steps[currentIdx].classList.remove('active');
        steps[newIdx].classList.add('active');
        position.textContent = `${newIdx + 1}/${steps.length}`;
        
        // Update nav buttons
        const prevBtn = card.querySelector('[data-action="prev"]');
        const nextBtn = card.querySelector('[data-action="next"]');
        prevBtn.disabled = newIdx === 0;
        nextBtn.disabled = newIdx === steps.length - 1;
      }
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

    renderMarkdown(text) {
      if (typeof marked === 'undefined') return this.escapeHtml(text);
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
      });
      return marked.parse(text);
    }

    getStepIcon(type) {
      const icons = {
        process: '⚡',
        followup: '💬',
        copy: '📋',
        insert: '⬇️',
        replace: '↩️'
      };
      return icons[type] || '•';
    }

    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    getDomain(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async copyQuickOutput(id) {
      const item = this.quickHistory.find(h => h.id === id);
      if (item) {
        try {
          await navigator.clipboard.writeText(item.output);
          this.showNotification('✅ Copied to clipboard!');
        } catch (error) {
          this.showNotification('❌ Failed to copy', 'error');
        }
      }
    }

    async copyChatConversation(id) {
      const item = this.chatHistory.find(h => h.id === id);
      if (item) {
        try {
          const text = item.messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
          await navigator.clipboard.writeText(text);
          this.showNotification('✅ Conversation copied!');
        } catch (error) {
          this.showNotification('❌ Failed to copy', 'error');
        }
      }
    }

    async deleteQuick(id) {
      if (confirm('Delete this history item?')) {
        this.quickHistory = this.quickHistory.filter(h => h.id !== id);
        await chrome.storage.local.set({ quickHistory: this.quickHistory });
        await this.loadHistory();
        this.filterQuick();
      }
    }

    async deleteChat(id) {
      if (confirm('Delete this conversation?')) {
        this.chatHistory = this.chatHistory.filter(h => h.id !== id);
        await chrome.storage.local.set({ chatHistory: this.chatHistory });
        await this.loadHistory();
        this.filterChat();
      }
    }

    async clearHistory() {
      const msg = this.currentTab === 'quick' 
        ? 'Clear all Quick AI history?' 
        : 'Clear all Chat history?';
      
      if (confirm(msg + ' This cannot be undone.')) {
        if (this.currentTab === 'quick') {
          await chrome.storage.local.set({ quickHistory: [] });
          this.quickHistory = [];
          this.filteredQuick = [];
          this.renderQuick();
        } else {
          await chrome.storage.local.set({ chatHistory: [] });
          this.chatHistory = [];
          this.filteredChat = [];
          this.renderChat();
        }
      }
    }

    exportHistory() {
      const data = {
        quickHistory: this.quickHistory,
        chatHistory: this.chatHistory,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quickai-history-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
      setTimeout(() => notification.remove(), 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new HistoryManager());
  } else {
    new HistoryManager();
  }
})();
