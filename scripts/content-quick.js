// Quick AI Mode - Text processing functionality
QuickAIContent.prototype.getPopupHTML = function (context) {
  return `
    <div class="quickai-header" id="quickai-header">
      <div class="header-left">
        <span class="header-icon">⚡</span>
        <span class="header-title">Quick AI</span>
      </div>
      <div class="header-center">
        <div class="layout-toggle">
          <button id="layout-input" class="layout-btn active" title="Focus Input">⬅️</button>
          <button id="layout-split" class="layout-btn" title="Split View">⬌</button>
          <button id="layout-output" class="layout-btn" title="Focus Output" disabled>➡️</button>
        </div>
        <select id="model-selector" class="model-selector" title="AI Model">
          <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
        </select>
      </div>
      <div class="header-right">
        <button id="save-prompt-btn" class="header-icon-btn" title="Templates">💾</button>
        <button id="quickai-settings" class="header-icon-btn" title="Settings">⚙️</button>
        <button class="quickai-close header-icon-btn">×</button>
      </div>
    </div>
    <div class="quickai-body">
      <div class="quickai-panels">
        <div class="input-panel">
          <div class="panel-section">
            <textarea id="quickai-input" placeholder="Enter or paste text...">${context.selectedText || ''}</textarea>
          </div>
          <div class="panel-section">
            <select id="quickai-template">
              <option value="custom">Custom Prompt</option>
              <option value="translate">Translate</option>
            </select>
          </div>
          <div class="panel-section custom-prompt-section">
            <textarea id="quickai-prompt" placeholder="Enter instruction..." ></textarea>
          </div>
          <div class="panel-section translate-section" style="display: none;">
            <select id="translate-language"></select>
          </div>
          <div class="panel-actions">
            <button id="quickai-undo" class="icon-btn-small" title="Undo" disabled>↶</button>
            <button id="quickai-redo" class="icon-btn-small" title="Redo" disabled>↷</button>
            <button id="quickai-process" class="btn-primary">Process</button>
          </div>
        </div>
        <div class="panel-divider" id="panel-divider" title="Drag to resize"></div>
        <div class="output-panel" id="output-panel">
          <div class="output-placeholder">
            <div class="placeholder-icon">✨</div>
            <div class="placeholder-text">Process text to see results</div>
          </div>
          <div class="output-content" style="display: none;">
            <div class="output-header">
              <div class="output-nav">
                <button id="output-prev" class="icon-btn-small" title="Previous" disabled>◀</button>
                <span id="output-position" class="output-position">1/1</span>
                <button id="output-next" class="icon-btn-small" title="Next" disabled>▶</button>
                <button id="output-edit" class="icon-btn-small" title="Edit">✏️</button>
              </div>
              <div class="output-actions-row">
                <button id="quickai-replace" class="action-btn" title="Replace selected text">↩️</button>
                <button id="quickai-insert" class="action-btn" title="Insert at cursor">⬇️</button>
                <button id="quickai-copy" class="action-btn" title="Copy to clipboard">📋</button>
                <button id="quickai-followup" class="action-btn" title="Refine result">💬</button>
              </div>
            </div>
            <div class="output-result" id="output-result"></div>
          </div>
        </div>
      </div>
      <div class="error-message" id="error-message" style="display: none;"></div>
    </div>
    <div class="quickai-resize-handle"></div>
  `;
};

QuickAIContent.prototype.setupQuickEvents = function (context) {
  this.outputHistory = [];
  this.outputHistoryIndex = -1;
  this.undoStack = [];
  this.redoStack = [];
  this.layoutMode = 'input-focus';
  this.splitRatio = 50;

  const templateSelect = this.popup.querySelector('#quickai-template');
  const customPrompt = this.popup.querySelector('.custom-prompt-section');
  const translateSection = this.popup.querySelector('.translate-section');
  if (templateSelect.value !== 'custom') customPrompt.style.display = 'none';
  this.loadLanguages();

  templateSelect.onchange = async () => {
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];
    if (templateSelect.value === 'translate') {
      customPrompt.style.display = 'none';
      translateSection.style.display = 'block';
      this.isTranslating = true;
    } else if (templateSelect.value === 'custom') {
      customPrompt.style.display = 'block';
      translateSection.style.display = 'none';
      this.isTranslating = false;
    } else {
      customPrompt.style.display = 'none';
      translateSection.style.display = 'none';
      this.isTranslating = false;
      if (selectedOption) this.popup.querySelector('#quickai-prompt').value = selectedOption.dataset.prompt || '';
    }
  };

  this.popup.querySelector('#quickai-process').onclick = () => this.processText(context);
  this.popup.querySelector('#quickai-replace').onclick = () => this.replaceText(context);
  this.popup.querySelector('#quickai-insert').onclick = () => this.insertText(context);
  this.popup.querySelector('#quickai-copy').onclick = () => this.copyText();
  this.popup.querySelector('#quickai-followup').onclick = () => this.showFollowup();
  this.popup.querySelector('#output-edit').onclick = () => this.toggleEditMode();
  this.popup.querySelector('#output-prev').onclick = () => this.navigateOutput(-1);
  this.popup.querySelector('#output-next').onclick = () => this.navigateOutput(1);
  this.popup.querySelector('#quickai-settings').onclick = () => {
    chrome.runtime.sendMessage({ action: 'openSettings' });
    this.closePopup();
  };
  this.popup.querySelector('#layout-input').onclick = () => this.setLayoutMode('input-focus');
  this.popup.querySelector('#layout-split').onclick = () => this.setLayoutMode('split-view');
  this.popup.querySelector('#layout-output').onclick = () => this.setLayoutMode('output-focus');
  this.setupPanelDivider();
  this.setupUndoRedo();
};

QuickAIContent.prototype.setupUndoRedo = function () {
  const undoBtn = this.popup.querySelector('#quickai-undo');
  const redoBtn = this.popup.querySelector('#quickai-redo');
  const input = this.popup.querySelector('#quickai-input');
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

QuickAIContent.prototype.loadTemplates = async function () {
  try {
    if (!chrome.storage || !chrome.storage.local) return;
    const { templates = [] } = await chrome.storage.local.get('templates');
    const select = this.popup.querySelector('#quickai-template');
    const sortedTemplates = [...templates].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    sortedTemplates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      option.dataset.prompt = template.prompt;
      option.dataset.systemInstruction = template.systemInstruction || '';
      select.appendChild(option);
    });
    this.templates = templates;
  } catch (error) {
    console.error('Quick AI: Error loading templates:', error);
  }
};

QuickAIContent.prototype.loadLanguages = async function () {
  try {
    const { translationLanguages = [] } = await chrome.storage.local.get('translationLanguages');
    const langSelect = this.popup.querySelector('#translate-language');
    if (!langSelect) return;
    this.translationLanguages = translationLanguages;
    const sortedLangs = [...translationLanguages].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    langSelect.innerHTML = sortedLangs.map(l => `<option value="${l.id}"${l.isDefault ? ' selected' : ''}>${l.name}${l.isDefault ? ' ⭐' : ''}</option>`).join('') + '<option value="__add_new__">+ Add New Language</option>';
    this.selectedLanguageId = langSelect.value;
    langSelect.addEventListener('change', this.handleLanguageChange.bind(this));
  } catch (error) {
    console.error('Quick AI: Error loading languages:', error);
  }
};

QuickAIContent.prototype.handleLanguageChange = async function (e) {
  const langSelect = e.target;
  const selectedValue = langSelect.value;
  if (selectedValue === '__add_new__') {
    langSelect.value = this.selectedLanguageId;
    this.showAddLanguageForm();
    return;
  }
  this.selectedLanguageId = selectedValue;
  this.hideAddLanguageForm();
  const lang = this.translationLanguages.find(l => l.id === selectedValue);
  if (lang) {
    lang.lastUsed = Date.now();
    await chrome.storage.local.set({ translationLanguages: this.translationLanguages });
  }
};

QuickAIContent.prototype.showAddLanguageForm = function () {
  const translateSection = this.popup.querySelector('.translate-section');
  if (translateSection.querySelector('.add-language-form')) return;
  const formHTML = `<div class="add-language-form"><input type="text" id="new-lang-name" placeholder="Language name (e.g., Hindi)" /><textarea id="new-lang-instruction" placeholder="System instruction (e.g., Use formal tone)" rows="2"></textarea><div class="form-actions"><button id="add-lang-btn" class="btn-primary">Add</button><button id="cancel-lang-btn" class="btn-secondary">Cancel</button></div></div>`;
  translateSection.insertAdjacentHTML('beforeend', formHTML);
  this.popup.querySelector('#add-lang-btn').onclick = () => this.addNewLanguage();
  this.popup.querySelector('#cancel-lang-btn').onclick = () => this.hideAddLanguageForm();
  this.popup.querySelector('#new-lang-name').focus();
};

QuickAIContent.prototype.hideAddLanguageForm = function () {
  const form = this.popup.querySelector('.add-language-form');
  if (form) form.remove();
  const langSelect = this.popup.querySelector('#translate-language');
  if (langSelect && this.selectedLanguageId) langSelect.value = this.selectedLanguageId;
};

QuickAIContent.prototype.addNewLanguage = async function () {
  const nameInput = this.popup.querySelector('#new-lang-name');
  const instructionInput = this.popup.querySelector('#new-lang-instruction');
  const name = nameInput.value.trim();
  const instruction = instructionInput.value.trim() || 'Translate naturally and accurately';
  if (!name) {
    this.showError('Please enter a language name');
    return;
  }
  const exists = this.translationLanguages.find(l => l.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    this.showError('Language already exists');
    return;
  }
  const newLang = { id: 'lang-' + Date.now(), name, isDefault: false, instruction, lastUsed: Date.now(), createdAt: Date.now() };
  this.translationLanguages.push(newLang);
  await chrome.storage.local.set({ translationLanguages: this.translationLanguages });
  const langSelect = this.popup.querySelector('#translate-language');
  langSelect.removeEventListener('change', this.handleLanguageChange);
  await this.loadLanguages();
  langSelect.value = newLang.id;
  this.selectedLanguageId = newLang.id;
  this.hideAddLanguageForm();
  this.showNotification(`Added ${name}!`, 'success');
};

QuickAIContent.prototype.processText = async function (context) {
  const input = this.popup.querySelector('#quickai-input').value;
  const templateSelect = this.popup.querySelector('#quickai-template');
  const customPrompt = this.popup.querySelector('#quickai-prompt').value;
  const selectedOption = templateSelect.options[templateSelect.selectedIndex];
  if (!input.trim()) {
    this.showError('Please enter some text to process');
    return;
  }
  let prompt = 'Improve the following text:';
  let systemInstruction = null;
  if (this.isTranslating) {
    const langSelect = this.popup.querySelector('#translate-language');
    if (!langSelect || !langSelect.value) {
      this.showError('Please select a language');
      return;
    }
    const lang = this.translationLanguages.find(l => l.id === langSelect.value);
    if (!lang) {
      this.showError('Language not found');
      return;
    }
    prompt = `Translate to ${lang.name}. Return ONLY the translation:`;
    systemInstruction = lang.instruction;
    lang.lastUsed = Date.now();
    await chrome.storage.local.set({ translationLanguages: this.translationLanguages });
  } else if (templateSelect.value === 'custom') {
    if (!customPrompt.trim()) {
      this.showError('Please enter a custom instruction');
      return;
    }
    prompt = customPrompt;
  } else {
    if (selectedOption) {
      prompt = selectedOption.dataset.prompt;
      systemInstruction = selectedOption.dataset.systemInstruction || null;
    }
  }
  const processBtn = this.popup.querySelector('#quickai-process');
  const originalText = processBtn.innerHTML;
  processBtn.innerHTML = '<span class="quickai-loading"></span>Processing...';
  processBtn.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'callGemini', prompt, text: input, systemInstruction, model: this.currentModel });
    if (response.success) {
      this.showOutput(response.data);
      this.hideError();
      
      // Save to Quick AI history with timeline
      const templateName = this.isTranslating ? 'Translate' : (templateSelect.value === 'custom' ? 'Custom' : selectedOption?.textContent || 'Unknown');
      const historyResponse = await chrome.runtime.sendMessage({
        action: 'saveQuickHistory',
        data: {
          originalText: input,
          prompt,
          output: response.data,
          template: templateName,
          pageUrl: window.location.href,
          model: this.currentModel,
          timeline: [{
            step: 1,
            type: 'process',
            output: response.data,
            timestamp: Date.now()
          }]
        }
      });
      this.lastHistoryId = historyResponse?.id;
    } else {
      this.showError(response.error || 'Error processing text. Please try again.');
    }
  } catch (error) {
    console.error('Quick AI Content Script Error:', error);
    this.showError(error.message || 'Failed to process text. Check your connection.');
  } finally {
    processBtn.innerHTML = originalText;
    processBtn.disabled = false;
  }
};

QuickAIContent.prototype.showOutput = function (result) {
  const outputPanel = this.popup.querySelector('#output-panel');
  const placeholder = outputPanel.querySelector('.output-placeholder');
  const content = outputPanel.querySelector('.output-content');
  const resultDiv = this.popup.querySelector('#output-result');
  this.outputHistory.push(result);
  this.outputHistoryIndex = this.outputHistory.length - 1;
  this.currentOutput = result;
  this.isEditMode = false;
  
  // Render markdown
  resultDiv.innerHTML = this.renderMarkdown(result);
  
  // Add copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'output-copy-btn';
  copyBtn.innerHTML = '📋';
  copyBtn.title = 'Copy text';
  copyBtn.onclick = () => this.copyOutput();
  resultDiv.appendChild(copyBtn);
  
  placeholder.style.display = 'none';
  content.style.display = 'block';
  this.updateOutputNavigation();
  this.setLayoutMode('split-view', true);
};

QuickAIContent.prototype.setLayoutMode = function (mode) {
  this.layoutMode = mode;
  const body = this.popup.querySelector('.quickai-body');
  const inputPanel = this.popup.querySelector('.input-panel');
  const outputPanel = this.popup.querySelector('.output-panel');
  inputPanel.removeAttribute('style');
  outputPanel.removeAttribute('style');
  body.classList.remove('layout-input-focus', 'layout-split-view', 'layout-output-focus');
  body.classList.add(`layout-${mode}`);
  if (mode === 'split-view') this.restorePanelRatio();
  this.popup.querySelectorAll('.layout-btn').forEach(btn => btn.classList.remove('active'));
  this.popup.querySelector(`#layout-${mode.split('-')[0]}`).classList.add('active');
  const outputBtn = this.popup.querySelector('#layout-output');
  outputBtn.disabled = !this.currentOutput;
};

QuickAIContent.prototype.restorePanelRatio = async function () {
  try {
    const { panelSplitRatio } = await chrome.storage.local.get('panelSplitRatio');
    const ratio = panelSplitRatio || 50;
    this.splitRatio = ratio;
    const inputPanel = this.popup.querySelector('.input-panel');
    const outputPanel = this.popup.querySelector('.output-panel');
    const divider = this.popup.querySelector('#panel-divider');
    if (inputPanel && outputPanel && divider) {
      const dividerWidth = 10;
      inputPanel.style.flex = `0 0 calc(${ratio}% - ${dividerWidth * ratio / 100}px)`;
      outputPanel.style.flex = `0 0 calc(${100 - ratio}% - ${dividerWidth * (100 - ratio) / 100}px)`;
    }
  } catch (error) {
    console.error('Quick AI: Error restoring panel ratio:', error);
  }
};

QuickAIContent.prototype.setupPanelDivider = function () {
  const divider = this.popup.querySelector('#panel-divider');
  if (!divider) return;
  const inputPanel = this.popup.querySelector('.input-panel');
  const outputPanel = this.popup.querySelector('.output-panel');
  let isResizing = false, startX, startInputWidth, containerWidth;
  
  const resizeStart = (e) => {
    if (this.layoutMode !== 'split-view') return;
    isResizing = true;
    startX = e.clientX;
    startInputWidth = inputPanel.offsetWidth;
    containerWidth = inputPanel.parentElement.offsetWidth;
    divider.style.background = 'rgba(0, 0, 0, 0.1)';
    divider.style.cursor = 'col-resize';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };
  
  const resize = (e) => {
    if (!isResizing) return;
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    const newInputWidth = startInputWidth + deltaX;
    const dividerWidth = 10;
    const minWidth = containerWidth * 0.2;
    const maxWidth = containerWidth * 0.8;
    
    if (newInputWidth >= minWidth && newInputWidth <= maxWidth) {
      const inputPercent = (newInputWidth / containerWidth) * 100;
      const outputPercent = 100 - inputPercent;
      inputPanel.style.flex = `0 0 calc(${inputPercent}% - ${dividerWidth * inputPercent / 100}px)`;
      outputPanel.style.flex = `0 0 calc(${outputPercent}% - ${dividerWidth * outputPercent / 100}px)`;
      this.splitRatio = inputPercent;
    }
  };
  
  const resizeEnd = async () => {
    if (isResizing) {
      isResizing = false;
      divider.style.background = '';
      divider.style.cursor = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      await chrome.storage.local.set({ panelSplitRatio: this.splitRatio });
    }
  };
  
  divider.addEventListener('mousedown', resizeStart);
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', resizeEnd);
  
  divider.addEventListener('dblclick', async () => {
    if (this.layoutMode !== 'split-view') return;
    const dividerWidth = 10;
    inputPanel.style.flex = `0 0 calc(50% - ${dividerWidth / 2}px)`;
    outputPanel.style.flex = `0 0 calc(50% - ${dividerWidth / 2}px)`;
    this.splitRatio = 50;
    await chrome.storage.local.set({ panelSplitRatio: 50 });
  });
};

QuickAIContent.prototype.navigateOutput = function (direction) {
  const newIndex = this.outputHistoryIndex + direction;
  if (newIndex < 0 || newIndex >= this.outputHistory.length) return;
  this.outputHistoryIndex = newIndex;
  this.currentOutput = this.outputHistory[newIndex];
  this.isEditMode = false;
  const resultDiv = this.popup.querySelector('#output-result');
  
  // Remove old copy button
  const oldCopyBtn = resultDiv.querySelector('.output-copy-btn');
  if (oldCopyBtn) oldCopyBtn.remove();
  
  // Render markdown
  resultDiv.innerHTML = this.renderMarkdown(this.currentOutput);
  resultDiv.contentEditable = 'false';
  resultDiv.classList.remove('editing');
  
  // Add copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'output-copy-btn';
  copyBtn.innerHTML = '📋';
  copyBtn.title = 'Copy text';
  copyBtn.onclick = () => this.copyOutput();
  resultDiv.appendChild(copyBtn);
  
  // Reset edit button
  const editBtn = this.popup.querySelector('#output-edit');
  if (editBtn) {
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
  }
  
  this.updateOutputNavigation();
};

QuickAIContent.prototype.updateOutputNavigation = function () {
  const prevBtn = this.popup.querySelector('#output-prev');
  const nextBtn = this.popup.querySelector('#output-next');
  const positionSpan = this.popup.querySelector('#output-position');
  if (prevBtn && nextBtn && positionSpan) {
    prevBtn.disabled = this.outputHistoryIndex <= 0;
    nextBtn.disabled = this.outputHistoryIndex >= this.outputHistory.length - 1;
    positionSpan.textContent = `${this.outputHistoryIndex + 1}/${this.outputHistory.length}`;
  }
};

QuickAIContent.prototype.toggleEditMode = function () {
  const resultDiv = this.popup.querySelector('#output-result');
  const editBtn = this.popup.querySelector('#output-edit');
  const copyBtn = resultDiv.querySelector('.output-copy-btn');
  
  if (this.isEditMode) {
    // Save: Switch from markdown source to rendered
    this.currentOutput = resultDiv.value;
    resultDiv.remove();
    
    // Create new div with rendered markdown
    const newResultDiv = document.createElement('div');
    newResultDiv.id = 'output-result';
    newResultDiv.className = 'output-result';
    newResultDiv.innerHTML = this.renderMarkdown(this.currentOutput);
    
    // Add copy button
    const newCopyBtn = document.createElement('button');
    newCopyBtn.className = 'output-copy-btn';
    newCopyBtn.innerHTML = '📋';
    newCopyBtn.title = 'Copy text';
    newCopyBtn.onclick = () => this.copyOutput();
    newResultDiv.appendChild(newCopyBtn);
    
    this.popup.querySelector('.output-content').insertBefore(newResultDiv, this.popup.querySelector('.output-content').children[1]);
    
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    this.isEditMode = false;
  } else {
    // Edit: Switch from rendered to markdown source
    if (copyBtn) copyBtn.remove();
    const markdown = this.currentOutput;
    resultDiv.remove();
    
    // Create textarea with markdown source
    const textarea = document.createElement('textarea');
    textarea.id = 'output-result';
    textarea.className = 'output-result editing';
    textarea.value = markdown;
    
    // Add copy button for markdown
    const newCopyBtn = document.createElement('button');
    newCopyBtn.className = 'output-copy-btn';
    newCopyBtn.innerHTML = '📋';
    newCopyBtn.title = 'Copy markdown';
    newCopyBtn.onclick = () => this.copyOutput();
    textarea.parentNode = this.popup.querySelector('.output-content');
    
    this.popup.querySelector('.output-content').insertBefore(textarea, this.popup.querySelector('.output-content').children[1]);
    textarea.appendChild(newCopyBtn);
    textarea.focus();
    
    editBtn.textContent = '✓';
    editBtn.title = 'Save';
    this.isEditMode = true;
  }
};

QuickAIContent.prototype.showFollowup = function () {
  const outputContent = this.popup.querySelector('.output-content');
  if (outputContent.querySelector('.followup-section')) return;
  const followupHTML = `<div class="followup-section"><textarea id="followup-input" placeholder="Refine the result... (e.g., 'make it shorter', 'add examples')" rows="2"></textarea><div class="followup-actions"><button id="followup-send" class="btn-primary">Send</button><button id="followup-cancel" class="btn-secondary">Cancel</button></div></div>`;
  outputContent.insertAdjacentHTML('beforeend', followupHTML);
  const followupInput = outputContent.querySelector('#followup-input');
  followupInput.focus();
  outputContent.querySelector('#followup-send').onclick = () => this.sendFollowup();
  outputContent.querySelector('#followup-cancel').onclick = () => { outputContent.querySelector('.followup-section').remove(); };
};

QuickAIContent.prototype.sendFollowup = async function () {
  const followupInput = this.popup.querySelector('#followup-input');
  const followupText = followupInput.value.trim();
  if (!followupText) return;
  const originalInput = this.popup.querySelector('#quickai-input').value;
  const currentOutput = this.currentOutput;
  const sendBtn = this.popup.querySelector('#followup-send');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Processing...';
  try {
    const response = await chrome.runtime.sendMessage({ action: 'callGemini', prompt: `Original input: ${originalInput}\n\nCurrent output: ${currentOutput}\n\nUser request: ${followupText}\n\nProvide the refined output:`, text: '', model: this.currentModel });
    if (response.success) {
      this.showOutput(response.data);
      this.popup.querySelector('.followup-section').remove();
      this.hideError();
      
      // Add to timeline
      if (this.lastHistoryId) {
        await chrome.runtime.sendMessage({
          action: 'addQuickTimeline',
          id: this.lastHistoryId,
          step: {
            type: 'followup',
            prompt: followupText,
            output: response.data,
            timestamp: Date.now()
          }
        });
      }
    } else {
      this.showError('Failed to process follow-up');
    }
  } catch (error) {
    this.showError(error.message || 'Failed to process follow-up');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
};

QuickAIContent.prototype.replaceText = async function (context) {
  if (!this.currentOutput) return;

  // Get text to insert based on edit mode
  const textToInsert = this.isEditMode ? this.currentOutput : (this.popup.querySelector('#output-result').innerText || this.popup.querySelector('#output-result').textContent);

  // Copy original + result to clipboard
  const originalText = context.selectedText || '';
  this.copyBothTexts(originalText, textToInsert);

  if (context.isEditable && context.activeElement) {
    const element = context.activeElement;
    if (context.hasSelection) {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const value = element.value || element.textContent;
      const newValue = value.substring(0, start) + textToInsert + value.substring(end);
      if (element.value !== undefined) element.value = newValue;
      else element.textContent = newValue;
    } else {
      if (element.value !== undefined) element.value = textToInsert;
      else element.textContent = textToInsert;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Update history with action
  if (this.lastHistoryId) {
    await chrome.runtime.sendMessage({
      action: 'addQuickTimeline',
      id: this.lastHistoryId,
      step: { type: 'replace', timestamp: Date.now() }
    });
  }
  
  this.closePopup();
};

QuickAIContent.prototype.insertText = async function (context) {
  if (!this.currentOutput) return;

  // Get text to insert based on edit mode
  const textToInsert = this.isEditMode ? this.currentOutput : (this.popup.querySelector('#output-result').innerText || this.popup.querySelector('#output-result').textContent);

  // Copy original + result to clipboard
  const originalText = context.selectedText || '';
  this.copyBothTexts(originalText, textToInsert);

  if (context.isEditable && context.activeElement) {
    const element = context.activeElement;
    const cursorPos = element.selectionStart || 0;
    const value = element.value || element.textContent || '';
    const newValue = value.substring(0, cursorPos) + textToInsert + value.substring(cursorPos);
    if (element.value !== undefined) element.value = newValue;
    else element.textContent = newValue;
    const newPos = cursorPos + textToInsert.length;
    element.setSelectionRange(newPos, newPos);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Update history with action
  if (this.lastHistoryId) {
    await chrome.runtime.sendMessage({
      action: 'addQuickTimeline',
      id: this.lastHistoryId,
      step: { type: 'insert', timestamp: Date.now() }
    });
  }
  
  this.closePopup();
};

QuickAIContent.prototype.copyOutput = async function () {
  const resultDiv = this.popup.querySelector('#output-result');
  const copyBtn = resultDiv.querySelector('.output-copy-btn');
  
  try {
    if (this.isEditMode) {
      // Copy markdown source
      await navigator.clipboard.writeText(resultDiv.value);
      this.showNotification('📋 Copied markdown', 'success');
    } else {
      // Copy rendered plain text
      const plainText = resultDiv.innerText || resultDiv.textContent;
      await navigator.clipboard.writeText(plainText);
      this.showNotification('📋 Copied text', 'success');
    }
    
    if (copyBtn) {
      copyBtn.innerHTML = '✓';
      setTimeout(() => copyBtn.innerHTML = '📋', 1500);
    }
  } catch (error) {
    this.showNotification('Failed to copy', 'error');
  }
};

QuickAIContent.prototype.copyText = async function () {
  if (!this.currentOutput) return;
  await this.copyOutput();
  
  // Update history with action
  if (this.lastHistoryId) {
    await chrome.runtime.sendMessage({
      action: 'addQuickTimeline',
      id: this.lastHistoryId,
      step: { type: 'copy', timestamp: Date.now() }
    });
  }
};

QuickAIContent.prototype.copyBothTexts = async function (original, result) {
  try {
    await navigator.clipboard.writeText(original);
    setTimeout(async () => {
      await navigator.clipboard.writeText(result);
      this.showNotification('📋 Copied: Original → Result', 'success');
    }, 100);
  } catch (error) {
    console.error('Copy failed:', error);
  }
};
