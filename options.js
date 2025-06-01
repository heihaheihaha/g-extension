// options.js
document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // 加载已保存的API Key
  chrome.storage.sync.get(['geminiApiKey'], function(result) {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });

  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({ 'geminiApiKey': apiKey }, function() {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = '错误: 保存API密钥失败。 ' + chrome.runtime.lastError.message;
          statusDiv.style.color = 'red';
          console.error("Error saving API key:", chrome.runtime.lastError.message);
        } else {
          statusDiv.textContent = 'API 密钥已成功保存！';
          statusDiv.style.color = 'green';
          setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }
      });
    } else {
      statusDiv.textContent = '请输入有效的API密钥。';
      statusDiv.style.color = 'red';
    }
  });
});