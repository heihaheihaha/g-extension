// g-extension/options.js
document.addEventListener('DOMContentLoaded', async function() {
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
  const languageSelect = document.getElementById('languageSelect');

  let configurations = [];
  let activeConfigurationId = null;
  let currentLang = 'zh';

  async function init() {
    currentLang = await getActiveLanguage(); // From translations.js
    languageSelect.value = currentLang;
    await applyPageLocalization(); // From translations.js
    await loadConfigurations();
    toggleApiEndpointField();
    setupEventListeners();
  }

  function setupEventListeners() {
    apiTypeSelect.addEventListener('change', toggleApiEndpointField);
    clearFormButton.addEventListener('click', clearForm);
    cancelEditButton.addEventListener('click', clearForm);
    saveConfigButton.addEventListener('click', handleSaveConfig);
    languageSelect.addEventListener('change', handleLanguageChange);
  }

  async function handleLanguageChange() {
    const newLang = languageSelect.value;
    await chrome.storage.sync.set({ language: newLang });
    currentLang = newLang;
    await applyPageLocalization();
    // Re-render configurations if their display text might change (e.g. "Active" tag)
    await loadConfigurations(); // This will re-render with new localized strings
  }

  function generateId() {
    return `config_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  function toggleApiEndpointField() {
    if (apiTypeSelect.value === 'openai') {
      apiEndpointGroup.classList.remove('hidden');
    } else {
      apiEndpointGroup.classList.add('hidden');
      apiEndpointInput.value = ''; 
    }
  }

  async function loadConfigurations() {
    const result = await chrome.storage.sync.get(['apiConfigurations', 'activeConfigurationId']);
    configurations = result.apiConfigurations || [];
    activeConfigurationId = result.activeConfigurationId || null;
    await renderConfigurations();
  }

  async function saveConfigurationsToStorage() {
    try {
      await chrome.storage.sync.set({ 
        apiConfigurations: configurations,
        activeConfigurationId: activeConfigurationId 
      });
      statusDiv.textContent = await getL10nString('statusSuccess');
      statusDiv.style.color = 'green';
    } catch (e) {
      statusDiv.textContent = await getL10nString('statusErrorSaving', e.message);
      statusDiv.style.color = 'red';
      console.error("Error saving configurations:", e);
    }
    setTimeout(() => { statusDiv.textContent = ''; }, 3000);
  }

  async function renderConfigurations() {
    configurationsListDiv.innerHTML = '';
    if (configurations.length === 0) {
      configurationsListDiv.innerHTML = `<p>${await getL10nString('noConfigsMessage')}</p>`;
      return;
    }

    for (const config of configurations) {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('config-item');
      if (config.id === activeConfigurationId) {
        itemDiv.classList.add('is-active');
      }

      const detailsDiv = document.createElement('div');
      detailsDiv.classList.add('config-details');
      const activeText = config.id === activeConfigurationId ? ` ${await getL10nString('configActive')}` : '';
      const typeText = await getL10nString('configTypeLabel');
      const modelText = await getL10nString('configModelLabel');

      detailsDiv.innerHTML = `
        <strong>${escapeHtml(config.configName)}</strong> <span class="math-inline">\{activeText\}<br\>
<small>{typeText} ${escapeHtml(config.apiType)} | ${modelText} ${escapeHtml(config.modelName)}</small>
`;
itemDiv.appendChild(detailsDiv);
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('config-actions');

      const setActiveButton = document.createElement('button');
      setActiveButton.textContent = await getL10nString('setActiveButton');
      setActiveButton.classList.add('set-active-btn');
      if (config.id === activeConfigurationId) {
        setActiveButton.disabled = true;
        setActiveButton.style.opacity = 0.5;
      }
      setActiveButton.addEventListener('click', async () => {
        activeConfigurationId = config.id;
        await saveConfigurationsToStorage();
        await renderConfigurations(); 
      });
      actionsDiv.appendChild(setActiveButton);

      const editButton = document.createElement('button');
      editButton.textContent = await getL10nString('editButton');
      editButton.classList.add('edit-btn');
      editButton.addEventListener('click', () => populateFormForEdit(config));
      actionsDiv.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = await getL10nString('deleteButton');
      deleteButton.classList.add('delete-btn');
      deleteButton.addEventListener('click', async () => {
        if (confirm(await getL10nString('confirmDeleteConfig', escapeHtml(config.configName)))) {
          configurations = configurations.filter(c => c.id !== config.id);
          if (activeConfigurationId === config.id) {
            activeConfigurationId = configurations.length > 0 ? configurations[0].id : null;
          }
          await saveConfigurationsToStorage();
          await loadConfigurations(); 
        }
      });
      actionsDiv.appendChild(deleteButton);
      
      itemDiv.appendChild(actionsDiv);
      configurationsListDiv.appendChild(itemDiv);
    }
  }

  async function populateFormForEdit(config) {
    configIdInput.value = config.id;
    configNameInput.value = config.configName;
    apiKeyInput.value = config.apiKey;
    apiTypeSelect.value = config.apiType;
    apiEndpointInput.value = config.apiEndpoint || '';
    modelNameInput.value = config.modelName;
    toggleApiEndpointField();
    saveConfigButton.textContent = await getL10nString('saveConfigButton'); // Or an "Update" string
    cancelEditButton.classList.remove('hidden');
    document.getElementById('configFormContainer').scrollIntoView({ behavior: 'smooth' });
  }

  async function clearForm() {
    configIdInput.value = '';
    configNameInput.value = '';
    apiKeyInput.value = '';
    apiTypeSelect.value = 'gemini'; 
    apiEndpointInput.value = '';
    modelNameInput.value = '';
    toggleApiEndpointField();
    saveConfigButton.textContent = await getL10nString('saveConfigButton');
    cancelEditButton.classList.add('hidden');
    configNameInput.focus();
  }

  async function handleSaveConfig() {
    const id = configIdInput.value;
    const configName = configNameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const apiType = apiTypeSelect.value;
    const apiEndpoint = apiEndpointInput.value.trim();
    const modelName = modelNameInput.value.trim();

    if (!configName || !apiKey || !modelName) {
      statusDiv.textContent = await getL10nString('statusEmptyFields');
      statusDiv.style.color = 'red';
      return;
    }
    if (apiType === 'openai' && !apiEndpoint) {
      statusDiv.textContent = await getL10nString('statusOpenAIEndpointMissing');
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
      configurations[existingIndex] = newConfig; 
    } else {
      configurations.push(newConfig); 
    }
    
    if (configurations.length === 1 || newConfig.id === activeConfigurationId || !activeConfigurationId) {
        activeConfigurationId = newConfig.id;
    }

    await saveConfigurationsToStorage();
    await clearForm();
    await loadConfigurations(); 
  }

  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  init();
});