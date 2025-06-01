// g-extension/sidebar.js

// --- 全局变量 ---
let geminiApiKey = null;
let currentChat = [];
let allChats = [];
let currentSelectedText = null;

// --- DOM 元素获取 ---
let chatOutput, chatInput, sendMessageButton, summarizePageButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    toggleHistoryButton, historyPanel, chatHistoryList, clearAllHistoryButton;

// --- 初始化和API Key加载 ---
async function initialize() {
    // console.log("Sidebar (sidePanel): Initializing...");

    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    toggleHistoryButton = document.getElementById('toggleHistoryButton');
    historyPanel = document.getElementById('history-panel');
    chatHistoryList = document.getElementById('chatHistoryList');
    clearAllHistoryButton = document.getElementById('clearAllHistoryButton');

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

    loadChatHistory();
    if (!currentChat || currentChat.length === 0) {
        renderCurrentChat();
    }

    if (sendMessageButton) {
        sendMessageButton.addEventListener('click', handleSendMessage);
    }

    if (chatInput && sendMessageButton) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                sendMessageButton.click();
            }
        });
    }

    if (summarizePageButton) {
        summarizePageButton.addEventListener('click', handleSummarizeCurrentPage);
    }

    if (clearSelectedTextButton) {
        clearSelectedTextButton.addEventListener('click', clearSelectedTextPreview);
    }

    if (toggleHistoryButton && historyPanel) {
        toggleHistoryButton.addEventListener('click', () => {
            const isHidden = historyPanel.style.display === 'none' || historyPanel.style.display === '';
            historyPanel.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                renderChatHistoryList();
            }
        });
    }

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

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.geminiApiKey) {
            geminiApiKey = changes.geminiApiKey.newValue;
            // console.log("Sidebar: Gemini API Key updated.");
            addMessageToChat({ role: 'model', parts: [{text: 'API 密钥已更新。'}], timestamp: Date.now() });
            enableInputs();
        }
    });

    chrome.runtime.onMessage.addListener(handleRuntimeMessages);
    // console.log("Sidebar (sidePanel): Initialized and event listeners attached.");
}

function handleRuntimeMessages(request, sender, sendResponse) {
    if (request.type === 'TEXT_SELECTED_FOR_SIDEBAR') {
        currentSelectedText = request.text;
        if (selectedTextContent) selectedTextContent.textContent = currentSelectedText.length > 100 ? currentSelectedText.substring(0, 97) + '...' : currentSelectedText;
        if (selectedTextPreview) selectedTextPreview.style.display = 'block';
        sendResponse({status: "Selected text received in sidebar"});
    } else if (request.type === 'SUMMARIZE_EXTERNAL_TEXT_FOR_SIDEBAR') {
        const { text, linkUrl, linkTitle, warning } = request;
        // console.log("Sidebar: Received text for external link summary:", linkUrl);
        removeLastMessageFromChatByContent(`正在总结链接`);

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
        // console.error("Sidebar: Error for link summary:", url, message);
        removeLastMessageFromChatByContent(`正在总结链接`);
        addMessageToChat({ role: 'model', parts: [{text: `总结链接 [${title || url}](${url}) 失败: ${message}`}], timestamp: Date.now() });
        sendResponse({status: "Error displayed"});

    } else if (request.type === 'LINK_SUMMARIZATION_STARTED') {
        const { url, title } = request;
        removeLastMessageFromChatByContent(`正在总结链接`); // Clean up previous if any
        addMessageToChat({ role: 'model', parts: [{text: `正在总结链接: [${title || url}](${url})... 请稍候。`}], timestamp: Date.now(), isTempStatus: true });
        sendResponse({status: "Notified user"});

    } else if (request.type === "TRIGGER_SIDEBAR_PAGE_SUMMARY") {
        // console.log("Sidebar: TRIGGER_SIDEBAR_PAGE_SUMMARY received.");
        handleSummarizeCurrentPage();
        sendResponse({ status: "Sidebar initiated page summary." });
    }
    return true;
}


function removeLastMessageFromChatByContent(searchText) {
    for (let i = currentChat.length - 1; i >= 0; i--) {
        const message = currentChat[i];
        if (message.parts && message.parts[0] && message.parts[0].text.includes(searchText) && (message.isTempStatus || message.isThinking)) {
            currentChat.splice(i, 1);
            renderCurrentChat();
            saveCurrentChat(); // Save after modification
            return true;
        }
    }
    return false;
}


async function handleSendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText && !currentSelectedText) {
        addMessageToChat({ role: 'model', parts: [{text: '请输入消息或选择页面文本后再发送。'}], timestamp: Date.now() });
        return;
    }
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
        disableInputs();
        return;
    }

    let userMessageContent = messageText;
    let displayMessage = messageText;

    if (currentSelectedText) {
        userMessageContent = `关于以下引用内容：\n"${currentSelectedText}"\n\n我的问题/指令是：\n"${messageText}"`;
        displayMessage = `(引用内容: ${currentSelectedText.substring(0,50)}...) ${messageText}`;
    }
    addMessageToChat({ role: 'user', parts: [{text: displayMessage}], timestamp: Date.now() });

    chatInput.value = '';
    clearSelectedTextPreview();

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
        removeLastMessageFromChat('user');

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
}

function enableInputs() {
    if (chatInput) chatInput.disabled = false;
    if (sendMessageButton) sendMessageButton.disabled = false;
    if (summarizePageButton) summarizePageButton.disabled = false;
}

async function callGeminiAPI(parts, isSummary = false) {
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未配置。'}], timestamp: Date.now() });
        return;
    }

    const thinkingMessage = { role: 'model', parts: [{text: '正在思考中...'}], timestamp: Date.now(), isThinking: true };
    addMessageToChat(thinkingMessage);

    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

    const requestBody = {
        contents: [{ role: "user", parts: parts }],
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        removeLastMessageFromChatByContent('正在思考中...');

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
        }
        else {
            addMessageToChat({ role: 'model', parts: [{text: '未能从API获取有效回复。'}], timestamp: Date.now() });
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        removeLastMessageFromChatByContent('正在思考中...');
        addMessageToChat({ role: 'model', parts: [{text: `与API通讯时发生错误: ${error.message}`}], timestamp: Date.now() });
    }
}


function addMessageToChat(message) {
    if (!message.parts || !Array.isArray(message.parts) || message.parts.length === 0 || typeof message.parts[0].text !== 'string') {
        // console.warn("addMessageToChat: Invalid message format, skipping.", message);
        message.parts = [{ text: message.text || "无效消息格式" }];
    }
    if (message.isTempStatus) {
        const existingTempMessage = currentChat.find(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
        if (existingTempMessage && existingTempMessage.parts[0].text === message.parts[0].text) {
            return;
        }
    }

    currentChat.push(message);
    renderCurrentChat();
    saveCurrentChat();
}


function removeLastMessageFromChat(role, isThinkingMessage = false) { // Legacy, use removeLastMessageFromChatByContent for specific statuses
    let removed = false;
    for (let i = currentChat.length - 1; i >= 0; i--) {
        const message = currentChat[i];
        if (message.role === role) {
            if (isThinkingMessage && message.isThinking) {
                currentChat.splice(i, 1);
                removed = true;
                break;
            } else if (!isThinkingMessage && !message.isThinking && !message.isTempStatus) {
                currentChat.splice(i, 1);
                removed = true;
                break;
            }
        }
    }
    if (removed) {
        renderCurrentChat();
        saveCurrentChat();
    }
}


function renderCurrentChat() {
    if (!chatOutput) {
        // console.error("renderCurrentChat: chatOutput element not found.");
        return;
    }
    chatOutput.innerHTML = '';
    currentChat.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.role === 'user' ? 'user' : 'ai');
        if (msg.isTempStatus) messageDiv.classList.add('temporary-status');

        let contentHtml = '';
        if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
            if (msg.role === 'model' && typeof marked !== 'undefined' && typeof marked.parse === 'function' && !msg.isTempStatus) {
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
        messageDiv.innerHTML = contentHtml;


        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = new Date(msg.timestamp).toLocaleTimeString();
        messageDiv.appendChild(timestampSpan);

        chatOutput.appendChild(messageDiv);
    });
    chatOutput.scrollTop = chatOutput.scrollHeight;
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
    const chatToSave = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));
    if (chatToSave.length > 0) {
        const existingChatIndex = allChats.findIndex(
            (chat) => chat.length > 0 && chatToSave.length > 0 &&
                      chat[chat.length - 1]?.timestamp === chatToSave[chatToSave.length - 1]?.timestamp && // Add ?. for safety
                      chat[0]?.timestamp === chatToSave[0]?.timestamp
        );

        if (existingChatIndex !== -1) {
            allChats[existingChatIndex] = [...chatToSave];
        } else {
            if (chatToSave.some(msg => msg.parts.some(p => p.text && p.text.trim() !== ''))) {
                 allChats.unshift([...chatToSave]);
            }
        }
        if (allChats.length > 50) {
            allChats.pop();
        }
    }
    const cleanAllChats = allChats.map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking));
    chrome.storage.local.set({ 'geminiChatHistory': cleanAllChats });
}

function saveCurrentChat() {
    if (currentChat && currentChat.length > 0) {
        const chatToStore = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));
         if (chatToStore.length === 0 && currentChat.some(msg => msg.isThinking || msg.isTempStatus)) {
            // No substantial content to save as the "current chat" in allChats yet
         } else if (chatToStore.length === 0) {
            return;
         }

        if (allChats.length > 0 &&
            allChats[0].length > 0 && chatToStore.length > 0 &&
            allChats[0][0]?.timestamp === chatToStore[0]?.timestamp) {
            allChats[0] = [...chatToStore];
        }
        saveChatHistory();
    } else {
        saveChatHistory();
    }
}


function loadChatHistory() {
    chrome.storage.local.get(['geminiChatHistory'], (result) => {
        if (result.geminiChatHistory) {
            allChats = result.geminiChatHistory.map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking));
        } else {
            allChats = [];
        }

        if (allChats.length > 0) {
            currentChat = [...allChats[0]];
        } else {
            currentChat = [];
        }
        renderCurrentChat();
        renderChatHistoryList();
    });
}

function renderChatHistoryList() {
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    allChats.forEach((chat, index) => {
        if (chat.length > 0) {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            const firstUserMsg = chat.find(msg => msg.role === 'user');
            let titleText = `对话 ${allChats.length - index}`;
            if (firstUserMsg && firstUserMsg.parts && firstUserMsg.parts[0] && firstUserMsg.parts[0].text) {
                titleText = firstUserMsg.parts[0].text.substring(0, 30) + (firstUserMsg.parts[0].text.length > 30 ? '...' : '');
            } else {
                 const firstModelMsg = chat.find(msg => msg.role === 'model' && !msg.isThinking && !msg.isTempStatus);
                 if (firstModelMsg && firstModelMsg.parts && firstModelMsg.parts[0] && firstModelMsg.parts[0].text) {
                     titleText = "AI: " + firstModelMsg.parts[0].text.substring(0, 27) + (firstModelMsg.parts[0].text.length > 27 ? '...' : '');
                 }
            }
            historyItem.textContent = titleText;

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定要删除这个对话 ("${titleText}") 吗？`)) {
                    allChats.splice(index, 1);
                    saveChatHistory();
                    renderChatHistoryList();
                    if (currentChat.length > 0 && chat.length > 0 && currentChat[0]?.timestamp === chat[0]?.timestamp) {
                        currentChat = [];
                        renderCurrentChat();
                         addMessageToChat({ role: 'model', parts: [{text: '当前对话已从历史中删除。新对话开始。'}], timestamp: Date.now() });
                    }
                }
            };
            historyItem.appendChild(deleteButton);

            historyItem.onclick = () => {
                currentChat = [...chat];
                renderCurrentChat();
                saveCurrentChat();
                if (historyPanel) historyPanel.style.display = 'none';
            };
            chatHistoryList.appendChild(historyItem);
        }
    });
}

document.addEventListener('DOMContentLoaded', initialize);