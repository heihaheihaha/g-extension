// g-extension/sidebar.js

// --- 全局变量 ---
let geminiApiKey = null;
let currentChat = [];
let allChats = [];
let archivedChats = [];
let currentSelectedText = null;
let promptTemplates = []; // New: For storing prompt templates

// --- DOM 元素获取 ---
let chatOutput, chatInput, sendMessageButton, summarizePageButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    historyPanel, chatHistoryList, clearAllHistoryButton,
    splitChatButton, viewArchivedChatsButton,
    managePromptsButton, // New
    promptShortcutsContainer; // New


// --- 初始化和API Key加载 ---
async function initialize() {
    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    historyPanel = document.querySelector('.history-panel');
    chatHistoryList = document.getElementById('chatHistoryList');
    clearAllHistoryButton = document.getElementById('clearAllHistoryButton');
    splitChatButton = document.getElementById('splitChatButton');
    viewArchivedChatsButton = document.getElementById('viewArchivedChatsButton');
    managePromptsButton = document.getElementById('managePromptsButton'); // New
    promptShortcutsContainer = document.getElementById('promptShortcuts'); // New


    if (typeof marked !== 'object' || marked === null || typeof marked.parse !== 'function') {
        console.warn("Marked Library Test - marked is not an object or marked.parse is not a function.");
    }

    try {
        const result = await chrome.storage.sync.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            geminiApiKey = result.geminiApiKey;
        } else {
            addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
            disableInputs();
        }
    } catch (e) {
        console.error("Sidebar: Error loading API key:", e);
        addMessageToChat({ role: 'model', parts: [{text: '错误：加载API密钥失败。'}], timestamp: Date.now() });
        disableInputs();
    }

    await loadArchivedChats(); 
    loadChatHistory(); 
    await loadPromptTemplates(); // New: Load prompts

    if (!currentChat || currentChat.length === 0 && allChats.length === 0) {
        renderCurrentChat();
    }


    if (sendMessageButton) sendMessageButton.addEventListener('click', handleSendMessage);

    if (chatInput && sendMessageButton) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault(); sendMessageButton.click();
            }
        });
    }

    if (summarizePageButton) summarizePageButton.addEventListener('click', handleSummarizeCurrentPage);
    if (clearSelectedTextButton) clearSelectedTextButton.addEventListener('click', clearSelectedTextPreview);
    if (clearAllHistoryButton) {
        clearAllHistoryButton.addEventListener('click', () => {
            if (confirm("确定要清除所有对话历史吗？此操作无法撤销。")) {
                allChats = [];
                currentChat = [];
                saveChatHistory();
                renderChatHistoryList();
                renderCurrentChat();
                addMessageToChat({ role: 'model', parts: [{text: '所有对话历史已清除。'}], timestamp: Date.now() });
            }
        });
    }

    if (splitChatButton) splitChatButton.addEventListener('click', handleSplitChat);
    if (viewArchivedChatsButton) {
        viewArchivedChatsButton.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
        });
    }
    // New: Event listener for Manage Prompts button
    if (managePromptsButton) {
        managePromptsButton.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('prompts.html') });
        });
    }


    chrome.storage.onChanged.addListener(async (changes, namespace) => { // Added async here
        if (namespace === 'sync' && changes.geminiApiKey) {
            geminiApiKey = changes.geminiApiKey.newValue;
            addMessageToChat({ role: 'model', parts: [{text: 'API 密钥已更新。'}], timestamp: Date.now() });
            enableInputs();
        }
        if (namespace === 'local') {
            if (changes.geminiChatHistory) {
                allChats = (changes.geminiChatHistory.newValue || []).map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking));
                renderChatHistoryList();
            }
            if (changes.geminiArchivedChats) {
                archivedChats = changes.geminiArchivedChats.newValue || [];
                updateArchivedChatsButtonCount();
            }
            // New: Listen for prompt template changes
            if (changes.promptTemplates) {
                await loadPromptTemplates();
            }
        }
    });
    chrome.runtime.onMessage.addListener(handleRuntimeMessages);
}

// New: Function to load prompt templates
async function loadPromptTemplates() {
    const result = await chrome.storage.local.get(['promptTemplates']);
    const presets = [
        { id: 'preset-translate', name: '翻译', content: '请将以下文本翻译成[目标语言]：\n\n{{text}}', isPreset: true },
        { id: 'preset-summarize', name: '总结', content: '请总结以下文本的主要内容：\n\n{{text}}', isPreset: true }
    ];

    if (result.promptTemplates && result.promptTemplates.length > 0) {
        promptTemplates = result.promptTemplates;
        // Ensure presets are always up-to-date or added if missing
        presets.forEach(preset => {
            const existing = promptTemplates.find(p => p.id === preset.id);
            if (!existing) {
                promptTemplates.unshift(preset);
            } else if (existing.isPreset) { // Update existing preset's content/name if needed
                existing.name = preset.name;
                existing.content = preset.content;
            }
        });
    } else {
        promptTemplates = [...presets];
        await chrome.storage.local.set({ promptTemplates: promptTemplates }); // Save presets if first time
    }
    renderPromptShortcuts();
}

// New: Function to render prompt shortcut buttons
function renderPromptShortcuts() {
    if (!promptShortcutsContainer) return;
    promptShortcutsContainer.innerHTML = ''; // Clear existing shortcuts

    promptTemplates.forEach(template => {
        const button = document.createElement('button');
        button.classList.add('prompt-shortcut-button');
        button.textContent = template.name;
        button.title = template.content.substring(0, 100) + (template.content.length > 100 ? '...' : '');
        button.addEventListener('click', () => applyPromptTemplate(template));
        promptShortcutsContainer.appendChild(button);
    });
}

// New: Function to apply a prompt template
function applyPromptTemplate(template) {
    let content = template.content;
    if (currentSelectedText) {
        content = content.replace(/{{text}}/g, currentSelectedText);
    }
    chatInput.value = content;
    chatInput.focus();
    // Optionally, auto-send if {{text}} was the only thing and it got replaced?
    // For now, just populate and let user send.
}


function updateArchivedChatsButtonCount() {
    if (viewArchivedChatsButton) {
        viewArchivedChatsButton.textContent = `查看已存档对话 (${archivedChats.length})`;
    }
}

function handleSplitChat() {
    const chatToProcess = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));
    
    if (chatToProcess.length > 0) {
        archivedChats.unshift([...chatToProcess].map(m => ({...m, archived: undefined }))); 
        saveArchivedChats();

        let alreadyInAllChats = false;
        if (allChats.length > 0 && JSON.stringify(allChats[0]) === JSON.stringify(chatToProcess)) {
            alreadyInAllChats = true;
        }
        if (!alreadyInAllChats) {
            allChats.unshift([...chatToProcess]);
            if (allChats.length > 50) allChats.pop();
            saveChatHistory(); 
            renderChatHistoryList();
        }
    }

    currentChat = [];
    renderCurrentChat();
    addMessageToChat({ role: 'model', parts: [{text: '对话已分割并存档。新的对话已开始。'}], timestamp: Date.now() });
}


function archiveQaPair(aiMessageIndexInCurrentChat) {
    const aiMessage = currentChat[aiMessageIndexInCurrentChat];
    if (!aiMessage || aiMessage.archived) return; 

    let userMessage = null;
    for (let i = aiMessageIndexInCurrentChat - 1; i >= 0; i--) {
        if (currentChat[i].role === 'user' && !currentChat[i].isThinking && !currentChat[i].isTempStatus) {
            userMessage = currentChat[i];
            break;
        }
    }

    if (userMessage && aiMessage) {
        const userMessageCopy = JSON.parse(JSON.stringify(userMessage));
        const aiMessageCopy = JSON.parse(JSON.stringify(aiMessage));
        delete userMessageCopy.archived; 
        delete aiMessageCopy.archived;

        const qaPairToArchive = [userMessageCopy, aiMessageCopy];
        
        archivedChats.unshift(qaPairToArchive);
        saveArchivedChats();

        aiMessage.archived = true; 
        
        renderCurrentChat(); 
        saveCurrentChat(); 

        const tempStatusMsg = addMessageToChat({role: 'model', parts: [{text: '该问答已存档。'}], timestamp: Date.now(), isTempStatus: true});
        setTimeout(() => {
            const idx = currentChat.findIndex(m => m.timestamp === tempStatusMsg.timestamp && m.isTempStatus);
            if (idx > -1) {
                currentChat.splice(idx, 1);
                renderCurrentChat();
                saveCurrentChat();
            }
        }, 3000);
    } else {
        console.warn("Could not find user message for AI message at index:", aiMessageIndexInCurrentChat);
        const tempErrorMsg = addMessageToChat({role: 'model', parts: [{text: '存档失败：未能找到对应的用户问题。'}], timestamp: Date.now(), isTempStatus: true});
        setTimeout(() => {
             const idx = currentChat.findIndex(m => m.timestamp === tempErrorMsg.timestamp && m.isTempStatus);
            if (idx > -1) {
                currentChat.splice(idx, 1);
                renderCurrentChat();
                saveCurrentChat();
            }
        }, 3000);
    }
}


function handleRuntimeMessages(request, sender, sendResponse) {
    if (request.type === 'TEXT_SELECTED_FOR_SIDEBAR') {
        currentSelectedText = request.text;
        if (selectedTextContent) selectedTextContent.textContent = currentSelectedText.length > 100 ? currentSelectedText.substring(0, 97) + '...' : currentSelectedText;
        if (selectedTextPreview) selectedTextPreview.style.display = 'block';
        sendResponse({status: "Selected text received in sidebar"});
    } else if (request.type === 'SUMMARIZE_EXTERNAL_TEXT_FOR_SIDEBAR') {
        const { text, linkUrl, linkTitle, warning } = request;
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));

        addMessageToChat({ role: 'user', parts: [{text: `总结请求：[${linkTitle || '链接'}](${linkUrl}) (内容长度: ${text?.length || 0})`}], timestamp: Date.now() });
        if (warning) {
            addMessageToChat({ role: 'model', parts: [{text: `注意: ${warning}`}], timestamp: Date.now() });
        }
        if (!text || text.trim() === "") {
            addMessageToChat({role: 'model', parts: [{text: `无法总结 [${linkTitle || linkUrl}](${linkUrl})，未能提取到有效文本。`}], timestamp: Date.now() });
            sendResponse({error: "No text provided"});
            return true;
        }
        const prompt = `请使用中文，清晰、简洁且全面地总结以下链接 (${linkTitle ? linkTitle + ' - ' : ''}${linkUrl}) 的主要内容。专注于核心信息，忽略广告、导航栏、页脚等非主要内容。如果内容包含技术信息或代码，请解释其核心概念和用途。如果是一篇文章，请提炼主要观点和论据。总结应易于理解，并抓住内容的精髓。\n\n链接内容文本如下：\n"${text}"`;
        callGeminiAPI([{ text: prompt }], true).then(() => sendResponse({status: "Summary initiated"}));

    } else if (request.type === 'SHOW_LINK_SUMMARY_ERROR') {
        const { message, url, title } = request;
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
        addMessageToChat({ role: 'model', parts: [{text: `总结链接 [${title || url}](${url}) 失败: ${message}`}], timestamp: Date.now() });
        sendResponse({status: "Error displayed"});

    } else if (request.type === 'LINK_SUMMARIZATION_STARTED') {
        const { url, title } = request;
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
        addMessageToChat({ role: 'model', parts: [{text: `正在总结链接: [${title || url}](${url})... 请稍候。`}], timestamp: Date.now(), isTempStatus: true });
        sendResponse({status: "Notified user"});

    } else if (request.type === "TRIGGER_SIDEBAR_PAGE_SUMMARY") {
        handleSummarizeCurrentPage();
        sendResponse({ status: "Sidebar initiated page summary." });
    }
    return true;
}

function removeMessageByContentCheck(conditionFn) {
    const initialLength = currentChat.length;
    currentChat = currentChat.filter(msg => !conditionFn(msg));
    if (currentChat.length < initialLength) {
        renderCurrentChat();
        saveCurrentChat();
        return true;
    }
    return false;
}


async function handleSendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText && !currentSelectedText) { // Modified condition slightly, though `messageText` alone was main check
        addMessageToChat({ role: 'model', parts: [{text: '请输入消息或选择页面文本后再发送。'}], timestamp: Date.now(), isTempStatus: true });
        setTimeout(() => removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.startsWith('请输入消息')), 3000);
        return;
    }
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
        disableInputs();
        return;
    }

    let userMessageContent = messageText;
    // Display message logic for chat history if selected text was part of input (via template or manual)
    // For now, the display message will be what's in the chatInput.
    // If a template was used and {{text}} was replaced, that's already in messageText.
    // If user manually typed after using a template that still has {{text}}, it will be sent as is.

    // If `currentSelectedText` exists AND `messageText` (from chatInput) explicitly contains `{{text}}`,
    // it implies the user might be using a template and wants the selected text injected there.
    // However, the `applyPromptTemplate` already handles this if a shortcut was clicked.
    // This direct send primarily handles manually typed messages or messages where template was manually edited.
    
    let displayMessage = messageText; // This will be what's shown in the chat.

    if (currentSelectedText && messageText.includes("{{text}}")) {
         // If user manually typed or edited a template that still has {{text}}
         // and there IS selected text, replace it for the API call.
        userMessageContent = messageText.replace(/{{text}}/g, currentSelectedText);
        // For display, we could show a note or just the processed text.
        // Let's keep displayMessage as what the user typed, and userMessageContent for API.
        // OR, be consistent with template application:
        // displayMessage = userMessageContent; // This would show the replaced text in the chat log for the user.
                                            // Let's choose this for consistency: what's sent to API is what user sees as their message.
    } else if (currentSelectedText && !messageText.includes("{{text}}") && messageText) {
        // If there's selected text, and user typed something *without* {{text}}
        // assume they want to ask about the selected text.
        // This is the original behavior for selected text.
        userMessageContent = `关于以下引用内容：\n"${currentSelectedText}"\n\n我的问题/指令是：\n"${messageText}"`;
        displayMessage = `(引用内容: ${currentSelectedText.substring(0,50)}...) ${messageText}`;
    } else {
        // No selected text, or selected text but user didn't use {{text}} and didn't type a separate question
        // (e.g. chatInput was populated by a template that didn't need currentSelectedText or it was cleared).
        userMessageContent = messageText;
        displayMessage = messageText;
    }


    if (!userMessageContent.trim()) { // After potential {{text}} replacement, if it's empty
        addMessageToChat({ role: 'model', parts: [{text: '请输入有效消息。'}], timestamp: Date.now(), isTempStatus: true });
        setTimeout(() => removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.startsWith('请输入有效消息')), 3000);
        return;
    }

    addMessageToChat({ role: 'user', parts: [{text: displayMessage}], timestamp: Date.now() });

    chatInput.value = '';
    clearSelectedTextPreview(); // Clear selected text quote after sending

    await callGeminiAPI([{ text: userMessageContent }]);
}

function handleSummarizeCurrentPage() {
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
        disableInputs();
        return;
    }
    const summaryRequestText = '(正在请求总结当前网页...)';
    addMessageToChat({role: 'user', parts: [{text: summaryRequestText}], timestamp: Date.now()});

    chrome.runtime.sendMessage({ action: "getAndSummarizePage" }, async (response) => {
        removeMessageByContentCheck(msg => msg.role ==='user' && msg.parts[0].text === summaryRequestText);

        if (chrome.runtime.lastError) {
            addMessageToChat({role: 'model', parts: [{text: `总结错误 (通讯): ${chrome.runtime.lastError.message}`}], timestamp: Date.now() });
            return;
        }

        if (response && typeof response.contentForSummary === 'string') {
            const pageContent = response.contentForSummary;
             if (pageContent.trim() === "") {
                 addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
                 addMessageToChat({role: 'model', parts: [{text: `页面内容为空或未能提取到有效文本进行总结。`}], timestamp: Date.now() });
                 return;
            }
            const prompt = `请使用中文，清晰、简洁且全面地总结以下网页内容。如果内容包含技术信息或代码，请解释其核心概念和用途。如果是一篇文章，请提炼主要观点和论据。总结应易于理解，并抓住内容的精髓。\n\n网页内容如下：\n"${pageContent}"`;
            addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面 (内容长度: ${pageContent.length})`}], timestamp: Date.now()});
            await callGeminiAPI([{ text: prompt }], true);
        } else if (response && response.error) {
            addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
            addMessageToChat({role: 'model', parts: [{text: `总结错误: ${response.error}`}], timestamp: Date.now() });
        } else {
            addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
            addMessageToChat({role: 'model', parts: [{text: `总结错误: 从背景脚本收到未知响应。`}], timestamp: Date.now() });
        }
    });
}


function disableInputs() {
    if (chatInput) chatInput.disabled = true;
    if (sendMessageButton) sendMessageButton.disabled = true;
    if (summarizePageButton) summarizePageButton.disabled = true;
    if (splitChatButton) splitChatButton.disabled = true;
    if (managePromptsButton) managePromptsButton.disabled = true; // Disable if API key missing
}

function enableInputs() {
    if (chatInput) chatInput.disabled = false;
    if (sendMessageButton) sendMessageButton.disabled = false;
    if (summarizePageButton) summarizePageButton.disabled = false;
    if (splitChatButton) splitChatButton.disabled = false;
    if (managePromptsButton) managePromptsButton.disabled = false;
}

async function callGeminiAPI(parts, isSummary = false) {
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未配置。'}], timestamp: Date.now() });
        return;
    }

    const thinkingMessage = addMessageToChat({ role: 'model', parts: [{text: '正在思考中...'}], timestamp: Date.now(), isThinking: true });

    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
    
    const historyForAPI = currentChat
        .filter(msg => msg.timestamp < thinkingMessage.timestamp && !msg.isTempStatus && !msg.isThinking)
        .map(msg => ({
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text }))
        }));
    
    const requestContents = [...historyForAPI, { role: "user", parts: parts }];

    const requestBody = {
        contents: requestContents,
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP error! status: ${response.status}` } }));
            console.error('Gemini API Error:', errorData);
            addMessageToChat({ role: 'model', parts: [{text: `API 调用失败: ${errorData.error?.message || response.statusText}`}], timestamp: Date.now() });
            return;
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
            const aiResponse = data.candidates[0].content.parts.map(part => part.text).join("\n");
            addMessageToChat({ role: 'model', parts: [{text: aiResponse}], timestamp: Date.now() });
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
             addMessageToChat({ role: 'model', parts: [{text: `请求被阻止: ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`}], timestamp: Date.now() });
        } else {
            addMessageToChat({ role: 'model', parts: [{text: '未能从API获取有效回复。'}], timestamp: Date.now() });
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        addMessageToChat({ role: 'model', parts: [{text: `与API通讯时发生错误: ${error.message}`}], timestamp: Date.now() });
    }
}

function addMessageToChat(message) {
    if (!message.parts || !Array.isArray(message.parts) || message.parts.length === 0 || typeof message.parts[0].text !== 'string') {
        // Fallback for older message formats or simple text messages
        message.parts = [{ text: message.text || "无效消息格式" }];
    }
    
    if (message.isTempStatus && message.parts[0].text.includes("正在总结链接")) {
        const existingTempLinkSummaryMsg = currentChat.find(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
        if (existingTempLinkSummaryMsg) {
            if (currentChat.some(m => m.isTempStatus && m.parts[0].text === message.parts[0].text)) return message; 
        }
    }
    
    const messageWithTimestamp = { ...message, timestamp: message.timestamp || Date.now()};
    currentChat.push(messageWithTimestamp);
    renderCurrentChat();
    if (!message.isTempStatus && !message.isThinking) {
      saveCurrentChat();
    }
    return messageWithTimestamp; 
}


function renderCurrentChat() {
    if (!chatOutput) return;
    chatOutput.innerHTML = '';
    currentChat.forEach((msg, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.role === 'user' ? 'user' : 'ai');
        if (msg.isTempStatus) messageDiv.classList.add('temporary-status');

        let contentHtml = '';
        if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
            if (msg.role === 'model' && typeof marked !== 'undefined' && typeof marked.parse === 'function' && !msg.isTempStatus && !msg.isThinking) {
                try {
                    contentHtml = marked.parse(msg.parts[0].text);
                } catch (e) {
                    console.error("Error parsing markdown:", e);
                    contentHtml = escapeHtml(msg.parts[0].text); 
                }
            } else { 
                contentHtml = escapeHtml(msg.parts[0].text).replace(/\n/g, '<br>');
            }
        } else {
            contentHtml = "内容不可用";
        }
        
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('message-content-wrapper');
        contentWrapper.innerHTML = contentHtml;
        messageDiv.appendChild(contentWrapper);

        const footerDiv = document.createElement('div');
        footerDiv.classList.add('message-footer');

        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        footerDiv.appendChild(timestampSpan);

        if (msg.role === 'model' && !msg.isThinking && !msg.isTempStatus) {
            const archiveElement = document.createElement('span');
            archiveElement.classList.add('archive-action');

            if (msg.archived) {
                archiveElement.textContent = '已存档';
                archiveElement.classList.add('archived-text');
            } else {
                archiveElement.innerHTML = '&#x1F4C1;'; 
                archiveElement.title = '存档此问答';
                archiveElement.classList.add('archive-icon');
                archiveElement.onclick = (e) => {
                    e.stopPropagation();
                    archiveQaPair(index); 
                };
            }
            footerDiv.appendChild(archiveElement);
        }
        messageDiv.appendChild(footerDiv);
        chatOutput.appendChild(messageDiv);
    });
    if (chatOutput.scrollHeight > chatOutput.clientHeight) {
        chatOutput.scrollTop = chatOutput.scrollHeight;
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function clearSelectedTextPreview() {
    currentSelectedText = null;
    if (selectedTextPreview) selectedTextPreview.style.display = 'none';
    if (selectedTextContent) selectedTextContent.textContent = '';
}

function saveChatHistory() { 
    const cleanAllChats = allChats.map(chat => 
        chat.filter(msg => !msg.isTempStatus && !msg.isThinking)
    );
    chrome.storage.local.set({ 'geminiChatHistory': cleanAllChats });
}

function saveCurrentChat() { 
    const chatToStore = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));

    if (chatToStore.length === 0) {
        saveChatHistory();
        return;
    }
    
    let foundAndUpdated = false;
    if (allChats.length > 0) {
        const existingChatIndex = allChats.findIndex(
            histChat => histChat.length > 0 && chatToStore.length > 0 && histChat[0].timestamp === chatToStore[0].timestamp
        );

        if (existingChatIndex !== -1) { 
            allChats[existingChatIndex] = [...chatToStore]; 
            foundAndUpdated = true;
        }
    }

    if (!foundAndUpdated) { 
        allChats.unshift([...chatToStore]); 
    }

    if (allChats.length > 50) { 
        allChats = allChats.slice(0, 50);
    }
    saveChatHistory(); 
    renderChatHistoryList(); 
}


async function loadChatHistory() {
    return new Promise(resolve => {
        chrome.storage.local.get(['geminiChatHistory'], (result) => {
            if (result.geminiChatHistory) {
                allChats = result.geminiChatHistory.map(chat => chat.filter(msg => msg.parts && msg.parts.length > 0 && msg.parts[0].text));
            } else {
                allChats = [];
            }

            if (allChats.length > 0 && currentChat.length === 0) { 
                currentChat = [...allChats[0]];
            } else if (currentChat.length === 0) { 
                 currentChat = [];
            }
            renderCurrentChat();
            renderChatHistoryList();
            resolve();
        });
    });
}

async function loadArchivedChats() {
    return new Promise(resolve => {
        chrome.storage.local.get(['geminiArchivedChats'], (result) => {
            if (result.geminiArchivedChats) {
                archivedChats = result.geminiArchivedChats;
            } else {
                archivedChats = [];
            }
            updateArchivedChatsButtonCount();
            resolve();
        });
    });
}

function saveArchivedChats() {
    chrome.storage.local.set({ 'geminiArchivedChats': archivedChats }, () => {
        updateArchivedChatsButtonCount();
    });
}


function renderChatHistoryList() {
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    allChats.forEach((chat, index) => {
        if (chat.length > 0) {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            
            const firstMeaningfulMsg = chat.find(msg => msg.parts && msg.parts[0] && msg.parts[0].text && !msg.isThinking && !msg.isTempStatus);
            let titleText = `对话 ${allChats.length - index}`;
            if (firstMeaningfulMsg) {
                const rolePrefix = firstMeaningfulMsg.role === 'user' ? "You: " : "AI: ";
                titleText = rolePrefix + firstMeaningfulMsg.parts[0].text.substring(0, 30) + (firstMeaningfulMsg.parts[0].text.length > 30 ? '...' : '');
            }
            
            const titleSpan = document.createElement('span');
            titleSpan.classList.add('history-item-title');
            titleSpan.textContent = titleText;
            historyItem.appendChild(titleSpan);

            const buttonsWrapper = document.createElement('div');
            buttonsWrapper.classList.add('history-item-buttons');

            const archiveButton = document.createElement('button');
            archiveButton.textContent = '存档';
            archiveButton.classList.add('archive-btn');
            archiveButton.title = '将此完整对话存档';
            archiveButton.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定要存档这个完整对话 ("${titleText}") 吗？`)) {
                    const chatToArchiveFromHistory = allChats.splice(index, 1)[0];
                    const cleanChatToArchive = chatToArchiveFromHistory.map(m => {
                        const copy = {...m};
                        delete copy.archived;
                        return copy;
                    });
                    archivedChats.unshift(cleanChatToArchive);
                    saveChatHistory(); 
                    saveArchivedChats(); 
                    renderChatHistoryList(); 
                    if (currentChat.length > 0 && chatToArchiveFromHistory.length > 0 && currentChat[0]?.timestamp === chatToArchiveFromHistory[0]?.timestamp) {
                        currentChat = [];
                        renderCurrentChat();
                        addMessageToChat({ role: 'model', parts: [{text: '当前对话已存档。新对话开始。'}], timestamp: Date.now() });
                    }
                }
            };
            buttonsWrapper.appendChild(archiveButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.classList.add('delete-btn');
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定要删除这个对话 ("${titleText}") 吗？`)) {
                    const deletedChat = allChats.splice(index, 1)[0];
                    saveChatHistory();
                    renderChatHistoryList();
                    if (currentChat.length > 0 && deletedChat.length > 0 && currentChat[0]?.timestamp === deletedChat[0]?.timestamp) {
                        currentChat = [];
                        renderCurrentChat();
                         addMessageToChat({ role: 'model', parts: [{text: '当前对话已从历史中删除。新对话开始。'}], timestamp: Date.now() });
                    }
                }
            };
            buttonsWrapper.appendChild(deleteButton);
            historyItem.appendChild(buttonsWrapper);

            historyItem.onclick = () => { 
                currentChat = [...chat];
                renderCurrentChat();
            };
            chatHistoryList.appendChild(historyItem);
        }
    });
}

document.addEventListener('DOMContentLoaded', initialize);