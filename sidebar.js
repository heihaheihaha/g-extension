// sidebar.js

// --- 全局变量 ---
let geminiApiKey = null;
let currentChat = []; // 存储当前对话: { role: 'user'/'model', parts: [{text: '...'}], timestamp: Date.now() }
let allChats = [];    // 存储所有历史对话
let currentSelectedText = null; // 当前从页面选中的文本

// --- DOM 元素获取 ---
const chatOutput = document.getElementById('chatOutput');
const chatInput = document.getElementById('chatInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const summarizePageButton = document.getElementById('summarizePageButton');
const selectedTextPreview = document.getElementById('selectedTextPreview');
const selectedTextContent = document.getElementById('selectedTextContent');
const clearSelectedTextButton = document.getElementById('clearSelectedTextButton');
const toggleHistoryButton = document.getElementById('toggleHistoryButton');
const historyPanel = document.getElementById('history-panel');
const chatHistoryList = document.getElementById('chatHistoryList');
const clearAllHistoryButton = document.getElementById('clearAllHistoryButton');

// --- 初始化和API Key加载 ---
async function initialize() {
    console.log("Sidebar: Initializing... typeof marked at init start:", typeof marked); // 这个日志现在应该是 "object"

    // 更新后的直接测试 marked.js
    console.log("Marked Library Test - typeof marked:", typeof marked);
    if (typeof marked === 'object' && marked !== null && typeof marked.parse === 'function') {
        try {
            const testMarkdown = "**粗体测试 (Bold Test)** 和 *斜体测试 (Italic Test)*";
            console.log("Marked Library Test - Input:", testMarkdown);
            const testHtml = marked.parse(testMarkdown); // 使用 marked.parse()
            console.log("Marked Library Test - Output HTML:", testHtml);

            if (document.getElementById('chatOutput')) { // 确保 chatOutput 存在
                 const testDiv = document.createElement('div');
                 testDiv.style.border = "1px solid limegreen"; // 加上边框以便区分
                 testDiv.innerHTML = "MARKDOWN 功能测试 (marked.parse): " + testHtml;
                 // 最好在API Key加载和历史记录渲染之后添加，避免被清空
                 // 或者在 chatOutput.innerHTML = ''; 之后重新添加
                 // 为简单起见，暂时注释掉 DOM 操作，保留 console.log
                 // document.getElementById('chatOutput').appendChild(testDiv);
            }
        } catch (e) {
            console.error("Marked Library Test - Error with marked.parse():", e);
        }
    } else {
        console.warn("Marked Library Test - marked is not an object or marked.parse is not a function. typeof marked:", typeof marked);
    }

    try {
        const result = await chrome.storage.sync.get(['geminiApiKey']);
        console.log("Sidebar: API Key from storage sync:", result);
        if (result.geminiApiKey) {
            geminiApiKey = result.geminiApiKey;
        } else {
            addMessageToChat({ role: 'model', parts: [{text: '错误：Gemini API 密钥未设置。请在插件选项中设置。'}], timestamp: Date.now() });
            disableInputs();
        }
    } catch (e) {
        console.error("Sidebar: Error loading API key from storage:", e);
        addMessageToChat({ role: 'model', parts: [{text: '错误：加载API密钥失败。'}], timestamp: Date.now() });
        disableInputs();
    }

    loadChatHistory(); // 加载历史对话
    renderCurrentChat(); // 渲染当前（可能为空的）对话

    // 通知 content_script (父窗口) 此 iframe 已准备就绪
    if (window.parent && window.parent !== window) {
        try {
            console.log("Sidebar: Sending SIDEBAR_READY to parent.");
            window.parent.postMessage({ type: 'SIDEBAR_READY' }, '*'); // 使用 '*' 作为 targetOrigin，或更精确的来源
        } catch (e) {
            console.error("Sidebar: Error sending SIDEBAR_READY to parent:", e);
        }
    } else {
        console.warn("Sidebar: window.parent not accessible or is self. Cannot send SIDEBAR_READY.");
    }
}

function disableInputs() {
    if (chatInput) chatInput.disabled = true;
    if (sendMessageButton) sendMessageButton.disabled = true;
    if (summarizePageButton) summarizePageButton.disabled = true;
}

// --- Gemini API 调用 ---
async function callGeminiAPI(promptPartsForAPI, isSummarization = false) {
    if (!geminiApiKey) {
        addMessageToChat({ role: 'model', parts: [{text: '错误: API Key 未设置。'}], timestamp: Date.now() });
        return;
    }

    let apiPayloadContents;

    if (isSummarization) {
        apiPayloadContents = [{ role: 'user', parts: promptPartsForAPI }];
    } else {
        apiPayloadContents = currentChat.map(msg => ({
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text }))
        }));
    }

    addMessageToChat({ role: 'model', parts: [{text: '思考中...'}]}, true);

    try {
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "contents": apiPayloadContents,
                "generationConfig": {
                    "temperature": 0.7,
                },
                "safetySettings": [
                    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            })
        });

        removeLastMessageFromChat();

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Sidebar: Gemini API Error:', errorData);
            const errorMessage = errorData.error?.message || `API请求失败 (状态 ${response.status})`;
            addMessageToChat({ role: 'model', parts: [{text: `错误: ${errorMessage}`}], timestamp: Date.now() });
            return;
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
            const aiResponseParts = data.candidates[0].content.parts;
            const aiMessageObject = {
                role: 'model',
                parts: aiResponseParts,
                timestamp: Date.now()
            };
            addMessageToChat(aiMessageObject);
            if (!isSummarization) {
                currentChat.push(aiMessageObject);
                saveCurrentChat();
            }
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            addMessageToChat({role: 'model', parts: [{text: `请求被安全策略阻止: ${data.promptFeedback.blockReason}`}], timestamp: Date.now()});
        } else {
            addMessageToChat({role: 'model', parts: [{text: '未能从API获取有效回复结构。请检查API响应。'}], timestamp: Date.now()});
            console.log("Sidebar: Unexpected API response structure:", data);
        }
    } catch (error) {
        removeLastMessageFromChat();
        console.error('Sidebar: Error calling Gemini API:', error);
        addMessageToChat({role: 'model', parts: [{text: `调用API时发生错误: ${error.message}`}], timestamp: Date.now()});
    }
}


// --- 聊天界面管理 ---
function addMessageToChat(messageObject, isTemporary = false) {
    if (!chatOutput) return;
    const sender = messageObject.role === 'user' ? 'user' : (messageObject.role === 'model' ? 'ai' : 'system');
    const text = messageObject.parts.map(p => p.text).join("\n");

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    if (sender === 'ai') {
        // console.log("[AI Message] Text to parse:", text); // 你可以保留这些日志用于调试
        // console.log("[AI Message] typeof marked:", typeof marked, "typeof marked.parse:", (marked ? typeof marked.parse : "marked is undefined"));

        // 更新后的条件：检查 marked 是否是一个对象，并且它有一个名为 parse 的方法，该方法是一个函数
        if (typeof marked === 'object' && marked !== null && typeof marked.parse === 'function') {
            try {
                // console.log("[AI Message] Parsing Markdown using marked.parse().");
                const htmlContent = marked.parse(text); // 调用 marked.parse()
                // console.log("[AI Message] Parsed HTML content:", htmlContent);
                messageDiv.innerHTML = htmlContent;
            } catch (e) {
                console.error("[AI Message] Error parsing Markdown with marked.parse():", e);
                const fallbackPre = document.createElement('pre');
                fallbackPre.textContent = text;
                messageDiv.appendChild(fallbackPre);
            }
        } else {
            console.warn("[AI Message] marked.parse is not available or marked is not an object. Displaying as plain text. typeof marked:", typeof marked, "marked.parse:", (marked ? marked.parse : "N/A"));
            const preTag = document.createElement('pre');
            preTag.textContent = text;
            messageDiv.appendChild(preTag);
        }
    } else { // 用户消息或其他系统消息
        const preTag = document.createElement('pre');
        preTag.textContent = text;
        messageDiv.appendChild(preTag);
    }

    if (messageObject.timestamp && !isTemporary) {
        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = new Date(messageObject.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.appendChild(timestampSpan);
    }

    if (isTemporary) {
        messageDiv.id = 'temporary-message';
    }

    chatOutput.appendChild(messageDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    return messageDiv;
}

function removeLastMessageFromChat() {
    if (!chatOutput) return;
    const tempMessage = document.getElementById('temporary-message');
    if (tempMessage) {
        chatOutput.removeChild(tempMessage);
    }
}

function renderCurrentChat() {
    if (!chatOutput) return;
    chatOutput.innerHTML = ''; // 清空
    currentChat.forEach(msgObject => {
        addMessageToChat(msgObject);
    });
    if (chatOutput.children.length > 0) {
        chatOutput.scrollTop = chatOutput.scrollHeight;
    }
}

// --- 事件监听 ---
if (sendMessageButton) {
    sendMessageButton.addEventListener('click', async () => {
        const userText = chatInput.value.trim();
        let promptForDisplay = "";
        let combinedTextForAPI = "";

        if (currentSelectedText) {
            promptForDisplay += `(关于引用: "${currentSelectedText.substring(0, 50)}...")\n`;
            combinedTextForAPI += `引用以下内容作为上下文：\n"${currentSelectedText}"\n\n我的问题或指令是：\n`;
        }

        if (userText) {
            promptForDisplay += userText;
            combinedTextForAPI += userText;
        } else if (currentSelectedText && !userText) {
            const defaultInstruction = "请基于上述引用内容进行处理或回应。";
            promptForDisplay = `(处理选中的文本: "${currentSelectedText.substring(0,50)}...")`;
            combinedTextForAPI += defaultInstruction;
        }


        if (!combinedTextForAPI.trim()) {
            console.log("Sidebar: No effective content to send.");
            return; // 没有有效输入
        }

        const partsForAPI = [{ text: combinedTextForAPI }];
        const partsForDisplay = [{ text: promptForDisplay.trim() }];

        const userMessageObject = {
            role: 'user',
            parts: partsForDisplay,
            timestamp: Date.now()
        };
        const userMessageForHistory = {
             role: 'user',
             parts: partsForAPI,
             timestamp: Date.now()
        }

        addMessageToChat(userMessageObject);
        currentChat.push(userMessageForHistory);

        if (chatInput) chatInput.value = '';
        clearSelectedTextPreview();

        await callGeminiAPI(partsForAPI, false);
    });
}

if (summarizePageButton) {
    summarizePageButton.addEventListener('click', () => {
        const summaryRequestText = '(正在请求总结当前网页...)';
        addMessageToChat({role: 'user', parts: [{text: summaryRequestText}], timestamp: Date.now()});

        chrome.runtime.sendMessage({ action: "getAndSummarizePage" }, async (response) => {
            if (chrome.runtime.lastError) {
                addMessageToChat({role: 'model', parts: [{text: `总结错误 (通讯): ${chrome.runtime.lastError.message}`}], timestamp: Date.now() });
                return;
            }

            if (response && typeof response.contentForSummary === 'string') {
                const pageContent = response.contentForSummary;
                if (pageContent.trim() === "") {
                     addMessageToChat({role: 'model', parts: [{text: `页面内容为空或未能提取到有效文本进行总结。`}], timestamp: Date.now() });
                     return;
                }
                const prompt = `请使用中文，清晰、简洁且全面地总结以下网页内容。如果内容包含技术信息或代码，请解释其核心概念和用途。如果是一篇文章，请提炼主要观点和论据。总结应易于理解，并抓住内容的精髓。\n\n网页内容如下：\n"${pageContent}"`;
                await callGeminiAPI([{ text: prompt }], true);
            } else if (response && response.error) {
                addMessageToChat({role: 'model', parts: [{text: `总结错误: ${response.error}`}], timestamp: Date.now() });
            } else {
                addMessageToChat({role: 'model', parts: [{text: `总结错误: 从背景脚本收到未知响应。`}], timestamp: Date.now() });
            }
        });
    });
}


// 监听来自 content_script 的选中文本消息
window.addEventListener('message', event => {
    if (event.data && event.data.type === 'TEXT_SELECTED') {
        currentSelectedText = event.data.text;
        if (selectedTextContent) selectedTextContent.textContent = currentSelectedText.length > 100 ? currentSelectedText.substring(0, 97) + '...' : currentSelectedText;
        if (selectedTextPreview) selectedTextPreview.style.display = 'block';
    }
});

if (clearSelectedTextButton) {
    clearSelectedTextButton.addEventListener('click', clearSelectedTextPreview);
}

function clearSelectedTextPreview() {
    currentSelectedText = null;
    if (selectedTextPreview) selectedTextPreview.style.display = 'none';
    if (selectedTextContent) selectedTextContent.textContent = '';
}

if (toggleHistoryButton) {
    toggleHistoryButton.addEventListener('click', () => {
        if (historyPanel) {
            const isHidden = historyPanel.style.display === 'none' || historyPanel.style.display === '';
            historyPanel.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                renderChatHistoryList();
            }
        }
    });
}

if (clearAllHistoryButton) {
    clearAllHistoryButton.addEventListener('click', () => {
        if (confirm("确定要清除所有对话历史吗？此操作不可撤销。")) {
            allChats = [];
            currentChat = [];
            if (currentChat.id) delete currentChat.id;
            saveChatHistory();
            renderCurrentChat();
            renderChatHistoryList();
            addMessageToChat({role:'model', parts:[{text: "所有对话历史已清除。"}]}, Date.now());
        }
    });
}

// --- 对话历史管理 ---
async function saveChatHistory() {
    try {
        await chrome.storage.local.set({ 'geminiChatHistory': allChats });
    } catch (e) {
        console.error("Sidebar: Error saving chat history:", e);
    }
}

function saveCurrentChat() {
    if (currentChat.length === 0 && !currentChat.id) return;

    const chatToSave = {
        id: currentChat.id || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        messages: [...currentChat],
        lastUpdated: Date.now(),
        title: currentChat[0]?.parts[0]?.text.substring(0, 40) + "..." || "新对话"
    };
    if (!currentChat.id) currentChat.id = chatToSave.id;

    const existingIndex = allChats.findIndex(c => c.id === chatToSave.id);
    if (existingIndex > -1) {
        allChats[existingIndex] = chatToSave;
    } else {
        allChats.push(chatToSave);
    }
    allChats.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    const MAX_HISTORY_ITEMS = 50;
    if (allChats.length > MAX_HISTORY_ITEMS) {
        allChats = allChats.slice(0, MAX_HISTORY_ITEMS);
    }
    saveChatHistory();
}


async function loadChatHistory() {
    try {
        const result = await chrome.storage.local.get(['geminiChatHistory']);
        if (result.geminiChatHistory && Array.isArray(result.geminiChatHistory)) {
            allChats = result.geminiChatHistory;
            allChats.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            console.log("Sidebar: Chat history loaded. Items:", allChats.length);
        } else {
            allChats = [];
            console.log("Sidebar: No chat history found or invalid format.");
        }
    } catch (e) {
        console.error("Sidebar: Error loading chat history:", e);
        allChats = [];
    }
}

function renderChatHistoryList() {
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    if (allChats.length === 0) {
        chatHistoryList.innerHTML = '<p>暂无历史对话。</p>';
        return;
    }

    allChats.forEach((chatSession, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('history-item');
        const titleText = chatSession.title || `对话 ${new Date(chatSession.id ? chatSession.id.split('_')[1] : chatSession.lastUpdated).toLocaleString()}`;
        itemDiv.textContent = titleText.length > 50 ? titleText.substring(0,47) + "..." : titleText;

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('history-item-buttons');

        const loadButton = document.createElement('button');
        loadButton.textContent = '加载';
        loadButton.title = "加载此对话到当前聊天窗口";
        loadButton.onclick = (e) => {
            e.stopPropagation();
            currentChat = [...chatSession.messages];
            currentChat.id = chatSession.id;
            renderCurrentChat();
            if (historyPanel) historyPanel.style.display = 'none';
        };

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.title = "删除此对话记录";
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`确定要删除对话 "${titleText}" 吗？`)) {
                allChats.splice(index, 1);
                if(currentChat.id === chatSession.id){
                    currentChat = [];
                    delete currentChat.id;
                    renderCurrentChat();
                }
                saveChatHistory();
                renderChatHistoryList();
            }
        };

        buttonContainer.appendChild(loadButton);
        buttonContainer.appendChild(deleteButton);
        itemDiv.appendChild(buttonContainer);

        itemDiv.onclick = () => {
            currentChat = [...chatSession.messages];
            currentChat.id = chatSession.id;
            renderCurrentChat();
            if (historyPanel) historyPanel.style.display = 'none';
        };
        chatHistoryList.appendChild(itemDiv);
    });
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', initialize);