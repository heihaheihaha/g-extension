// g-extension/link_content_extractor.js
(function() {
  if (typeof Readability === 'function') {
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();

    if (article && article.textContent) {
      chrome.runtime.sendMessage({
        action: "extractedLinkContent",
        content: article.textContent,
        title: article.title,
        url: document.location.href
      });
    } else {
      // Fallback to body.innerText if Readability fails but page is loaded
      const fallbackContent = document.body && document.body.innerText ? document.body.innerText.trim() : "";
      if (fallbackContent) {
         chrome.runtime.sendMessage({
            action: "extractedLinkContent",
            content: fallbackContent,
            title: document.title || "N/A",
            url: document.location.href,
            warning: "Readability.js failed to extract main content, used basic text extraction. Quality may vary."
          });
      } else {
        chrome.runtime.sendMessage({
          action: "extractedLinkContent",
          error: "Could not extract article content using Readability or fallback.",
          url: document.location.href
        });
      }
    }
  } else {
    // Fallback if Readability.js wasn't loaded for some reason
    console.warn("link_content_extractor.js: Readability.js not found. Using basic document.body.innerText.");
    const content = document.body && document.body.innerText ? document.body.innerText.trim() : "";
    if (content) {
        chrome.runtime.sendMessage({
            action: "extractedLinkContent",
            content: content,
            title: document.title || "N/A",
            url: document.location.href,
            warning: "Readability.js was not available, used basic text extraction. Quality may vary."
        });
    } else {
         chrome.runtime.sendMessage({
            action: "extractedLinkContent",
            error: "Could not extract content (Readability unavailable and body is empty).",
            url: document.location.href
        });
    }
  }
})();