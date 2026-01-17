// Core functionality - Main entry point & shared utilities
class QuickAIContent {
  constructor() {
    this.popup = null;
    this.selectedText = '';
    this.activeElement = null;
    this.cursorPosition = null;
    this.currentModel = 'gemini-2.5-flash';
    this.escapeCount = 0;
    this.escapeTimer = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'activate') {
        this.activate(request.mode || 'quick');
      }
      return true;
    });

    document.addEventListener('keydown', (e) => {
      const isInPopup = e.target.closest('#quickai-popup');
      if (e.altKey && e.key === 'q' && !isInPopup) {
        e.preventDefault();
        this.activate('quick');
      } else if (e.altKey && e.key === 'c' && !isInPopup) {
        e.preventDefault();
        this.activate('chat');
      }
    });

    document.addEventListener('mouseup', () => {
      this.selectedText = window.getSelection().toString();
    });

    document.addEventListener('focusin', (e) => {
      this.activeElement = e.target;
      if (this.isEditableElement(e.target)) {
        this.cursorPosition = e.target.selectionStart;
      }
    });
  }

  isEditableElement(element) {
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.contentEditable === 'true';
  }

  async activate(mode = 'quick') {
    if (this.popup) {
      this.closePopup();
      return;
    }
    const context = await this.getContext();
    this.createPopup(context, mode);
  }

  async getContext() {
    const selection = window.getSelection().toString();
    const activeElement = document.activeElement;
    return {
      selectedText: selection,
      hasSelection: selection.length > 0,
      activeElement: activeElement,
      isEditable: this.isEditableElement(activeElement),
      elementValue: activeElement.value || activeElement.textContent || '',
      cursorPosition: activeElement.selectionStart,
      pageTitle: document.title,
      pageUrl: window.location.href
    };
  }

  createPopup(context, mode) {
    this.popup = document.createElement('div');
    this.popup.id = 'quickai-popup';
    this.popup.innerHTML = mode === 'chat' ? this.getChatHTML(context) : this.getPopupHTML(context);
    this.popup.dataset.mode = mode;
    this.positionPopup();
    this.restoreSize();
    document.body.appendChild(this.popup);
    this.setupPopupEvents(context, mode);
    this.setupResizable();
    if (mode === 'quick') this.setLayoutMode('input-focus', false);
    
    // Smart initial focus
    setTimeout(() => {
      if (mode === 'chat') {
        const chatInput = this.popup.querySelector('#chat-input');
        if (chatInput) chatInput.focus();
      } else {
        const promptInput = this.popup.querySelector('#quickai-prompt');
        if (promptInput) promptInput.focus();
      }
    }, 100);
  }

  positionPopup() {
    const savedPosition = localStorage.getItem('quickai-popup-position');
    const rect = this.popup.getBoundingClientRect();
    const padding = 20;
    
    let x, y;
    
    if (savedPosition) {
      const pos = JSON.parse(savedPosition);
      x = pos.x;
      y = pos.y;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const selRect = selection.getRangeAt(0).getBoundingClientRect();
        if (selRect.width > 0 && selRect.height > 0) {
          x = selRect.left + selRect.width / 2 - rect.width / 2;
          y = selRect.bottom + 10;
        } else {
          x = window.innerWidth / 2 - rect.width / 2;
          y = 100;
        }
      } else {
        x = window.innerWidth / 2 - rect.width / 2;
        y = 100;
      }
    }
    
    // Boundary detection
    const maxX = window.innerWidth - rect.width - padding;
    const maxY = window.innerHeight - rect.height - padding;
    
    x = Math.max(padding, Math.min(x, maxX));
    y = Math.max(padding, Math.min(y, maxY));
    
    this.popup.style.left = x + 'px';
    this.popup.style.top = y + 'px';
  }

  async setupPopupEvents(context, mode) {
    this.setupDraggable();
    this.popup.querySelector('.quickai-close').onclick = () => this.closePopup();
    const modelSelector = this.popup.querySelector('#model-selector');
    const { selectedModel } = await chrome.storage.local.get('selectedModel');
    this.currentModel = selectedModel || 'gemini-2.5-flash';
    modelSelector.value = this.currentModel;
    modelSelector.onchange = async () => {
      this.currentModel = modelSelector.value;
      await chrome.storage.local.set({ selectedModel: this.currentModel });
    };
    if (mode === 'chat') {
      this.setupChatEvents(context);
    } else {
      await this.loadTemplates();
      this.setupQuickEvents(context);
    }
    const saveBtn = this.popup.querySelector('#save-prompt-btn');
    if (saveBtn) saveBtn.onclick = () => this.openTemplates();
    this.setupKeyboardNav();
    this.setupGlobalShortcuts(mode, context);
  }

  setupKeyboardNav() {
    this.popup.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.target.matches('select')) {
        e.preventDefault();
        const focusableElements = Array.from(this.popup.querySelectorAll('input:not([disabled]), textarea:not([disabled]), button:not([disabled]), select:not([disabled])'));
        const currentIndex = focusableElements.indexOf(e.target);
        const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
        const nextEl = focusableElements[nextIndex < 0 ? focusableElements.length - 1 : nextIndex % focusableElements.length];
        nextEl?.focus();
      }
    });
  }

  setupGlobalShortcuts(mode, context) {
    this.popup.addEventListener('keydown', (e) => {
      // Escape twice to close
      if (e.key === 'Escape') {
        this.escapeCount++;
        if (this.escapeTimer) clearTimeout(this.escapeTimer);
        if (this.escapeCount === 2) {
          this.closePopup();
          this.escapeCount = 0;
        } else {
          this.escapeTimer = setTimeout(() => { this.escapeCount = 0; }, 500);
        }
        return;
      }
      
      // Ctrl+Enter: Process/Send
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'chat') {
          const sendBtn = this.popup.querySelector('#chat-send');
          if (sendBtn) sendBtn.click();
        } else {
          const processBtn = this.popup.querySelector('#quickai-process');
          if (processBtn && !processBtn.disabled) processBtn.click();
        }
        return;
      }
      
      // Ctrl+Shift+Left/Right: Navigate output
      if (e.ctrlKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const direction = e.key === 'ArrowLeft' ? -1 : 1;
        if (mode === 'quick' && this.navigateOutput) {
          this.navigateOutput(direction);
        }
        return;
      }
    });
  }

  setupGlobalShortcuts(mode, context) {
    this.popup.addEventListener('keydown', (e) => {
      // Escape twice to close
      if (e.key === 'Escape') {
        this.escapeCount++;
        if (this.escapeTimer) clearTimeout(this.escapeTimer);
        if (this.escapeCount === 2) {
          this.closePopup();
          this.escapeCount = 0;
        } else {
          this.escapeTimer = setTimeout(() => { this.escapeCount = 0; }, 500);
        }
        return;
      }
      
      // Ctrl+Enter: Process/Send
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'chat') {
          const sendBtn = this.popup.querySelector('#chat-send');
          if (sendBtn) sendBtn.click();
        } else {
          const processBtn = this.popup.querySelector('#quickai-process');
          if (processBtn && !processBtn.disabled) processBtn.click();
        }
        return;
      }
      
      // Ctrl+Shift+Left/Right: Navigate output
      if (e.ctrlKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const direction = e.key === 'ArrowLeft' ? -1 : 1;
        if (mode === 'quick' && this.navigateOutput) {
          this.navigateOutput(direction);
        }
        return;
      }
      
      // F1 or Ctrl+?: Show shortcuts help
      if (e.key === 'F1' || (e.ctrlKey && e.shiftKey && e.key === '?')) {
        e.preventDefault();
        this.showShortcutsHelp();
        return;
      }
    });
  }

  openTemplates() {
    chrome.tabs.create({ url: chrome.runtime.getURL('templates.html') });
  }

  setupDraggable() {
    const header = this.popup.querySelector('#quickai-header');
    let isDragging = false, initialX, initialY;
    
    const dragStart = (e) => {
      if (e.target.closest('.quickai-close') || e.target.closest('.model-selector') || e.target.closest('select') || e.target.closest('button')) return;
      isDragging = true;
      initialX = e.clientX - this.popup.offsetLeft;
      initialY = e.clientY - this.popup.offsetTop;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    };
    
    const drag = (e) => {
      if (!isDragging || !this.popup) return;
      e.preventDefault();
      
      let x = e.clientX - initialX;
      let y = e.clientY - initialY;
      
      // Boundary detection during drag
      const rect = this.popup.getBoundingClientRect();
      const padding = 20;
      const maxX = window.innerWidth - rect.width - padding;
      const maxY = window.innerHeight - rect.height - padding;
      
      x = Math.max(padding, Math.min(x, maxX));
      y = Math.max(padding, Math.min(y, maxY));
      
      this.popup.style.left = x + 'px';
      this.popup.style.top = y + 'px';
    };
    
    const dragEnd = () => {
      if (isDragging && this.popup) {
        isDragging = false;
        header.style.cursor = 'grab';
        localStorage.setItem('quickai-popup-position', JSON.stringify({ 
          x: this.popup.offsetLeft, 
          y: this.popup.offsetTop 
        }));
      }
    };
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
  }

  setupResizable() {
    const handle = this.popup.querySelector('.quickai-resize-handle');
    let isResizing = false, startX, startY, startWidth, startHeight;
    
    const resizeStart = (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this.popup.offsetWidth;
      startHeight = this.popup.offsetHeight;
      e.preventDefault();
    };
    
    const resize = (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newWidth = startWidth + deltaX;
      const newHeight = startHeight + deltaY;
      
      // Min/max constraints with finer control
      const minWidth = 400;
      const maxWidth = window.innerWidth - this.popup.offsetLeft - 20;
      const minHeight = 300;
      const maxHeight = window.innerHeight - this.popup.offsetTop - 20;
      
      const width = Math.max(minWidth, Math.min(newWidth, maxWidth));
      const height = Math.max(minHeight, Math.min(newHeight, maxHeight));
      
      this.popup.style.width = width + 'px';
      this.popup.style.height = height + 'px';
    };
    
    const resizeEnd = () => {
      if (isResizing) {
        this.saveSize(this.popup.offsetWidth, this.popup.offsetHeight);
        isResizing = false;
      }
    };
    
    handle.addEventListener('mousedown', resizeStart);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', resizeEnd);
  }

  async restoreSize() {
    try {
      const { popupSize } = await chrome.storage.local.get('popupSize');
      if (popupSize) {
        this.popup.style.width = popupSize.width + 'px';
        this.popup.style.height = popupSize.height + 'px';
      }
    } catch (error) {
      console.error('Quick AI: Error restoring size:', error);
    }
  }

  async saveSize(width, height) {
    try {
      await chrome.storage.local.set({ popupSize: { width, height } });
    } catch (error) {
      console.error('Quick AI: Error saving size:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message, errorCode = null, persistent = false) {
    const errorDiv = this.popup.querySelector('#error-message');
    if (!errorDiv) return;
    
    // Parse error code and message
    let icon = '⚠️';
    let actionButton = '';
    
    if (message.includes('|')) {
      const [code, msg] = message.split('|');
      errorCode = code;
      message = msg;
      
      // Set icon based on error type
      if (code === 'INVALID_API_KEY' || code === 'API_KEY_MISSING') {
        icon = '❌';
        actionButton = '<button class="error-action-btn" onclick="chrome.runtime.sendMessage({action: \'openSettings\'});">Open Settings</button>';
        persistent = true;
      } else if (code === 'RATE_LIMIT' || code === 'QUOTA_EXCEEDED') {
        icon = '⏱️';
        persistent = true;
      } else if (code === 'CONTENT_BLOCKED') {
        icon = '🛡️';
      } else if (code === 'TOKEN_LIMIT') {
        icon = '📏';
      } else if (code === 'NETWORK_ERROR') {
        icon = '🌐';
        actionButton = '<button class="error-action-btn" onclick="document.querySelector(\'#quickai-process, #chat-send\')?.click();">Retry</button>';
      } else if (code === 'SERVER_ERROR') {
        icon = '⚠️';
        actionButton = '<button class="error-action-btn" onclick="document.querySelector(\'#quickai-process, #chat-send\')?.click();">Retry</button>';
      } else if (code === 'MODEL_NOT_FOUND') {
        icon = '🤖';
      }
    }
    
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">${icon}</span>
        <span class="error-text">${message}</span>
      </div>
      ${actionButton}
      ${errorCode ? `<div class="error-code">Error: ${errorCode}</div>` : ''}
    `;
    errorDiv.style.display = 'flex';
    
    if (!persistent) {
      setTimeout(() => this.hideError(), 5000);
    }
  }

  hideError() {
    const errorDiv = this.popup.querySelector('#error-message');
    if (errorDiv) errorDiv.style.display = 'none';
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `quickai-notification quickai-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 12px 20px; background: ${type === 'success' ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; animation: slideInRight 0.3s ease-out; font-size: 14px; font-weight: 500;`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }

  showShortcutsHelp() {
    const helpHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); padding: 24px; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); z-index: 10002; max-width: 500px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" id="shortcuts-help">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: rgba(0,0,0,0.9);">⌨️ Keyboard Shortcuts</h3>
        <div style="display: grid; gap: 8px; font-size: 13px; color: rgba(0,0,0,0.8);">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Activate Quick AI</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Alt+Q</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Activate Chat</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Alt+C</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Process / Send</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Enter</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Previous Output</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Shift+←</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Next Output</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Shift+→</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Undo</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Z</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Redo</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Y</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Navigate Elements</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Tab</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><span>Close Popup</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Esc Esc</kbd></div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span>Show This Help</span><kbd style="background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 4px; font-family: monospace;">F1</kbd></div>
        </div>
        <button onclick="document.getElementById('shortcuts-help').remove()" style="margin-top: 16px; width: 100%; padding: 8px; background: rgba(0,0,0,0.08); border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">Close</button>
      </div>
    `;
    const helpDiv = document.createElement('div');
    helpDiv.innerHTML = helpHTML;
    document.body.appendChild(helpDiv.firstElementChild);
  }

  closePopup() {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
      this.currentOutput = null;
    }
  }
}

// Initialize
new QuickAIContent();
