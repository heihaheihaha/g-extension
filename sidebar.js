// g-extension/sidebar.js

// --- 全局变量 ---
let geminiApiKey = null;
let currentChat = [];
let allChats = [];
let currentSelectedText = null;

// --- DOM 元素获取 ---
// These will be assigned in initialize()
let chatOutput, chatInput, sendMessageButton, summarizePageButton,
    selectedTextPreview, selectedTextContent, clearSelectedTextButton,
    toggleHistoryButton, historyPanel, chatHistoryList, clearAllHistoryButton;

// --- 初始化和API Key加载 ---
async function initialize() {
    console.log("Sidebar (sidePanel): Initializing...");

    // Assign DOM elements
    chatOutput = document.getElementById('chatOutput');
    chatInput = document.getElementById('chatInput');
    sendMessageButton = document.getElementById('sendMessageButton');
    summarizePageButton = document.getElementById('summarizePageButton');
    selectedTextPreview = document.getElementById('selectedTextPreview');
    selectedTextContent = document.getElementById('selectedTextContent');
    clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
    toggleHistoryButton = document.getElementById('toggleHistoryButton');
    historyPanel = document.getElementById('history-panel'); // Corrected ID from HTML
    chatHistoryList = document.getElementById('chatHistoryList');
    clearAllHistoryButton = document.getElementById('clearAllHistoryButton');

    // Test marked.js (no change here)
    if (typeof marked === 'object' && marked !== null && typeof marked.parse === 'function') {
        // console.log("Marked Library Test - marked.parse is a function. Version:", marked.version);
        // try {
        //     const html = marked.parse('# Marked heading\n* item 1\n* item 2');
        //     // console.log("Marked Test Output:", html);
        //     // For testing display in sidebar (optional)
        //     // addMessageToChat({ role: 'model', parts: [{text: "Marked.js loaded. Test output: " + html}], timestamp: Date.now() });
        // } catch (e) {
        //     console.error("Marked Test Error:", e);
        //     addMessageToChat({ role: 'model', parts: [{text: "Marked.js loaded, but test failed: " + e.message}], timestamp: Date.now() });
        // }
    } else {
        console.warn("Marked Library Test - marked is not an object or marked.parse is not a function.");
        // addMessageToChat({ role: 'model', parts: [{text: 'Warning: Markdown rendering library (marked.js) not loaded correctly.'}], timestamp: Date.now() });
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

    loadChatHistory(); // Also renders current chat if one is loaded
    if (!currentChat || currentChat.length === 0) {
        renderCurrentChat(); // Ensure chat is rendered even if empty
    }


    // --- 事件监听 ---
    // Moved inside initialize to ensure elements are loaded
    if (sendMessageButton) {
        sendMessageButton.addEventListener('click', async () => {
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

            let fullMessage = messageText;
            if (currentSelectedText) {
                fullMessage = `关于以下引用内容：\n"${currentSelectedText}"\n\n我的问题/指令是：\n"${messageText}"`;
                addMessageToChat({ role: 'user', parts: [{text: `(引用内容: ${currentSelectedText.substring(0,50)}...) ${messageText}`}], timestamp: Date.now() });
            } else {
                addMessageToChat({ role: 'user', parts: [{text: messageText}], timestamp: Date.now() });
            }

            chatInput.value = '';
            clearSelectedTextPreview(); // Clear selected text after using it

            await callGeminiAPI([{ text: fullMessage }]);
        });
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
        summarizePageButton.addEventListener('click', () => {
            if (!geminiApiKey) {
                addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
                disableInputs();
                return;
            }
            const summaryRequestText = '(正在请求总结当前网页...)';
            addMessageToChat({role: 'user', parts: [{text: summaryRequestText}], timestamp: Date.now()});

            chrome.runtime.sendMessage({ action: "getAndSummarizePage" }, async (response) => {
                removeLastMessageFromChat('user'); // Remove the "(正在请求总结当前网页...)" message

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
                    addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面 (内容长度: ${pageContent.length}字符)`}], timestamp: Date.now()});
                    await callGeminiAPI([{ text: prompt }], true);
                } else if (response && response.error) {
                    addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
                    addMessageToChat({role: 'model', parts: [{text: `总结错误: ${response.error}`}], timestamp: Date.now() });
                } else {
                    addMessageToChat({role: 'user', parts: [{text: `总结请求：当前页面`}], timestamp: Date.now()});
                    addMessageToChat({role: 'model', parts: [{text: `总结错误: 从背景脚本收到未知响应。`}], timestamp: Date.now() });
                }
            });
        });
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
                renderCurrentChat(); // Clear current chat display
                addMessageToChat({ role: 'model', parts: [{text: '所有对话历史已清除。'}], timestamp: Date.now() });
            }
        });
    }

    // Listener for API Key changes from options page (via background script)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.geminiApiKey) {
            geminiApiKey = changes.geminiApiKey.newValue;
            console.log("Sidebar: Gemini API Key updated.");
            addMessageToChat({ role: 'model', parts: [{text: 'API 密钥已更新。'}], timestamp: Date.now() });
            enableInputs();
        }
    });

    console.log("Sidebar (sidePanel): Initialized and event listeners attached.");
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
        // Optional: Add safetySettings and generationConfig if needed
        // safetySettings: [
        //   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        //   { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        //   { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        //   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        // ],
        // generationConfig: {
        //   temperature: 0.7,
        //   topK: 1,
        //   topP: 1,
        //   maxOutputTokens: 2048,
        // }
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        removeLastMessageFromChat('model', true); // Remove "Thinking..."

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
        removeLastMessageFromChat('model', true); // Remove "Thinking..." in case of network error
        addMessageToChat({ role: 'model', parts: [{text: `与API通讯时发生错误: ${error.message}`}], timestamp: Date.now() });
    }
}


function addMessageToChat(message) {
    // Ensure message.parts is an array and has at least one part with text
    if (!message.parts || !Array.isArray(message.parts) || message.parts.length === 0 || typeof message.parts[0].text !== 'string') {
        console.warn("addMessageToChat: Invalid message format, skipping.", message);
        // Fallback or default message part if needed
        message.parts = [{ text: message.text || "无效消息格式" }]; // Use message.text if parts is completely missing/invalid
    }

    currentChat.push(message);
    renderCurrentChat();
    saveCurrentChat(); // Save after each message
}


function removeLastMessageFromChat(role, isThinkingMessage = false) {
    let removed = false;
    for (let i = currentChat.length - 1; i >= 0; i--) {
        const message = currentChat[i];
        if (message.role === role) {
            if (isThinkingMessage && message.isThinking) {
                currentChat.splice(i, 1);
                removed = true;
                break;
            } else if (!isThinkingMessage && !message.isThinking) { // Only remove non-thinking messages if not specified
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
        console.error("renderCurrentChat: chatOutput element not found.");
        return;
    }
    chatOutput.innerHTML = '';
    currentChat.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.role === 'user' ? 'user' : 'ai');

        // Use marked.js to render Markdown if the message is from the AI (model)
        // And the part is text. Assume parts[0] is the main content for now.
        let contentHtml = '';
        if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
            if (msg.role === 'model' && typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                try {
                    contentHtml = marked.parse(msg.parts[0].text);
                } catch (e) {
                    console.error("Error parsing markdown:", e);
                    contentHtml = escapeHtml(msg.parts[0].text); // Fallback to escaped HTML
                }
            } else {
                contentHtml = escapeHtml(msg.parts[0].text).replace(/\n/g, '<br>');
            }
        } else {
            contentHtml = "内容不可用"; // Fallback for undefined text
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
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}


// ADD new listener for messages from the background script (forwarded from content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TEXT_SELECTED_FOR_SIDEBAR') {
        currentSelectedText = request.text;
        if (selectedTextContent) selectedTextContent.textContent = currentSelectedText.length > 100 ? currentSelectedText.substring(0, 97) + '...' : currentSelectedText;
        if (selectedTextPreview) selectedTextPreview.style.display = 'block';
        // Optionally send a response back if the background script needs it
        sendResponse({status: "Selected text received in sidebar"});
    }
    return true; // Indicate async response potential
});


function clearSelectedTextPreview() {
    currentSelectedText = null;
    if (selectedTextPreview) selectedTextPreview.style.display = 'none';
    if (selectedTextContent) selectedTextContent.textContent = '';
}


// --- 对话历史管理 ---
function saveChatHistory() {
    // Prune empty or placeholder chats before saving to allChats
    const chatToSave = currentChat.filter(msg => !(msg.isThinking || (msg.parts && msg.parts.length === 1 && msg.parts[0].text.trim() === '')));
    if (chatToSave.length > 0) {
        // Check if this chat (or a similar one) already exists to avoid duplicates
        // This simple check assumes the last message's timestamp is a good enough proxy for uniqueness if needed
        const existingChatIndex = allChats.findIndex(
            (chat) => chat.length > 0 && chatToSave.length > 0 &&
                      chat[chat.length - 1].timestamp === chatToSave[chatToSave.length - 1].timestamp &&
                      chat[0].timestamp === chatToSave[0].timestamp
        );

        if (existingChatIndex !== -1) {
            allChats[existingChatIndex] = [...chatToSave]; // Update existing chat
        } else {
            // Add as a new chat if it has substantial content
            if (chatToSave.some(msg => msg.parts.some(p => p.text && p.text.trim() !== ''))) {
                 allChats.unshift([...chatToSave]); // Add to the beginning
            }
        }
         // Limit history size if necessary
        if (allChats.length > 50) { // Example limit
            allChats.pop();
        }
    }
    chrome.storage.local.set({ 'geminiChatHistory': allChats }, () => {
        // console.log("Chat history saved.");
    });
}

function saveCurrentChat() {
    // This function is primarily to update the 'current' state of the active chat in allChats
    // The actual saving to storage.local happens in saveChatHistory, often called after this.
    if (currentChat && currentChat.length > 0) {
        const chatToSave = currentChat.filter(msg => !(msg.isThinking));
         if (chatToSave.length === 0) return; // Don't save empty or only "thinking"

        // Find if this chat is already the first in allChats (most recent)
        if (allChats.length > 0 &&
            allChats[0].length > 0 && chatToSave.length > 0 &&
            allChats[0][0].timestamp === chatToSave[0].timestamp) {
            allChats[0] = [...chatToSave]; // Update the most recent chat
        } else {
            // If not the first, it might be a loaded older chat being continued or a new one.
            // For simplicity, we let saveChatHistory handle adding it as new or updating if it finds a match by timestamp.
            // This call to saveChatHistory will ensure it's properly stored.
        }
        saveChatHistory(); // This will now handle the logic of adding/updating in allChats and saving to storage
    } else {
        // If currentChat is empty, no specific "current" chat to save separately,
        // saveChatHistory would handle the general list.
        saveChatHistory();
    }
}


function loadChatHistory() {
    chrome.storage.local.get(['geminiChatHistory', 'geminiCurrentChatID'], (result) => {
        if (result.geminiChatHistory) {
            allChats = result.geminiChatHistory;
        } else {
            allChats = [];
        }

        // Attempt to load the last active chat, or the most recent one
        // For simplicity, we'll just load the most recent chat from allChats if no specific ID
        if (allChats.length > 0) {
            currentChat = [...allChats[0]]; // Load the most recent chat
        } else {
            currentChat = [];
        }
        renderCurrentChat();
        renderChatHistoryList(); // Update history panel display
    });
}

function renderChatHistoryList() {
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    allChats.forEach((chat, index) => {
        if (chat.length > 0) {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            // Display the first user message or a summary as the title
            const firstUserMsg = chat.find(msg => msg.role === 'user');
            let titleText = `对话 ${allChats.length - index}`;
            if (firstUserMsg && firstUserMsg.parts && firstUserMsg.parts[0] && firstUserMsg.parts[0].text) {
                titleText = firstUserMsg.parts[0].text.substring(0, 30) + (firstUserMsg.parts[0].text.length > 30 ? '...' : '');
            } else {
                 const firstModelMsg = chat.find(msg => msg.role === 'model' && !msg.isThinking);
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
                    // If the deleted chat was the current one, clear currentChat
                    if (currentChat.length > 0 && chat.length > 0 && currentChat[0].timestamp === chat[0].timestamp) {
                        currentChat = [];
                        renderCurrentChat();
                         addMessageToChat({ role: 'model', parts: [{text: '当前对话已从历史中删除。新对话开始。'}], timestamp: Date.now() });
                    }
                }
            };
            historyItem.appendChild(deleteButton);

            historyItem.onclick = () => {
                currentChat = [...chat]; // Create a copy to avoid direct modification
                renderCurrentChat();
                saveCurrentChat(); // Save this as the "active" chat potentially
                if (historyPanel) historyPanel.style.display = 'none'; // Hide history panel
            };
            chatHistoryList.appendChild(historyItem);
        }
    });
}


// --- 初始化 ---
document.addEventListener('DOMContentLoaded', initialize);