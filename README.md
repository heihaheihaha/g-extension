# 侧边栏助手 (Gemini) / Sidebar Assistant (Gemini)

---

## 简介 / Introduction

🇨🇳 **中文**:
智能侧边栏助手是一款基于 Manifest V3 的 Chrome 浏览器插件，它利用 Google Gemini API 的强大功能，为您提供网页内容总结和智能对话服务。该插件以可调整宽度的侧边栏形式集成到您的浏览器中，能够“推送”页面内容而非简单覆盖，支持中文进行交互，并允许用户设置自己的 Gemini API 密钥。所有对话都将保存在本地，方便回顾和管理。

🇬🇧 **English**:
The Smart Sidebar Assistant is a Manifest V3 Chrome extension that leverages the power of the Google Gemini API to provide webpage summarization and intelligent chat services. It integrates into your browser as a resizable sidebar that "pushes" page content rather than overlaying it, supports interaction in Chinese, and allows users to set their own Gemini API key. All conversations are saved locally for easy review and management.

---

## ✨ 功能特性 / Features

🇨🇳 **中文**:
* **动态侧边栏**: 以侧边栏形式常驻，不遮挡页面内容，宽度可自由拖动调整。
* **自定义 API Key**: 用户可在插件选项页面设置并保存自己的 Gemini API 密钥。
* **中文网页总结**: 一键提取当前网页主要内容，并使用 Gemini API 生成中文摘要。
* **智能对话**:
    * 与 Gemini AI进行流畅的对话。
    * 自动读取并在对话中引用用户在网页上选择的文本内容。
* **本地对话历史**:
    * 自动保存所有对话记录到本地浏览器存储。
    * 提供查看、加载和删除历史对话的功能。
    * (基础) 支持从历史记录中将对话作为新对话开始（分割）。
* **多语言界面**: 主要交互以中文为主。

🇬🇧 **English**:
* **Dynamic Sidebar**: A persistent sidebar that pushes page content and can be freely resized by dragging.
* **Custom API Key**: Users can set and save their own Gemini API key in the extension's options page.
* **Chinese Webpage Summarization**: One-click extraction of main webpage content, summarized in Chinese using the Gemini API.
* **Intelligent Chat**:
    * Engage in fluent conversations with the Gemini AI.
    * Automatically reads and incorporates user-selected text from the webpage into the conversation context.
* **Local Chat History**:
    * Automatically saves all conversation logs to local browser storage.
    * Provides functionality to view, load, and delete chat history.
    * (Basic) Supports starting a new conversation from a historical one (splitting).
* **Multilingual Interface**: Primary interaction is in Chinese.

---

## 🛠️ 技术栈 / Tech Stack

* **Manifest V3**: Chrome Extension platform.
* **JavaScript**: Core logic for the extension, content scripts, background scripts, and UI.
* **HTML & CSS**: Structure and styling for the sidebar and options page.
* **Google Gemini API**: For AI-powered summarization and chat.
* **`chrome.storage.sync`**: For storing the user's API key.
* **`chrome.storage.local`**: For storing chat history.

---

## 🚀 快速开始 / Getting Started

### 先决条件 / Prerequisites

🇨🇳 **中文**:
1.  一个有效的 Google Gemini API 密钥。您可以从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取。
2.  最新版本的 Google Chrome 浏览器。

🇬🇧 **English**:
1.  A valid Google Gemini API key. You can obtain one from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  The latest version of the Google Chrome browser.

### 安装步骤 / Installation

🇨🇳 **中文**:
1.  下载或克隆此项目的代码到您的本地计算机。
2.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions` 并回车。
3.  在打开的扩展程序页面中，启用右上角的 “开发者模式” (Developer mode)。
4.  点击左上角的 “加载已解压的扩展程序” (Load unpacked) 按钮。
5.  选择您在步骤1中下载或克隆的项目文件夹。
6.  插件图标应该会出现在 Chrome 工具栏中。

🇬🇧 **English**:
1.  Download or clone this project's code to your local machine.
2.  Open the Chrome browser, type `chrome://extensions` in the address bar, and press Enter.
3.  On the extensions page, enable "Developer mode" using the toggle switch in the top right corner.
4.  Click the "Load unpacked" button that appears in the top left.
5.  Select the project folder you downloaded or cloned in step 1.
6.  The extension icon should now appear in your Chrome toolbar.

### 配置 / Configuration

🇨🇳 **中文**:
1.  安装插件后，右键点击 Chrome 工具栏中的插件图标，选择 “选项” (Options)。或者，在 `chrome://extensions` 页面找到该插件，点击 “详细信息”，然后选择 “扩展程序选项”。
2.  在打开的选项页面中，输入您的 Gemini API 密钥。
3.  点击 “保存密钥” (Save Key) 按钮。成功保存后会有提示。

🇬🇧 **English**:
1.  After installation, right-click the extension icon in the Chrome toolbar and select "Options." Alternatively, go to `chrome://extensions`, find the extension, click "Details," and then "Extension options."
2.  In the options page that opens, enter your Gemini API key.
3.  Click the "Save Key" button. A success message will appear upon successful saving.

---

## 📖 使用指南 / How to Use

### 打开/关闭侧边栏 / Opening/Closing Sidebar

🇨🇳 **中文**:
* 点击 Chrome 工具栏中的插件图标即可打开或关闭侧边栏。

🇬🇧 **English**:
* Click the extension icon in the Chrome toolbar to open or close the sidebar.

### 总结网页 / Summarizing Webpages

🇨🇳 **中文**:
1.  打开您想要总结的网页。
2.  打开侧边栏。
3.  点击侧边栏顶部的 “总结当前网页 (中文)” 按钮。
4.  总结结果将显示在聊天区域。

🇬🇧 **English**:
1.  Navigate to the webpage you want to summarize.
2.  Open the sidebar.
3.  Click the "Summarize Current Webpage (Chinese)" button at the top of the sidebar.
4.  The summary will be displayed in the chat area.

### 与AI对话 / Chatting with AI

🇨🇳 **中文**:
1.  打开侧边栏。
2.  在底部的文本输入框中输入您的问题或指令。
3.  点击 “发送” 按钮或按 Enter 键。
4.  AI 的回复将显示在聊天区域。

🇬🇧 **English**:
1.  Open the sidebar.
2.  Type your question or command in the text input field at the bottom.
3.  Click the "Send" button or press Enter.
4.  The AI's response will appear in the chat area.

### 使用选中文本 / Using Selected Text

🇨🇳 **中文**:
1.  在任何网页上，用鼠标选择一段文本。
2.  打开侧边栏（如果尚未打开）。
3.  选中的文本会自动显示在侧边栏输入框上方作为一个引用提示。
4.  您可以在输入框中继续输入与此引用内容相关的问题或指令，然后发送。AI 将结合引用内容进行回复。

🇬🇧 **English**:
1.  On any webpage, select a piece of text with your mouse.
2.  Open the sidebar (if not already open).
3.  The selected text will automatically appear as a reference cue above the sidebar's input field.
4.  You can then type your question or instruction related to this selected text in the input field and send it. The AI will respond considering the referenced text.

### 管理对话历史 / Managing Chat History

🇨🇳 **中文**:
1.  打开侧边栏。
2.  点击 “查看/隐藏对话历史” 按钮来显示或隐藏历史记录面板。
3.  在历史记录面板中：
    * 点击任一条目以加载该对话到当前聊天窗口。
    * 点击条目旁的 “删除” 按钮以删除该条对话记录。
    * 点击 “清除所有历史” 按钮以删除所有已保存的对话。

🇬🇧 **English**:
1.  Open the sidebar.
2.  Click the "View/Hide Chat History" button to show or hide the history panel.
3.  In the history panel:
    * Click any entry to load that conversation into the current chat window.
    * Click the "Delete" button next to an entry to delete that specific conversation.
    * Click the "Clear All History" button to delete all saved conversations.

### 调整侧边栏大小 / Resizing Sidebar

🇨🇳 **中文**:
* 将鼠标悬停在侧边栏的左边缘，当光标变为水平调整样式时，按住鼠标左键并拖动即可调整侧边栏的宽度。
* 调整后的宽度会自动保存，并在下次打开时生效。

🇬🇧 **English**:
* Hover your mouse cursor over the left edge of the sidebar. When the cursor changes to a horizontal resize icon, click and drag to adjust the sidebar's width.
* The adjusted width is automatically saved and will be applied the next time you open the sidebar.

---

## 📁 项目结构 / Project Structure (Simplified)
```
gemini-sidebar-extension/
├── manifest.json                # 插件清单文件 / Extension manifest file
├── background.js                # 后台服务工作脚本 / Background service worker
├── content_script.js            # 内容脚本，注入到网页 / Content script injected into web pages
├── options.html                 # API密钥设置页面 / Options page for API key
├── options.js                   # options.html 的脚本 / Script for options.html
├── options.css                  # options.html 的样式 / Styles for options.html
├── sidebar.html                 # 侧边栏界面文件 / Sidebar UI file
├── sidebar.js                   # 侧边栏逻辑脚本 / Sidebar logic script
├── sidebar.css                  # 侧边栏样式 / Sidebar styles
└── images/                      # 插件图标 / Extension icons
```
---
## ⚠️ 已知问题与限制 / Known Issues & Limitations

🇨🇳 **中文**:
* **页面兼容性**: 侧边栏通过修改页面DOM结构来“推送”内容，这可能在某些结构复杂或使用特定JavaScript框架的网站上导致布局问题或功能冲突。
* **API 密钥安全**: 您的 Gemini API 密钥存储在浏览器的同步存储中 (`chrome.storage.sync`)。请注意保护好您的密钥，不要在不信任的计算机上使用。密钥的安全性由用户负责。
* **内容提取**: 当前用于总结的网页内容提取方法（`innerText`）可能不是最优的，对于某些包含大量非主要内容的页面，总结效果可能受影响。
* **错误处理**: 虽然进行了一些错误处理，但可能仍有未覆盖到的场景。

🇬🇧 **English**:
* **Page Compatibility**: The sidebar "pushes" content by modifying the page's DOM structure. This might cause layout issues or conflicts on some websites with complex structures or specific JavaScript frameworks.
* **API Key Security**: Your Gemini API key is stored in the browser's sync storage (`chrome.storage.sync`). Please be mindful of your key's security and avoid using it on untrusted computers. The user is responsible for the security of their API key.
* **Content Extraction**: The current method for extracting webpage content for summarization (`innerText`) might not be optimal and could affect summary quality on pages with a lot of non-main content.
* **Error Handling**: While some error handling is in place, there might still be uncovered scenarios.

---

## 展望未来 / Future Enhancements

🇨🇳 **中文**:
* 更精细的网页内容提取算法 (例如集成 Readability.js)。
* 支持在侧边栏内进行多轮对话历史的搜索。
* 更高级的对话分割和管理功能。
* 支持更多语言的总结和对话。
* 用户可自定义的提示词 (Prompts)。

🇬🇧 **English**:
* More sophisticated webpage content extraction algorithms (e.g., integrating Readability.js).
* Support for searching within multi-turn conversation history in the sidebar.
* Advanced conversation splitting and management features.
* Support for summarization and chat in more languages.
* User-customizable prompts.

---

## (可选 / Optional) 许可证 / License

🇨🇳 **中文**:
此项目采用 [MIT 许可证](LICENSE)。

🇬🇧 **English**:
This project is licensed under the [MIT License](LICENSE).