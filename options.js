// options.js
document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const apiTypeSelect = document.getElementById('apiType');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const modelNameInput = document.getElementById('modelName');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');
  const apiEndpointGroup = document.getElementById('apiEndpointGroup');
  const modelNameGroup = document.getElementById('modelNameGroup');

  // 根据API类型显示/隐藏特定字段
  function toggleApiSpecificFields() {
    const selectedType = apiTypeSelect.value;
    if (selectedType === 'openai') {
      apiEndpointGroup.style.display = 'block';
      modelNameGroup.style.display = 'block'; // OpenAI usually requires a model name
    } else if (selectedType === 'gemini') {
      apiEndpointGroup.style.display = 'none'; // Gemini endpoint is fixed for this key type
      modelNameGroup.style.display = 'block'; // Gemini also uses model names
    } else {
      apiEndpointGroup.style.display = 'none';
      modelNameGroup.style.display = 'none';
    }
  }

  apiTypeSelect.addEventListener('change', toggleApiSpecificFields);

  // 加载已保存的设置
  chrome.storage.sync.get(['apiKey', 'apiType', 'apiEndpoint', 'modelName'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.apiType) {
      apiTypeSelect.value = result.apiType;
    }
    if (result.apiEndpoint) {
      apiEndpointInput.value = result.apiEndpoint;
    }
    if (result.modelName) {
      modelNameInput.value = result.modelName;
    }
    toggleApiSpecificFields(); // 初始化时根据存储的值调整显示
  });

  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    const apiType = apiTypeSelect.value;
    const apiEndpoint = apiEndpointInput.value.trim();
    const modelName = modelNameInput.value.trim();

    let settingsToSave = {};
    let isValid = true;

    if (apiKey) {
      settingsToSave.apiKey = apiKey;
    } else {
      statusDiv.textContent = '请输入有效的API密钥。';
      statusDiv.style.color = 'red';
      isValid = false;
    }

    settingsToSave.apiType = apiType;

    if (apiType === 'openai') {
      if (apiEndpoint && URL.canParse(apiEndpoint)) { // Basic URL validation
        settingsToSave.apiEndpoint = apiEndpoint;
      } else {
        statusDiv.textContent = '请输入有效的 OpenAI API Endpoint URL。';
        statusDiv.style.color = 'red';
        isValid = false;
      }
      if (modelName) {
        settingsToSave.modelName = modelName;
      } else {
        // Model name might be optional for some OpenAI compatible APIs if they have a default
        // Or you can enforce it:
        // statusDiv.textContent = '请输入 OpenAI 模型名称。';
        // statusDiv.style.color = 'red';
        // isValid = false;
      }
    } else if (apiType === 'gemini') {
      if (modelName) {
        settingsToSave.modelName = modelName;
      } else {
        statusDiv.textContent = '请输入 Gemini 模型名称。';
        statusDiv.style.color = 'red';
        isValid = false;
      }
      // apiEndpoint is not user-configurable for Gemini in this basic setup
      settingsToSave.apiEndpoint = ''; // Clear it if not Gemini
    }

    if (!modelName && (apiType === 'gemini' || apiType === 'openai')) { // General check for model name
        statusDiv.textContent = '请输入模型名称。';
        statusDiv.style.color = 'red';
        isValid = false;
    }


    if (isValid) {
      chrome.storage.sync.set(settingsToSave, function() {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = '错误: 保存设置失败。 ' + chrome.runtime.lastError.message;
          statusDiv.style.color = 'red';
          console.error("Error saving settings:", chrome.runtime.lastError.message);
        } else {
          statusDiv.textContent = '设置已成功保存！';
          statusDiv.style.color = 'green';
          setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }
      });
    }
  });
});