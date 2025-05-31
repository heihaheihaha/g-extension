// This is a very basic way to get text.
// You might want to implement a more sophisticated method
// to extract only the main content of the page.
function getPageContent() {
  return document.body.innerText;
}

// Listen for messages from the background script (if needed)
// or directly send content when requested by the popup via the background script.
// For this design, the background script will request the content.