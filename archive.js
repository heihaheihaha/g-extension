// g-extension/archive.js
document.addEventListener('DOMContentLoaded', async function() {
    const archivedChatsListDiv = document.getElementById('archivedChatsList');
    const clearAllArchivedButton = document.getElementById('clearAllArchivedButton');
    let archivedChats = []; 
    let currentLang = 'zh';

    async function initArchive() {
        currentLang = await getActiveLanguage();
        await applyPageLocalization();
        await loadArchivedChats();
        setupEventListeners();
    }

    function setupEventListeners() {
        if (clearAllArchivedButton) {
            clearAllArchivedButton.addEventListener('click', async () => {
                if (confirm(await getL10nString('confirmClearAllArchived'))) {
                    archivedChats = [];
                    saveArchivedChatsToStorage();
                    await renderArchivedChats(); 
                }
            });
        }
         // Listener for language changes
        chrome.storage.onChanged.addListener(async (changes, namespace) => {
            if (namespace === 'sync' && changes.language) {
                currentLang = changes.language.newValue || 'zh';
                await applyPageLocalization();
                await renderArchivedChats(); // Re-render with new language for dates, etc.
            }
             if (namespace === 'local' && changes.geminiArchivedChats) { // Keep existing listener
                archivedChats = changes.geminiArchivedChats.newValue || [];
                await renderArchivedChats();
            }
        });
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

    async function renderArchivedChats() {
        if (!archivedChatsListDiv) return;
        archivedChatsListDiv.innerHTML = '';
        currentLang = await getActiveLanguage(); // Ensure lang is current for display

        if (archivedChats.length === 0) {
            archivedChatsListDiv.innerHTML = `<p>${await getL10nString('noArchivedChats')}</p>`;
            return;
        }

        const sortedArchivedChats = [...archivedChats].sort((a, b) => {
            const tsA = a[0]?.timestamp || 0;
            const tsB = b[0]?.timestamp || 0;
            return tsB - tsA;
        });

        const deleteButtonText = await getL10nString('deleteFromArchiveButton');
        const roleYouText = await getL10nString('roleYou');
        const roleAiText = await getL10nString('roleAi');


        for (let index = 0; index < sortedArchivedChats.length; index++) {
            const chat = sortedArchivedChats[index];
            if (!chat || chat.length === 0) continue;

            const chatContainer = document.createElement('div');
            chatContainer.classList.add('archived-chat-item');

            let titleTextKey = 'archiveChatItemTitle';
            let titleArg = String(index + 1);

            const firstUserMsg = chat.find(msg => msg.role === 'user' && msg.parts && msg.parts[0] && msg.parts[0].text);
            const firstModelMsg = chat.find(msg => msg.role === 'model' && msg.parts && msg.parts[0] && msg.parts[0].text);

            if (chat.length === 2 && firstUserMsg && firstModelMsg) { 
                titleTextKey = 'archiveChatItemQATitle';
                titleArg = firstUserMsg.parts[0].text.substring(0, 40);
            } else if (firstUserMsg) {
                titleTextKey = 'archiveChatItemConvTitle';
                titleArg = firstUserMsg.parts[0].text.substring(0, 40);
            } else if (firstModelMsg) {
                titleTextKey = 'archiveChatItemConvAiTitle';
                titleArg = firstModelMsg.parts[0].text.substring(0, 30);
            } else if (chat[0] && chat[0].parts && chat[0].parts[0] && chat[0].parts[0].text) {
                titleTextKey = chat[0].role === 'user' ? 'archiveChatItemConvTitle' : 'archiveChatItemConvAiTitle';
                titleArg = chat[0].parts[0].text.substring(0,40);
            }
            const titleText = await getL10nString(titleTextKey, titleArg);

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
            const dateToFormat = new Date(chat[0]?.timestamp || Date.now());
            const formattedDate = dateToFormat.toLocaleDateString(currentLang === 'en' ? 'en-US' : 'zh-CN');
            archiveDateSpan.textContent = await getL10nString('archiveDateLabel', formattedDate);
            chatContainer.appendChild(archiveDateSpan);

            const chatContentDiv = document.createElement('div');
            chatContentDiv.classList.add('archived-chat-content');
            chatContentDiv.style.display = 'none'; 

            chat.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', msg.role === 'user' ? 'user-message' : 'ai-message');

                let contentHtml = "Content unavailable"; // Fallback
                if (msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string') {
                     contentHtml = escapeHtml(msg.parts[0].text).replace(/\n/g, '<br>');
                }
                const roleDisplayName = msg.role === 'user' ? roleYouText : roleAiText;
                const timeToFormat = new Date(msg.timestamp).toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' });
                messageDiv.innerHTML = `<strong><span class="math-inline">\{roleDisplayName\} \(</span>{timeToFormat}):</strong><div class="msg-text-content">${contentHtml}</div>`;

                chatContentDiv.appendChild(messageDiv);
            });
            chatContainer.appendChild(chatContentDiv);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = deleteButtonText;
            deleteButton.classList.add('delete-archive-btn');
            deleteButton.onclick = async (e) => {
                e.stopPropagation(); 
                if (confirm(await getL10nString('confirmDeleteArchiveItem', titleText))) {
                    const originalIndex = archivedChats.findIndex(originalChat => originalChat === chat);
                    if (originalIndex !== -1) {
                        archivedChats.splice(originalIndex, 1);
                        saveArchivedChatsToStorage(); 
                        await renderArchivedChats(); 
                    }
                }
            };
            chatContainer.appendChild(deleteButton);
            archivedChatsListDiv.appendChild(chatContainer);
        }
    }

    async function loadArchivedChats() {
        const result = await chrome.storage.local.get(['geminiArchivedChats']);
        archivedChats = result.geminiArchivedChats || [];
        await renderArchivedChats();
    }

    function saveArchivedChatsToStorage() {
        chrome.storage.local.set({ 'geminiArchivedChats': archivedChats });
    }

    initArchive();
});