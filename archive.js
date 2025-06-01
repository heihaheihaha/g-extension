// g-extension/archive.js
document.addEventListener('DOMContentLoaded', function() {
    const archivedChatsListDiv = document.getElementById('archivedChatsList');
    const clearAllArchivedButton = document.getElementById('clearAllArchivedButton');
    let archivedChats = [];

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderArchivedChats() {
        if (!archivedChatsListDiv) return;
        archivedChatsListDiv.innerHTML = '';

        if (archivedChats.length === 0) {
            archivedChatsListDiv.innerHTML = '<p>没有已存档的对话。</p>';
            return;
        }

        archivedChats.forEach((chat, index) => {
            if (chat.length === 0) return;

            const chatContainer = document.createElement('div');
            chatContainer.classList.add('archived-chat-item');

            const firstUserMsg = chat.find(msg => msg.role === 'user' && msg.parts && msg.parts[0] && msg.parts[0].text);
            let titleText = `存档对话 ${index + 1}`;
             if (firstUserMsg && firstUserMsg.parts && firstUserMsg.parts[0] && firstUserMsg.parts[0].text) {
                titleText = firstUserMsg.parts[0].text.substring(0, 50) + (firstUserMsg.parts[0].text.length > 50 ? '...' : '');
            } else {
                 const firstModelMsg = chat.find(msg => msg.role === 'model' && msg.parts && msg.parts[0] && msg.parts[0].text);
                 if (firstModelMsg && firstModelMsg.parts && firstModelMsg.parts[0] && firstModelMsg.parts[0].text) {
                     titleText = "AI: " + firstModelMsg.parts[0].text.substring(0, 40) + (firstModelMsg.parts[0].text.length > 40 ? '...' : '');
                 } else if (chat[0] && chat[0].parts && chat[0].parts[0] && chat[0].parts[0].text) {
                    titleText = (chat[0].role === 'user' ? "User: " : "AI: ") + chat[0].parts[0].text.substring(0,40) + (chat[0].parts[0].text.length > 40 ? "..." : "");
                 }
            }

            const titleHeader = document.createElement('h3');
            titleHeader.textContent = titleText;
            titleHeader.classList.add('archived-chat-title');
            titleHeader.addEventListener('click', () => {
                const contentDiv = chatContainer.querySelector('.archived-chat-content');
                contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
            });
            chatContainer.appendChild(titleHeader);

            const chatContentDiv = document.createElement('div');
            chatContentDiv.classList.add('archived-chat-content');
            chatContentDiv.style.display = 'none'; // Initially hidden

            chat.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', msg.role === 'user' ? 'user-message' : 'ai-message');
                
                let contentHtml = "内容不可用";
                if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
                     // Using simple text display for archive for now, can add markdown later if needed
                     contentHtml = escapeHtml(msg.parts[0].text).replace(/\n/g, '<br>');
                }
                messageDiv.innerHTML = `<strong>${msg.role === 'user' ? 'You' : 'AI'}:</strong> ${contentHtml}`;
                
                const timestampSpan = document.createElement('span');
                timestampSpan.classList.add('timestamp');
                timestampSpan.textContent = new Date(msg.timestamp).toLocaleString();
                messageDiv.appendChild(timestampSpan);

                chatContentDiv.appendChild(messageDiv);
            });
            chatContainer.appendChild(chatContentDiv);
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '从此存档中删除';
            deleteButton.classList.add('delete-archive-btn');
            deleteButton.onclick = () => {
                if (confirm(`确定要从存档中删除这个对话 ("${titleText}") 吗？此操作无法撤销。`)) {
                    archivedChats.splice(index, 1);
                    saveArchivedChats();
                    renderArchivedChats();
                }
            };
            chatContainer.appendChild(deleteButton);

            archivedChatsListDiv.appendChild(chatContainer);
        });
    }

    function loadArchivedChats() {
        chrome.storage.local.get(['geminiArchivedChats'], (result) => {
            if (result.geminiArchivedChats) {
                archivedChats = result.geminiArchivedChats;
            } else {
                archivedChats = [];
            }
            renderArchivedChats();
        });
    }

    function saveArchivedChats() {
        chrome.storage.local.set({ 'geminiArchivedChats': archivedChats });
    }

    if (clearAllArchivedButton) {
        clearAllArchivedButton.addEventListener('click', () => {
            if (confirm("确定要永久删除所有已存档的对话吗？此操作无法撤销。")) {
                archivedChats = [];
                saveArchivedChats();
                renderArchivedChats();
            }
        });
    }
    
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.geminiArchivedChats) {
            archivedChats = changes.geminiArchivedChats.newValue || [];
            renderArchivedChats();
        }
    });

    loadArchivedChats();
});