# Quick AI Chrome Extension

A powerful Chrome extension that integrates Gemini AI for lightning-fast text editing and conversational AI across all websites.

## ✨ Features

### 🚀 Dual Mode System

- **Quick AI Mode (Alt+Q)**: Fast text processing with templates
- **Chat Mode (Alt+C)**: Conversational AI with context awareness
- **Universal Text Processing**: Works on all input fields, textareas, and content-editable areas
- **Local Storage Only**: All data stored locally, no cloud sync

### 🤖 AI Models

- **Gemini 2.5 Flash** (Recommended): Ultra-fast responses with excellent quality
- **Gemini 2.5 Pro**: Advanced reasoning and complex tasks
- **Gemini 3.0 Flash Preview**: Latest experimental model
- **On-the-fly Model Switching**: Change models anytime via dropdown

### 📝 Template System

- **Pre-built Templates**: Grammar fix, summarize, email writing, translation
- **Custom Templates**: Create unlimited templates with custom prompts
- **System Instructions**: Guide AI behavior for better responses
- **Template Categories**: Organize by type (editing, communication, analysis)
- **Easy Management**: Edit, delete, duplicate templates

### 💬 Chat Features

- **Conversation History**: Maintains context across messages
- **Markdown Rendering**: Supports bold, italic, code blocks, lists, headers
- **Context Awareness**: Uses selected text as conversation context
- **Clear & Reset**: Start fresh conversations anytime

### 🎯 Smart Features

- **Undo/Redo**: Full text history with Ctrl+Z/Ctrl+Y
- **Keyboard Navigation**: Tab through all elements smoothly
- **Position Memory**: Remembers popup position and size
- **Draggable & Resizable**: Customize popup placement and dimensions
- **Error Handling**: Clear error messages with auto-dismiss
- **Model Indicator**: Always know which AI model you're using

### 💎 User Experience

- **Glassmorphism UI**: Modern water-glass design with transparency
- **Custom Scrollbar**: Thin, elegant scrollbar in chat
- **Better Spacing**: Optimized layout for readability
- **Loading States**: Visual feedback during processing
- **Keyboard Shortcuts**: Quick access without mouse
- **Focus States**: Clear visual feedback for accessibility

## 📦 Installation

1. **Download the Extension**
   - Clone or download this repository
   - Extract to a folder on your computer

2. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked" and select the extension folder

3. **Get Gemini API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - Copy the API key

4. **Configure Extension**
   - Click the Quick AI extension icon in Chrome toolbar
   - Enter your Gemini API key
   - Click "Save API Key"

## 🎮 Usage

### Quick AI Mode (Alt+Q)

1. **Activate**: Press `Alt+Q` on any webpage
2. **Select Text** (optional): Highlight text you want to process
3. **Choose Template**: Select from dropdown or use custom prompt
4. **Process**: Click "Process" to get AI response
5. **Apply**: Choose to Replace, Insert, or Copy the result

### Chat Mode (Alt+C)

1. **Activate**: Press `Alt+C` on any webpage
2. **Select Text** (optional): Highlight text for context
3. **Ask Questions**: Type your message and press Enter
4. **Continue Conversation**: AI remembers previous messages
5. **Clear Chat**: Reset conversation anytime

### Templates

- **Grammar Fix**: Corrects grammar and spelling errors
- **Summarize**: Creates concise summaries
- **Professional Email**: Converts text to professional email format
- **Translate**: Translates text to different languages
- **Custom**: Use your own prompts with system instructions

### Managing Templates

1. Click 💾 button in popup → Opens template manager
2. Add new templates with custom prompts
3. Add system instructions for better AI behavior
4. Edit or delete existing templates
5. Duplicate templates for variations

## ⌨️ Keyboard Shortcuts

### Global Shortcuts

- `Alt+Q`: Activate Quick AI mode
- `Alt+C`: Activate Chat mode
- `Escape`: Close popup

### Inside Popup

- `Tab`: Navigate through elements
- `Shift+Tab`: Navigate backwards
- `Ctrl+Z`: Undo text changes
- `Ctrl+Y` or `Ctrl+Shift+Z`: Redo text changes
- `Enter`: Send message (Chat mode)
- `Shift+Enter`: New line (Chat mode)

## 🎨 UI Features

### Glassmorphism Design

- Transparent backgrounds with blur effects
- Light color scheme for better readability
- Smooth animations and transitions

### Customization

- **Draggable**: Drag popup by header
- **Resizable**: Resize from bottom-right corner
- **Position Memory**: Popup remembers last position
- **Size Memory**: Popup remembers last size

### Model Switching

- Dropdown in header shows current model
- Switch models anytime without closing popup
- Model preference saved per session

## 🔒 Privacy & Security

- **Local Storage Only**: All data stays on your device
- **No Tracking**: Extension doesn't track or collect user data
- **API Key Security**: Your Gemini API key is stored locally
- **No External Servers**: Direct communication with Google's Gemini API only

## 🛠️ Troubleshooting

### Extension Not Working

1. Refresh the webpage and try again
2. Check if API key is configured correctly
3. Ensure you have internet connection for API calls

### API Errors

1. Verify your Gemini API key is valid
2. Check API quota limits in Google AI Studio
3. Try switching to a different Gemini model
4. Check error message in popup for details

### Popup Not Appearing

1. Make sure the page is fully loaded
2. Try pressing the shortcut again
3. Check browser console for error messages

### Shortcuts Not Working

1. Make sure you're not inside an input field
2. Try clicking outside any input first
3. Check Chrome shortcuts at `chrome://extensions/shortcuts`

## 📁 File Structure

```
quickai/
├── manifest.json          # Extension manifest
├── background.js          # Service worker & API calls
├── content.js            # Content script & UI
├── popup.html            # Extension action popup
├── popup.js              # Action popup functionality
├── popup.css             # All styles
├── templates.html        # Template management
├── templates.js          # Template CRUD operations
├── history.html          # History viewer
├── settings.html         # Settings page
└── README.md            # This file
```

## 🎨 What's New

- ⚡ **Dual Mode System**: Quick AI + Chat mode
- 🤖 **Latest Models**: Gemini 2.5 & 3.0 support
- 💬 **Chat Interface**: Conversational AI with history
- 📝 **Markdown Support**: Rich text formatting in chat
- ↶↷ **Undo/Redo**: Full text history
- ⌨️ **Better Shortcuts**: Alt+Q and Alt+C
- 🎨 **Glassmorphism UI**: Modern transparent design
- 🔄 **Model Switching**: Change models on-the-fly
- 📍 **Position Memory**: Remembers popup location
- ⚠️ **Error Handling**: Clear error messages

## 🚧 Upcoming Features

- **Follow-up Actions**: Continue refining results without retyping
- **Editable Output**: Edit AI responses before copying
- **Better Markdown**: Improved rendering with better
- **Smart Scrollbar**: Better overflow handling
- **Enhanced Clipboard**: Copy with formatting options
- **History Integration**: View and reuse past interactions
- **Export Chat**: Download conversations

## 📄 License

MIT License - see LICENSE file for details.

## 💬 Support

For issues or feature requests, please create an issue in the GitHub repository.

---

**Made with ❤️ using Gemini AI**
