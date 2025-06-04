// g-extension/prompts.js
document.addEventListener('DOMContentLoaded', async () => {
  const promptListDiv = document.getElementById('promptList');
  const promptIdInput = document.getElementById('promptId');
  const promptNameInput = document.getElementById('promptName');
  const promptContentInput = document.getElementById('promptContent');
  const savePromptButton = document.getElementById('savePromptButton');
  const clearFormButton = document.getElementById('clearFormButton');
  const backToSidebarButton = document.getElementById('backToSidebarButton');

  let prompts = [];
  let currentLang = 'zh';

  async function initializePrompts() {
    currentLang = await getActiveLanguage(); // from translations.js
    await applyPageLocalization(); // from translations.js
    await loadPrompts();
    setupEventListeners();
  }

  function setupEventListeners() {
    savePromptButton.addEventListener('click', handleSavePrompt);
    clearFormButton.addEventListener('click', clearForm);
    backToSidebarButton.addEventListener('click', () => {
      chrome.tabs.getCurrent(tab => {
          if (tab && tab.id) {
              chrome.tabs.remove(tab.id);
          } else {
              window.close(); 
          }
      });
    });
  }

  // Define presets with multi-language support
  async function getPresetDefinitions() {
    // Fetch localized names/content for presets
    // This ensures that if a preset is added because it's missing,
    // it gets added with the current UI language.
    return [
      {
        id: 'preset-translate',
        names: { en: await getL10nString('presetTranslateName'), zh: await getL10nString('presetTranslateName') }, // Use same key for both
        contents: { en: await getL10nString('presetTranslateContent'), zh: await getL10nString('presetTranslateContent') },
        isPreset: true
      },
      {
        id: 'preset-summarize',
        names: { en: await getL10nString('presetSummarizeName'), zh: await getL10nString('presetSummarizeName') },
        contents: { en: await getL10nString('presetSummarizeContent'), zh: await getL10nString('presetSummarizeContent') },
        isPreset: true
      }
    ];
  }


  async function loadPrompts() {
    const result = await chrome.storage.local.get(['promptTemplates']);
    prompts = result.promptTemplates ? [...result.promptTemplates] : [];
    currentLang = await getActiveLanguage(); // Ensure currentLang is fresh

    let madeChangesToStoredStructure = false;
    const presetPromptsDefinition = await getPresetDefinitions();

    presetPromptsDefinition.forEach(definedPreset => {
        const existingPromptIndex = prompts.findIndex(p => p.id === definedPreset.id);

        if (existingPromptIndex === -1) {
            prompts.unshift({ 
                id: definedPreset.id,
                // When adding a NEW preset, use the name/content for the CURRENT language
                name: definedPreset.names[currentLang] || definedPreset.names.en, 
                content: definedPreset.contents[currentLang] || definedPreset.contents.en,
                isPreset: true 
            });
            madeChangesToStoredStructure = true;
        } else {
            // Preset exists, ensure its 'isPreset' flag is true.
            // User's edited name and content are preserved.
            if (prompts[existingPromptIndex].isPreset !== true) {
                prompts[existingPromptIndex].isPreset = true;
                madeChangesToStoredStructure = true;
            }
            // Optional: If you want to allow resetting preset name/content to default
            // you could add logic here. For now, user edits are kept.
        }
    });

    prompts.forEach(p => {
        const isActuallyPreset = presetPromptsDefinition.some(dp => dp.id === p.id);
        if (!isActuallyPreset) { 
            if (p.isPreset !== false) { 
                p.isPreset = false;
                madeChangesToStoredStructure = true;
            }
        }
    });

    if (!result.promptTemplates || madeChangesToStoredStructure) {
        await savePromptsToStorage();
    }
    await renderPrompts();
  }

  async function savePromptsToStorage() {
    prompts.sort((a, b) => {
        if (a.isPreset && !b.isPreset) return -1;
        if (!a.isPreset && b.isPreset) return 1;
        return 0;
    });
    await chrome.storage.local.set({ promptTemplates: prompts });
  }

  async function renderPrompts() {
    promptListDiv.innerHTML = '';
    if (prompts.length === 0) {
      promptListDiv.innerHTML = `<p>${await getL10nString('noPromptsYet')}</p>`;
      return;
    }

    const presetTagText = await getL10nString('presetTagText');
    const editButtonText = await getL10nString('editButton');
    const deleteButtonText = await getL10nString('deleteButton');

    prompts.forEach(prompt => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('prompt-item');
      itemDiv.dataset.id = prompt.id;

      const headerDiv = document.createElement('div');
      headerDiv.classList.add('prompt-item-header');

      const nameSpan = document.createElement('span');
      nameSpan.classList.add('prompt-item-name');
      nameSpan.textContent = prompt.name; 
      if (prompt.isPreset) {
        const presetTag = document.createElement('span');
        presetTag.classList.add('preset-tag');
        presetTag.textContent = presetTagText;
        nameSpan.appendChild(presetTag);
      }
      headerDiv.appendChild(nameSpan);

      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('prompt-item-actions');

      const editButtonElement = document.createElement('button');
      editButtonElement.classList.add('edit-button');
      editButtonElement.textContent = editButtonText;
      editButtonElement.addEventListener('click', () => loadPromptForEditing(prompt.id));
      actionsDiv.appendChild(editButtonElement);

      if (!prompt.isPreset) {
        const deleteButtonElement = document.createElement('button');
        deleteButtonElement.classList.add('delete-button');
        deleteButtonElement.textContent = deleteButtonText;
        deleteButtonElement.addEventListener('click', () => deletePrompt(prompt.id));
        actionsDiv.appendChild(deleteButtonElement);
      }
      headerDiv.appendChild(actionsDiv);
      itemDiv.appendChild(headerDiv);

      const contentPre = document.createElement('pre');
      contentPre.classList.add('prompt-item-content');
      contentPre.textContent = prompt.content;
      itemDiv.appendChild(contentPre);

      promptListDiv.appendChild(itemDiv);
    });
  }

  function clearForm() {
    promptIdInput.value = '';
    promptNameInput.value = '';
    promptContentInput.value = '';
    promptNameInput.focus();
  }

  function loadPromptForEditing(id) {
    const prompt = prompts.find(p => p.id === id);
    if (prompt) {
      promptIdInput.value = prompt.id;
      promptNameInput.value = prompt.name;
      promptContentInput.value = prompt.content;
      // If it's a preset, the name and content fields become editable.
      // User changes are saved. The 'isPreset' flag is not changed by user.
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      promptNameInput.focus();
    }
  }

  async function deletePrompt(id) {
    if (confirm(await getL10nString('confirmDeletePrompt'))) {
      prompts = prompts.filter(p => p.id !== id);
      await savePromptsToStorage();
      await renderPrompts();
      clearForm(); 
    }
  }

  async function handleSavePrompt() {
    const id = promptIdInput.value;
    const name = promptNameInput.value.trim();
    const content = promptContentInput.value.trim();

    if (!name || !content) {
      alert(await getL10nString('alertPromptNameContentMissing'));
      return;
    }

    if (id) { 
      const promptIndex = prompts.findIndex(p => p.id === id);
      if (promptIndex !== -1) {
        prompts[promptIndex].name = name;
        prompts[promptIndex].content = content;
        // isPreset flag is preserved
      }
    } else { 
      prompts.push({
        id: `custom-${Date.now()}`,
        name,
        content,
        isPreset: false 
      });
    }
    await savePromptsToStorage();
    await renderPrompts();
    clearForm();
  }

  // Listener for language changes from other parts of the extension (e.g., options page)
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'sync' && changes.language) {
        currentLang = changes.language.newValue || 'zh';
        await applyPageLocalization();
        await loadPrompts(); // Reload prompts, definitions might change language
    }
  });

  initializePrompts();
});