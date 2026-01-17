// Background service worker
class QuickAI {
  constructor() {
    this.setupEventListeners();
    this.initializeDefaults();
  }

  setupEventListeners() {
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'activate-quickai') {
        this.activateQuickAI();
      } else if (command === 'activate-chat') {
        this.activateChat();
      }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async initializeDefaults() {
    const storage = await chrome.storage.local.get();
    
    if (!storage.templates) {
      await this.setupDefaultTemplates();
    }
    
    if (!storage.translationLanguages) {
      await this.setupDefaultLanguages();
    }
    
    if (!storage.settings) {
      await this.setupDefaultSettings();
    } else {
      const oldModels = ['gemini-pro', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-2.5-flash-8b'];
      if (oldModels.includes(storage.settings.selectedModel)) {
        storage.settings.selectedModel = 'gemini-2.5-flash';
        await chrome.storage.local.set({ settings: storage.settings });
        console.log('Quick AI: Migrated old model to gemini-2.5-flash');
      }
    }
  }

  async setupDefaultTemplates() {
    const defaultTemplates = [
      {
        id: 'grammar-fix',
        name: 'Grammar Fix',
        prompt: 'Fix grammar and spelling errors. Return ONLY the corrected text without explanations or markdown formatting:',
        category: 'editing',
        systemInstruction: 'You are a grammar correction assistant. Return only the corrected text, no explanations, no markdown, no formatting.',
        lastUsed: 0
      },
      {
        id: 'summarize',
        name: 'Summarize',
        prompt: 'Provide a concise summary:',
        category: 'analysis',
        systemInstruction: 'You are a summarization assistant. Provide clear, concise summaries without markdown formatting.',
        lastUsed: 0
      },
      {
        id: 'email-professional',
        name: 'Professional Email',
        prompt: 'Rewrite as a professional email:',
        category: 'communication',
        systemInstruction: 'You are an email writing assistant. Write professional emails without markdown formatting.',
        lastUsed: 0
      },
      {
        id: 'make-shorter',
        name: 'Make Shorter',
        prompt: 'Make this text shorter while keeping the key points:',
        category: 'editing',
        systemInstruction: 'Condense text to essential information only.',
        lastUsed: 0
      },
      {
        id: 'make-longer',
        name: 'Make Longer',
        prompt: 'Expand this text with more details and examples:',
        category: 'editing',
        systemInstruction: 'Add relevant details and examples to expand the content.',
        lastUsed: 0
      },
      {
        id: 'change-tone-formal',
        name: 'Formal Tone',
        prompt: 'Rewrite in a formal, professional tone:',
        category: 'style',
        systemInstruction: 'Use formal language, avoid contractions and casual expressions.',
        lastUsed: 0
      },
      {
        id: 'change-tone-casual',
        name: 'Casual Tone',
        prompt: 'Rewrite in a casual, friendly tone:',
        category: 'style',
        systemInstruction: 'Use conversational language, contractions are fine.',
        lastUsed: 0
      },
      {
        id: 'simplify',
        name: 'Simplify',
        prompt: 'Simplify this text for easier understanding:',
        category: 'editing',
        systemInstruction: 'Use simple words and short sentences.',
        lastUsed: 0
      },
      {
        id: 'add-emojis',
        name: 'Add Emojis',
        prompt: 'Add relevant emojis to make the text more engaging:',
        category: 'style',
        systemInstruction: 'Add emojis naturally without overdoing it.',
        lastUsed: 0
      }
    ];

    await chrome.storage.local.set({ templates: defaultTemplates });
  }

  async setupDefaultLanguages() {
    const defaultLanguages = [
      { id: 'lang-1', name: 'English', isDefault: true, instruction: 'Translate naturally and accurately', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-2', name: 'Spanish', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-3', name: 'French', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-4', name: 'German', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-5', name: 'Hindi', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-6', name: 'Arabic', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-7', name: 'Chinese', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() },
      { id: 'lang-8', name: 'Japanese', isDefault: false, instruction: 'Use formal tone', lastUsed: 0, createdAt: Date.now() }
    ];

    await chrome.storage.local.set({ translationLanguages: defaultLanguages });
  }

  async setupDefaultSettings() {
    const defaultSettings = {
      shortcuts: { main: 'Ctrl+Shift+I' },
      shortcut: 'Ctrl+Shift+I',
      popupPosition: { type: 'cursor' },
      autoActions: [],
      responseLength: 'normal',
      selectedModel: 'gemini-2.5-flash',
      theme: 'light',
      defaultTask: 'grammar-fix',
      defaultStyle: 'professional'
    };

    await chrome.storage.local.set({
      settings: defaultSettings,
      tasks: [],
      memories: {},
      history: [],
      favorites: [],
      savedPrompts: []
    });
  }

  async activateQuickAI() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'activate', mode: 'quick' });
  }

  async activateChat() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'activate', mode: 'chat' });
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'callGemini':
        try {
          const response = await this.callGeminiAPI(request.prompt, request.text, request.systemInstruction, request.model);
          sendResponse({ success: true, data: response });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      case 'saveQuickHistory':
        const quickId = await this.saveQuickHistory(request.data);
        sendResponse({ success: true, id: quickId });
        break;
      case 'addQuickTimeline':
        await this.addQuickTimeline(request.id, request.step);
        sendResponse({ success: true });
        break;
      case 'updateQuickHistory':
        await this.updateQuickHistory(request.id, request.output, request.action);
        sendResponse({ success: true });
        break;
      case 'saveChatHistory':
        const chatId = await this.saveChatHistory(request.data);
        sendResponse({ success: true, id: chatId });
        break;
      case 'updateChatHistory':
        await this.updateChatHistory(request.id, request.data);
        sendResponse({ success: true });
        break;
      case 'saveToHistory':
        await this.saveToHistory(request.data);
        sendResponse({ success: true });
        break;
      case 'getPageContent':
        const content = await this.getPageContent(sender.tab.id);
        sendResponse({ success: true, data: content });
        break;
      case 'openSettings':
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
        sendResponse({ success: true });
        break;
    }
  }


  async callGeminiAPI(prompt, text, systemInstruction = null, model = null) {
    const { apiKey, settings } = await chrome.storage.local.get(['apiKey', 'settings']);

    if (!apiKey) {
      throw new Error('API_KEY_MISSING|API key not configured. Please add your Gemini API key in settings.');
    }

    const selectedModel = model || settings?.selectedModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{ text: `${prompt}\n\n${text}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.error) {
        const errorCode = data.error.code;
        const errorMessage = data.error.message;
        const errorStatus = data.error.status;
        
        // Parse specific error types
        if (errorCode === 401 || errorStatus === 'UNAUTHENTICATED') {
          throw new Error('INVALID_API_KEY|Invalid API key. Please check your settings.');
        } else if (errorCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
          if (errorMessage.includes('quota')) {
            throw new Error('QUOTA_EXCEEDED|API quota exceeded. Check your usage at Google AI Studio.');
          } else {
            throw new Error('RATE_LIMIT|Rate limit reached. Please wait a moment and try again.');
          }
        } else if (errorCode === 404 || errorStatus === 'NOT_FOUND') {
          throw new Error(`MODEL_NOT_FOUND|Model '${selectedModel}' not available. Try Gemini 2.5 Flash.`);
        } else if (errorCode === 400) {
          if (errorMessage.includes('SAFETY')) {
            throw new Error('CONTENT_BLOCKED|Content blocked by safety filters. Try rephrasing your request.');
          } else if (errorMessage.includes('token')) {
            throw new Error('TOKEN_LIMIT|Text too long. Please shorten your input.');
          } else {
            throw new Error(`BAD_REQUEST|${errorMessage}`);
          }
        } else if (errorCode >= 500) {
          throw new Error('SERVER_ERROR|Gemini API temporarily unavailable. Try again in a few minutes.');
        } else {
          throw new Error(`API_ERROR|${errorMessage}`);
        }
      }
      
      if (!data.candidates || !data.candidates[0]) {
        throw new Error('INVALID_RESPONSE|Invalid API response. Please try again.');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      if (error.message.includes('|')) {
        throw error;
      }
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        throw new Error('NETWORK_ERROR|Connection failed. Check your internet and try again.');
      }
      throw new Error(`UNKNOWN_ERROR|${error.message}`);
    }
  }

  async saveQuickHistory(data) {
    const { quickHistory = [] } = await chrome.storage.local.get('quickHistory');
    const id = 'quick_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    quickHistory.unshift({
      ...data,
      id,
      type: 'quick',
      timestamp: Date.now()
    });

    if (quickHistory.length > 100) {
      quickHistory.splice(100);
    }

    await chrome.storage.local.set({ quickHistory });
    return id;
  }

  async addQuickTimeline(id, step) {
    const { quickHistory = [] } = await chrome.storage.local.get('quickHistory');
    const entry = quickHistory.find(h => h.id === id);
    
    if (entry) {
      if (!entry.timeline) entry.timeline = [];
      
      step.step = entry.timeline.length + 1;
      entry.timeline.push(step);
      
      // Update final output if step has output
      if (step.output) entry.output = step.output;
      
      // Keep only last 20 timeline steps
      if (entry.timeline.length > 20) {
        entry.timeline = entry.timeline.slice(-20);
      }
      
      // Update stats
      entry.stats = {
        followupCount: entry.timeline.filter(s => s.type === 'followup').length,
        finalAction: step.type,
        totalSteps: entry.timeline.length
      };
      
      entry.updatedAt = Date.now();
      await chrome.storage.local.set({ quickHistory });
    }
  }

  async updateQuickHistory(id, output, action) {
    const { quickHistory = [] } = await chrome.storage.local.get('quickHistory');
    const entry = quickHistory.find(h => h.id === id);
    
    if (entry) {
      if (output) entry.output = output;
      if (action) entry.lastAction = action;
      entry.updatedAt = Date.now();
      await chrome.storage.local.set({ quickHistory });
    }
  }

  async saveChatHistory(data) {
    const { chatHistory = [] } = await chrome.storage.local.get('chatHistory');
    const id = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    chatHistory.unshift({
      ...data,
      id,
      type: 'chat',
      timestamp: Date.now()
    });

    if (chatHistory.length > 50) {
      chatHistory.splice(50);
    }

    await chrome.storage.local.set({ chatHistory });
    return id;
  }

  async updateChatHistory(id, data) {
    const { chatHistory = [] } = await chrome.storage.local.get('chatHistory');
    const entry = chatHistory.find(h => h.id === id);
    
    if (entry) {
      entry.messages = data.messages;
      entry.title = data.title;
      entry.updatedAt = Date.now();
      await chrome.storage.local.set({ chatHistory });
    }
  }

  async saveToHistory(historyItem) {
    const { history = [] } = await chrome.storage.local.get('history');
    history.unshift({
      ...historyItem,
      timestamp: Date.now(),
      id: Date.now().toString()
    });

    // Keep only last 100 items
    if (history.length > 100) {
      history.splice(100);
    }

    await chrome.storage.local.set({ history });
  }

  async getPageContent(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        return {
          title: document.title,
          url: window.location.href,
          content: document.body.innerText.slice(0, 5000)
        };
      }
    });
    return results[0].result;
  }
}

new QuickAI();