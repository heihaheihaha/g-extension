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
    console.log("Sidebar: Initializing...");
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

    // 为API请求准备内容，确保不包含本地时间戳等额外字段
    let apiPayloadContents;

    if (isSummarization) {
        // 总结请求通常不带历史上下文，只有当前指令和页面内容
        apiPayloadContents = [{ role: 'user', parts: promptPartsForAPI }];
    } else {
        // 对话请求：使用 currentChat (它已经包含了最新的用户输入，并且 parts 已是API格式)
        // currentChat 内部存储的已经是 {role, parts:[{text}], timestamp}
        // 发送给API时，需要移除 timestamp
        apiPayloadContents = currentChat.map(msg => ({
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text })) // 确保 parts 也是纯净的
        }));
    }

    addMessageToChat({ role: 'model', parts: [{text: '思考中...'}]}, true); // 临时"思考中"消息

    try {
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "contents": apiPayloadContents,
                "generationConfig": {
                    "temperature": 0.7,
                    // "maxOutputTokens": isSummarization ? 2048 : 1024, // 总结可以长一些
                    // "topK": 1,
                    // "topP": 1,
                },
                "safetySettings": [ // 可以根据需要调整安全设置
                    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            })
        });

        removeLastMessageFromChat(); // 移除 "思考中..."

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Sidebar: Gemini API Error:', errorData);
            const errorMessage = errorData.error?.message || `API请求失败 (状态 ${response.status})`;
            addMessageToChat({ role: 'model', parts: [{text: `错误: ${errorMessage}`}], timestamp: Date.now() });
            // 如果API调用失败，对于非总结的对话，可以考虑是否回滚最后的用户消息
            if (!isSummarization && currentChat.length > 0 && currentChat[currentChat.length - 1].role === 'user') {
                // currentChat.pop(); // 简单回滚
                // renderCurrentChat();
                // saveCurrentChat(); // 保存回滚后的状态
            }
            return;
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
            const aiResponseParts = data.candidates[0].content.parts; // API返回的parts已经是 [{text:"..."}] 格式
            const aiMessageObject = {
                role: 'model',
                parts: aiResponseParts,
                timestamp: Date.now()
            };

            addMessageToChat(aiMessageObject); // 显示AI回复

            if (!isSummarization) { // 只有对话回复才加入并保存到 currentChat
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
        removeLastMessageFromChat(); // 移除 "思考中..."
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

    // 根据发送者处理文本
    if (sender === 'ai' && typeof marked === 'function') { // 确保marked库已加载
        try {
            // 将AI的Markdown回复转换为HTML
            // marked.parse() 是新版 Marked.js (v4+) 的推荐用法
            // 旧版可能是 marked(text)
            const htmlContent = marked.parse(text);
            messageDiv.innerHTML = htmlContent; // 设置HTML内容
        } catch (e) {
            console.error("Sidebar: Error parsing Markdown:", e);
            // 如果解析失败，则回退到纯文本显示
            const fallbackPre = document.createElement('pre');
            fallbackPre.textContent = text;
            messageDiv.appendChild(fallbackPre);
        }
    } else {
        // 对于用户消息或解析失败/marked未加载的情况，仍然使用 <pre> 标签显示纯文本
        // (或者，如果您希望用户输入也被解析为Markdown，可以修改此逻辑)
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

        // partsForAPI 是发送给API的，应该包含完整上下文和指令
        const partsForAPI = [{ text: combinedTextForAPI }];
        // partsForDisplay 是显示在聊天窗口的，可以简洁一些
        const partsForDisplay = [{ text: promptForDisplay.trim() }];

        const userMessageObject = {
            role: 'user',
            parts: partsForDisplay, // 用于显示
            timestamp: Date.now()
        };
        const userMessageForHistory = { // 用于历史和API调用上下文
             role: 'user',
             parts: partsForAPI, // 存储更完整的API指令
             timestamp: Date.now()
        }

        addMessageToChat(userMessageObject);
        currentChat.push(userMessageForHistory); // 将包含完整API指令的版本加入历史

        if (chatInput) chatInput.value = '';
        clearSelectedTextPreview();

        await callGeminiAPI(partsForAPI, false); // false表示这不是页面总结
    });
}

if (summarizePageButton) {
    summarizePageButton.addEventListener('click', () => {
        const summaryRequestText = '(正在请求总结当前网页...)';
        // 显示用户请求总结的动作
        addMessageToChat({role: 'user', parts: [{text: summaryRequestText}], timestamp: Date.now()});

        // 请求 background.js 获取当前页面内容
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
                // 构建总结的提示
                const prompt = `请使用中文，清晰、简洁且全面地总结以下网页内容。如果内容包含技术信息或代码，请解释其核心概念和用途。如果是一篇文章，请提炼主要观点和论据。总结应易于理解，并抓住内容的精髓。\n\n网页内容如下：\n"${pageContent}"`;

                // 对于总结，我们通常不希望它受当前对话历史的影响
                // 临时保存并清空currentChat，调用API，然后恢复
                // const tempCurrentChatBackup = [...currentChat];
                // currentChat = []; // 确保总结是基于纯粹的页面内容

                await callGeminiAPI([{ text: prompt }], true); // true 表示是总结请求

                // currentChat = tempCurrentChatBackup; // 恢复之前的对话
                // renderCurrentChat();
                // 注意：总结结果目前是直接显示的，并没有加入到 currentChat 以便继续对话。
                // 如果希望总结后可以继续对话，那么不应该清空 currentChat，
                // 而是将总结请求和结果也作为对话的一部分。但通常总结是一次性操作。

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
    // 安全性: 理想情况下应检查 event.origin
    // console.log("Sidebar: Received window message", event.data);
    if (event.data && event.data.type === 'TEXT_SELECTED') {
        // console.log("Sidebar: TEXT_SELECTED received:", event.data.text);
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
            if (currentChat.id) delete currentChat.id; // 清除当前对话的ID
            saveChatHistory();    // 保存空的 allChats
            renderCurrentChat();  // 清空当前聊天窗口
            renderChatHistoryList(); // 更新历史列表显示
            addMessageToChat({role:'model', parts:[{text: "所有对话历史已清除。"}]}, Date.now());
        }
    });
}

// --- 对话历史管理 ---
async function saveChatHistory() { // 保存 allChats 数组
    try {
        await chrome.storage.local.set({ 'geminiChatHistory': allChats });
    } catch (e) {
        console.error("Sidebar: Error saving chat history:", e);
    }
}

function saveCurrentChat() { // 将 currentChat 更新或添加到 allChats
    if (currentChat.length === 0 && !currentChat.id) return; // 如果当前对话为空且没有ID，则不保存

    const chatToSave = {
        id: currentChat.id || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        messages: [...currentChat], // 创建副本
        lastUpdated: Date.now(),
        title: currentChat[0]?.parts[0]?.text.substring(0, 40) + "..." || "新对话"
    };
    if (!currentChat.id) currentChat.id = chatToSave.id; // 如果是新对话，赋予ID

    const existingIndex = allChats.findIndex(c => c.id === chatToSave.id);
    if (existingIndex > -1) {
        allChats[existingIndex] = chatToSave; // 更新现有对话
    } else {
        allChats.push(chatToSave); // 添加新对话
    }
    // 按lastUpdated降序排列
    allChats.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    // 只保留最近N条历史记录，避免存储过大
    const MAX_HISTORY_ITEMS = 50;
    if (allChats.length > MAX_HISTORY_ITEMS) {
        allChats = allChats.slice(0, MAX_HISTORY_ITEMS); // 保留最新的N条
    }
    saveChatHistory(); // 将更新后的 allChats 保存到 chrome.storage.local
    // renderChatHistoryList(); // 通常在显式打开历史记录时渲染
}


async function loadChatHistory() {
    try {
        const result = await chrome.storage.local.get(['geminiChatHistory']);
        if (result.geminiChatHistory && Array.isArray(result.geminiChatHistory)) {
            allChats = result.geminiChatHistory;
            allChats.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)); // 确保加载后也排序
            console.log("Sidebar: Chat history loaded. Items:", allChats.length);
        } else {
            allChats = [];
            console.log("Sidebar: No chat history found or invalid format.");
        }
    } catch (e) {
        console.error("Sidebar: Error loading chat history:", e);
        allChats = [];
    }
    // 默认不加载任何历史到当前聊天窗口，保持 currentChat 为空
    // renderChatHistoryList(); // 通常在用户点击查看历史时渲染
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
            currentChat = [...chatSession.messages]; // 创建副本
            currentChat.id = chatSession.id; // 赋予ID
            renderCurrentChat();
            if (historyPanel) historyPanel.style.display = 'none';
        };

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.title = "删除此对话记录";
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`确定要删除对话 "${titleText}" 吗？`)) {
                allChats.splice(index, 1); // 从当前渲染的allChats数组中删除
                if(currentChat.id === chatSession.id){ // 如果删除的是当前加载的对话
                    currentChat = [];
                    delete currentChat.id;
                    renderCurrentChat();
                }
                saveChatHistory(); // 保存更改 (allChats)
                renderChatHistoryList(); // 重新渲染列表
            }
        };
        // 对话分割功能可以更复杂，这里仅作占位
        // const splitButton = document.createElement('button');
        // splitButton.textContent = '分割'; // ...

        buttonContainer.appendChild(loadButton);
        buttonContainer.appendChild(deleteButton);
        // buttonContainer.appendChild(splitButton);
        itemDiv.appendChild(buttonContainer);

        itemDiv.onclick = () => { // 点击条目本身也加载
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