// g-extension/background.js

// This is a simplified way to provide translations to content script.
// Ideally, translations.js would be a shared module.
const csTranslations = {
  en: {
    linkPreviewTitle: "Link Preview",
    closePreviewButtonTitle: "Close Preview",
    urlLabel: "URL:",
    textLabel: "Text:",
    summarizeButtonText: "Summarize Link"
  },
  zh: {
    linkPreviewTitle: "链接预览",
    closePreviewButtonTitle: "关闭预览",
    urlLabel: "网址:",
    textLabel: "文本:",
    summarizeButtonText: "总结链接"
  }
};

async function getCsLocalizedStrings() {
  try {
    const result = await chrome.storage.sync.get('language');
    const lang = result.language || 'zh';
    return csTranslations[lang] || csTranslations.en;
  } catch (e) {
    return csTranslations.zh; // Fallback
  }
}


chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyzeImageWithGemini",
    title: chrome.i18n.getMessage("analyzeImageWithGeminiCM"),
    contexts: ["image"]
  });
  console.log("Background: Context menu for image analysis created.");
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyzeImageWithGemini" && info.srcUrl) {
    chrome.runtime.sendMessage({
      type: "IMAGE_SELECTED_FOR_SIDEBAR",
      imageUrl: info.srcUrl
    }, response => {
      if (chrome.runtime.lastError) {
        console.log("Background: Error sending image to sidebar.", chrome.runtime.lastError.message);
      }
    });
  }
});

(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error("Background: Failed to set side panel behavior:", error);
  }
})();

// Listener for when the language changes in options, to inform content scripts
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.language) {
    const newLang = changes.language.newValue || 'zh';
    const newCsTranslations = csTranslations[newLang] || csTranslations.en;

    // Inform active content scripts about the language change
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "languageChanged",
                translations: newCsTranslations
            }, response => {
                if (chrome.runtime.lastError) { /* console.warn("Could not inform content script of lang change", chrome.runtime.lastError.message); */ }
            });
        }
    });
  }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCsTranslations") {
    getCsLocalizedStrings().then(translations => {
      sendResponse({ translations });
    });
    return true; // Indicates async response
  }
  // Keep other message handlers from your original background.js
  if (request.action === "getAndSummarizePage") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        // For background script, it's better to send English or keys, and let UI localize
        sendResponse({ error: "Could not determine active tab." }); // Keep it simple or use a key
        return;
      }
      const activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(activeTabId, { action: "getPageContentForSummarize" }, (pageResponse) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: "Failed to get page content (CS communication error): " + chrome.runtime.lastError.message });
          return;
        }
        if (pageResponse && typeof pageResponse.contentForSummary === 'string') {
          sendResponse({ contentForSummary: pageResponse.contentForSummary });
        } else {
          sendResponse({ error: "Failed to get content from page (CS data invalid or malformed)." });
        }
      });
    });
    return true;
  } else if (request.action === "TEXT_SELECTED_FROM_PAGE") {
    chrome.runtime.sendMessage({ type: "TEXT_SELECTED_FOR_SIDEBAR", text: request.text });
    sendResponse({ status: "Text selected event forwarded" }); 
    return true;
  } else if (request.action === "summarizeLinkTarget") {
    const linkUrl = request.url;
    const linkText = request.linkText || linkUrl; 
    sendResponse({ status: "Processing link summarization..." }); // Keep simple or key

    chrome.runtime.sendMessage({ type: "LINK_SUMMARIZATION_STARTED", url: linkUrl, title: linkText });

    chrome.tabs.create({ url: linkUrl, active: false }, (newTab) => {
      if (chrome.runtime.lastError || !newTab || !newTab.id) {
        console.error("Background: Error creating new tab:", chrome.runtime.lastError?.message);
        const errorMessage = chrome.runtime.lastError?.message || "Unknown error";
        chrome.runtime.sendMessage({ type: "SHOW_LINK_SUMMARY_ERROR", message: `Cannot open link: ${errorMessage}`, url: linkUrl, title: linkText });
        return;
      }
      const tempTabId = newTab.id;

      function tabUpdateListener(tabId, changeInfo, tab) {
        if (tabId === tempTabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          chrome.scripting.executeScript({
            target: { tabId: tempTabId },
            files: ["libs/Readability.js", "link_content_extractor.js"]
          }, (injectionResults) => {
            if (chrome.runtime.lastError) {
              console.error("Background: Error injecting scripts:", chrome.runtime.lastError.message);
              chrome.runtime.sendMessage({ type: "SHOW_LINK_SUMMARY_ERROR", message: "Failed to extract content (injection failure): " + chrome.runtime.lastError.message, url: linkUrl, title: linkText });
              chrome.tabs.remove(tempTabId).catch(e => console.warn("BG: Failed to remove temp tab post-injection-error", e));
            }
          });
        }
      }
      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      setTimeout(() => {
        chrome.tabs.get(tempTabId, (tabDetails) => {
          if (tabDetails && tabDetails.status && !tabDetails.status.includes('complete')) { 
            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
            console.warn(`Background: Timeout waiting for tab ${tempTabId} to load complete for ${linkUrl}.`);
            chrome.runtime.sendMessage({ type: "SHOW_LINK_SUMMARY_ERROR", message: "Page load timeout, cannot extract content.", url: linkUrl, title: linkText });
            chrome.tabs.remove(tempTabId).catch(e => console.warn("BG: Failed to remove temp tab post-timeout", e));
          } else if (!tabDetails) { 
            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
            console.warn(`Background: Tab ${tempTabId} for ${linkUrl} was closed or crashed before loading.`);
          }
        });
      }, 20000); 
    });
    return true;
  } else if (request.action === "extractedLinkContent") {
    const { content, title: extractedTitle, url: originalUrlFromExtractor, error, warning } = request;
    const tempTabId = sender.tab?.id;

    if (tempTabId) {
      chrome.tabs.remove(tempTabId).catch(e => console.warn("BG: Failed to remove temp tab", tempTabId, e));
    }

    if (error) {
      chrome.runtime.sendMessage({ type: "SHOW_LINK_SUMMARY_ERROR", message: error, url: originalUrlFromExtractor, title: extractedTitle || originalUrlFromExtractor });
    } else {
      chrome.runtime.sendMessage({
        type: "SUMMARIZE_EXTERNAL_TEXT_FOR_SIDEBAR",
        text: content,
        linkUrl: originalUrlFromExtractor,
        linkTitle: extractedTitle, 
        warning: warning
      });
    }
    sendResponse({status: "Link content processed."});
    return true;
  }

  return false; 
});

console.log("Background script (gemini-sidebar with sidePanel) started.");