// Chat AI Mode - Conversational functionality
QuickAIContent.prototype.getChatHTML = function(context) {
  return `
    <div class="quickai-header" id="quickai-header">
      <h3>💬 Chat Mode <span class="shortcut-hint">Alt+C</span></h3>
      <div class="header-controls">
        <select id="model-selector" class="model-selector" title="AI Model">
          <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
        </select>
        <button class="quickai-close">×</button>
      </div>
    </div>
    <div class="quickai-content chat-mode">
      <div class="quickai-chat-messages" id="chat-messages">
        ${context.selectedText ? `<div class="chat-context">📌 Context: ${this.escapeHtml(context.selectedText.substring(0, 200))}${context.selectedText.length > 200 ? '...' : ''}</div>` : ''}
      </div>
      <div class="quickai-chat-input">
        <textarea id="chat-input" placeholder="Ask anything... (Enter to send, Shift+Enter for new line)" rows="2"></textarea>
        <div class="chat-actions">
          <button id="chat-undo" class="icon-btn" title="Undo (Ctrl+Z)" disabled>↶</button>
          <button id="chat-redo" class="icon-btn" title="Redo (Ctrl+Y)" disabled>↷</button>
          <button id="chat-send" class="primary">Send</button>
          <button id="chat-clear" class="secondary">Clear</button>
          <button id="save-prompt-btn" class="icon-btn" title="Save as Template">💾</button>
        </div>
      </div>
      <div class="error-message" id="error-message" style="display: none;"></div>
    </div>
    <div class="quickai-resize-handle"></div>
  `;
};

QuickAIContent.prototype.setupChatEvents = function(context) {
  this.chatHistory = [];
  this.undoStack = [];
  this.redoStack = [];
  this.currentChatId = null;
  
  const sendBtn = this.popup.querySelector('#chat-send');
  const clearBtn = this.popup.querySelector('#chat-clear');
  const input = this.popup.querySelector('#chat-input');
  
  sendBtn.onclick = () => this.sendChatMessage(context);
  clearBtn.onclick = () => this.clearChat();
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendChatMessage(context);
    }
  });
  
  this.setupChatUndoRedo();
};

QuickAIContent.prototype.setupChatUndoRedo = function() {
  const undoBtn = this.popup.querySelector('#chat-undo');
  const redoBtn = this.popup.querySelector('#chat-redo');
  const input = this.popup.querySelector('#chat-input');
  if (!input) return;
  
  let lastValue = input.value;
  input.addEventListener('input', () => {
    if (input.value !== lastValue) {
      this.undoStack.push(lastValue);
      this.redoStack = [];
      lastValue = input.value;
      undoBtn.disabled = false;
      redoBtn.disabled = true;
    }
  });
  
  undoBtn.onclick = () => {
    if (this.undoStack.length > 0) {
      this.redoStack.push(input.value);
      input.value = this.undoStack.pop();
      lastValue = input.value;
      undoBtn.disabled = this.undoStack.length === 0;
      redoBtn.disabled = false;
    }
  };
  
  redoBtn.onclick = () => {
    if (this.redoStack.length > 0) {
      this.undoStack.push(input.value);
      input.value = this.redoStack.pop();
      lastValue = input.value;
      redoBtn.disabled = this.redoStack.length === 0;
      undoBtn.disabled = false;
    }
  };
  
  this.popup.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoBtn.click();
    } else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redoBtn.click();
    }
  });
};

QuickAIContent.prototype.sendChatMessage = async function(context) {
  const input = this.popup.querySelector('#chat-input');
  const message = input.value.trim();
  if (!message) return;
  
  this.addChatMessage('user', message);
  input.value = '';
  this.undoStack = [];
  this.redoStack = [];
  this.popup.querySelector('#chat-undo').disabled = true;
  this.popup.querySelector('#chat-redo').disabled = true;
  
  const messagesDiv = this.popup.querySelector('#chat-messages');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message assistant loading';
  loadingDiv.innerHTML = '<span class="quickai-loading"></span>Thinking...';
  messagesDiv.appendChild(loadingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  try {
    // Build conversation history for context
    const conversationHistory = this.chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    const contextText = context.selectedText ? `[Page Context]: ${context.selectedText}\n\n` : '';
    const fullPrompt = `${contextText}${conversationHistory}\nuser: ${message}`;
    
    const response = await chrome.runtime.sendMessage({
      action: 'callGemini',
      prompt: 'Continue this conversation naturally. Respond only as the assistant:',
      text: fullPrompt,
      systemInstruction: 'You are a helpful AI assistant. Be concise and conversational.',
      model: this.currentModel
    });
    
    loadingDiv.remove();
    if (response.success) {
      this.addChatMessage('assistant', response.data);
      this.hideError();
      
      // Save/update chat history after each message
      const firstUserMsg = this.chatHistory.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.content.substring(0, 50) : 'Chat';
      
      const historyResponse = await chrome.runtime.sendMessage({
        action: this.currentChatId ? 'updateChatHistory' : 'saveChatHistory',
        id: this.currentChatId,
        data: {
          title,
          messages: this.chatHistory,
          pageUrl: window.location.href,
          model: this.currentModel
        }
      });
      
      if (!this.currentChatId && historyResponse?.id) {
        this.currentChatId = historyResponse.id;
      }
    } else {
      this.showError(response.error || 'Failed to get response. Please try again.');
    }
  } catch (error) {
    loadingDiv.remove();
    this.showError(error.message || 'Network error. Check your connection.');
  }
};

QuickAIContent.prototype.addChatMessage = function(role, content) {
  const timestamp = Date.now();
  this.chatHistory.push({ role, content, timestamp });
  const messagesDiv = this.popup.querySelector('#chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  
  if (role === 'assistant') {
    messageDiv.innerHTML = this.renderMarkdown(content);
    
    // Add copy button for assistant messages
    const copyBtn = document.createElement('button');
    copyBtn.className = 'chat-copy-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = 'Copy message';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.innerHTML = '✓';
        setTimeout(() => copyBtn.innerHTML = '📋', 1500);
      });
    };
    messageDiv.appendChild(copyBtn);
  } else {
    messageDiv.textContent = content;
  }
  
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

QuickAIContent.prototype.renderMarkdown = function(text) {
  // Configure marked.js options
  marked.setOptions({
    breaks: true,        // Convert \n to <br>
    gfm: true,          // GitHub Flavored Markdown
    headerIds: false,   // Don't add IDs to headers
    mangle: false,      // Don't escape email addresses
    sanitize: false     // We trust Gemini API output
  });
  
  return marked.parse(text);
};

QuickAIContent.prototype.toggleChatEdit = function(messageDiv) {
  const isEditMode = messageDiv.dataset.isEditMode === 'true';
  const editBtn = messageDiv.querySelector('.chat-edit-btn');
  const copyBtn = messageDiv.querySelector('.chat-copy-btn');
  const markdown = messageDiv.dataset.markdown;
  
  if (isEditMode) {
    // Save: Switch from markdown source to rendered
    const textarea = messageDiv.querySelector('textarea');
    const newMarkdown = textarea.value;
    messageDiv.dataset.markdown = newMarkdown;
    
    // Remove textarea and buttons
    textarea.remove();
    editBtn.remove();
    copyBtn.remove();
    
    // Render markdown
    messageDiv.innerHTML = this.renderMarkdown(newMarkdown);
    messageDiv.classList.remove('editing');
    messageDiv.dataset.isEditMode = 'false';
    
    // Re-add buttons
    const newEditBtn = document.createElement('button');
    newEditBtn.className = 'chat-edit-btn';
    newEditBtn.innerHTML = '✏️';
    newEditBtn.title = 'Edit';
    newEditBtn.onclick = () => this.toggleChatEdit(messageDiv);
    messageDiv.appendChild(newEditBtn);
    
    const newCopyBtn = document.createElement('button');
    newCopyBtn.className = 'chat-copy-btn';
    newCopyBtn.innerHTML = '📋';
    newCopyBtn.title = 'Copy text';
    newCopyBtn.onclick = () => this.copyChatMessage(messageDiv);
    messageDiv.appendChild(newCopyBtn);
  } else {
    // Edit: Switch from rendered to markdown source
    const renderedContent = messageDiv.innerHTML;
    messageDiv.innerHTML = '';
    
    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'chat-edit-textarea';
    textarea.value = markdown;
    messageDiv.appendChild(textarea);
    messageDiv.classList.add('editing');
    messageDiv.dataset.isEditMode = 'true';
    
    // Update buttons
    editBtn.innerHTML = '✓';
    editBtn.title = 'Save';
    copyBtn.title = 'Copy markdown';
    
    messageDiv.appendChild(editBtn);
    messageDiv.appendChild(copyBtn);
    textarea.focus();
  }
};

QuickAIContent.prototype.copyChatMessage = async function(messageDiv) {
  const isEditMode = messageDiv.dataset.isEditMode === 'true';
  const copyBtn = messageDiv.querySelector('.chat-copy-btn');
  
  try {
    if (isEditMode) {
      // Copy markdown source
      const textarea = messageDiv.querySelector('textarea');
      await navigator.clipboard.writeText(textarea.value);
    } else {
      // Copy rendered plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = messageDiv.innerHTML;
      tempDiv.querySelectorAll('.chat-copy-btn, .chat-edit-btn').forEach(btn => btn.remove());
      const plainText = tempDiv.innerText || tempDiv.textContent;
      await navigator.clipboard.writeText(plainText);
    }
    
    if (copyBtn) {
      copyBtn.innerHTML = '✓';
      setTimeout(() => copyBtn.innerHTML = '📋', 1500);
    }
  } catch (error) {
    console.error('Copy failed:', error);
  }
};

QuickAIContent.prototype.clearChat = async function() {
  // Save chat history before clearing (only if has messages)
  if (this.chatHistory.length > 0 && !this.currentChatId) {
    const firstUserMsg = this.chatHistory.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.substring(0, 50) : 'Chat';
    
    await chrome.runtime.sendMessage({
      action: 'saveChatHistory',
      data: {
        title,
        messages: this.chatHistory.map(m => ({ ...m, timestamp: m.timestamp || Date.now() })),
        pageUrl: window.location.href,
        model: this.currentModel
      }
    });
  }
  
  this.chatHistory = [];
  this.currentChatId = null;
  const messagesDiv = this.popup.querySelector('#chat-messages');
  const context = messagesDiv.querySelector('.chat-context');
  messagesDiv.innerHTML = '';
  if (context) messagesDiv.appendChild(context);
};
