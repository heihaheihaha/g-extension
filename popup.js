document.addEventListener('DOMContentLoaded', function() {
  const summarizeButton = document.getElementById('summarizeButton');
  const summaryOutput = document.getElementById('summaryOutput');

  summarizeButton.addEventListener('click', function() {
    summaryOutput.textContent = 'Summarizing...'; // Provide feedback
    // Send a message to the background script to start the summarization
    chrome.runtime.sendMessage({ action: "summarize" }, function(response) {
      if (chrome.runtime.lastError) {
        summaryOutput.textContent = 'Error: ' + chrome.runtime.lastError.message;
        console.error(chrome.runtime.lastError.message);
        return;
      }
      if (response && response.summary) {
        summaryOutput.textContent = response.summary;
      } else if (response && response.error) {
        summaryOutput.textContent = 'Error: ' + response.error;
      } else {
        summaryOutput.textContent = 'Failed to get summary.';
      }
    });
  });
});