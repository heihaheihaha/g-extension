# 智能侧边栏助手 (Gemini) - Intelligent Sidebar Assistant (Gemini)
## 描述

本 Chrome 扩展程序提供了一个由 Gemini API 驱动的智能侧边栏助手。它允许用户总结网页、进行智能对话以及管理自定义提示，并主要侧重于中文语言支持。

## 功能特性

* **网页总结：** 快速总结当前网页的内容。
* **智能聊天：** 直接在侧边栏中与 Gemini 模型进行对话。
* **Prompt 管理：** 为常用任务创建、编辑和管理自定义 Prompt 模板。包含用于翻译和总结的预设 Prompt。
* **聊天记录：** 保存您与助手的对话。
* **聊天存档：** 将重要的对话或问答对存档以供日后查看。
* **右键菜单集成：**
    * 通过右键单击图片，使用 Gemini 分析图片。
    * 通过将链接拖放到预览窗口或通过右键菜单（基于 `content_script.js` 的功能）总结链接目标。
* **文本选择集成：** 轻松地在您的 Prompt 中使用从网页选择的文本。
* **图片支持：** 在与 AI 的对话中包含图片。
* **API 密钥配置：** 用户可以在扩展程序的选项中安全地保存其 Gemini API 密钥。
* **侧边栏用户界面：** 浏览器侧边栏中现代化且用户友好的界面。
* **专注中文：** 用户界面和默认 Prompt 均为中文，专为中文用户设计。

## 安装步骤

1.  **下载扩展文件：** 确保您已将所有扩展文件放置在单个文件夹中（例如 `g-extension`）。
2.  **打开 Chrome 扩展程序页面：**
    * 打开 Google Chrome 浏览器。
    * 导航到 `chrome://extensions/`。
3.  **启用开发者模式：**
    * 在扩展程序页面的右上角，打开“开发者模式”开关。
4.  **加载已解压的扩展程序：**
    * 点击出现的“加载已解压的扩展程序”按钮。
    * 选择包含扩展文件的文件夹（例如 `g-extension`）。
5.  扩展程序图标现在应该会出现在您的 Chrome 工具栏中。

## 使用方法

1.  **设置 API 密钥：**
    * 在 Chrome 工具栏中右键单击扩展程序图标，然后选择“选项”，或导航到扩展程序的选项页面。
    * 输入您的 Gemini API 密钥，然后单击“保存密钥”。
2.  **打开侧边栏：**
    * 单击 Chrome 工具栏中的扩展程序图标。这将在侧边栏中打开智能助手。
3.  **与助手互动：**
    * **总结网页：** 单击“总结当前网页”按钮以获取活动标签页内容的摘要。
    * **聊天：** 在侧边栏底部的输入字段中键入您的消息，然后按 Enter 键或单击“发送”。
    * **使用选中文本：** 在任何网页上选择文本。它将出现在侧边栏的“引用内容”部分。然后，您可以在 Prompt 中使用 `{{text}}` 占位符，或者直接就所选文本提问。
    * **使用图片：** 在网页上右键单击图片，然后选择“用 Gemini 分析图片”。该图片将显示在侧边栏中，然后您可以就该图片提问。
    * **管理 Prompt：** 单击“管理 Prompt”以打开一个新标签页，您可以在其中添加、编辑或删除自定义 Prompt 模板。在模板中使用 `{{text}}` 可自动插入选定的网页文本。
    * **Prompt 快捷方式：** 在侧边栏主控制按钮下方直接访问您已保存和预设的 Prompt。
    * **分割对话：** 单击“分割当前对话”以存档当前对话并开始新的对话。
    * **查看已存档对话：** 单击“查看已存档对话”以打开一个显示所有已存档对话的页面。
    * **清除历史记录：** 展开“更多历史操作”部分以清除所有聊天记录。

## 文件结构 (主要文件)

* `manifest.json`: 定义扩展程序的属性、权限和核心文件。
* `sidebar.html` / `sidebar.js` / `sidebar.css`: 聊天和总结功能的主要界面。
* `background.js`: Service worker，处理后台任务、API 通信、右键菜单和消息传递。
* `options.html` / `options.js`: 供用户输入和保存其 Gemini API 密钥的页面。
* `prompts.html` / `prompts.js` / `prompts.css`: 用于管理 Prompt 模板的界面。
* `archive.html` / `archive.js` / `archive.css`: 用于查看已存档聊天的界面。
* `content_script.js`: 注入到网页中以启用文本选择、图片选择和链接拖放总结预览等功能。
* `link_content_extractor.js`: 使用 Readability.js 库从网页中提取主要内容，尤其适用于总结链接目标。
* `libs/`: 包含外部库，如 `marked.min.js` (用于渲染 Markdown) 和 `Readability.js`。
* `images/`: 包含扩展程序的图标。

## 工作原理

该扩展程序利用 Gemini API 实现其核心 AI 功能。
* **前端 (侧边栏、选项、Prompt、存档)：** 使用 HTML、CSS 和 JavaScript 创建用户界面。
* **后台脚本 (`background.js`)：**
    * 管理 API 密钥。
    * 处理扩展程序不同部分（例如内容脚本、侧边栏）之间的通信。
    * 处理总结和图片分析请求。
    * 创建和管理右键菜单。
    * 协调从外部链接获取和总结内容的过程。
* **内容脚本 (`content_script.js`)：**
    * 与用户访问的网页进行交互。
    * 侦听文本选择和图片选择以发送到侧边栏。
    * 实现用于总结的链接拖放预览功能。
    * 在请求总结时提取页面内容。
* **API 交互 (主要在 `sidebar.js` 中)：**
    * 使用存储的 API 密钥构建对 Gemini API 的请求。
    * 将用户 Prompt、选定文本、页面内容和图片数据发送到 API。
    * 在聊天界面中显示 API 的响应。
* **存储：**
    * 使用 `chrome.storage.sync` 存储 Gemini API 密钥。
    * 使用 `chrome.storage.local` 存储聊天记录、已存档聊天和 Prompt 模板。

---

## Description

This Chrome extension provides an intelligent sidebar assistant powered by the Gemini API. It allows users to summarize web pages, engage in intelligent conversations, and manage custom prompts, with a primary focus on Chinese language support.

## Features

* **Web Page Summarization:** Quickly summarize the content of the current web page.
* **Intelligent Chat:** Converse with the Gemini model directly within the sidebar.
* **Prompt Management:** Create, edit, and manage custom prompt templates for frequent tasks. Includes preset prompts for translation and summarization.
* **Chat History:** Saves your conversations with the assistant.
* **Chat Archiving:** Archive important conversations or Q&A pairs for later review.
* **Context Menu Integration:**
    * Analyze images using Gemini by right-clicking on an image.
    * Summarize link targets by dragging and dropping links onto a preview window or via context menu (implicitly based on `content_script.js` functionality).
* **Text Selection Integration:** Easily use selected text from a webpage in your prompts.
* **Image Support:** Include images in your conversations with the AI.
* **API Key Configuration:** Users can securely save their Gemini API key in the extension's options.
* **Side Panel UI:** Modern and user-friendly interface within the browser's side panel.
* **Chinese Language Focused:** UI and default prompts are in Chinese, designed for Chinese-speaking users.

## Installation

1.  **Download the Extension Files:** Make sure you have all the extension files in a single folder (e.g., `g-extension`).
2.  **Open Chrome Extensions Page:**
    * Open Google Chrome.
    * Navigate to `chrome://extensions/`.
3.  **Enable Developer Mode:**
    * In the top right corner of the Extensions page, toggle the "Developer mode" switch to on.
4.  **Load Unpacked Extension:**
    * Click the "Load unpacked" button that appears.
    * Select the folder containing the extension files (e.g., `g-extension`).
5.  The extension icon should now appear in your Chrome toolbar.

## Usage

1.  **Set API Key:**
    * Right-click on the extension icon in the Chrome toolbar and select "Options," or navigate to the extension's options page.
    * Enter your Gemini API key and click "Save Key."
2.  **Open the Sidebar:**
    * Click on the extension icon in the Chrome toolbar. This will open the intelligent assistant in the side panel.
3.  **Interacting with the Assistant:**
    * **Summarize Page:** Click the "总结当前网页" (Summarize Current Page) button to get a summary of the active tab's content.
    * **Chat:** Type your messages in the input field at the bottom of the sidebar and press Enter or click "发送" (Send).
    * **Use Selected Text:** Select text on any webpage. It will appear in the "引用内容" (Quoted Content) section in the sidebar. You can then use the `{{text}}` placeholder in your prompts or simply ask questions about the selected text.
    * **Use Images:** Right-click an image on a webpage and select "用 Gemini 分析图片" (Analyze Image with Gemini). The image will appear in the sidebar, and you can then ask questions about it.
    * **Manage Prompts:** Click "管理 Prompt" (Manage Prompts) to open a new tab where you can add, edit, or delete custom prompt templates. Use `{{text}}` in your templates to automatically insert selected page text.
    * **Prompt Shortcuts:** Access your saved and preset prompts directly below the main control buttons in the sidebar.