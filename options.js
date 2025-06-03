// options.js
document.addEventListener('DOMContentLoaded', function() {
  const configIdInput = document.getElementById('configId');
  const configNameInput = document.getElementById('configName');
  const apiKeyInput = document.getElementById('apiKey');
  const apiTypeSelect = document.getElementById('apiType');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const modelNameInput = document.getElementById('modelName');
  
  const saveConfigButton = document.getElementById('saveConfigButton');
  const clearFormButton = document.getElementById('clearFormButton');
  const cancelEditButton = document.getElementById('cancelEditButton');
  
  const configurationsListDiv = document.getElementById('configurationsList');
  const statusDiv = document.getElementById('status');
  
  const apiEndpointGroup = document.getElementById('apiEndpointGroup');

  let configurations = [];
  let activeConfigurationId = null;

  function generateId() {
    return `config_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  function toggleApiEndpointField() {
    if (apiTypeSelect.value === 'openai') {
      apiEndpointGroup.classList.remove('hidden');
    } else {
      apiEndpointGroup.classList.add('hidden');
      apiEndpointInput.value = ''; // Clear if not applicable
    }
  }

  apiTypeSelect.addEventListener('change', toggleApiEndpointField);

  async function loadConfigurations() {
    const result = await chrome.storage.sync.get(['apiConfigurations', 'activeConfigurationId']);
    configurations = result.apiConfigurations || [];
    activeConfigurationId = result.activeConfigurationId || null;
    renderConfigurations();
  }

  async function saveConfigurations() {
    try {
      await chrome.storage.sync.set({ 
        apiConfigurations: configurations,
        activeConfigurationId: activeConfigurationId 
      });
      statusDiv.textContent = '操作成功！';
      statusDiv.style.color = 'green';
    } catch (e) {
      statusDiv.textContent = '错误: 保存配置失败。 ' + e.message;
      statusDiv.style.color = 'red';
      console.error("Error saving configurations:", e);
    }
    setTimeout(() => { statusDiv.textContent = ''; }, 3000);
  }

  function renderConfigurations() {
    configurationsListDiv.innerHTML = '';
    if (configurations.length === 0) {
      configurationsListDiv.innerHTML = '<p>暂无配置。请使用上面的表单添加一个新配置。</p>';
      return;
    }

    configurations.forEach(config => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('config-item');
      if (config.id === activeConfigurationId) {
        itemDiv.classList.add('is-active');
      }

      const detailsDiv = document.createElement('div');
      detailsDiv.classList.add('config-details');
      detailsDiv.innerHTML = `
        <strong>${escapeHtml(config.configName)}</strong> ${config.id === activeConfigurationId ? '(当前活动)' : ''}<br>
        <small>类型: ${escapeHtml(config.apiType)} | 模型: ${escapeHtml(config.modelName)}</small>
      `;
      itemDiv.appendChild(detailsDiv);

      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('config-actions');

      const setActiveButton = document.createElement('button');
      setActiveButton.textContent = '设为活动';
      setActiveButton.classList.add('set-active-btn');
      if (config.id === activeConfigurationId) {
        setActiveButton.disabled = true;
        setActiveButton.style.opacity = 0.5;
      }
      setActiveButton.addEventListener('click', async () => {
        activeConfigurationId = config.id;
        await saveConfigurations();
        renderConfigurations(); // Re-render to update active status
      });
      actionsDiv.appendChild(setActiveButton);

      const editButton = document.createElement('button');
      editButton.textContent = '编辑';
      editButton.classList.add('edit-btn');
      editButton.addEventListener('click', () => populateFormForEdit(config));
      actionsDiv.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = '删除';
      deleteButton.classList.add('delete-btn');
      deleteButton.addEventListener('click', async () => {
        if (confirm(`确定要删除配置 "${escapeHtml(config.configName)}" 吗？`)) {
          configurations = configurations.filter(c => c.id !== config.id);
          if (activeConfigurationId === config.id) {
            activeConfigurationId = configurations.length > 0 ? configurations[0].id : null;
          }
          await saveConfigurations();
          loadConfigurations(); // Reload and re-render
        }
      });
      actionsDiv.appendChild(deleteButton);
      
      itemDiv.appendChild(actionsDiv);
      configurationsListDiv.appendChild(itemDiv);
    });
  }

  function populateFormForEdit(config) {
    configIdInput.value = config.id;
    configNameInput.value = config.configName;
    apiKeyInput.value = config.apiKey;
    apiTypeSelect.value = config.apiType;
    apiEndpointInput.value = config.apiEndpoint || '';
    modelNameInput.value = config.modelName;
    toggleApiEndpointField();
    saveConfigButton.textContent = '更新配置';
    cancelEditButton.classList.remove('hidden');
    document.getElementById('configFormContainer').scrollIntoView({ behavior: 'smooth' });
  }

  function clearForm() {
    configIdInput.value = '';
    configNameInput.value = '';
    apiKeyInput.value = '';
    apiTypeSelect.value = 'gemini'; // Default
    apiEndpointInput.value = '';
    modelNameInput.value = '';
    toggleApiEndpointField();
    saveConfigButton.textContent = '保存配置';
    cancelEditButton.classList.add('hidden');
    configNameInput.focus();
  }

  clearFormButton.addEventListener('click', clearForm);
  cancelEditButton.addEventListener('click', clearForm);

  saveConfigButton.addEventListener('click', async () => {
    const id = configIdInput.value;
    const configName = configNameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const apiType = apiTypeSelect.value;
    const apiEndpoint = apiEndpointInput.value.trim();
    const modelName = modelNameInput.value.trim();

    if (!configName || !apiKey || !modelName) {
      statusDiv.textContent = '配置名称、API密钥和模型名称不能为空。';
      statusDiv.style.color = 'red';
      return;
    }
    if (apiType === 'openai' && !apiEndpoint) {
      statusDiv.textContent = 'OpenAI 兼容 API 需要填写 Endpoint URL。';
      statusDiv.style.color = 'red';
      return;
    }

    const newConfig = {
      id: id || generateId(),
      configName,
      apiKey,
      apiType,
      apiEndpoint: apiType === 'openai' ? apiEndpoint : '',
      modelName
    };

    const existingIndex = configurations.findIndex(c => c.id === newConfig.id);
    if (existingIndex > -1) {
      configurations[existingIndex] = newConfig; // Update existing
    } else {
      configurations.push(newConfig); // Add new
    }
    
    // If this is the first configuration, or if we're updating the active one,
    // or if no configuration is active, make this one active.
    if (configurations.length === 1 || newConfig.id === activeConfigurationId || !activeConfigurationId) {
        activeConfigurationId = newConfig.id;
    }

    await saveConfigurations();
    clearForm();
    loadConfigurations(); // Reload and re-render
  });

  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // Initial load
  loadConfigurations();
  toggleApiEndpointField(); // Set initial state of endpoint field
});