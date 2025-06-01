// g-extension/background.js
let geminiApiKey = null;

async function loadApiKey() {
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    if (result.geminiApiKey) {
      geminiApiKey = result.geminiApiKey;
      console.log("Background: Gemini API Key loaded.");
    } else {
      console.warn("Background: Gemini API Key not found in storage.");
      // Optionally, you could open the options page here if the key is missing
      // chrome.runtime.openOptionsPage();
    }
  } catch (e) {
    console.error("Background: Error loading API Key:", e);
  }
}

// Initialize API key and side panel behavior when the extension starts
(async () => {
  await loadApiKey();
  try {
    // This makes the extension icon click open the side panel.
    // Requires Chrome 114+
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error("Background: Failed to set side panel behavior:", error);
    // Fallback for older versions or if specific click handling is needed:
    // chrome.action.onClicked.addListener(async (tab) => {
    //   if (tab.id) {
    //     await chrome.sidePanel.open({ tabId: tab.id });
    //   }
    // });
  }
})();

// Listen for API Key changes from options page
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.geminiApiKey) {
    geminiApiKey = changes.geminiApiKey.newValue;
    console.log("Background: Gemini API Key updated.");
  }
});

// REMOVE the old chrome.action.onClicked listener that sent 'toggleSidebar'
// chrome.action.onClicked.addListener((tab) => { ... }); // REMOVE THIS

// Listen for messages from content_script.js or sidebar.js (now side panel)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAndSummarizePage") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        console.error("Background (getAndSummarizePage): No active tab found or tab ID missing.");
        sendResponse({ error: "无法确定活动标签页。" });
        return;
      }
      const activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(activeTabId, { action: "getPageContentForSummarize" }, (pageResponse) => {
        if (chrome.runtime.lastError) {
          console.error("Background (getAndSummarizePage): Error messaging content script:", chrome.runtime.lastError.message);
          sendResponse({ error: "获取页面内容失败 (CS通讯错误): " + chrome.runtime.lastError.message });
          return;
        }
        if (pageResponse && typeof pageResponse.contentForSummary === 'string') {
          sendResponse({ contentForSummary: pageResponse.contentForSummary });
        } else {
          console.warn("Background (getAndSummarizePage): Invalid response from content script:", pageResponse);
          sendResponse({ error: "未能从页面获取内容 (CS数据无效或格式错误)。" });
        }
      });
    });
    return true;
  } else if (request.action === "TEXT_SELECTED_FROM_PAGE") {
    // Forward the selected text to the side panel
    // The side panel's sidebar.js will have a listener for this.
    chrome.runtime.sendMessage({ type: "TEXT_SELECTED_FOR_SIDEBAR", text: request.text });
    sendResponse({ status: "Text selected event forwarded to sidebar" });
    return true; // Indicate async response if needed, though not strictly for this forward
  }
  // Handle other actions if needed
  return false;
});

console.log("Background script (gemini-sidebar with sidePanel) started.");