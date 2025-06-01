// g-extension/sidebar.js

// --- 全局变量 ---
let geminiApiKey = null;
let currentChat = [];
let allChats = [];
let archivedChats = [];
let currentSelectedText = null;
let currentSelectedImageUrl = null; // New: For selected image URL
let promptTemplates = [];

// --- DOM 元素获取 ---
let chatOutput, chatInput, sendMessageButton, summarizePageButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    selectedImagePreviewContainer, clearSelectedImageButton, // New: For image preview
    historyPanel, chatHistoryList, clearAllHistoryButton,
    splitChatButton, viewArchivedChatsButton,
    managePromptsButton, promptShortcutsContainer;


// --- 初始化和API Key加载 ---
async function initialize() {
    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    selectedImagePreviewContainer = document.getElementById('selectedImagePreviewContainer'); // New
    clearSelectedImageButton = document.getElementById('clearSelectedImageButton'); // New
    historyPanel = document.querySelector('.history-panel');
    // chatHistoryList = document.getElementById('chatHistoryList'); // This was removed from HTML
    clearAllHistoryButton = document.getElementById('clearAllHistoryButton');
    splitChatButton = document.getElementById('splitChatButton');
    viewArchivedChatsButton = document.getElementById('viewArchivedChatsButton');
    managePromptsButton = document.getElementById('managePromptsButton');
    promptShortcutsContainer = document.getElementById('promptShortcuts');


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
    await loadPromptTemplates();

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
    if (clearSelectedImageButton) clearSelectedImageButton.addEventListener('click', clearSelectedImagePreview); // New


    if (clearAllHistoryButton) {
        clearAllHistoryButton.addEventListener('click', () => {
            if (confirm("确定要清除所有对话历史吗？此操作无法撤销。")) {
                allChats = [];
                currentChat = [];
                saveChatHistory();
                renderChatHistoryList(); // This function might need adjustment if chatHistoryList element is gone
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
    if (managePromptsButton) {
        managePromptsButton.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('prompts.html') });
        });
    }


    chrome.storage.onChanged.addListener(async (changes, namespace) => {
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
            if (changes.promptTemplates) {
                await loadPromptTemplates();
            }
        }
    });
    chrome.runtime.onMessage.addListener(handleRuntimeMessages);
}

async function loadPromptTemplates() {
    const result = await chrome.storage.local.get(['promptTemplates']);
    const presets = [
        { id: 'preset-translate', name: '翻译', content: '请将以下文本翻译成[目标语言]：\n\n{{text}}', isPreset: true },
        { id: 'preset-summarize', name: '总结', content: '请总结以下文本的主要内容：\n\n{{text}}', isPreset: true }
    ];

    if (result.promptTemplates && result.promptTemplates.length > 0) {
        promptTemplates = result.promptTemplates;
        presets.forEach(preset => {
            const existing = promptTemplates.find(p => p.id === preset.id);
            if (!existing) {
                promptTemplates.unshift(preset);
            } else if (existing.isPreset) {
                existing.name = preset.name;
                existing.content = preset.content;
            }
        });
    } else {
        promptTemplates = [...presets];
        await chrome.storage.local.set({ promptTemplates: promptTemplates });
    }
    renderPromptShortcuts();
}

function renderPromptShortcuts() {
    if (!promptShortcutsContainer) return;
    promptShortcutsContainer.innerHTML = '';

    promptTemplates.forEach(template => {
        const button = document.createElement('button');
        button.classList.add('prompt-shortcut-button');
        button.textContent = template.name;
        button.title = template.content.substring(0, 100) + (template.content.length > 100 ? '...' : '');
        button.addEventListener('click', () => applyPromptTemplate(template));
        promptShortcutsContainer.appendChild(button);
    });
}

function applyPromptTemplate(template) {
    let content = template.content;
    if (currentSelectedText && content.includes("{{text}}")) {
        content = content.replace(/{{text}}/g, currentSelectedText);
    } else if (!content.includes("{{text}}") && currentSelectedText){
        // If template doesn't use {{text}} but text is selected, perhaps user wants to ask about selected text using the template as a base query
        // For now, we just populate the template as is. User can manually add {{text}} or clear selected text.
    }
    chatInput.value = content;
    chatInput.focus();
}

// --- New Image Preview Functions ---
function displaySelectedImagePreview(imageUrl) {
    if (selectedImagePreviewContainer && imageUrl) {
        selectedImagePreviewContainer.innerHTML = `<img src="${imageUrl}" alt="Selected image preview" style="max-width: 100%; max-height: 150px; object-fit: contain; border: 1px solid var(--border-color); border-radius: var(--border-radius);">`;
        selectedImagePreviewContainer.style.display = 'block';
        if (clearSelectedImageButton) clearSelectedImageButton.style.display = 'block'; // Show clear button
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        clearSelectedImagePreview();
    }
}

function clearSelectedImagePreview() {
    currentSelectedImageUrl = null;
    if (selectedImagePreviewContainer) {
        selectedImagePreviewContainer.innerHTML = '';
        selectedImagePreviewContainer.style.display = 'none';
    }
    if (clearSelectedImageButton) clearSelectedImageButton.style.display = 'none';
}
// --- End New Image Preview Functions ---


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
        if (selectedTextPreview) selectedTextPreview.style.display = 'flex';
        sendResponse({status: "Selected text received in sidebar"});
    } else if (request.type === 'IMAGE_SELECTED_FOR_SIDEBAR') { // New: Handle image selection
        currentSelectedImageUrl = request.imageUrl;
        displaySelectedImagePreview(currentSelectedImageUrl);
        sendResponse({status: "Image URL received in sidebar"});
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
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接")); // remove any previous
        addMessageToChat({ role: 'model', parts: [{text: `正在总结链接: [${title || url}](${url})... 请稍候。`}], timestamp: Date.now(), isTempStatus: true });
        sendResponse({status: "Notified user"});

    } else if (request.type === "TRIGGER_SIDEBAR_PAGE_SUMMARY") {
        handleSummarizeCurrentPage();
        sendResponse({ status: "Sidebar initiated page summary." });
    }
    return true; // Keep true for async sendResponse
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
    let userMessageForApi = messageText;
    let displayUserMessageInChat = messageText;

    if (currentSelectedText && messageText.includes("{{text}}")) {
        userMessageForApi = messageText.replace(/{{text}}/g, currentSelectedText);
        displayUserMessageInChat = userMessageForApi;
    } else if (currentSelectedText && !messageText.includes("{{text}}") && messageText) {
        userMessageForApi = `关于以下引用内容：\n"${currentSelectedText}"\n\n我的问题/指令是：\n"${messageText}"`;
        displayUserMessageInChat = `(引用内容: ${currentSelectedText.substring(0,50)}...) ${messageText}`;
    }

    const imageUrlToSend = currentSelectedImageUrl;

    if (!userMessageForApi.trim() && !imageUrlToSend) {
        const tempMsg = addMessageToChat({ role: 'model', parts: [{text: '请输入消息或选择图片/文本后再发送。'}], timestamp: Date.now(), isTempStatus: true });
        setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === tempMsg.timestamp && msg.isTempStatus), 3000);
        return;
    }
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
        disableInputs();
        return;
    }

    let finalDisplayMessage = displayUserMessageInChat;
    let finalApiTextMessage = userMessageForApi;

    if (imageUrlToSend) {
        if (!finalDisplayMessage.trim()) {
            finalDisplayMessage = "(图片已选择)"; // User sees this if they only sent an image
            finalApiTextMessage = "请描述这张图片。"; // API gets this if user typed nothing
        } else {
            finalDisplayMessage += " (附带图片)";
        }
    }

    if (!finalApiTextMessage.trim() && !imageUrlToSend) { // Double check after all processing
         const tempMsg = addMessageToChat({ role: 'model', parts: [{text: '没有有效内容发送。'}], timestamp: Date.now(), isTempStatus: true });
         setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === tempMsg.timestamp && msg.isTempStatus), 3000);
         return;
    }


    addMessageToChat({ role: 'user', parts: [{text: finalDisplayMessage}], timestamp: Date.now() });

    chatInput.value = '';
    clearSelectedTextPreview();
    clearSelectedImagePreview(); // Clear image after adding user message to chat and before API call

    await callGeminiAPI([{ text: finalApiTextMessage }], false, imageUrlToSend);
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
            await callGeminiAPI([{ text: prompt }], true, null); // Ensure imageUrl is null for page summary
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
    if (managePromptsButton) managePromptsButton.disabled = true;
}

function enableInputs() {
    if (chatInput) chatInput.disabled = false;
    if (sendMessageButton) sendMessageButton.disabled = false;
    if (summarizePageButton) summarizePageButton.disabled = false;
    if (splitChatButton) splitChatButton.disabled = false;
    if (managePromptsButton) managePromptsButton.disabled = false;
}

async function callGeminiAPI(userTextParts, isSummary = false, imageUrl = null) {
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未配置。'}], timestamp: Date.now() });
        return;
    }

    const thinkingMessage = addMessageToChat({ role: 'model', parts: [{text: '正在思考中...'}], timestamp: Date.now(), isThinking: true });

    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

    const historyForAPI = currentChat
        .filter(msg => msg.timestamp < thinkingMessage.timestamp && !msg.isTempStatus && !msg.isThinking && !msg.archived)
        .map(msg => ({
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text })) // Assuming history parts are text
        }));

    const currentUserMessageParts = [];

    // Add text part if provided and not empty
    if (userTextParts && userTextParts.length > 0 && userTextParts[0].text && userTextParts[0].text.trim() !== "") {
        currentUserMessageParts.push({ text: userTextParts[0].text });
    }

    let tempImageStatusMsg = null;
    if (imageUrl) {
        try {
            tempImageStatusMsg = addMessageToChat({ role: 'model', parts: [{text: '正在加载并处理图片...'}], timestamp: Date.now(), isTempStatus: true });
            const response = await fetch(imageUrl);
            if (!response.ok) {
                 throw new Error(`图片获取失败: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();
            const mimeType = blob.type || 'application/octet-stream'; // Fallback MIME type

            if (!mimeType.startsWith('image/')) {
                throw new Error(`提供的URL不是有效的图片类型 (MIME: ${mimeType})。请选择图片文件。`);
            }

            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = (error) => reject(new Error("图片读取失败: " + error.message));
                reader.readAsDataURL(blob);
            });
            currentUserMessageParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            });
            if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
        } catch (error) {
            console.error('Error fetching or processing image:', error);
            if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
            removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
            addMessageToChat({ role: 'model', parts: [{text: `图片处理错误: ${error.message}`}], timestamp: Date.now() });
            return;
        }
    }

    if (currentUserMessageParts.length === 0) {
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        addMessageToChat({ role: 'model', parts: [{text: '没有内容可以发送给AI。'}], timestamp: Date.now() });
        return;
    }
    
    const requestContents = [...historyForAPI, { role: "user", parts: currentUserMessageParts }];

    const requestBody = {
        contents: requestContents,
        // generationConfig: { // Optional: Add configuration if needed
        //   temperature: 0.7,
        //   topK: 40,
        // }
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP 错误 ${response.status}: ${response.statusText}` } }));
            console.error('Gemini API Error:', errorData);
            let detailedErrorMessage = `API 调用失败: ${errorData.error?.message || response.statusText}`;
            if (errorData.error?.details) {
                detailedErrorMessage += ` 详情: ${JSON.stringify(errorData.error.details)}`;
            }
            addMessageToChat({ role: 'model', parts: [{text: detailedErrorMessage}], timestamp: Date.now() });
            return;
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
            const aiResponse = data.candidates[0].content.parts.map(part => part.text).join("\n");
            addMessageToChat({ role: 'model', parts: [{text: aiResponse}], timestamp: Date.now() });
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
             addMessageToChat({ role: 'model', parts: [{text: `请求被阻止: ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`}], timestamp: Date.now() });
        } else {
            console.warn("Gemini API Response did not contain expected content:", data);
            addMessageToChat({ role: 'model', parts: [{text: '未能从API获取有效回复。响应结构可能不符合预期。'}], timestamp: Date.now() });
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        addMessageToChat({ role: 'model', parts: [{text: `与API通讯时发生错误: ${error.message}`}], timestamp: Date.now() });
    }
}

function addMessageToChat(message) {
    if (!message.parts || !Array.isArray(message.parts) || message.parts.length === 0 || typeof message.parts[0].text !== 'string') {
        message.parts = [{ text: message.text || "无效消息格式" }];
    }

    if (message.isTempStatus && message.parts[0].text.includes("正在总结链接")) {
         // Remove any existing "summarizing link" messages to prevent duplicates
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
    }
     if (message.isTempStatus && message.parts[0].text.includes("正在加载并处理图片...")) {
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在加载并处理图片..."));
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
        if (msg.isThinking) messageDiv.classList.add('thinking-status');


        let contentHtml = '';
        if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
            if (msg.role === 'model' && typeof marked !== 'undefined' && typeof marked.parse === 'function' && !msg.isTempStatus && !msg.isThinking) {
                try {
                    // Ensure text is a string before passing to marked.parse
                    const textToParse = String(msg.parts[0].text || "");
                    contentHtml = marked.parse(textToParse);
                } catch (e) {
                    console.error("Error parsing markdown:", e, "for text:", msg.parts[0].text);
                    contentHtml = escapeHtml(String(msg.parts[0].text || ""));
                }
            } else {
                contentHtml = escapeHtml(String(msg.parts[0].text || "")).replace(/\n/g, '<br>');
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

        if (msg.role === 'model' && !msg.isThinking && !msg.isTempStatus && !msg.archived) { // Don't show archive for already archived
            const archiveElement = document.createElement('span');
            archiveElement.classList.add('archive-action');
            archiveElement.innerHTML = '&#x1F4C1;'; // Folder icon
            archiveElement.title = '存档此问答';
            archiveElement.classList.add('archive-icon');
            archiveElement.onclick = (e) => {
                e.stopPropagation();
                archiveQaPair(index);
            };
            footerDiv.appendChild(archiveElement);
        } else if (msg.archived) {
            const archivedTextSpan = document.createElement('span');
            archivedTextSpan.classList.add('archived-text');
            archivedTextSpan.textContent = '已存档';
            footerDiv.appendChild(archivedTextSpan);
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

    if (chatToStore.length === 0 && allChats.length > 0 && allChats[0]?.length === 0) {
        // Avoid saving an empty current chat if allChats[0] is already empty or doesn't exist
        // Or if the first history item is already this empty chat (e.g. after split)
         const firstHistIsEmpty = allChats.length > 0 && allChats[0].length === 0;
         if(!firstHistIsEmpty && allChats.length > 0 && currentChat.length === 0){
            // if current chat is empty but was previously the one at allChats[0]
            // we might want to remove it or update it to empty.
            // For now, let's not add a new empty chat if allChats[0] was the one just cleared.
         } else if (currentChat.length > 0 || allChats.length === 0 || (allChats.length > 0 && allChats[0].length > 0) ) {
            // Proceed to save if currentChat has content, or if there's no history, or if current history head isn't already empty
         } else {
            // Potentially, currentChat is empty and allChats[0] was just this chat.
            // If allChats[0] corresponds to the *just cleared* currentChat, update it.
            const currentChatOriginalTimestamp = currentChat[0]?.timestamp; // This will be undefined if currentChat is empty
            const allChatsHeadTimestamp = allChats[0]?.[0]?.timestamp;
            if(allChats.length > 0 && !currentChatOriginalTimestamp && allChatsHeadTimestamp &&
               currentChat.length === 0 && allChats[0].length > 0 &&
               !allChats.find(c => c.length > 0 && c[0].timestamp === allChatsHeadTimestamp && c.every(m => m.isThinking || m.isTempStatus))
            ){
                 // This case is tricky: current chat is empty, allChats[0] is not empty.
                 // If currentChat was previously allChats[0] and got cleared, allChats[0] should reflect that.
                 // This is complex to track perfectly without more IDs.
                 // The current logic below handles updating existing or unshifting new.
            }
         }
    }


    let foundAndUpdated = false;
    if (allChats.length > 0 && chatToStore.length > 0) { // Only update if chatToStore has content
        const existingChatIndex = allChats.findIndex(
            histChat => histChat.length > 0 && chatToStore.length > 0 && histChat[0].timestamp === chatToStore[0].timestamp
        );

        if (existingChatIndex !== -1) {
            allChats[existingChatIndex] = [...chatToStore];
            foundAndUpdated = true;
        }
    } else if (allChats.length > 0 && chatToStore.length === 0) {
        // If current chat became empty, check if it was the head of allChats
        const firstHistChat = allChats[0];
        // This requires a robust way to identify if firstHistChat *was* the currentChat.
        // For simplicity, if currentChat is empty, we don't add a new empty entry if allChats[0] was non-empty.
        // If allChats[0] was the one being cleared, it should ideally be removed or replaced by an empty array.
        // The split logic handles this by creating a new chat.
        // If user just clears history or deletes the current one, currentChat becomes empty.
        // Let's assume for now that an empty currentChat does not create a new history entry unless allChats is empty.
        if (allChats[0] && allChats[0].length > 0 && currentChat.length === 0 && allChats[0][0].timestamp === currentChat[0]?.timestamp) {
             // This condition is hard to meet if currentChat is empty.
             // The logic below will not unshift an empty chatToStore if allChats is not empty.
        }
    }


    if (!foundAndUpdated && chatToStore.length > 0) {
        allChats.unshift([...chatToStore]);
    } else if (allChats.length === 0 && chatToStore.length > 0){ // If allChats was empty, and current is not
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
                allChats = result.geminiChatHistory.map(chat => chat.filter(msg => msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string'));
                 allChats = allChats.filter(chat => chat.length > 0); // Remove empty chats from history
            } else {
                allChats = [];
            }

            if (currentChat.length === 0) { // Only load from history if current chat is empty
                if (allChats.length > 0) {
                    currentChat = [...allChats[0]];
                } else {
                     currentChat = []; // Start with a truly empty chat if no history
                }
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
    // This function is called but chatHistoryList element was removed.
    // For now, it will do nothing gracefully.
    // If history needs to be displayed differently (e.g. in a dropdown), this needs rework.
    // The 'More history actions' details/summary is the current UI for history management.
    if (!chatHistoryList) { // chatHistoryList is the old element ID, not used by <details>
        // console.log("renderChatHistoryList called, but no chatHistoryList element found. History UI is now via 'More history actions'.");
        return;
    }
    // Keep old logic commented out in case of future UI changes to re-introduce a list
    /*
    chatHistoryList.innerHTML = '';
    allChats.forEach((chat, index) => {
        if (chat.length > 0) {
            const historyItem = document.createElement('div');
            // ... rest of the old list rendering logic
            chatHistoryList.appendChild(historyItem);
        }
    });
    */
}

document.addEventListener('DOMContentLoaded', initialize);