// g-extension/sidebar.js

// --- 全局变量 ---
let currentApiKey = null;
let currentApiType = 'gemini'; // Default to Gemini
let currentApiEndpoint = ''; // For OpenAI-compatible APIs
let currentModelName = 'gemini-1.5-flash-latest'; // Default model

let currentChat = [];
let allChats = [];
let archivedChats = [];
let currentSelectedText = null;
let currentSelectedImageUrl = null;
let promptTemplates = [];

// --- DOM 元素获取 ---
let chatOutput, chatInput, sendMessageButton, summarizePageButton, extractContentButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    selectedImagePreviewContainer, clearSelectedImageButton,
    historyPanel, /* chatHistoryList, */ clearAllHistoryButton, // chatHistoryList removed from HTML
    splitChatButton, viewArchivedChatsButton,
    managePromptsButton, promptShortcutsContainer;


// --- 初始化和API Key加载 ---
async function initialize() {
    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    extractContentButton = document.getElementById('extractContentButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    selectedImagePreviewContainer = document.getElementById('selectedImagePreviewContainer');
    clearSelectedImageButton = document.getElementById('clearSelectedImageButton');
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

    // Load active API configuration
    try {
        const result = await chrome.storage.sync.get(['apiConfigurations', 'activeConfigurationId']); //
        const configs = result.apiConfigurations || []; //
        const activeId = result.activeConfigurationId; //
        
        let activeConfig = null;
        if (activeId && configs.length > 0) {
            activeConfig = configs.find(c => c.id === activeId); //
        }
        // If no activeId, or activeId not found, try to use the first available config
        if (!activeConfig && configs.length > 0) {
            activeConfig = configs[0]; //
            // Optionally, save this as the new activeConfigurationId
            // await chrome.storage.sync.set({ activeConfigurationId: activeConfig.id });
            console.warn("No active configuration found or ID mismatch, defaulting to the first available configuration.");
        }

        if (activeConfig) {
            currentApiKey = activeConfig.apiKey; //
            currentApiType = activeConfig.apiType; //
            currentApiEndpoint = activeConfig.apiEndpoint || ''; // Ensure empty string if undefined //
            currentModelName = activeConfig.modelName; //
            
            // Basic validation of the loaded active config
            if (!currentApiKey || !currentModelName || (currentApiType === 'openai' && !currentApiEndpoint)) {
                 addMessageToChat({ role: 'model', parts: [{text: '错误：当前活动的API配置不完整。请检查插件选项。'}], timestamp: Date.now() }); //
                 disableInputs(); //
            } else {
                // Add a temporary status message that will be removed.
                const tempStatusMsg = addMessageToChat({ role: 'model', parts: [{text: `已加载配置: "${activeConfig.configName}" (${activeConfig.apiType})`}], timestamp: Date.now(), isTempStatus: true }); //
                setTimeout(() => removeMessageByContentCheck(msg => msg.isTempStatus && msg.timestamp === tempStatusMsg.timestamp && msg.parts[0].text.includes("已加载配置")), 3000);
                enableInputs(); //
            }
        } else {
            addMessageToChat({ role: 'model', parts: [{text: '错误：未找到任何API配置或未设置活动配置。请在插件选项中添加并设置一个活动配置。'}], timestamp: Date.now() }); //
            disableInputs(); //
        }

    } catch (e) {
        console.error("Sidebar: Error loading API configuration:", e);
        addMessageToChat({ role: 'model', parts: [{text: '错误：加载API配置失败。'}], timestamp: Date.now() });
        disableInputs();
    }

    await loadArchivedChats(); //
    loadChatHistory(); // This now loads history and potentially sets currentChat //
    await loadPromptTemplates(); //

    // If currentChat is still empty after loadChatHistory (e.g. first run or all history cleared)
    if (!currentChat || currentChat.length === 0) {
        renderCurrentChat(); // Ensure UI is at least cleared or shows an initial state
    }


    if (sendMessageButton) sendMessageButton.addEventListener('click', handleSendMessage); //

    if (chatInput && sendMessageButton) {
        chatInput.addEventListener('keydown', (event) => { //
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { //
                event.preventDefault(); sendMessageButton.click(); //
            }
        });
    }

    if (summarizePageButton) summarizePageButton.addEventListener('click', handleSummarizeCurrentPage); //
    if (extractContentButton) extractContentButton.addEventListener('click', handleExtractContent);
    if (clearSelectedTextButton) clearSelectedTextButton.addEventListener('click', clearSelectedTextPreview); //
    if (clearSelectedImageButton) clearSelectedImageButton.addEventListener('click', clearSelectedImagePreview); //


    if (clearAllHistoryButton) {
        clearAllHistoryButton.addEventListener('click', () => { //
            if (confirm("确定要清除所有对话历史吗？此操作无法撤销。")) { //
                allChats = []; //
                currentChat = []; //
                saveChatHistory(); // This will save empty allChats //
                // renderChatHistoryList(); // No longer needed as list display is removed
                renderCurrentChat(); // Clears the current chat display //
                addMessageToChat({ role: 'model', parts: [{text: '所有对话历史已清除。'}], timestamp: Date.now() }); //
            }
        });
    }

    if (splitChatButton) splitChatButton.addEventListener('click', handleSplitChat); //
    if (viewArchivedChatsButton) {
        viewArchivedChatsButton.addEventListener('click', () => { //
            chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') }); //
        });
    }
    if (managePromptsButton) {
        managePromptsButton.addEventListener('click', () => { //
            chrome.tabs.create({ url: chrome.runtime.getURL('prompts.html') }); //
        });
    }


    chrome.storage.onChanged.addListener(async (changes, namespace) => { //
        if (namespace === 'sync' && (changes.apiConfigurations || changes.activeConfigurationId)) { //
            // Reload configurations if either the list or the active ID changes
            const result = await chrome.storage.sync.get(['apiConfigurations', 'activeConfigurationId']); //
            const configs = result.apiConfigurations || []; //
            const activeId = result.activeConfigurationId; //
            let activeConfig = null;

            if (activeId && configs.length > 0) {
                activeConfig = configs.find(c => c.id === activeId); //
            }
            if (!activeConfig && configs.length > 0) { // Fallback to first if activeId is somehow invalid
                 activeConfig = configs[0]; //
                 console.warn("Active configuration ID not found in list after change, defaulting to first available.");
                 // Optionally, update activeConfigurationId in storage here if you want to auto-correct
                 // await chrome.storage.sync.set({ activeConfigurationId: activeConfig.id });
            }
            
            let configStatusMessage = 'API 配置已更新。';
            if (activeConfig) {
                currentApiKey = activeConfig.apiKey; //
                currentApiType = activeConfig.apiType; //
                currentApiEndpoint = activeConfig.apiEndpoint || ''; //
                currentModelName = activeConfig.modelName; //
                configStatusMessage = `已切换到配置: "${activeConfig.configName}" (${activeConfig.apiType})`;

                // Re-validate and enable/disable inputs
                if (!currentApiKey || !currentModelName || (currentApiType === 'openai' && !currentApiEndpoint)) { //
                    addMessageToChat({ role: 'model', parts: [{text: '错误：新的活动API配置不完整。请检查插件选项。'}], timestamp: Date.now() }); //
                    disableInputs(); //
                } else {
                    enableInputs(); //
                }
            } else { // No active config could be determined
                currentApiKey = null; //
                currentApiType = 'gemini'; // Reset to default or keep previous
                currentApiEndpoint = '';
                currentModelName = '';
                configStatusMessage = '未找到有效的活动API配置。请在选项中设置。';
                disableInputs(); //
            }
             addMessageToChat({ role: 'model', parts: [{text: configStatusMessage}], timestamp: Date.now() }); //
        }
        // --- Existing local storage listeners ---
        if (namespace === 'local') { //
            if (changes.geminiChatHistory) { //
                allChats = (changes.geminiChatHistory.newValue || []).map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking)); //
                // renderChatHistoryList(); // No longer needed
            }
            if (changes.geminiArchivedChats) { //
                archivedChats = changes.geminiArchivedChats.newValue || []; //
                updateArchivedChatsButtonCount(); //
            }
            if (changes.promptTemplates) { //
                await loadPromptTemplates(); // This will re-render shortcuts //
            }
        }
    });
    chrome.runtime.onMessage.addListener(handleRuntimeMessages); //
}

async function loadPromptTemplates() {
    const result = await chrome.storage.local.get(['promptTemplates']);
    const presets = [
        { id: 'preset-translate', name: '翻译', content: '请将以下文本翻译成[目标语言]：\n\n{{text}}', isPreset: true },
        { id: 'preset-summarize', name: '总结', content: '请总结以下文本的主要内容：\n\n{{text}}', isPreset: true }
    ];

    if (result.promptTemplates && result.promptTemplates.length > 0) {
        promptTemplates = result.promptTemplates;
        // Ensure presets are always present and correctly marked, but keep user's edits to content/name
        presets.forEach(presetDef => {
            const existing = promptTemplates.find(p => p.id === presetDef.id);
            if (!existing) {
                promptTemplates.unshift({ ...presetDef }); // Add if missing
            } else {
                existing.isPreset = true; // Ensure it's marked as preset
                // Optionally, update name/content to default if they want to "reset" a preset
                // For now, user's changes to preset name/content are kept.
            }
        });
    } else {
        promptTemplates = [...presets];
        // Save if storage was empty and we just populated with presets
        await chrome.storage.local.set({ promptTemplates: promptTemplates });
    }
    // Ensure custom prompts are marked correctly
    promptTemplates.forEach(p => {
        if (!presets.some(presetDef => presetDef.id === p.id)) {
            p.isPreset = false;
        }
    });

    renderPromptShortcuts();
}

function renderPromptShortcuts() {
    if (!promptShortcutsContainer) return;
    promptShortcutsContainer.innerHTML = '';

    // Sort prompts: presets first, then custom by name
    const sortedPrompts = [...promptTemplates].sort((a, b) => {
        if (a.isPreset && !b.isPreset) return -1;
        if (!a.isPreset && b.isPreset) return 1;
        return a.name.localeCompare(b.name);
    });

    sortedPrompts.forEach(template => {
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
    }
    chatInput.value = content;
    chatInput.focus();
    chatInput.scrollTop = chatInput.scrollHeight; // Scroll to end if content is long
}

function displaySelectedImagePreview(imageUrl) {
    if (selectedImagePreviewContainer && imageUrl) {
        selectedImagePreviewContainer.innerHTML = `<img src="${imageUrl}" alt="Selected image preview" style="max-width: 100%; max-height: 150px; object-fit: contain; border: 1px solid var(--border-color); border-radius: var(--border-radius);">`;
        selectedImagePreviewContainer.style.display = 'block';
        if (clearSelectedImageButton) clearSelectedImageButton.style.display = 'block';
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

function updateArchivedChatsButtonCount() {
    if (viewArchivedChatsButton) {
        viewArchivedChatsButton.textContent = `查看已存档对话 (${archivedChats.length})`;
    }
}

function handleSplitChat() {
    const chatToProcess = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));

    if (chatToProcess.length > 0) {
        // Create a clean copy for archiving, removing transient properties
        const archivedCopy = chatToProcess.map(m => {
            const {isThinking, isTempStatus, archived, ...rest} = m;
            return rest;
        });
        archivedChats.unshift(archivedCopy);
        saveArchivedChats();

        // Also save this completed chat to the main history if it's not already the head
        // (it usually will be the head, representing the current active session)
        let alreadyInAllChats = false;
        if (allChats.length > 0 && JSON.stringify(allChats[0]) === JSON.stringify(chatToProcess)) {
            alreadyInAllChats = true;
        }
        if (!alreadyInAllChats) { // If it's a new distinct chat
            allChats.unshift([...chatToProcess]); // Add a copy
            if (allChats.length > 50) allChats.pop(); // Limit history size
            saveChatHistory();
            // renderChatHistoryList(); // No list to render
        }
    }

    currentChat = []; // Start a new chat
    renderCurrentChat();
    addMessageToChat({ role: 'model', parts: [{text: '对话已分割并存档。新的对话已开始。'}], timestamp: Date.now() });
    saveCurrentChat(); // Save the new state (empty current chat, potentially updated allChats)
}


function archiveQaPair(aiMessageIndexInCurrentChat) {
    const aiMessage = currentChat[aiMessageIndexInCurrentChat];
    if (!aiMessage || aiMessage.archived) return;

    let userMessage = null;
    // Find the preceding user message that isn't a temp/thinking status
    for (let i = aiMessageIndexInCurrentChat - 1; i >= 0; i--) {
        if (currentChat[i].role === 'user' && !currentChat[i].isThinking && !currentChat[i].isTempStatus) {
            userMessage = currentChat[i];
            break;
        }
    }

    if (userMessage && aiMessage) {
        // Create clean copies for archiving
        const userMessageCopy = {...userMessage};
        delete userMessageCopy.archived; delete userMessageCopy.isThinking; delete userMessageCopy.isTempStatus;
        const aiMessageCopy = {...aiMessage};
        delete aiMessageCopy.archived; delete aiMessageCopy.isThinking; delete aiMessageCopy.isTempStatus;

        const qaPairToArchive = [userMessageCopy, aiMessageCopy];

        archivedChats.unshift(qaPairToArchive);
        saveArchivedChats();

        // Mark the original AI message in currentChat as archived
        aiMessage.archived = true; // This is a property of the message object in currentChat
        renderCurrentChat(); // Re-render to show "已存档"
        saveCurrentChat(); // Save currentChat with the 'archived' flag

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
    // 使用 switch 语句使消息处理更清晰
    switch (request.type || request.action) {
        case 'TEXT_SELECTED_FOR_SIDEBAR':
            currentSelectedText = request.text;
            if (selectedTextContent) selectedTextContent.textContent = currentSelectedText.length > 100 ? currentSelectedText.substring(0, 97) + '...' : currentSelectedText;
            if (selectedTextPreview) selectedTextPreview.style.display = 'flex';
            sendResponse({status: "Selected text received in sidebar"});
            break;

        case 'IMAGE_SELECTED_FOR_SIDEBAR':
            currentSelectedImageUrl = request.imageUrl;
            displaySelectedImagePreview(currentSelectedImageUrl);
            sendResponse({status: "Image URL received in sidebar"});
            break;

        case 'extractedPageContent': // from page_content_extractor.js
            removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes('正在提取页面主要内容'));
            if (request.error) {
                addMessageToChat({ role: 'model', parts: [{text: `提取失败: ${request.error}${request.warning ? ' ('+request.warning+')' : ''}`}], timestamp: Date.now() });
            } else {
                currentSelectedText = request.content;
                if (selectedTextPreview && selectedTextContent) {
                    selectedTextContent.textContent = `已提取页面内容 (字数: ${currentSelectedText.length})`;
                    selectedTextPreview.style.display = 'flex';
                }
                const successMsgText = `✅ 提取成功 (字数: ${request.content.length})` + (request.warning ? ` (${request.warning})` : '');
                const successMsg = addMessageToChat({ role: 'model', parts: [{text: successMsgText}], timestamp: Date.now(), isTempStatus: true });
                setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === successMsg.timestamp), 6000);
            }
            sendResponse({status: "Page content processed"});
            break;

        case 'EXTRACT_CONTENT_ERROR': // from background.js for special pages
            removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes('正在提取页面主要内容'));
            addMessageToChat({ role: 'model', parts: [{text: `提取失败: ${request.message}`}], timestamp: Date.now() });
            sendResponse({status: "Error notice displayed"});
            break;

        case 'SUMMARIZE_EXTERNAL_TEXT_FOR_SIDEBAR': {
            const { text, linkUrl, linkTitle, warning } = request;
            removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
            addMessageToChat({ role: 'user', parts: [{text: `总结请求：[${linkTitle || '链接'}](${linkUrl}) (内容长度: ${text?.length || 0})`}], timestamp: Date.now() });
            if (warning) {
                addMessageToChat({ role: 'model', parts: [{text: `注意: ${warning}`}], timestamp: Date.now() });
            }
            if (!text || text.trim() === "") {
                addMessageToChat({role: 'model', parts: [{text: `无法总结 [${linkTitle || linkUrl}](${linkUrl})，未能提取到有效文本。`}], timestamp: Date.now() });
                sendResponse({error: "No text provided"});
            } else {
                const prompt = `请使用中文，清晰、简洁且全面地总结以下链接 (${linkTitle ? linkTitle + ' - ' : ''}${linkUrl}) 的主要内容。专注于核心信息，忽略广告、导航栏、页脚等非主要内容。如果内容包含技术信息或代码，请解释其核心概念和用途。如果是一篇文章，请提炼主要观点和论据。总结应易于理解，并抓住内容的精髓。\n\n链接内容文本如下：\n"${text}"`;
                callApi(prompt, true, null).then(() => sendResponse({status: "Summary initiated"})); // Ensure callApi is used
            }
            break;
        }

        case 'SHOW_LINK_SUMMARY_ERROR': {
            const { message, url, title } = request;
            removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
            addMessageToChat({ role: 'model', parts: [{text: `总结链接 [${title || url}](${url}) 失败: ${message}`}], timestamp: Date.now() });
            sendResponse({status: "Error displayed"});
            break;
        }

        case 'LINK_SUMMARIZATION_STARTED': {
            const { url, title } = request;
            removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
            addMessageToChat({ role: 'model', parts: [{text: `正在总结链接: [${title || url}](${url})... 请稍候。`}], timestamp: Date.now(), isTempStatus: true });
            sendResponse({status: "Notified user"});
            break;
        }

        case 'TRIGGER_SIDEBAR_PAGE_SUMMARY':
            handleSummarizeCurrentPage();
            sendResponse({ status: "Sidebar initiated page summary." });
            break;
    }
    return true; // 对异步 sendResponse 很重要
}

function removeMessageByContentCheck(conditionFn) {
    const initialLength = currentChat.length;
    currentChat = currentChat.filter(msg => !conditionFn(msg));
    if (currentChat.length < initialLength) {
        renderCurrentChat();
        // saveCurrentChat(); // Save if a non-transient message was removed. For temp status, often not needed to save.
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
        displayUserMessageInChat = userMessageForApi; // Display the version with text inserted
    } else if (currentSelectedText && !messageText.includes("{{text}}") && messageText) {
        // If user types something AND there's selected text, but no {{text}} placeholder,
        // assume they're asking about the selected text with their typed query.
        userMessageForApi = `关于以下引用内容：\n"${currentSelectedText}"\n\n我的问题/指令是：\n"${messageText}"`;
        displayUserMessageInChat = `(引用内容: ${currentSelectedText.substring(0,50)}...) ${messageText}`;
    } else if (currentSelectedText && !messageText) {
        // If only selected text exists and user types nothing, use selected text as the primary query
        userMessageForApi = currentSelectedText;
        displayUserMessageInChat = currentSelectedText;
    }


    const imageUrlToSend = currentSelectedImageUrl; // This is the URL of the image

    if (!userMessageForApi.trim() && !imageUrlToSend) {
        const tempMsg = addMessageToChat({ role: 'model', parts: [{text: '请输入消息或选择图片/文本后再发送。'}], timestamp: Date.now(), isTempStatus: true });
        setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === tempMsg.timestamp && msg.isTempStatus), 3000);
        return;
    }

    // Validation for API config before sending
    if (!currentApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
        disableInputs(); return;
    }
    if (!currentModelName) {
        addMessageToChat({ role: 'model', parts: [{text: `错误：模型名称未设置。`}], timestamp: Date.now() });
        disableInputs(); return;
    }
    if (currentApiType === 'openai' && !currentApiEndpoint) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：OpenAI API Endpoint 未设置。'}], timestamp: Date.now() });
        disableInputs(); return;
    }


    let finalDisplayMessage = displayUserMessageInChat;
    let finalApiTextMessage = userMessageForApi; // This is what's sent as text part to API

    if (imageUrlToSend) {
        if (!finalApiTextMessage.trim() && !currentSelectedText) { // If no text typed and no text selected
            finalDisplayMessage = "(图片已选择)"; // User sees this
            finalApiTextMessage = "请描述这张图片。"; // API gets this as default prompt for image
        } else {
            finalDisplayMessage = finalDisplayMessage ? `${finalDisplayMessage} (附带图片)` : `(图片已选择，并结合当前文本)`;
        }
    }

    // Ensure there's actually something to send after all processing
    if (!finalApiTextMessage.trim() && !imageUrlToSend) {
         const tempMsg = addMessageToChat({ role: 'model', parts: [{text: '没有有效内容发送。'}], timestamp: Date.now(), isTempStatus: true });
         setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === tempMsg.timestamp && msg.isTempStatus), 3000);
         return;
    }

    addMessageToChat({ role: 'user', parts: [{text: finalDisplayMessage}], timestamp: Date.now() });

    chatInput.value = '';
    clearSelectedTextPreview(); // Clear after message is constructed and added
    clearSelectedImagePreview(); // Clear after message is constructed and added

    await callApi(finalApiTextMessage, false, imageUrlToSend); // Use the potentially modified finalApiTextMessage
}

function handleSummarizeCurrentPage() {
    if (!currentApiKey || !currentModelName || (currentApiType === 'openai' && !currentApiEndpoint)) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：API 配置不完整。请检查插件选项。'}], timestamp: Date.now() });
        disableInputs();
        return;
    }
    const summaryRequestText = '(正在请求总结当前网页...)';
    addMessageToChat({role: 'user', parts: [{text: summaryRequestText}], timestamp: Date.now(), isTempStatus: true }); // Make it temp

    chrome.runtime.sendMessage({ action: "getAndSummarizePage" }, async (response) => {
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text === summaryRequestText); // Remove the temp message

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
            await callApi(prompt, true, null); // Use callApi
        } else if (response && response.error) {
            addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
            addMessageToChat({role: 'model', parts: [{text: `总结错误: ${response.error}`}], timestamp: Date.now() });
        } else {
            addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
            addMessageToChat({role: 'model', parts: [{text: `总结错误: 从背景脚本收到未知响应。`}], timestamp: Date.now() });
        }
    });
}

function handleExtractContent() {
    if (!currentApiKey) { // Use API key check as a proxy for "is extension configured"
        addMessageToChat({ role: 'model', parts: [{text: '错误：API 配置不完整。请检查插件选项。'}], timestamp: Date.now() });
        disableInputs();
        return;
    }
    
    const tempStatusMsg = addMessageToChat({role: 'model', parts: [{text: '正在提取页面主要内容...'}], timestamp: Date.now(), isTempStatus: true });

    chrome.runtime.sendMessage({ action: "extractActiveTabContent" }, (response) => {
        // 这个回调主要处理来自 background 脚本的即时错误，比如注入失败。
        // 实际内容会通过另一条消息返回。
        if (chrome.runtime.lastError || (response && !response.success)) {
            removeMessageByContentCheck(msg => msg.timestamp === tempStatusMsg.timestamp);
            const errorMessage = response?.error || chrome.runtime.lastError?.message || "未知错误";
            addMessageToChat({role: 'model', parts: [{text: `提取失败: ${errorMessage}`}], timestamp: Date.now() });
        }
    });
}


function disableInputs() {
    if (chatInput) chatInput.disabled = true;
    if (sendMessageButton) sendMessageButton.disabled = true;
    if (summarizePageButton) summarizePageButton.disabled = true;
    if (extractContentButton) extractContentButton.disabled = true;
    if (splitChatButton) splitChatButton.disabled = true;
    // Allow managing prompts even if API is not set
    // if (managePromptsButton) managePromptsButton.disabled = true;
}

function enableInputs() {
    if (chatInput) chatInput.disabled = false;
    if (sendMessageButton) sendMessageButton.disabled = false;
    if (summarizePageButton) summarizePageButton.disabled = false;
    if (extractContentButton) extractContentButton.disabled = false;
    if (splitChatButton) splitChatButton.disabled = false;
    // if (managePromptsButton) managePromptsButton.disabled = false;
}

async function callApi(userMessageContent, isSummary = false, imageUrl = null) {
    if (!currentApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：API 密钥未配置。'}], timestamp: Date.now() });
        return;
    }
    if (!currentModelName) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：模型名称未配置。'}], timestamp: Date.now() });
        return;
    }
    if (currentApiType === 'openai' && !currentApiEndpoint) {
        addMessageToChat({ role: 'model', parts: [{text: '错误：OpenAI API Endpoint 未配置。'}], timestamp: Date.now() });
        return;
    }


    const thinkingMessage = addMessageToChat({ role: 'model', parts: [{text: '正在思考中...'}], timestamp: Date.now(), isThinking: true });

    let endpoint = '';
    let requestBody = {};
    let headers = { 'Content-Type': 'application/json' };

    const historyForAPI = currentChat
        .filter(msg => msg.timestamp < thinkingMessage.timestamp && !msg.isTempStatus && !msg.isThinking && !msg.archived)
        .map(msg => {
            const textContent = msg.parts.map(part => part.text).join('\n');
            if (currentApiType === 'openai') {
                return {
                    role: msg.role === 'model' ? 'assistant' : msg.role,
                    content: textContent
                };
            } else { // Gemini
                return {
                    role: msg.role,
                    parts: [{ text: textContent }] // Gemini expects parts to be an array of objects
                };
            }
        });

    // ----- Specific API Request Construction -----
    if (currentApiType === 'gemini') {
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${currentApiKey}`;
        
        const geminiUserParts = [];
        if (userMessageContent && userMessageContent.trim() !== "") {
            geminiUserParts.push({ text: userMessageContent });
        }

        let tempImageStatusMsg = null;
        if (imageUrl) {
            try {
                tempImageStatusMsg = addMessageToChat({ role: 'model', parts: [{text: '正在加载并处理图片 (Gemini)...'}], timestamp: Date.now(), isTempStatus: true });
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error(`图片获取失败: HTTP ${response.status}`);
                const blob = await response.blob();
                const mimeType = blob.type || 'application/octet-stream';
                if (!mimeType.startsWith('image/')) throw new Error(`无效图片MIME类型: ${mimeType}`);
                
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = (error) => reject(new Error("图片读取失败: " + error.message));
                    reader.readAsDataURL(blob);
                });
                geminiUserParts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
                if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
            } catch (error) {
                if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
                removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
                addMessageToChat({ role: 'model', parts: [{text: `图片处理错误 (Gemini): ${error.message}`}], timestamp: Date.now() });
                return;
            }
        }

        if (geminiUserParts.length === 0) {
            removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
            addMessageToChat({ role: 'model', parts: [{text: '没有内容可以发送给AI。'}], timestamp: Date.now() });
            return;
        }
        requestBody = { contents: [...historyForAPI, { role: "user", parts: geminiUserParts }] };

    } else if (currentApiType === 'openai') {
        endpoint = currentApiEndpoint;
        headers['Authorization'] = `Bearer ${currentApiKey}`;

        const openaiCurrentUserMessageContent = [];
        if (userMessageContent && userMessageContent.trim() !== "") {
            openaiCurrentUserMessageContent.push({ type: "text", text: userMessageContent });
        }

        let tempImageStatusMsg = null;
        if (imageUrl) {
            try {
                tempImageStatusMsg = addMessageToChat({ role: 'model', parts: [{text: '正在加载并处理图片 (OpenAI)...'}], timestamp: Date.now(), isTempStatus: true });
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error(`图片获取失败: HTTP ${response.status}`);
                const blob = await response.blob();
                const mimeType = blob.type || 'application/octet-stream';
                if (!mimeType.startsWith('image/')) throw new Error(`无效图片MIME类型: ${mimeType}`);

                const base64DataUri = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result); // Full data URI
                    reader.onerror = (error) => reject(new Error("图片读取失败: " + error.message));
                    reader.readAsDataURL(blob);
                });
                openaiCurrentUserMessageContent.push({ type: "image_url", image_url: { "url": base64DataUri } });
                 if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
            } catch (error) {
                if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
                removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
                addMessageToChat({ role: 'model', parts: [{text: `图片处理错误 (OpenAI): ${error.message}`}], timestamp: Date.now() });
                return;
            }
        }
        
        if (openaiCurrentUserMessageContent.length === 0) {
            removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
            addMessageToChat({ role: 'model', parts: [{text: '没有内容可以发送给AI。'}], timestamp: Date.now() });
            return;
        }
        // If only image is sent to OpenAI, add a default text part
        if (openaiCurrentUserMessageContent.some(c => c.type === 'image_url') && !openaiCurrentUserMessageContent.some(c => c.type === 'text')) {
            openaiCurrentUserMessageContent.unshift({ type: "text", text: "请描述这张图片。" });
        }

        requestBody = {
            model: currentModelName,
            messages: [...historyForAPI, { role: "user", content: openaiCurrentUserMessageContent }],
            // max_tokens: 2048 // Example, can be configured
        };
    } else {
        addMessageToChat({ role: 'model', parts: [{text: `错误：不支持的API类型 "${currentApiType}"。`}], timestamp: Date.now() });
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        return;
    }

    // ----- API Call and Response Handling -----
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status} ${response.statusText}` } }));
            console.error(`${currentApiType} API Error:`, errorData);
            let detailedErrorMessage = `API 调用失败 (${currentApiType}): ${errorData.error?.message || response.statusText}`;
            if (errorData.error?.details && currentApiType === 'gemini') {
                detailedErrorMessage += ` 详情: ${JSON.stringify(errorData.error.details)}`;
            } else if (errorData.error?.type && currentApiType === 'openai') {
                 detailedErrorMessage += ` 类型: ${errorData.error.type}`;
            }
            addMessageToChat({ role: 'model', parts: [{text: detailedErrorMessage}], timestamp: Date.now() });
            return;
        }

        const data = await response.json();
        let aiResponseText = '';

        if (currentApiType === 'gemini') {
            if (data.candidates && data.candidates[0]?.content?.parts) {
                aiResponseText = data.candidates[0].content.parts.map(part => part.text).join("\n");
            } else if (data.promptFeedback?.blockReason) {
                 aiResponseText = `请求被阻止 (Gemini): ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`;
            } else {
                console.warn("Gemini API Response did not contain expected content:", data);
                aiResponseText = '未能从Gemini API获取有效回复。';
            }
        } else if (currentApiType === 'openai') {
            if (data.choices && data.choices[0]?.message?.content) {
                aiResponseText = data.choices[0].message.content;
            } else if (data.error) { // Explicit error in OpenAI response body
                 aiResponseText = `OpenAI API 错误: ${data.error.message}`;
            } else {
                console.warn("OpenAI API Response did not contain expected content:", data);
                aiResponseText = '未能从OpenAI API获取有效回复。';
            }
        }
        addMessageToChat({ role: 'model', parts: [{text: aiResponseText}], timestamp: Date.now() });

    } catch (error) {
        console.error(`Error calling ${currentApiType} API:`, error);
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        addMessageToChat({ role: 'model', parts: [{text: `与API (${currentApiType}) 通讯时发生错误: ${error.message}`}], timestamp: Date.now() });
    }
}


function addMessageToChat(message) {
    // Ensure message.parts is an array of objects with a text property
    if (!message.parts || !Array.isArray(message.parts) || message.parts.some(p => typeof p.text !== 'string')) {
         // Attempt to fix common issues, like message.text directly
        if (typeof message.text === 'string') {
            message.parts = [{ text: message.text }];
        } else if (message.parts && typeof message.parts.text === 'string') { // handle {parts: {text: "..."}}
             message.parts = [{ text: message.parts.text }];
        }
        else {
            console.warn("Correcting invalid message structure for chat:", message);
            message.parts = [{ text: "无效消息或内容为空" }];
        }
    }


    if (message.isTempStatus && message.parts[0].text.includes("正在总结链接")) {
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在总结链接"));
    }
     if (message.isTempStatus && message.parts[0].text.includes("正在加载并处理图片...")) {
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("正在加载并处理图片...")); // Prevent duplicates
    }

    const messageWithTimestamp = { ...message, timestamp: message.timestamp || Date.now()};
    currentChat.push(messageWithTimestamp);
    renderCurrentChat();
    if (!message.isTempStatus && !message.isThinking) {
      saveCurrentChat(); // Save non-transient messages
    }
    return messageWithTimestamp; // Return the added message, useful for temp messages
}


function renderCurrentChat() {
    if (!chatOutput) return;
    chatOutput.innerHTML = '';
    currentChat.forEach((msg, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.role === 'user' ? 'user' : 'ai');
        if (msg.isTempStatus) messageDiv.classList.add('temporary-status');
        if (msg.isThinking) messageDiv.classList.add('thinking-status'); // This could be a specific class for styling

        let contentHtml = '';
        // Ensure msg.parts[0] and msg.parts[0].text exist and are strings
        const textContent = (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') ? msg.parts[0].text : "内容不可用";

        if (msg.role === 'model' && typeof marked !== 'undefined' && typeof marked.parse === 'function' && !msg.isTempStatus && !msg.isThinking) {
            try {
                contentHtml = marked.parse(textContent);
            } catch (e) {
                console.error("Error parsing markdown:", e, "for text:", textContent);
                contentHtml = escapeHtml(textContent).replace(/\n/g, '<br>');
            }
        } else {
            contentHtml = escapeHtml(textContent).replace(/\n/g, '<br>');
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

        if (msg.role === 'model' && !msg.isThinking && !msg.isTempStatus && !msg.archived) {
            const archiveElement = document.createElement('span');
            archiveElement.classList.add('archive-action', 'archive-icon');
            archiveElement.innerHTML = '&#x1F4C1;'; // Folder icon
            archiveElement.title = '存档此问答';
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
    // Filter out transient messages from allChats before saving
    const cleanAllChats = allChats.map(chat =>
        chat.filter(msg => !msg.isTempStatus && !msg.isThinking)
    ).filter(chat => chat.length > 0); // Also remove any chats that became empty
    chrome.storage.local.set({ 'geminiChatHistory': cleanAllChats });
}

function saveCurrentChat() {
    const chatToStore = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));

    // Find if currentChat (identified by its first message's timestamp if it exists)
    // already has a corresponding entry in allChats.
    let existingChatIndex = -1;
    if (chatToStore.length > 0 && allChats.length > 0) {
        const firstMessageTimestamp = chatToStore[0].timestamp;
        existingChatIndex = allChats.findIndex(
            histChat => histChat.length > 0 && histChat[0].timestamp === firstMessageTimestamp
        );
    }

    if (chatToStore.length > 0) {
        if (existingChatIndex !== -1) {
            // Update existing history entry
            allChats[existingChatIndex] = [...chatToStore];
        } else {
            // Add as a new history entry (typically at the beginning)
            allChats.unshift([...chatToStore]);
        }
    } else { // currentChat is empty (e.g., after a split or clear)
        if (existingChatIndex !== -1) {
            // If the chat that became empty was in history, remove it or mark it as empty
            // For simplicity, let's remove it if it became empty.
            // However, splitChat handles this by starting a new currentChat and archiving the old one.
            // This case might be if user deletes all messages from current chat manually (if such feature existed).
            // For now, an empty currentChat just means the "active session" is empty.
            // allChats[existingChatIndex] = []; // Or splice it out: allChats.splice(existingChatIndex, 1);
            // Let's be conservative: if it's empty, it won't be added as new, and update logic for existing non-empty.
        }
        // We generally don't add a new *empty* chat to `allChats` unless `allChats` itself is empty.
    }


    // Limit history size
    if (allChats.length > 50) {
        allChats = allChats.slice(0, 50);
    }
    saveChatHistory(); // Persists the potentially modified allChats
    // renderChatHistoryList(); // No list to render directly
}


async function loadChatHistory() {
    return new Promise(resolve => {
        chrome.storage.local.get(['geminiChatHistory'], (result) => {
            if (result.geminiChatHistory) {
                allChats = result.geminiChatHistory.map(chat =>
                    chat.filter(msg => msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string' && !msg.isTempStatus && !msg.isThinking)
                ).filter(chat => chat.length > 0); // Remove empty chats and ensure structure
            } else {
                allChats = [];
            }

            // If currentChat is empty (e.g., on sidebar open), load the latest from history
            if (currentChat.length === 0) {
                if (allChats.length > 0) {
                    currentChat = [...allChats[0]]; // Load a copy of the most recent chat
                } else {
                     currentChat = []; // Start with a truly empty chat if no history
                }
            }
            renderCurrentChat();
            // renderChatHistoryList(); // No direct list rendering
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
    // Ensure archived chats are clean of transient properties before saving
    const cleanArchivedChats = archivedChats.map(chat =>
        chat.map(msg => {
            const {isThinking, isTempStatus, ...rest} = msg;
            return rest;
        })
    );
    chrome.storage.local.set({ 'geminiArchivedChats': cleanArchivedChats }, () => {
        updateArchivedChatsButtonCount();
    });
}

function renderChatHistoryList() {
    // This function is currently not used as the direct chat history list UI was removed.
    // The "More history actions" button handles clearing history.
    // If a history list UI is re-introduced, this function would populate it.
    // console.log("renderChatHistoryList called, but no direct UI list to populate.");
}

document.addEventListener('DOMContentLoaded', initialize);