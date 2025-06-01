// g-extension/sidebar.js

// --- 全局变量 ---
let geminiApiKey = null;
let currentChat = [];
let allChats = [];
let archivedChats = []; // For temporarily holding loaded archived chats if needed by sidebar
let currentSelectedText = null;

// --- DOM 元素获取 ---
let chatOutput, chatInput, sendMessageButton, summarizePageButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    historyPanel, chatHistoryList, clearAllHistoryButton,
    splitChatButton, saveCurrentChatButton, viewArchivedChatsButton; // New buttons

// --- 初始化和API Key加载 ---
async function initialize() {
    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    historyPanel = document.getElementById('history-panel'); // Ensure this ID matches HTML if not already. Corrected from your HTML: it is class history-panel
    chatHistoryList = document.getElementById('chatHistoryList');
    clearAllHistoryButton = document.getElementById('clearAllHistoryButton');
    splitChatButton = document.getElementById('splitChatButton');
    saveCurrentChatButton = document.getElementById('saveCurrentChatButton');
    viewArchivedChatsButton = document.getElementById('viewArchivedChatsButton');

    // Correcting historyPanel selector if it's a class as in the HTML provided
    historyPanel = document.querySelector('.history-panel');


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

    loadChatHistory(); // Loads allChats
    loadArchivedChats(); // Loads archivedChats (needed for count or if sidebar interacts with them directly)

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

    // toggleHistoryButton and its listener are removed. History panel is now always visible.

    if (clearAllHistoryButton) {
        clearAllHistoryButton.addEventListener('click', () => {
            if (confirm("确定要清除所有对话历史吗？此操作无法撤销。")) {
                allChats = [];
                currentChat = []; // Also clear current chat if all history is wiped
                saveChatHistory();
                renderChatHistoryList();
                renderCurrentChat(); // Re-render current empty chat
                addMessageToChat({ role: 'model', parts: [{text: '所有对话历史已清除。'}], timestamp: Date.now() });
            }
        });
    }

    if (splitChatButton) {
        splitChatButton.addEventListener('click', handleSplitChat);
    }

    if (saveCurrentChatButton) {
        saveCurrentChatButton.addEventListener('click', handleSaveCurrentChat);
    }

    if (viewArchivedChatsButton) {
        viewArchivedChatsButton.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
        });
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.geminiApiKey) {
            geminiApiKey = changes.geminiApiKey.newValue;
            addMessageToChat({ role: 'model', parts: [{text: 'API 密钥已更新。'}], timestamp: Date.now() });
            enableInputs();
        }
        if (namespace === 'local' && changes.geminiChatHistory) {
            allChats = changes.geminiChatHistory.newValue.map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking));
            renderChatHistoryList();
        }
        if (namespace === 'local' && changes.geminiArchivedChats) {
            // Potentially update UI if sidebar shows archive count, etc.
            archivedChats = changes.geminiArchivedChats.newValue;
        }
    });

    chrome.runtime.onMessage.addListener(handleRuntimeMessages);
}

function handleSplitChat() {
    const chatToArchive = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));
    if (chatToArchive.length > 0) {
        // Check if this exact chat is already the latest in allChats
        let alreadyExists = false;
        if (allChats.length > 0) {
            const latestHistoryChat = allChats[0];
            if (JSON.stringify(latestHistoryChat) === JSON.stringify(chatToArchive)) {
                alreadyExists = true;
            }
        }
        if (!alreadyExists) {
            allChats.unshift([...chatToArchive]); // Add as a new entry
            if (allChats.length > 50) allChats.pop();
            saveChatHistory(); // Saves allChats
            renderChatHistoryList();
        }
    }
    currentChat = [];
    renderCurrentChat();
    addMessageToChat({ role: 'model', parts: [{text: '对话已分割。新的对话已开始。'}], timestamp: Date.now() });
    saveCurrentChat(); // Save the new state (empty current chat, potentially updated allChats)
}

function handleSaveCurrentChat() {
    const chatToSave = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));
    if (chatToSave.length === 0) {
        addMessageToChat({ role: 'model', parts: [{text: '当前对话为空或仅包含临时消息，无法保存。'}], timestamp: Date.now() });
        return;
    }

    let alreadyExists = false;
    if (allChats.length > 0) {
        // A simple way to check for duplicates: compare with the most recent entry
        // More sophisticated check might involve comparing content or timestamps more deeply
        const latestHistoryChat = allChats[0];
        if (JSON.stringify(latestHistoryChat) === JSON.stringify(chatToSave)) {
            alreadyExists = true;
        }
    }

    if (!alreadyExists) {
        allChats.unshift([...chatToSave]); // Add as a new distinct entry
        if (allChats.length > 50) { // Limit history size
            allChats.pop();
        }
        saveChatHistory(); // This saves the updated allChats array
        renderChatHistoryList();
        addMessageToChat({ role: 'model', parts: [{text: '当前对话已保存到历史记录。'}], timestamp: Date.now() });
    } else {
        addMessageToChat({ role: 'model', parts: [{text: '当前对话已是最新历史记录。'}], timestamp: Date.now() });
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
        removeLastMessageFromChatByContent(`正在总结链接`);
        addMessageToChat({ role: 'model', parts: [{text: `总结链接 [${title || url}](${url}) 失败: ${message}`}], timestamp: Date.now() });
        sendResponse({status: "Error displayed"});

    } else if (request.type === 'LINK_SUMMARIZATION_STARTED') {
        const { url, title } = request;
        removeLastMessageFromChatByContent(`正在总结链接`); 
        addMessageToChat({ role: 'model', parts: [{text: `正在总结链接: [${title || url}](${url})... 请稍候。`}], timestamp: Date.now(), isTempStatus: true });
        sendResponse({status: "Notified user"});

    } else if (request.type === "TRIGGER_SIDEBAR_PAGE_SUMMARY") {
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
            saveCurrentChat(); 
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
        removeLastMessageFromChatByContent(summaryRequestText); // More robust removal

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
    // Disable new buttons if needed
    if (splitChatButton) splitChatButton.disabled = true;
    if (saveCurrentChatButton) saveCurrentChatButton.disabled = true;
}

function enableInputs() {
    if (chatInput) chatInput.disabled = false;
    if (sendMessageButton) sendMessageButton.disabled = false;
    if (summarizePageButton) summarizePageButton.disabled = false;
    // Enable new buttons
    if (splitChatButton) splitChatButton.disabled = false;
    if (saveCurrentChatButton) saveCurrentChatButton.disabled = false;
}

async function callGeminiAPI(parts, isSummary = false) {
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未配置。'}], timestamp: Date.now() });
        return;
    }

    const thinkingMessage = { role: 'model', parts: [{text: '正在思考中...'}], timestamp: Date.now(), isThinking: true };
    addMessageToChat(thinkingMessage);

    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

    // Construct context from currentChat, excluding the last "thinking" message
    const conversationContext = currentChat.filter(msg => !msg.isThinking && !msg.isTempStatus) // Exclude temporary messages
                                        .map(msg => ({
                                            role: msg.role,
                                            parts: msg.parts.map(part => ({ text: part.text }))
                                        }));
    // Remove the last user message from context if it's the one we just added
    // For API call, the last user message is provided in 'parts'
    if (conversationContext.length > 0 && conversationContext.at(-1).role === 'user') {
       // conversationContext.pop(); // The current 'parts' is the latest user message
    }


    const requestBody = {
        contents: [...conversationContext], // Send the whole conversation history as context
                                            // The API will treat the last user message in `contents` array
                                            // as the current prompt if `parts` is what the user typed now.
                                            // For Gemini, the API expects contents to be an array of Content objects.
                                            // Each Content object has a role and parts.
                                            // The provided `parts` parameter to this function IS the latest user message.
                                            // So, we should remove the last message from `currentChat` before forming `contents` for API
                                            // if it's the one we're sending now.
    };
     // The `parts` argument to callGeminiAPI *is* the current user turn.
     // So, the `conversationContext` should be the history *before* this turn.
    const historyForAPI = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus || (msg.role === 'user' && msg.parts[0].text === parts[0].text && msg.timestamp === currentChat.at(-2)?.timestamp) ))
                                    .slice(0, -1) // Exclude the current user message itself from history fed to API if it's already added to currentChat
                                    .map(msg => ({
                                        role: msg.role,
                                        parts: msg.parts.map(part => ({ text: part.text}))
                                    }));


    requestBody.contents = [...historyForAPI, { role: "user", parts: parts }];


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

function renderCurrentChat() {
    if (!chatOutput) {
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

// Saves allChats to storage
function saveChatHistory() {
    const cleanAllChats = allChats.map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking));
    chrome.storage.local.set({ 'geminiChatHistory': cleanAllChats });
}

// Saves the currentChat into allChats (usually as the first element) and then calls saveChatHistory
function saveCurrentChat() {
    const chatToStore = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));

    if (chatToStore.length === 0) { // Don't save if current chat is empty or only temp
        if (currentChat.some(msg => msg.isThinking || msg.isTempStatus)) {
            // If it only had temp messages, don't try to save it as a persistent chat record
        } else {
             // If currentChat is truly empty, and allChats exists, we don't need to do much
             // unless an action just cleared currentChat and expects allChats to be persisted.
        }
    } else {
        // Check if allChats[0] is the same as chatToStore to avoid trivial duplicate updates
        if (allChats.length > 0 &&
            allChats[0].length > 0 &&
            JSON.stringify(allChats[0]) === JSON.stringify(chatToStore)) {
            // It's the same as the most recent, no need to add again, just ensure history is saved
        } else {
            // It's a new or significantly different chat, add it
            // Find if an identical chat already exists as allChats[0] based on first/last message timestamps
            const existingChatIndex = allChats.findIndex(
                (chat) => chat.length > 0 && chatToStore.length > 0 &&
                          chat[0]?.timestamp === chatToStore[0]?.timestamp &&
                          chat[chat.length-1]?.timestamp === chatToStore[chatToStore.length-1]?.timestamp &&
                          JSON.stringify(chat) === JSON.stringify(chatToStore) // Stricter check
            );

            if (existingChatIndex === 0) { // if it's the first one and identical
                allChats[0] = [...chatToStore]; // Update it
            } else if (existingChatIndex > 0) { // if it exists elsewhere, move to top
                allChats.splice(existingChatIndex, 1);
                allChats.unshift([...chatToStore]);
            }
            else { // It's a new chat
                allChats.unshift([...chatToStore]);
            }
        }
        if (allChats.length > 50) { // Keep history to a manageable size
            allChats.pop();
        }
    }
    saveChatHistory(); // Persist allChats
}


function loadChatHistory() {
    chrome.storage.local.get(['geminiChatHistory'], (result) => {
        if (result.geminiChatHistory) {
            allChats = result.geminiChatHistory.map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking && msg.parts && msg.parts.length > 0 && msg.parts[0].text));
        } else {
            allChats = [];
        }

        if (allChats.length > 0) {
            // Load the most recent chat into currentChat if currentChat is empty
            // Or, if a chat was previously selected from history, that would be currentChat.
            // For now, if currentChat is empty, load the latest.
            if (currentChat.length === 0) {
                 currentChat = [...allChats[0]];
            }
        } else {
            // currentChat might have been initialized with a welcome message if allChats is empty
            if (currentChat.length === 0) {
                 currentChat = []; // Or a default welcome message
            }
        }
        renderCurrentChat();
        renderChatHistoryList();
    });
}

function loadArchivedChats() {
    chrome.storage.local.get(['geminiArchivedChats'], (result) => {
        if (result.geminiArchivedChats) {
            archivedChats = result.geminiArchivedChats;
        } else {
            archivedChats = [];
        }
        // No rendering here, archive.html will handle it.
        // We could update a counter for the "View Archived Chats" button if desired.
        if (viewArchivedChatsButton) {
            // Example: viewArchivedChatsButton.textContent = `View Archived Chats (${archivedChats.length})`;
        }
    });
}

function saveArchivedChats() {
    chrome.storage.local.set({ 'geminiArchivedChats': archivedChats });
    // Update button text if showing count
    if (viewArchivedChatsButton) {
        // Example: viewArchivedChatsButton.textContent = `View Archived Chats (${archivedChats.length})`;
    }
}


function renderChatHistoryList() {
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    allChats.forEach((chat, index) => {
        if (chat.length > 0) {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            const firstUserMsg = chat.find(msg => msg.role === 'user' && msg.parts && msg.parts[0] && msg.parts[0].text);
            let titleText = `对话 ${allChats.length - index}`;
            if (firstUserMsg && firstUserMsg.parts && firstUserMsg.parts[0] && firstUserMsg.parts[0].text) {
                titleText = firstUserMsg.parts[0].text.substring(0, 30) + (firstUserMsg.parts[0].text.length > 30 ? '...' : '');
            } else {
                 const firstModelMsg = chat.find(msg => msg.role === 'model' && !msg.isThinking && !msg.isTempStatus && msg.parts && msg.parts[0] && msg.parts[0].text);
                 if (firstModelMsg && firstModelMsg.parts && firstModelMsg.parts[0] && firstModelMsg.parts[0].text) {
                     titleText = "AI: " + firstModelMsg.parts[0].text.substring(0, 27) + (firstModelMsg.parts[0].text.length > 27 ? '...' : '');
                 } else if (chat[0] && chat[0].parts && chat[0].parts[0] && chat[0].parts[0].text) { // Fallback to first message
                    titleText = (chat[0].role === 'user' ? "User: " : "AI: ") + chat[0].parts[0].text.substring(0,25) + (chat[0].parts[0].text.length > 25 ? "..." : "");
                 }
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
            archiveButton.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定要存档这个对话 ("${titleText}") 吗？它将从主历史列表移动到存档。`)) {
                    const chatToArchive = allChats.splice(index, 1)[0];
                    archivedChats.unshift(chatToArchive); // Add to beginning of archives
                    saveChatHistory(); // Save modified allChats
                    saveArchivedChats(); // Save new archivedChats
                    renderChatHistoryList(); // Re-render history
                    // If the archived chat was the current chat, clear current chat
                    if (currentChat.length > 0 && chatToArchive.length > 0 && currentChat[0]?.timestamp === chatToArchive[0]?.timestamp) {
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

            historyItem.onclick = () => { // Load chat on click
                currentChat = [...chat];
                renderCurrentChat();
                // No need to saveCurrentChat() here as it's just loading, not modifying
                // if (historyPanel) historyPanel.style.display = 'none'; // History panel is always visible now
            };
            chatHistoryList.appendChild(historyItem);
        }
    });
}

document.addEventListener('DOMContentLoaded', initialize);