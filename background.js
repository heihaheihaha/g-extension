// IMPORTANT: Store your API key securely.
// Ideally, prompt the user for it or use chrome.storage.sync.
// For this example, it's hardcoded, which is NOT recommended for production.
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // Replace with your actual key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "summarize") {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({ error: "No active tab found." });
        return true; // Indicates asynchronous response
      }
      const activeTab = tabs[0];

      // Inject the content script to get page content
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        function: getPageTextContent // This function will run in the content script's context
      }, async (injectionResults) => {
        if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
          sendResponse({ error: "Failed to get page content: " + (chrome.runtime.lastError ? chrome.runtime.lastError.message : "No result") });
          return true;
        }

        const pageContent = injectionResults[0].result;
        if (!pageContent) {
          sendResponse({ error: "No content found on the page." });
          return true;
        }

        // Make the API call to Gemini
        try {
          const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              "contents": [{
                "parts": [{
                  "text": `Please summarize the following text:\n\n${pageContent}`
                }]
              }]
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            sendResponse({ error: `API Error: ${errorData.error?.message || response.statusText}` });
            return true;
          }

          const data = await response.json();
          // Assuming the Gemini API response structure for summarization.
          // You'll need to adjust this based on the actual API response.
          const summary = data.candidates[0]?.content?.parts[0]?.text || "No summary available.";
          sendResponse({ summary: summary });

        } catch (error) {
          console.error('Error calling Gemini API:', error);
          sendResponse({ error: 'Failed to summarize: ' + error.message });
        }
      });
    });
    return true; // Indicates that the response will be sent asynchronously
  }
});

// This function will be injected into the active tab to get its text content
function getPageTextContent() {
  // You can use more sophisticated methods here to get cleaner text,
  // e.g., using readability libraries or targeting specific HTML elements.
  return document.body.innerText;
}