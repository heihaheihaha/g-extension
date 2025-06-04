// g-extension/content_script.js
console.log("Content Script for sidePanel: Loaded and running for drag-preview.");

const PREVIEW_WINDOW_ID = 'gemini-link-summary-preview-window';
const PREVIEW_STYLE_ID = 'gemini-link-summary-preview-style';
let currentDraggedLink = null;
let previewWindow = null;
let summarizeButtonInPreview = null;
let closePreviewButton = null;
let previewUrlElement = null;
let previewTextElement = null;
let previewHeaderTitleElement = null;
let previewUrlLabelElement = null;
let previewTextLabelElement = null;

// Object to hold localized strings, fetched from background
let csL10n = {
    linkPreviewTitle: "Link Preview",
    closePreviewButtonTitle: "Close Preview",
    urlLabel: "URL:",
    textLabel: "Text:",
    summarizeButtonText: "Summarize Link"
};

// Request translations from background script on load
chrome.runtime.sendMessage({ action: "getCsTranslations" }, (response) => {
    if (chrome.runtime.lastError) {
        console.error("CS: Error getting translations:", chrome.runtime.lastError.message);
    } else if (response && response.translations) {
        csL10n = response.translations;
        // If preview window exists, update its text
        if (previewWindow && previewWindow.style.display !== 'none') {
            updatePreviewWindowText();
        }
    }
});


function injectPreviewStyles() {
    if (document.getElementById(PREVIEW_STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = PREVIEW_STYLE_ID;
    style.textContent = `
    #${PREVIEW_WINDOW_ID} {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      max-width: 90vw;
      background-color: white;
      border: 1px solid #ccc;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2147483647; /* Max z-index */
      font-family: sans-serif;
      font-size: 13px;
      color: #333;
      border-radius: 6px;
      display: none; /* Initially hidden */
      flex-direction: column;
      overflow: hidden;
    }
    #${PREVIEW_WINDOW_ID} .preview-header {
      padding: 8px 12px;
      background-color: #f0f0f0;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab; 
    }
    #${PREVIEW_WINDOW_ID} .preview-header-title {
      font-weight: bold;
    }
    #${PREVIEW_WINDOW_ID} .preview-close-btn {
      background: none;
      border: none;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 0 5px;
      color: #777;
    }
    #${PREVIEW_WINDOW_ID} .preview-close-btn:hover {
      color: #333;
    }
    #${PREVIEW_WINDOW_ID} .preview-content {
      padding: 12px;
      max-height: 100px;
      overflow-y: auto;
      word-wrap: break-word;
    }
    #${PREVIEW_WINDOW_ID} .preview-content p {
      margin: 0 0 8px 0;
      display: flex; /* Align label and content */
      align-items: baseline;
    }
    #${PREVIEW_WINDOW_ID} .preview-content strong { /* For labels */
      color: #555;
      margin-right: 5px;
      white-space: nowrap;
    }
    #${PREVIEW_WINDOW_ID} .preview-url-content-span,
    #${PREVIEW_WINDOW_ID} .preview-text-content-span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block; /* Changed from block */
      color: #0066cc;
      flex-grow: 1; /* Allow content to take remaining space */
      min-width: 0; /* Important for ellipsis to work in flex item */
    }
     #${PREVIEW_WINDOW_ID} .preview-text-content-span {
       color: #333;
     }
    #${PREVIEW_WINDOW_ID} .preview-actions {
      padding: 10px 12px;
      text-align: right;
      border-top: 1px solid #e0e0e0;
      background-color: #f9f9f9;
    }
    #${PREVIEW_WINDOW_ID} .summarize-link-btn-preview {
      padding: 7px 15px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    #${PREVIEW_WINDOW_ID} .summarize-link-btn-preview:hover {
      background-color: #0056b3;
    }
  `;
    document.head.appendChild(style);
}

function updatePreviewWindowText() {
    if (!previewWindow) return;
    if (previewHeaderTitleElement) previewHeaderTitleElement.textContent = csL10n.linkPreviewTitle;
    if (closePreviewButton) closePreviewButton.title = csL10n.closePreviewButtonTitle;
    if (previewUrlLabelElement) previewUrlLabelElement.textContent = csL10n.urlLabel;
    if (previewTextLabelElement) previewTextLabelElement.textContent = csL10n.textLabel;
    if (summarizeButtonInPreview) summarizeButtonInPreview.textContent = csL10n.summarizeButtonText;
}

function createPreviewWindow() {
    if (document.getElementById(PREVIEW_WINDOW_ID)) {
        previewWindow = document.getElementById(PREVIEW_WINDOW_ID);
        summarizeButtonInPreview = previewWindow.querySelector('.summarize-link-btn-preview');
        closePreviewButton = previewWindow.querySelector('.preview-close-btn');
        previewUrlElement = previewWindow.querySelector('.preview-url-content-span');
        previewTextElement = previewWindow.querySelector('.preview-text-content-span');
        previewHeaderTitleElement = previewWindow.querySelector('.preview-header-title');
        // Get label elements
        const labels = previewWindow.querySelectorAll('.preview-content p strong');
        if (labels.length >= 2) {
            previewUrlLabelElement = labels[0];
            previewTextLabelElement = labels[1];
        }
        updatePreviewWindowText(); // Apply initial translations
        return;
    }

    injectPreviewStyles();

    previewWindow = document.createElement('div');
    previewWindow.id = PREVIEW_WINDOW_ID;
    previewWindow.innerHTML = `
    <div class="preview-header">
      <span class="preview-header-title">${csL10n.linkPreviewTitle}</span>
      <button class="preview-close-btn" title="${csL10n.closePreviewButtonTitle}">&times;</button>
    </div>
    <div class="preview-content">
      <p><strong>${csL10n.urlLabel}</strong> <span class="preview-url-content-span"></span></p>
      <p><strong>${csL10n.textLabel}</strong> <span class="preview-text-content-span"></span></p>
    </div>
    <div class="preview-actions">
      <button class="summarize-link-btn-preview">${csL10n.summarizeButtonText}</button>
    </div>
  `;
    document.body.appendChild(previewWindow);

    summarizeButtonInPreview = previewWindow.querySelector('.summarize-link-btn-preview');
    closePreviewButton = previewWindow.querySelector('.preview-close-btn');
    previewUrlElement = previewWindow.querySelector('.preview-url-content-span');
    previewTextElement = previewWindow.querySelector('.preview-text-content-span');
    previewHeaderTitleElement = previewWindow.querySelector('.preview-header-title');
    const labels = previewWindow.querySelectorAll('.preview-content p strong');
    if (labels.length >= 2) {
        previewUrlLabelElement = labels[0];
        previewTextLabelElement = labels[1];
    }


    closePreviewButton.addEventListener('click', hidePreview);

    const header = previewWindow.querySelector('.preview-header');
    let isDraggingHeader = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        isDraggingHeader = true;
        offsetX = e.clientX - previewWindow.getBoundingClientRect().left;
        offsetY = e.clientY - previewWindow.getBoundingClientRect().top;
        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingHeader) {
            previewWindow.style.left = `${e.clientX - offsetX}px`;
            previewWindow.style.top = `${e.clientY - offsetY}px`;
            previewWindow.style.right = 'auto'; 
            previewWindow.style.bottom = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingHeader) {
            isDraggingHeader = false;
            header.style.cursor = 'grab';
        }
    });
}

function showPreview(linkElement) {
    if (!previewWindow) createPreviewWindow();
    updatePreviewWindowText(); // Ensure text is updated with current l10n strings

    currentDraggedLink = linkElement;
    const url = linkElement.href;
    const linkText = linkElement.textContent.trim() || linkElement.title || url;

    previewUrlElement.textContent = url;
    previewUrlElement.title = url;
    previewTextElement.textContent = linkText;
    previewTextElement.title = linkText;

    previewWindow.dataset.url = url;
    previewWindow.dataset.title = linkText; 
    previewWindow.style.display = 'flex';

    if (summarizeButtonInPreview._clickHandler) {
        summarizeButtonInPreview.removeEventListener('click', summarizeButtonInPreview._clickHandler);
    }
    summarizeButtonInPreview._clickHandler = () => {
        const targetUrl = previewWindow.dataset.url;
        const targetTitle = previewWindow.dataset.title;
        // console.log("Content Script: 'Summarize' clicked in preview for:", targetUrl);
        chrome.runtime.sendMessage({
            action: 'summarizeLinkTarget',
            url: targetUrl,
            linkText: targetTitle 
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Content Script: Error sending summarizeLinkTarget message:", chrome.runtime.lastError.message);
            }
        });
        hidePreview();
    };
    summarizeButtonInPreview.addEventListener('click', summarizeButtonInPreview._clickHandler);
}

function hidePreview() {
    if (previewWindow) {
        previewWindow.style.display = 'none';
        previewWindow.style.bottom = '20px';
        previewWindow.style.right = '20px';
        previewWindow.style.left = 'auto';
        previewWindow.style.top = 'auto';
    }
    currentDraggedLink = null;
}

document.addEventListener('dragstart', (event) => {
    const targetLink = event.target.closest('a');
    if (targetLink && targetLink.href && !targetLink.href.startsWith('javascript:')) {
        try {
            event.dataTransfer.setData('text/uri-list', targetLink.href);
            event.dataTransfer.setData('text/plain', targetLink.href);
        } catch (e) {
            console.warn("Could not set drag data:", e);
        }
        showPreview(targetLink);
    }
}, true);

document.addEventListener('dragend', () => {
    setTimeout(hidePreview, 1000);
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContentForSummarize') {
        try {
            const mainContent = document.body.innerText;
            sendResponse({ contentForSummary: mainContent });
        } catch (e) {
            console.error("Content Script: Error getting document.body.innerText", e);
            sendResponse({ error: "Error accessing page content: " + e.message });
        }
        return true; 
    } else if (request.action === 'languageChanged') { // Listen for language changes
        csL10n = request.translations;
        if (previewWindow && previewWindow.style.display !== 'none') {
            updatePreviewWindowText();
        }
        sendResponse({status: "cs language updated"});
    }
    return true; 
});

document.addEventListener('mouseup', () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && !previewWindow?.contains(window.getSelection().anchorNode?.parentNode)) { 
        chrome.runtime.sendMessage({ action: 'TEXT_SELECTED_FROM_PAGE', text: selectedText }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Content Script: Error sending selected text to background:", chrome.runtime.lastError.message);
            }
        });
    }
});

// Ensure preview window is created on load so its elements are available
createPreviewWindow();