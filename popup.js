// g-extension/popup.js
document.addEventListener('DOMContentLoaded', async function() {
  await applyPageLocalization(); // from translations.js

  const summarizeButton = document.getElementById('summarizeButton');
  const summaryOutput = document.getElementById('summaryOutput');

  summarizeButton.addEventListener('click', async function() {
    summaryOutput.textContent = await getL10nString('summarizingStatusPopup'); 
    chrome.runtime.sendMessage({ action: "summarize" }, async function(response) {
      if (chrome.runtime.lastError) {
        summaryOutput.textContent = await getL10nString('errorPopup', chrome.runtime.lastError.message);
        console.error(chrome.runtime.lastError.message);
        return;
      }
      if (response && response.summary) {
        summaryOutput.textContent = response.summary;
      } else if (response && response.error) {
        summaryOutput.textContent = await getL10nString('errorPopup', response.error);
      } else {
        summaryOutput.textContent = await getL10nString('failedToGetSummaryPopup');
      }
    });
  });

  // Listener for language changes to re-apply localization
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace === 'sync' && changes.language) {
          await applyPageLocalization();
          // If the button text or other elements were dynamically set and need re-translation
          const currentSummarizeButtonText = await getL10nString('summarizeButtonLabel');
          if (summarizeButton.textContent !== currentSummarizeButtonText) {
              summarizeButton.textContent = currentSummarizeButtonText;
          }
      }
  });
});