// g-extension/sidebar.js

// --- Global Variables ---
let currentApiKey = null;
let currentApiType = 'gemini'; 
let currentApiEndpoint = ''; 
let currentModelName = 'gemini-1.5-flash-latest'; 

let currentChat = [];
let allChats = [];
let archivedChats = [];
let currentSelectedText = null;
let currentSelectedImageUrl = null;
let promptTemplates = [];
let currentLang = 'zh';

// --- DOM Elements ---
let chatOutput, chatInput, sendMessageButton, summarizePageButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    selectedImagePreviewContainer, selectedImagePreviewContainerImage, clearSelectedImageButton, // Added selectedImagePreviewContainerImage
    historyPanel, clearAllHistoryButton,
    splitChatButton, viewArchivedChatsButton,
    managePromptsButton, promptShortcutsContainer;


async function initialize() {
    currentLang = await getActiveLanguage(); // From translations.js

    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    selectedImagePreviewContainer = document.getElementById('selectedImagePreviewContainer');
    // Create img element if not exists, or get it
    selectedImagePreviewContainerImage = selectedImagePreviewContainer.querySelector('img');
    if (!selectedImagePreviewContainerImage) {
        selectedImagePreviewContainerImage = document.createElement('img');
        selectedImagePreviewContainerImage.style.maxWidth = '100%';
        selectedImagePreviewContainerImage.style.maxHeight = '150px';
        selectedImagePreviewContainerImage.style.objectFit = 'contain';
        selectedImagePreviewContainerImage.style.border = '1px solid var(--border-color)';
        selectedImagePreviewContainerImage.style.borderRadius = 'var(--border-radius)';
        selectedImagePreviewContainer.appendChild(selectedImagePreviewContainerImage);
    }
    clearSelectedImageButton = document.getElementById('clearSelectedImageButton');
    historyPanel = document.querySelector('.history-panel');
    clearAllHistoryButton = document.getElementById('clearAllHistoryButton');
    splitChatButton = document.getElementById('splitChatButton');
    viewArchivedChatsButton = document.getElementById('viewArchivedChatsButton');
    managePromptsButton = document.getElementById('managePromptsButton');
    promptShortcutsContainer = document.getElementById('promptShortcuts');

    await applyPageLocalization(); // From translations.js

    if (typeof marked !== 'object' || marked === null || typeof marked.parse !== 'function') {
        console.warn("Marked Library Test - marked is not an object or marked.parse is not a function.");
    }

    try {
        const result = await chrome.storage.sync.get(['apiConfigurations', 'activeConfigurationId', 'language']);
        currentLang = result.language || 'zh'; // Update lang based on storage
        const configs = result.apiConfigurations || [];
        const activeId = result.activeConfigurationId;

        let activeConfig = null;
        if (activeId && configs.length > 0) {
            activeConfig = configs.find(c => c.id === activeId);
        }
        if (!activeConfig && configs.length > 0) {
            activeConfig = configs[0];
            console.warn("No active configuration found or ID mismatch, defaulting to the first available configuration.");
        }

        if (activeConfig) {
            currentApiKey = activeConfig.apiKey;
            currentApiType = activeConfig.apiType;
            currentApiEndpoint = activeConfig.apiEndpoint || '';
            currentModelName = activeConfig.modelName;

            if (!currentApiKey || !currentModelName || (currentApiType === 'openai' && !currentApiEndpoint)) {
                addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorApiConfigIncomplete')}], timestamp: Date.now() });
                disableInputs();
            } else {
                const statusMsg = await getL10nString('configLoadedStatus', activeConfig.configName, activeConfig.apiType);
                const tempStatusMsg = addMessageToChat({ role: 'model', parts: [{text: statusMsg}], timestamp: Date.now(), isTempStatus: true });
                setTimeout(() => removeMessageByContentCheck(msg => msg.isTempStatus && msg.timestamp === tempStatusMsg.timestamp && msg.parts[0].text === statusMsg), 3000);
                enableInputs();
            }
        } else {
            addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorApiConfigMissing')}], timestamp: Date.now() });
            disableInputs();
        }
    } catch (e) {
        console.error("Sidebar: Error loading API configuration:", e);
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorLoadingApiConfig')}], timestamp: Date.now() });
        disableInputs();
    }

    await loadArchivedChats();
    await loadChatHistory(); 
    await loadPromptTemplates();

    if (!currentChat || currentChat.length === 0) {
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
    if (clearSelectedImageButton) clearSelectedImageButton.addEventListener('click', clearSelectedImagePreview);

    if (clearAllHistoryButton) {
        clearAllHistoryButton.addEventListener('click', async () => {
            if (confirm(await getL10nString('confirmClearAllHistory'))) {
                allChats = []; 
                currentChat = []; 
                saveChatHistory(); 
                renderCurrentChat(); 
                addMessageToChat({ role: 'model', parts: [{text: await getL10nString('allHistoryCleared')}], timestamp: Date.now() });
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

    chrome.storage.onChanged.addListener(handleStorageChanges);
    chrome.runtime.onMessage.addListener(handleRuntimeMessages);
}

async function handleStorageChanges(changes, namespace) {
    if (namespace === 'sync' && changes.language) {
        currentLang = changes.language.newValue || 'zh';
        await applyPageLocalization(); // Re-apply to current page
        await loadPromptTemplates(); // Reload prompts as their names might change
        await renderCurrentChat(); // Re-render chat if timestamps or other locale-specific things change
    }

    if (namespace === 'sync' && (changes.apiConfigurations || changes.activeConfigurationId)) {
        const result = await chrome.storage.sync.get(['apiConfigurations', 'activeConfigurationId']);
        const configs = result.apiConfigurations || [];
        const activeId = result.activeConfigurationId;
        let activeConfig = null;

        if (activeId && configs.length > 0) {
            activeConfig = configs.find(c => c.id === activeId);
        }
        if (!activeConfig && configs.length > 0) {
             activeConfig = configs[0];
             console.warn("Active configuration ID not found in list after change, defaulting to first available.");
        }

        let configStatusMessageKey = 'configUpdatedStatus';
        let configName = '', apiType = '';

        if (activeConfig) {
            currentApiKey = activeConfig.apiKey;
            currentApiType = activeConfig.apiType;
            currentApiEndpoint = activeConfig.apiEndpoint || '';
            currentModelName = activeConfig.modelName;
            configStatusMessageKey = 'configSwitchedStatus';
            configName = activeConfig.configName;
            apiType = activeConfig.apiType;

            if (!currentApiKey || !currentModelName || (currentApiType === 'openai' && !currentApiEndpoint)) {
                addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorNewApiConfigIncomplete')}], timestamp: Date.now() });
                disableInputs();
            } else {
                enableInputs();
            }
        } else {
            currentApiKey = null;
            currentApiType = 'gemini';
            currentApiEndpoint = '';
            currentModelName = '';
            configStatusMessageKey = 'errorNoActiveConfig';
            disableInputs();
        }
         addMessageToChat({ role: 'model', parts: [{text: await getL10nString(configStatusMessageKey, configName, apiType)}], timestamp: Date.now() });
    }
    if (namespace === 'local') {
        if (changes.geminiChatHistory) {
            allChats = (changes.geminiChatHistory.newValue || []).map(chat => chat.filter(msg => !msg.isTempStatus && !msg.isThinking));
        }
        if (changes.geminiArchivedChats) {
            archivedChats = changes.geminiArchivedChats.newValue || [];
            await updateArchivedChatsButtonCount();
        }
        if (changes.promptTemplates) {
            await loadPromptTemplates(); 
        }
    }
}


async function loadPromptTemplates() {
    const result = await chrome.storage.local.get(['promptTemplates']);
    currentLang = await getActiveLanguage(); // ensure currentLang is up-to-date

    // Define presets with multi-language support
    const presetDefinitions = [
        { 
          id: 'preset-translate', 
          names: { en: await getL10nString('presetTranslateName'), zh: await getL10nString('presetTranslateName') },
          contents: { en: await getL10nString('presetTranslateContent'), zh: await getL10nString('presetTranslateContent') },
          isPreset: true 
        },
        { 
          id: 'preset-summarize', 
          names: { en: await getL10nString('presetSummarizeName'), zh: await getL10nString('presetSummarizeName') }, 
          contents: { en: await getL10nString('presetSummarizeContent'), zh: await getL10nString('presetSummarizeContent') },
          isPreset: true 
        }
    ];

    if (result.promptTemplates && result.promptTemplates.length > 0) {
        promptTemplates = result.promptTemplates;
        let changed = false;
        presetDefinitions.forEach(presetDef => {
            const existing = promptTemplates.find(p => p.id === presetDef.id);
            if (!existing) {
                promptTemplates.unshift({ 
                    id: presetDef.id,
                    name: presetDef.names[currentLang] || presetDef.names.en, // Use current language
                    content: presetDef.contents[currentLang] || presetDef.contents.en,
                    isPreset: true 
                });
                changed = true;
            } else {
                if (existing.isPreset !== true) { // Ensure flag is correct
                    existing.isPreset = true;
                    changed = true;
                }
                // Keep user's edited name/content for existing presets
            }
        });
         if (changed) await chrome.storage.local.set({ promptTemplates: promptTemplates });
    } else {
        promptTemplates = presetDefinitions.map(def => ({
            id: def.id,
            name: def.names[currentLang] || def.names.en,
            content: def.contents[currentLang] || def.contents.en,
            isPreset: true
        }));
        await chrome.storage.local.set({ promptTemplates: promptTemplates });
    }

    promptTemplates.forEach(p => {
        if (!presetDefinitions.some(presetDef => presetDef.id === p.id)) {
            p.isPreset = false;
        }
    });
    renderPromptShortcuts();
}

function renderPromptShortcuts() {
    if (!promptShortcutsContainer) return;
    promptShortcutsContainer.innerHTML = '';
    currentLang = chatInput.ownerDocument.documentElement.lang || currentLang; // Get lang from HTML if set

    const sortedPrompts = [...promptTemplates].sort((a, b) => {
        if (a.isPreset && !b.isPreset) return -1;
        if (!a.isPreset && b.isPreset) return 1;

        // For presets, try to get the localized name for sorting if available in definitions
        // This assumes promptTemplates stores user-edited names, but for display/sort, we might prefer original localized
        const aName = a.isPreset ? (messages[currentLang]?.[`preset${a.id.split('-')[1]}Name`] || a.name) : a.name;
        const bName = b.isPreset ? (messages[currentLang]?.[`preset${b.id.split('-')[1]}Name`] || b.name) : b.name;
        return aName.localeCompare(bName, currentLang);
    });

    sortedPrompts.forEach(template => {
        const button = document.createElement('button');
        button.classList.add('prompt-shortcut-button');
        // Display the name stored in the template (which might be user-edited or language-specific from init)
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
    chatInput.scrollTop = chatInput.scrollHeight;
}

async function displaySelectedImagePreview(imageUrl) {
    if (selectedImagePreviewContainer && imageUrl) {
        selectedImagePreviewContainerImage.src = imageUrl;
        selectedImagePreviewContainerImage.alt = await getL10nString('selectedImagePreviewContainerAlt');
        selectedImagePreviewContainer.style.display = 'block';
        if (clearSelectedImageButton) clearSelectedImageButton.style.display = 'block';
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        clearSelectedImagePreview();
    }
}

function clearSelectedImagePreview() {
    currentSelectedImageUrl = null;
    if (selectedImagePreviewContainerImage) selectedImagePreviewContainerImage.src = '';
    if (selectedImagePreviewContainer) selectedImagePreviewContainer.style.display = 'none';
    if (clearSelectedImageButton) clearSelectedImageButton.style.display = 'none';
}

async function updateArchivedChatsButtonCount() {
    if (viewArchivedChatsButton) {
        const text = await getL10nString('viewArchivedButton', archivedChats.length);
        viewArchivedChatsButton.textContent = text;
    }
}

async function handleSplitChat() {
    const chatToProcess = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));

    if (chatToProcess.length > 0) {
        const archivedCopy = chatToProcess.map(m => {
            const {isThinking, isTempStatus, archived, ...rest} = m;
            return rest;
        });
        archivedChats.unshift(archivedCopy);
        saveArchivedChats();

        let alreadyInAllChats = false;
        if (allChats.length > 0 && JSON.stringify(allChats[0]) === JSON.stringify(chatToProcess)) {
            alreadyInAllChats = true;
        }
        if (!alreadyInAllChats) { 
            allChats.unshift([...chatToProcess]); 
            if (allChats.length > 50) allChats.pop(); 
            saveChatHistory();
        }
    }

    currentChat = []; 
    renderCurrentChat();
    addMessageToChat({ role: 'model', parts: [{text: await getL10nString('chatSplitArchived')}], timestamp: Date.now() });
    saveCurrentChat(); 
}

async function archiveQaPair(aiMessageIndexInCurrentChat) {
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
        const userMessageCopy = {...userMessage};
        delete userMessageCopy.archived; delete userMessageCopy.isThinking; delete userMessageCopy.isTempStatus;
        const aiMessageCopy = {...aiMessage};
        delete aiMessageCopy.archived; delete aiMessageCopy.isThinking; delete aiMessageCopy.isTempStatus;

        const qaPairToArchive = [userMessageCopy, aiMessageCopy];
        archivedChats.unshift(qaPairToArchive);
        saveArchivedChats();

        aiMessage.archived = true; 
        renderCurrentChat(); 
        saveCurrentChat();

        const tempStatusMsg = addMessageToChat({role: 'model', parts: [{text: await getL10nString('qaArchived')}], timestamp: Date.now(), isTempStatus: true});
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
        const tempErrorMsg = addMessageToChat({role: 'model', parts: [{text: await getL10nString('archiveFailedUserMessage')}], timestamp: Date.now(), isTempStatus: true});
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

async function handleRuntimeMessages(request, sender, sendResponse) {
    if (request.type === 'TEXT_SELECTED_FOR_SIDEBAR') {
        currentSelectedText = request.text;
        if (selectedTextContent) selectedTextContent.textContent = currentSelectedText.length > 100 ? currentSelectedText.substring(0, 97) + '...' : currentSelectedText;
        if (selectedTextPreview) selectedTextPreview.style.display = 'flex';
        sendResponse({status: await getL10nString('selectedTextReceived')});
    } else if (request.type === 'IMAGE_SELECTED_FOR_SIDEBAR') {
        currentSelectedImageUrl = request.imageUrl;
        await displaySelectedImagePreview(currentSelectedImageUrl);
        sendResponse({status: await getL10nString('imageUrlReceived')});
    } else if (request.type === 'SUMMARIZE_EXTERNAL_TEXT_FOR_SIDEBAR') {
        const { text, linkUrl, linkTitle, warning } = request;
        removeMessageByContentCheck(async msg => msg.isTempStatus && msg.parts[0].text.includes( (await getL10nString('summarizingLinkStatus', '')).split('...')[0] ));

        addMessageToChat({ role: 'user', parts: [{text: await getL10nString('summaryRequestLink', linkTitle || 'Link', linkUrl, text?.length || 0)}], timestamp: Date.now() });
        if (warning) {
            addMessageToChat({ role: 'model', parts: [{text: await getL10nString('linkSummaryWarning', warning)}], timestamp: Date.now() });
        }
        if (!text || text.trim() === "") {
            addMessageToChat({role: 'model', parts: [{text: await getL10nString('linkSummaryFailedNoText', linkTitle || linkUrl, linkUrl)}], timestamp: Date.now() });
            sendResponse({error: "No text provided"});
            return true; 
        }
        const prompt = `<span class="math-inline">\{await getL10nString\('presetSummarizeContent'\)\} "</span>{text}"`; // Simplified prompt for external
        callApi(prompt, true, null).then(() => sendResponse({status: "Summary initiated"}));

    } else if (request.type === 'SHOW_LINK_SUMMARY_ERROR') {
        const { message, url, title } = request;
        removeMessageByContentCheck(async msg => msg.isTempStatus && msg.parts[0].text.includes( (await getL10nString('summarizingLinkStatus', '')).split('...')[0] ));
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('summarizingLinkFailed', title || url, message)}], timestamp: Date.now() });
        sendResponse({status: "Error displayed"});

    } else if (request.type === 'LINK_SUMMARIZATION_STARTED') {
        const { url, title } = request;
         removeMessageByContentCheck(async msg => msg.isTempStatus && msg.parts[0].text.includes( (await getL10nString('summarizingLinkStatus', '')).split('...')[0] ));
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('summarizingLinkStatus', title || url)}], timestamp: Date.now(), isTempStatus: true });
        sendResponse({status: "Notified user"});

    } else if (request.type === "TRIGGER_SIDEBAR_PAGE_SUMMARY") {
        handleSummarizeCurrentPage();
        sendResponse({ status: await getL10nString('sidebarInitiatedPageSummary') });
    }
    return true; 
}

function removeMessageByContentCheck(conditionFn) {
    const initialLength = currentChat.length;
    currentChat = currentChat.filter(msg => !conditionFn(msg));
    if (currentChat.length < initialLength) {
        renderCurrentChat();
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
        userMessageForApi = await getL10nString('combinedQueryPrefix', currentSelectedText, messageText);
        displayUserMessageInChat = `${await getL10nString('quotedTextDisplay', currentSelectedText.substring(0,50))} ${messageText}`;
    } else if (currentSelectedText && !messageText) {
        userMessageForApi = currentSelectedText;
        displayUserMessageInChat = currentSelectedText;
    }

    const imageUrlToSend = currentSelectedImageUrl;

    if (!userMessageForApi.trim() && !imageUrlToSend) {
        const tempMsg = addMessageToChat({ role: 'model', parts: [{text: await getL10nString('promptNoTextOrImage')}], timestamp: Date.now(), isTempStatus: true });
        setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === tempMsg.timestamp && msg.isTempStatus), 3000);
        return;
    }

    if (!currentApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorApiKeyMissing')}], timestamp: Date.now() });
        disableInputs(); return;
    }
    if (!currentModelName) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorModelNameMissing')}], timestamp: Date.now() });
        disableInputs(); return;
    }
    if (currentApiType === 'openai' && !currentApiEndpoint) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorOpenAIEndpointMissingSidebar')}], timestamp: Date.now() });
        disableInputs(); return;
    }

    let finalDisplayMessage = displayUserMessageInChat;
    let finalApiTextMessage = userMessageForApi; 

    if (imageUrlToSend) {
        if (!finalApiTextMessage.trim() && !currentSelectedText) { 
            finalDisplayMessage = await getL10nString('selectedImageDisplay');
            finalApiTextMessage = await getL10nString('defaultImagePrompt');
        } else {
            finalDisplayMessage = finalDisplayMessage ? `<span class="math-inline">\{finalDisplayMessage\} \(</span>{await getL10nString('selectedImageAndTextPrompt')})` : await getL10nString('selectedImageAndTextPrompt');
        }
    }

    if (!finalApiTextMessage.trim() && !imageUrlToSend) {
         const tempMsg = addMessageToChat({ role: 'model', parts: [{text: await getL10nString('promptNoValidContent')}], timestamp: Date.now(), isTempStatus: true });
         setTimeout(() => removeMessageByContentCheck(msg => msg.timestamp === tempMsg.timestamp && msg.isTempStatus), 3000);
         return;
    }

    addMessageToChat({ role: 'user', parts: [{text: finalDisplayMessage}], timestamp: Date.now() });

    chatInput.value = '';
    clearSelectedTextPreview(); 
    clearSelectedImagePreview(); 

    await callApi(finalApiTextMessage, false, imageUrlToSend); 
}

async function handleSummarizeCurrentPage() {
    if (!currentApiKey || !currentModelName || (currentApiType === 'openai' && !currentApiEndpoint)) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorApiConfigIncomplete')}], timestamp: Date.now() });
        disableInputs();
        return;
    }
    const summaryRequestText = `(${await getL10nString('thinkingStatus')}...)`; // Generic thinking
    addMessageToChat({role: 'user', parts: [{text: summaryRequestText}], timestamp: Date.now(), isTempStatus: true }); 

    chrome.runtime.sendMessage({ action: "getAndSummarizePage" }, async (response) => {
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text === summaryRequestText); 

        if (chrome.runtime.lastError) {
            addMessageToChat({role: 'model', parts: [{text: await getL10nString('summaryErrorComms', chrome.runtime.lastError.message)}], timestamp: Date.now() });
            return;
        }

        if (response && typeof response.contentForSummary === 'string') {
            const pageContent = response.contentForSummary;
             if (pageContent.trim() === "") {
                 addMessageToChat({role: 'user', parts: [{text: await getL10nString('summaryRequestCurrentPage')}], timestamp: Date.now()});
                 addMessageToChat({role: 'model', parts: [{text: await getL10nString('pageContentEmpty')}], timestamp: Date.now() });
                 return;
            }
            const summarizeContent = await getL10nString('presetSummarizeContent'); // Get base summarize prompt
            const prompt = `<span class="math-inline">\{summarizeContent\}\\n\\n"</span>{pageContent}"`;

            addMessageToChat({role: 'user', parts: [{text: `<span class="math-inline">\{await getL10nString\('summaryRequestCurrentPage'\)\} \(</span>{await getL10nString('configModelLabel')} ${pageContent.length})`}], timestamp: Date.now()});
            await callApi(prompt, true, null); 
        } else if (response && response.error) {
            addMessageToChat({role: 'user', parts: [{text: await getL10nString('summaryRequestCurrentPage')}], timestamp: Date.now()});
            addMessageToChat({role: 'model', parts: [{text: await getL10nString('summaryErrorGeneric', response.error)}], timestamp: Date.now() });
        } else {
            addMessageToChat({role: 'user', parts: [{text: await getL10nString('summaryRequestCurrentPage')}], timestamp: Date.now()});
            addMessageToChat({role: 'model', parts: [{text: await getL10nString('summaryErrorUnknownResponse')}], timestamp: Date.now() });
        }
    });
}

function disableInputs() {
    if (chatInput) chatInput.disabled = true;
    if (sendMessageButton) sendMessageButton.disabled = true;
    if (summarizePageButton) summarizePageButton.disabled = true;
    if (splitChatButton) splitChatButton.disabled = true;
}

function enableInputs() {
    if (chatInput) chatInput.disabled = false;
    if (sendMessageButton) sendMessageButton.disabled = false;
    if (summarizePageButton) summarizePageButton.disabled = false;
    if (splitChatButton) splitChatButton.disabled = false;
}

async function callApi(userMessageContent, isSummary = false, imageUrl = null) {
    if (!currentApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorApiKeyMissing')}], timestamp: Date.now() }); return;
    }
    if (!currentModelName) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorModelNameMissing')}], timestamp: Date.now() }); return;
    }
    if (currentApiType === 'openai' && !currentApiEndpoint) {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorOpenAIEndpointMissingSidebar')}], timestamp: Date.now() }); return;
    }

    const thinkingMessage = addMessageToChat({ role: 'model', parts: [{text: await getL10nString('thinkingStatus')}], timestamp: Date.now(), isThinking: true });

    let endpoint = '';
    let requestBody = {};
    let headers = { 'Content-Type': 'application/json' };

    const historyForAPI = currentChat
        .filter(msg => msg.timestamp < thinkingMessage.timestamp && !msg.isTempStatus && !msg.isThinking && !msg.archived)
        .map(msg => {
            const textContent = msg.parts.map(part => part.text).join('\n');
            if (currentApiType === 'openai') {
                return { role: msg.role === 'model' ? 'assistant' : msg.role, content: textContent };
            } else { 
                return { role: msg.role, parts: [{ text: textContent }] };
            }
        });

    if (currentApiType === 'gemini') {
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/<span class="math-inline">\{currentModelName\}\:generateContent?key\=</span>{currentApiKey}`;
        const geminiUserParts = [];
        if (userMessageContent && userMessageContent.trim() !== "") {
            geminiUserParts.push({ text: userMessageContent });
        }

        let tempImageStatusMsg = null;
        if (imageUrl) {
            try {
                tempImageStatusMsg = addMessageToChat({ role: 'model', parts: [{text: await getL10nString('loadingImageStatusGemini')}], timestamp: Date.now(), isTempStatus: true });
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const mimeType = blob.type || 'application/octet-stream';
                if (!mimeType.startsWith('image/')) throw new Error(`Invalid MIME type: ${mimeType}`);

                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = (error) => reject(new Error("Image read failed: " + error.message));
                    reader.readAsDataURL(blob);
                });
                geminiUserParts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
                if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
            } catch (error) {
                if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
                removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
                addMessageToChat({ role: 'model', parts: [{text: await getL10nString('imageProcessingErrorGemini', error.message)}], timestamp: Date.now() });
                return;
            }
        }

        if (geminiUserParts.length === 0) {
            removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
            addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorNoContentToAI')}], timestamp: Date.now() });
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
                tempImageStatusMsg = addMessageToChat({ role: 'model', parts: [{text: await getL10nString('loadingImageStatusOpenAI')}], timestamp: Date.now(), isTempStatus: true });
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const mimeType = blob.type || 'application/octet-stream';
                if (!mimeType.startsWith('image/')) throw new Error(`Invalid MIME type: ${mimeType}`);
                const base64DataUri = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result); 
                    reader.onerror = (error) => reject(new Error("Image read failed: " + error.message));
                    reader.readAsDataURL(blob);
                });
                openaiCurrentUserMessageContent.push({ type: "image_url", image_url: { "url": base64DataUri } });
                 if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
            } catch (error) {
                if (tempImageStatusMsg) removeMessageByContentCheck(msg => msg.timestamp === tempImageStatusMsg.timestamp && msg.isTempStatus);
                removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
                addMessageToChat({ role: 'model', parts: [{text: await getL10nString('imageProcessingErrorOpenAI', error.message)}], timestamp: Date.now() });
                return;
            }
        }

        if (openaiCurrentUserMessageContent.length === 0) {
            removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
            addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorNoContentToAI')}], timestamp: Date.now() });
            return;
        }
        if (openaiCurrentUserMessageContent.some(c => c.type === 'image_url') && !openaiCurrentUserMessageContent.some(c => c.type === 'text')) {
             openaiCurrentUserMessageContent.unshift({ type: "text", text: await getL10nString('defaultImagePrompt') });
        }
        requestBody = { model: currentModelName, messages: [...historyForAPI, { role: "user", content: openaiCurrentUserMessageContent }] };
    } else {
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorUnsupportedApiType', currentApiType)}], timestamp: Date.now() });
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        return;
    }

    try {
        const response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(requestBody) });
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status} ${response.statusText}` } }));
            console.error(`${currentApiType} API Error:`, errorData);
            let detailedErrorMessage = await getL10nString('errorApiCallFailed', currentApiType, errorData.error?.message || response.statusText);
            if (errorData.error?.details && currentApiType === 'gemini') {
                detailedErrorMessage += ` Details: ${JSON.stringify(errorData.error.details)}`;
            } else if (errorData.error?.type && currentApiType === 'openai') {
                 detailedErrorMessage += ` Type: ${errorData.error.type}`;
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
                 aiResponseText = `Request blocked (Gemini): ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`;
            } else {
                console.warn("Gemini API Response did not contain expected content:", data);
                aiResponseText = 'Failed to get valid response from Gemini API.';
            }
        } else if (currentApiType === 'openai') {
            if (data.choices && data.choices[0]?.message?.content) {
                aiResponseText = data.choices[0].message.content;
            } else if (data.error) { 
                 aiResponseText = `OpenAI API Error: ${data.error.message}`;
            } else {
                console.warn("OpenAI API Response did not contain expected content:", data);
                aiResponseText = 'Failed to get valid response from OpenAI API.';
            }
        }
        addMessageToChat({ role: 'model', parts: [{text: aiResponseText}], timestamp: Date.now() });

    } catch (error) {
        console.error(`Error calling ${currentApiType} API:`, error);
        removeMessageByContentCheck(msg => msg.isThinking && msg.timestamp === thinkingMessage.timestamp);
        addMessageToChat({ role: 'model', parts: [{text: await getL10nString('errorApiComms', currentApiType, error.message)}], timestamp: Date.now() });
    }
}

function addMessageToChat(message) {
    if (!message.parts || !Array.isArray(message.parts) || message.parts.some(p => typeof p.text !== 'string')) {
        if (typeof message.text === 'string') {
            message.parts = [{ text: message.text }];
        } else if (message.parts && typeof message.parts.text === 'string') {
            message.parts = [{ text: message.parts.text }];
        } else {
            console.warn("Correcting invalid message structure for chat:", message);
            message.parts = [{ text: "Invalid message or empty content" }];
        }
    }

    if (message.isTempStatus && message.parts[0].text.includes("Summarizing link")) { // Use English key for check
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("Summarizing link"));
    }
    if (message.isTempStatus && message.parts[0].text.includes("Loading and processing image...")) {
        removeMessageByContentCheck(msg => msg.isTempStatus && msg.parts[0].text.includes("Loading and processing image..."));
    }

    const messageWithTimestamp = { ...message, timestamp: message.timestamp || Date.now()};
    currentChat.push(messageWithTimestamp);
    renderCurrentChat();
    if (!message.isTempStatus && !message.isThinking) {
      saveCurrentChat(); 
    }
    return messageWithTimestamp; 
}

async function renderCurrentChat() {
    if (!chatOutput) return;
    chatOutput.innerHTML = '';
    const currentDisplayLang = await getActiveLanguage(); // For date/time formatting

    for (let index = 0; index < currentChat.length; index++) {
        const msg = currentChat[index];
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.role === 'user' ? 'user' : 'ai');
        if (msg.isTempStatus) messageDiv.classList.add('temporary-status');
        if (msg.isThinking) messageDiv.classList.add('thinking-status'); 

        let contentHtml = '';
        const textContent = (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') ? msg.parts[0].text : "Content unavailable";

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
        timestampSpan.textContent = new Date(msg.timestamp).toLocaleTimeString(currentDisplayLang === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' });
        footerDiv.appendChild(timestampSpan);

        if (msg.role === 'model' && !msg.isThinking && !msg.isTempStatus && !msg.archived) {
            const archiveElement = document.createElement('span');
            archiveElement.classList.add('archive-action', 'archive-icon');
            archiveElement.innerHTML = '&#x1F4C1;'; 
            archiveElement.title = await getL10nString('qaArchived'); // "Archive this Q&A"
            archiveElement.onclick = (e) => {
                e.stopPropagation();
                archiveQaPair(index);
            };
            footerDiv.appendChild(archiveElement);
        } else if (msg.archived) {
            const archivedTextSpan = document.createElement('span');
            archivedTextSpan.classList.add('archived-text');
            archivedTextSpan.textContent = await getL10nString('qaArchived'); // "Archived"
            footerDiv.appendChild(archivedTextSpan);
        }
        messageDiv.appendChild(footerDiv);
        chatOutput.appendChild(messageDiv);
    }
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
    ).filter(chat => chat.length > 0); 
    chrome.storage.local.set({ 'geminiChatHistory': cleanAllChats });
}

function saveCurrentChat() {
    const chatToStore = currentChat.filter(msg => !(msg.isThinking || msg.isTempStatus));
    let existingChatIndex = -1;
    if (chatToStore.length > 0 && allChats.length > 0) {
        const firstMessageTimestamp = chatToStore[0].timestamp;
        existingChatIndex = allChats.findIndex(
            histChat => histChat.length > 0 && histChat[0].timestamp === firstMessageTimestamp
        );
    }

    if (chatToStore.length > 0) {
        if (existingChatIndex !== -1) {
            allChats[existingChatIndex] = [...chatToStore];
        } else {
            allChats.unshift([...chatToStore]);
        }
    }
    if (allChats.length > 50) {
        allChats = allChats.slice(0, 50);
    }
    saveChatHistory();
}

async function loadChatHistory() {
  currentLang = await getActiveLanguage(); // Ensure lang is current for rendering
  return new Promise(resolve => {
      chrome.storage.local.get(['geminiChatHistory'], (result) => {
          if (result.geminiChatHistory) {
              allChats = result.geminiChatHistory.map(chat =>
                  chat.filter(msg => msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string' && !msg.isTempStatus && !msg.isThinking)
              ).filter(chat => chat.length > 0); 
          } else {
              allChats = [];
          }
          if (currentChat.length === 0) {
              if (allChats.length > 0) {
                  currentChat = [...allChats[0]]; 
              } else {
                   currentChat = []; 
              }
          }
          renderCurrentChat();
          resolve();
      });
  });
}

async function loadArchivedChats() {
  return new Promise(resolve => {
      chrome.storage.local.get(['geminiArchivedChats'], async (result) => {
          if (result.geminiArchivedChats) {
              archivedChats = result.geminiArchivedChats;
          } else {
              archivedChats = [];
          }
          await updateArchivedChatsButtonCount();
          resolve();
      });
  });
}

function saveArchivedChats() {
    const cleanArchivedChats = archivedChats.map(chat =>
        chat.map(msg => {
            const {isThinking, isTempStatus, ...rest} = msg;
            return rest;
        })
    );
    chrome.storage.local.set({ 'geminiArchivedChats': cleanArchivedChats }, async () => {
        await updateArchivedChatsButtonCount();
    });
}

document.addEventListener('DOMContentLoaded', initialize);