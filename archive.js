// g-extension/archive.js
document.addEventListener('DOMContentLoaded', function() {
    const archivedChatsListDiv = document.getElementById('archivedChatsList');
    const clearAllArchivedButton = document.getElementById('clearAllArchivedButton');
    let archivedChats = []; // This will be populated from storage

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

        // Sort by the timestamp of the first message in each archived chat/pair, newest first
        const sortedArchivedChats = [...archivedChats].sort((a, b) => {
            const tsA = a[0]?.timestamp || 0;
            const tsB = b[0]?.timestamp || 0;
            return tsB - tsA;
        });


        sortedArchivedChats.forEach((chat, index) => { // Use sortedArchivedChats
            if (!chat || chat.length === 0) return;

            const chatContainer = document.createElement('div');
            chatContainer.classList.add('archived-chat-item');

            let titleText = `存档 ${index + 1}`;
            const firstUserMsg = chat.find(msg => msg.role === 'user' && msg.parts && msg.parts[0] && msg.parts[0].text);
            const firstModelMsg = chat.find(msg => msg.role === 'model' && msg.parts && msg.parts[0] && msg.parts[0].text);

            if (chat.length === 2 && firstUserMsg && firstModelMsg) { // Likely a Q&A pair
                titleText = `问答: ${firstUserMsg.parts[0].text.substring(0, 40)}...`;
            } else if (firstUserMsg) {
                titleText = `对话始于: ${firstUserMsg.parts[0].text.substring(0, 40)}...`;
            } else if (firstModelMsg) {
                 titleText = `对话始于 (AI): ${firstModelMsg.parts[0].text.substring(0, 30)}...`;
            } else if (chat[0] && chat[0].parts && chat[0].parts[0] && chat[0].parts[0].text) {
                titleText = (chat[0].role === 'user' ? "User: " : "AI: ") + chat[0].parts[0].text.substring(0,40) + (chat[0].parts[0].text.length > 40 ? "..." : "");
            }


            const titleHeader = document.createElement('h3');
            titleHeader.textContent = titleText;
            titleHeader.classList.add('archived-chat-title');
            titleHeader.addEventListener('click', () => {
                const contentDiv = chatContainer.querySelector('.archived-chat-content');
                contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
            });
            chatContainer.appendChild(titleHeader);
            
            const archiveDateSpan = document.createElement('span');
            archiveDateSpan.classList.add('archive-date');
            // Use timestamp of the first message in the archived item
            archiveDateSpan.textContent = `存档于: ${new Date(chat[0]?.timestamp || Date.now()).toLocaleDateString()}`;
            chatContainer.appendChild(archiveDateSpan);


            const chatContentDiv = document.createElement('div');
            chatContentDiv.classList.add('archived-chat-content');
            chatContentDiv.style.display = 'none'; 

            chat.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', msg.role === 'user' ? 'user-message' : 'ai-message');
                
                let contentHtml = "内容不可用";
                if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
                     // Can use marked.js here if desired, for consistency
                     // For now, simple escaped HTML:
                     contentHtml = escapeHtml(msg.parts[0].text).replace(/\n/g, '<br>');
                }
                messageDiv.innerHTML = `<strong>${msg.role === 'user' ? 'You' : 'AI'} (${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}):</strong><div class="msg-text-content">${contentHtml}</div>`;
                
                chatContentDiv.appendChild(messageDiv);
            });
            chatContainer.appendChild(chatContentDiv);
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '从此存档中删除';
            deleteButton.classList.add('delete-archive-btn');
            deleteButton.onclick = (e) => {
                e.stopPropagation(); // Prevent title click event
                if (confirm(`确定要从存档中删除这个对话 ("${titleText}") 吗？此操作无法撤销。`)) {
                    // Find the original index in 'archivedChats' before sorting for deletion
                    const originalIndex = archivedChats.findIndex(originalChat => originalChat === chat);
                    if (originalIndex !== -1) {
                        archivedChats.splice(originalIndex, 1);
                        saveArchivedChats(); // This will trigger re-render via storage listener or call render directly
                        renderArchivedChats(); // Immediate re-render
                    }
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
        // The onChanged listener in this script will handle re-rendering if open.
    }

    if (clearAllArchivedButton) {
        clearAllArchivedButton.addEventListener('click', () => {
            if (confirm("确定要永久删除所有已存档的对话吗？此操作无法撤销。")) {
                archivedChats = [];
                saveArchivedChats();
                renderArchivedChats(); // Immediate re-render
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