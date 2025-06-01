// background.js
let geminiApiKey = null;

async function loadApiKey() {
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    if (result.geminiApiKey) {
      geminiApiKey = result.geminiApiKey;
      console.log("Background: Gemini API Key loaded.");
    } else {
      console.warn("Background: Gemini API Key not found in storage.");
    }
  } catch (e) {
    console.error("Background: Error loading API Key:", e);
  }
}

// Load API key when the background script starts
loadApiKey();

// Listen for API Key changes from options page
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.geminiApiKey) {
    geminiApiKey = changes.geminiApiKey.newValue;
    console.log("Background: Gemini API Key updated.");
  }
});

// Handle browser action click (plugin icon)
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Background: Could not send toggleSidebar message to content script:", chrome.runtime.lastError.message);
        // This might happen on pages like chrome://extensions or new tab page where content scripts don't run.
      } else if (response) {
        // console.log("Background: Sidebar toggle response:", response);
      }
    });
  } else {
    console.error("Background: Tab ID not found for action click.");
  }
});

// Listen for messages from content_script.js or sidebar.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log("Background: Received message", request);
  if (request.action === "getAndSummarizePage") {
    // This message comes from sidebar.js, asking background to get content from content_script.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        console.error("Background (getAndSummarizePage): No active tab found or tab ID missing.");
        sendResponse({ error: "无法确定活动标签页。" });
        return;
      }
      const activeTabId = tabs[0].id;

      // Send message to content_script.js to get the page content
      chrome.tabs.sendMessage(activeTabId, { action: "getPageContentForSummarize" }, (pageResponse) => {
        if (chrome.runtime.lastError) {
          console.error("Background (getAndSummarizePage): Error messaging content script:", chrome.runtime.lastError.message);
          sendResponse({ error: "获取页面内容失败 (CS通讯错误): " + chrome.runtime.lastError.message });
          return;
        }

        // pageResponse is from content_script.js. It should be { contentForSummary: "..." }
        if (pageResponse && typeof pageResponse.contentForSummary === 'string') {
          // Successfully got content (or empty string if page has no text)
          sendResponse({ contentForSummary: pageResponse.contentForSummary }); // Forward to sidebar.js
        } else {
          // content_script.js didn't send the expected structure, or contentForSummary was not a string.
          console.warn("Background (getAndSummarizePage): Invalid response from content script:", pageResponse);
          sendResponse({ error: "未能从页面获取内容 (CS数据无效或格式错误)。" });
        }
      });
    });
    return true; // Indicates that the response will be sent asynchronously
  }

  // Handle other actions if needed
  // For example, if API calls were to be proxied through background for security:
  // if (request.action === "callGeminiAPI_viaBackground") {
  //   if (!geminiApiKey) {
  //     sendResponse({ error: "API Key not set in background." });
  //     return true;
  //   }
  //   // ... (make fetch call here) ...
  //   return true; // Async
  // }

  return false; // Default for synchronous messages or if no handler matches
});

console.log("Background script (gemini-sidebar) started.");