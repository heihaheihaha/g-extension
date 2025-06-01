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
      cursor: grab; /* Allow moving the preview window */
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
    }
    #${PREVIEW_WINDOW_ID} .preview-content strong {
      color: #555;
    }
    #${PREVIEW_WINDOW_ID} .preview-url-content-span,
    #${PREVIEW_WINDOW_ID} .preview-text-content-span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      color: #0066cc;
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

function createPreviewWindow() {
    if (document.getElementById(PREVIEW_WINDOW_ID)) {
        previewWindow = document.getElementById(PREVIEW_WINDOW_ID);
        summarizeButtonInPreview = previewWindow.querySelector('.summarize-link-btn-preview');
        closePreviewButton = previewWindow.querySelector('.preview-close-btn');
        previewUrlElement = previewWindow.querySelector('.preview-url-content-span');
        previewTextElement = previewWindow.querySelector('.preview-text-content-span');
        return;
    }

    injectPreviewStyles();

    previewWindow = document.createElement('div');
    previewWindow.id = PREVIEW_WINDOW_ID;
    previewWindow.innerHTML = `
    <div class="preview-header">
      <span class="preview-header-title">Link Preview</span>
      <button class="preview-close-btn" title="Close Preview">&times;</button>
    </div>
    <div class="preview-content">
      <p><strong>URL:</strong> <span class="preview-url-content-span"></span></p>
      <p><strong>Text:</strong> <span class="preview-text-content-span"></span></p>
    </div>
    <div class="preview-actions">
      <button class="summarize-link-btn-preview">Summarize Link</button>
    </div>
  `;
    document.body.appendChild(previewWindow);

    summarizeButtonInPreview = previewWindow.querySelector('.summarize-link-btn-preview');
    closePreviewButton = previewWindow.querySelector('.preview-close-btn');
    previewUrlElement = previewWindow.querySelector('.preview-url-content-span');
    previewTextElement = previewWindow.querySelector('.preview-text-content-span');

    closePreviewButton.addEventListener('click', hidePreview);

    // Make the preview window draggable by its header
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
            // Adjust if it goes off-screen, if necessary
            previewWindow.style.right = 'auto'; // unset fixed right/bottom
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

    currentDraggedLink = linkElement;
    const url = linkElement.href;
    const linkText = linkElement.textContent.trim() || linkElement.title || url;

    previewUrlElement.textContent = url;
    previewUrlElement.title = url;
    previewTextElement.textContent = linkText;
    previewTextElement.title = linkText;

    previewWindow.dataset.url = url;
    previewWindow.dataset.title = linkText; // Store title for summary request
    previewWindow.style.display = 'flex'; // Use flex for column layout

    // Remove previous listener before adding a new one to avoid multiple triggers
    if (summarizeButtonInPreview._clickHandler) {
        summarizeButtonInPreview.removeEventListener('click', summarizeButtonInPreview._clickHandler);
    }
    summarizeButtonInPreview._clickHandler = () => {
        const targetUrl = previewWindow.dataset.url;
        const targetTitle = previewWindow.dataset.title;
        console.log("Content Script: 'Summarize' clicked in preview for:", targetUrl);
        chrome.runtime.sendMessage({
            action: 'summarizeLinkTarget',
            url: targetUrl,
            linkText: targetTitle // Send link text for better context in sidebar
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
         // Reset fixed position if it was changed by dragging
        previewWindow.style.bottom = '20px';
        previewWindow.style.right = '20px';
        previewWindow.style.left = 'auto';
        previewWindow.style.top = 'auto';
    }
    currentDraggedLink = null;
    // It's good practice to remove the specific click handler if it captures variables from its creation scope
    // but since we overwrite _clickHandler, it's less critical here.
}


document.addEventListener('dragstart', (event) => {
    const targetLink = event.target.closest('a');
    if (targetLink && targetLink.href && !targetLink.href.startsWith('javascript:')) {
        // Allow native drag to proceed for things like dragging to tab bar or bookmarks
        // event.preventDefault(); // Optional: uncomment if you want to completely override native drag for links
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
    // Hide preview after a short delay to allow click on summarize button if drag ends quickly
    setTimeout(hidePreview, 1000);
}, true);


// Listener for messages FROM the background script (e.g., to get page content)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log("Content Script: Message received", request);
    if (request.action === 'getPageContentForSummarize') {
        // console.log("Content Script: Action getPageContentForSummarize received.");
        try {
            const mainContent = document.body.innerText;
            // console.log("Content Script: Sending page content for summary (length: " + (mainContent ? mainContent.length : 0) + ")");
            sendResponse({ contentForSummary: mainContent });
        } catch (e) {
            console.error("Content Script: Error getting document.body.innerText", e);
            sendResponse({ error: "Error accessing page content: " + e.message });
        }
        return true; // Important for asynchronous sendResponse
    }
    return true; // Keep true for async responses from other handlers if any
});

// Listener for page text selection (to send TO background script)
document.addEventListener('mouseup', () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && !previewWindow?.contains(window.getSelection().anchorNode?.parentNode)) { // Don't trigger if selecting text within our preview
        // console.log("Content Script: Text selected (length: " + selectedText.length + "), sending to background.");
        chrome.runtime.sendMessage({ action: 'TEXT_SELECTED_FROM_PAGE', text: selectedText }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Content Script: Error sending selected text to background:", chrome.runtime.lastError.message);
            }
        });
    }
});

// Ensure preview elements are ready when the script loads
createPreviewWindow();