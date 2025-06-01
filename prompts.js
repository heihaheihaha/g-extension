// g-extension/prompts.js
document.addEventListener('DOMContentLoaded', () => {
  const promptListDiv = document.getElementById('promptList');
  const promptIdInput = document.getElementById('promptId');
  const promptNameInput = document.getElementById('promptName');
  const promptContentInput = document.getElementById('promptContent');
  const savePromptButton = document.getElementById('savePromptButton');
  const clearFormButton = document.getElementById('clearFormButton');
  const backToSidebarButton = document.getElementById('backToSidebarButton');

  let prompts = [];

  // Renamed to avoid conflict in scope, and defined as 'const'
  const presetPromptsDefinition = [
    {
      id: 'preset-translate',
      name: '翻译 (Translate)',
      content: '请将以下文本翻译成[在此处填写目标语言，例如：英文]：\n\n{{text}}',
      isPreset: true // This property is intrinsic to definition
    },
    {
      id: 'preset-summarize',
      name: '总结 (Summarize)',
      content: '请总结以下文本的主要内容：\n\n{{text}}',
      isPreset: true // This property is intrinsic to definition
    }
  ];

  async function loadPrompts() {
    const result = await chrome.storage.local.get(['promptTemplates']);
    // Start with prompts from storage, or an empty array if none.
    prompts = result.promptTemplates ? [...result.promptTemplates] : [];

    let madeChangesToStoredStructure = false;

    // Ensure preset definitions are present and correctly flagged.
    // User's edits to name/content of presets already in 'prompts' will be preserved.
    presetPromptsDefinition.forEach(definedPreset => {
        const existingPromptIndex = prompts.findIndex(p => p.id === definedPreset.id);

        if (existingPromptIndex === -1) {
            // Preset is missing, add it from definition.
            // Add to the beginning of the array for consistent order of presets.
            prompts.unshift({ ...definedPreset });
            madeChangesToStoredStructure = true;
        } else {
            // Preset exists, ensure its 'isPreset' flag is true.
            // User's edited name and content are already loaded from storage.
            if (prompts[existingPromptIndex].isPreset !== true) {
                prompts[existingPromptIndex].isPreset = true;
                madeChangesToStoredStructure = true;
            }
            // Optional: If you want the hardcoded preset *name* to always override user's name changes for presets,
            // while keeping their content edits, you could do:
            // if (prompts[existingPromptIndex].name !== definedPreset.name) {
            //    prompts[existingPromptIndex].name = definedPreset.name;
            //    madeChangesToStoredStructure = true;
            // }
            // However, to allow users to fully edit presets (name and content), we don't override here.
        }
    });

    // Ensure any non-preset prompts (custom ones) have isPreset: false
    prompts.forEach(p => {
        // Check if this prompt ID exists in our hardcoded preset definitions
        const isActuallyPreset = presetPromptsDefinition.some(dp => dp.id === p.id);
        if (!isActuallyPreset) { // If it's not in our definitions, it must be custom
            if (p.isPreset !== false) { // if it's undefined or somehow true
                p.isPreset = false;
                madeChangesToStoredStructure = true;
            }
        }
    });

    // If storage was initially empty or structural changes were made (like adding missing presets or correcting flags), save.
    if (!result.promptTemplates || madeChangesToStoredStructure) {
        await savePrompts();
    }

    renderPrompts();
  }

  async function savePrompts() {
    // Ensure prompts are sorted so presets appear first, then custom prompts
    prompts.sort((a, b) => {
        if (a.isPreset && !b.isPreset) return -1;
        if (!a.isPreset && b.isPreset) return 1;
        // Optional: sort by name or id if both are same type
        return 0;
    });
    await chrome.storage.local.set({ promptTemplates: prompts });
  }

  function renderPrompts() {
    promptListDiv.innerHTML = '';
    if (prompts.length === 0) {
      promptListDiv.innerHTML = '<p>还没有模板，请添加一个。</p>';
      return;
    }

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
        presetTag.textContent = '预设';
        nameSpan.appendChild(presetTag);
      }
      headerDiv.appendChild(nameSpan);

      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('prompt-item-actions');

      const editButton = document.createElement('button');
      editButton.classList.add('edit-button');
      editButton.textContent = '编辑';
      editButton.addEventListener('click', () => loadPromptForEditing(prompt.id));
      actionsDiv.appendChild(editButton);

      if (!prompt.isPreset) {
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.textContent = '删除';
        deleteButton.addEventListener('click', () => deletePrompt(prompt.id));
        actionsDiv.appendChild(deleteButton);
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
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      promptNameInput.focus();
    }
  }

  async function deletePrompt(id) {
    if (confirm('确定要删除这个模板吗？')) {
      prompts = prompts.filter(p => p.id !== id);
      await savePrompts();
      renderPrompts();
      clearForm(); // In case the deleted one was loaded in form
    }
  }

  savePromptButton.addEventListener('click', async () => {
    const id = promptIdInput.value;
    const name = promptNameInput.value.trim();
    const content = promptContentInput.value.trim();

    if (!name || !content) {
      alert('模板名称和内容不能为空。');
      return;
    }

    if (id) { // Editing existing
      const promptIndex = prompts.findIndex(p => p.id === id);
      if (promptIndex !== -1) {
        prompts[promptIndex].name = name;
        prompts[promptIndex].content = content;
        // prompts[promptIndex].isPreset is preserved.
      }
    } else { // Adding new
      prompts.push({
        id: `custom-${Date.now()}`,
        name,
        content,
        isPreset: false // New prompts are always custom, not presets
      });
    }
    await savePrompts();
    renderPrompts();
    clearForm();
  });

  clearFormButton.addEventListener('click', clearForm);

  backToSidebarButton.addEventListener('click', () => {
    // This page is likely opened in a new tab from the sidebar.
    // Attempt to close it. If it wasn't, this might not work or might close an unintended tab.
    // A more robust method would involve checking if it *can* be closed or messaging.
    chrome.tabs.getCurrent(tab => {
        if (tab && tab.id) {
            chrome.tabs.remove(tab.id);
        } else {
            window.close(); // Fallback for environments where chrome.tabs.getCurrent might not work as expected
        }
    });
  });

  loadPrompts();
});