// g-extension/content_script.js
console.log("Content Script for sidePanel: Loaded and running.");

let longPressTimer = null;
let isLongPress = false;
let longPressTargetElement = null;
const LONG_PRESS_DURATION = 750; // milliseconds

function handleMouseDown(event) {
  const target = event.target.closest('a');
  if (target && target.href && !target.href.startsWith('javascript:')) {
    longPressTargetElement = target;
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      console.log("Content Script: Long press detected on link:", longPressTargetElement.href);
      // Optional: Add visual feedback for long press here
    }, LONG_PRESS_DURATION);
  }
}

function handleMouseUp(event) {
  clearTimeout(longPressTimer);
  if (isLongPress && longPressTargetElement) {
    // Ensure mouseup is on the same element or a child, or just proceed if longPressTargetElement is set
    const target = event.target.closest('a');
    if (target === longPressTargetElement || longPressTargetElement.contains(target)) {
      console.log("Content Script: Long press confirmed for:", longPressTargetElement.href);
      chrome.runtime.sendMessage({
        action: 'summarizeLinkTarget',
        url: longPressTargetElement.href
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Content Script: Error sending summarizeLinkTarget message:", chrome.runtime.lastError.message);
        } else if (response) {
          // console.log("Content Script: Background response for summarizeLinkTarget:", response.status);
        }
      });
      event.preventDefault(); // Prevent default action (e.g., navigation) after a long press
    }
  }
  resetLongPressState();
}

function handleMouseLeave(event) {
    // If the mouse leaves the original target element during a potential long press
    if (longPressTargetElement && event.target === longPressTargetElement) {
        clearTimeout(longPressTimer);
        // Do not reset isLongPress here, mouseup should handle it
    }
}

function handleContextMenu(event) {
  if (isLongPress && longPressTargetElement && (event.target.closest('a') === longPressTargetElement || longPressTargetElement.contains(event.target.closest('a')))) {
    console.log("Content Script: Preventing context menu due to long press.");
    event.preventDefault();
  }
  // Reset state after context menu, as mouseup might not fire as expected
  resetLongPressState();
}

function resetLongPressState() {
  clearTimeout(longPressTimer);
  isLongPress = false;
  longPressTargetElement = null;
}

document.addEventListener('mousedown', handleMouseDown, true);
document.addEventListener('mouseup', handleMouseUp, true);
// document.addEventListener('mouseleave', handleMouseLeave, true); // Can be too aggressive
document.addEventListener('contextmenu', handleContextMenu, true);


// Listener for messages FROM the background script (e.g., to get page content)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content Script: Message received", request);
  if (request.action === 'getPageContentForSummarize') {
    console.log("Content Script: Action getPageContentForSummarize received.");
    try {
      const mainContent = document.body.innerText;
      console.log("Content Script: Sending page content for summary (length: " + (mainContent ? mainContent.length : 0) + ")");
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
document.addEventListener('mouseup', () => { // This mouseup is for text selection, separate from long-press
  if (isLongPress) return; // Don't trigger text selection if it was a long press action

  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    console.log("Content Script: Text selected (length: " + selectedText.length + "), sending to background.");
    chrome.runtime.sendMessage({ action: 'TEXT_SELECTED_FROM_PAGE', text: selectedText }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Content Script: Error sending selected text to background:", chrome.runtime.lastError.message);
      } else {
        // console.log("Content Script: Background response for selected text:", response ? response.status : "no response");
      }
    });
  }
});