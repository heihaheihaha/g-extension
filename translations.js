// g-extension/translations.js
const messages = {
  en: {
    // Options Page
    optionsHtmlTitle: "Smart Sidebar API Settings",
    apiConfigManagement: "API Configuration Management",
    addEditConfig: "Add/Edit Configuration",
    configNameLabel: "Configuration Name:",
    configNamePlaceholder: "e.g., My Main Gemini",
    apiKeyLabel: "API Key:",
    apiKeyPlaceholder: "Paste your API Key",
    apiTypeLabel: "API Type:",
    apiTypeGemini: "Google Gemini",
    apiTypeOpenAI: "OpenAI Compatible API",
    apiEndpointLabel: "API Endpoint URL:",
    apiEndpointPlaceholder: "e.g., https://api.openai.com/v1/chat/completions",
    modelNameLabel: "Model Name:",
    modelNamePlaceholder: "e.g., gemini-1.5-flash-latest or gpt-4o",
    saveConfigButton: "Save Configuration",
    clearFormButton: "Clear Form",
    cancelEditButton: "Cancel Edit",
    savedConfigsTitle: "Saved Configurations",
    noConfigsMessage: "No configurations yet. Please add a new one using the form above.",
    statusSuccess: "Operation successful!",
    statusErrorSaving: "Error: Failed to save configuration. $1",
    statusEmptyFields: "Configuration Name, API Key, and Model Name cannot be empty.",
    statusOpenAIEndpointMissing: "OpenAI Compatible API requires an Endpoint URL.",
    configActive: "(Current Active)",
    configTypeLabel: "Type:",
    configModelLabel: "Model:",
    setActiveButton: "Set Active",
    editButton: "Edit",
    deleteButton: "Delete",
    confirmDeleteConfig: "Are you sure you want to delete configuration \"$1\"?",
    languageSettingLabel: "Language:",
    languageEn: "English",
    languageZh: "简体中文",

    // Sidebar
    sidebarHtmlTitle: "Smart Assistant",
    summarizePageButton: "Summarize Current Page",
    splitChatButton: "Split Current Chat",
    viewArchivedButton: "View Archived Chats ($1)", // $1 will be count
    managePromptsButton: "Manage Prompts",
    promptShortcutsTitle: "Prompt Shortcuts:",
    clearImageButton: "Clear Image",
    selectedImagePreviewContainerAlt: "Selected image preview",
    selectedTextPreviewLabel: "Quoting:",
    clearSelectedTextButton: "Clear",
    chatInputPlaceholder: "Enter message or use shortcuts...",
    sendMessageButton: "Send",
    moreHistoryActions: "More History Actions",
    clearAllHistoryButton: "Clear All History",
    confirmClearAllHistory: "Are you sure you want to clear all chat history? This action cannot be undone.",
    allHistoryCleared: "All chat history has been cleared.",
    chatSplitArchived: "Chat has been split and archived. A new chat has started.",
    qaArchived: "This Q&A pair has been archived.",
    archiveFailedUserMessage: "Archive failed: Could not find corresponding user question.",
    summarizingLinkStatus: "Summarizing link: [$1]... Please wait.",
    summarizingLinkFailed: "Failed to summarize link [$1]: $2",
    errorApiConfigIncomplete: "Error: Active API configuration is incomplete. Please check plugin options.",
    errorApiConfigMissing: "Error: No API configuration found or no active configuration set. Please add and set an active configuration in plugin options.",
    errorLoadingApiConfig: "Error: Failed to load API configuration.",
    configLoadedStatus: "Loaded configuration: \"$1\" ($2)",
    configUpdatedStatus: "API configuration updated.",
    configSwitchedStatus: "Switched to configuration: \"$1\" ($2)",
    errorNewApiConfigIncomplete: "Error: The new active API configuration is incomplete. Please check plugin options.",
    errorNoActiveConfig: "No valid active API configuration found. Please set one in options.",
    errorApiKeyMissing: "Error: API Key not set. Please set it in plugin options.",
    errorModelNameMissing: "Error: Model name not set.",
    errorOpenAIEndpointMissingSidebar: "Error: OpenAI API Endpoint not set.",
    promptNoTextOrImage: "Please enter a message or select an image/text before sending.",
    promptNoValidContent: "No valid content to send.",
    thinkingStatus: "Thinking...",
    loadingImageStatusGemini: "Loading and processing image (Gemini)...",
    loadingImageStatusOpenAI: "Loading and processing image (OpenAI)...",
    imageProcessingErrorGemini: "Image processing error (Gemini): $1",
    imageProcessingErrorOpenAI: "Image processing error (OpenAI): $1",
    errorNoContentToAI: "No content to send to AI.",
    errorUnsupportedApiType: "Error: Unsupported API type \"$1\".",
    errorApiCallFailed: "API call failed ($1): $2",
    errorApiComms: "Error communicating with API ($1): $2",
    pageContentEmpty: "Page content is empty or no valid text could be extracted for summary.",
    summaryRequestCurrentPage: "Summary request: Current page",
    summaryRequestLink: "Summary request: [$1]($2) (Content length: $3)",
    linkSummaryFailedNoText: "Cannot summarize [$1]($2), no valid text extracted.",
    linkSummaryWarning: "Note: $1",
    sidebarInitiatedPageSummary: "Sidebar initiated page summary.",
    selectedTextReceived: "Selected text received in sidebar",
    imageUrlReceived: "Image URL received in sidebar",
    defaultImagePrompt: "Please describe this image.",
    selectedImageAndTextPrompt: "(Image selected, combined with current text)",
    selectedImageDisplay: "(Image selected)",
    combinedQueryPrefix: "Regarding the following quote:\n\"$1\"\n\nMy question/instruction is:\n\"$2\"",
    quotedTextDisplay: "(Quoted content: $1...)",
    summaryErrorComms: "Summary error (communications): $1",
    summaryErrorUnknownResponse: "Summary error: Unknown response from background script.",
    summaryErrorGeneric: "Summary error: $1",


    // Prompts Page
    promptsHtmlTitle: "Manage Prompt Templates",
    backToSidebarButton: "Back to Sidebar",
    addEditPromptTitle: "Add/Edit Template",
    promptNameLabel: "Template Name:",
    promptNamePlaceholder: "e.g., Translate to English",
    promptContentLabel: "Template Content (use {{text}} for selected text):",
    promptContentPlaceholder: "e.g., Please translate the following text to English:\n\n{{text}}",
    savePromptButton: "Save Template",
    usageNoteTitle: "Usage Note:",
    usageNoteLi1: "If there is currently selected web text, {{text}} will be replaced with that text.",
    usageNoteLi2: "If there is no selected text, {{text}} will be preserved as is or processed based on your input.",
    noPromptsYet: "No templates yet, please add one.",
    presetTagText: "Preset",
    confirmDeletePrompt: "Are you sure you want to delete this template?",
    alertPromptNameContentMissing: "Template name and content cannot be empty.",
    presetTranslateName: "Translate",
    presetTranslateContent: "Please translate the following text into [target language, e.g., English]:\n\n{{text}}",
    presetSummarizeName: "Summarize",
    presetSummarizeContent: "Please summarize the main content of the following text:\n\n{{text}}",


    // Archive Page
    archiveHtmlTitle: "Archived Conversations",
    loadArchiveStatus: "Loading archives...",
    noArchivedChats: "No archived conversations.",
    clearAllArchivedButton: "Clear All Archives",
    archiveChatItemTitle: "Archive $1",
    archiveChatItemQATitle: "Q&A: $1...",
    archiveChatItemConvTitle: "Conversation started: $1...",
    archiveChatItemConvAiTitle: "Conversation started (AI): $1...",
    archiveDateLabel: "Archived on: $1",
    roleYou: "You",
    roleAi: "AI",
    deleteFromArchiveButton: "Delete from Archive",
    confirmDeleteArchiveItem: "Are you sure you want to delete this conversation (\"$1\") from archive? This action is irreversible.",
    confirmClearAllArchived: "Are you sure you want to permanently delete all archived conversations? This action is irreversible.",

    // Popup
    popupHtmlTitle: "Page Summarizer",
    summarizeButtonLabel: "Summarize Page", // Used for button text
    summarizingStatusPopup: "Summarizing...", // Specific for popup if needed
    failedToGetSummaryPopup: "Failed to get summary.",
    errorPopup: "Error: $1",


    // Content Script (Preview Window)
    contentLinkPreviewTitle: "Link Preview",
    contentPreviewCloseButtonTitle: "Close Preview",
    contentPreviewUrlLabel: "URL:",
    contentPreviewTextLabel: "Text:",
    contentPreviewSummarizeButton: "Summarize Link",

    // Background script context menu & messages
    analyzeImageWithGeminiCM: "Analyze Image with Gemini",
    errorNoActiveTabBG: "Could not determine active tab.",
    errorGetPageContentBG: "Failed to get page content (Content Script communication error): $1",
    errorGetPageContentDataBG: "Failed to get content from page (Content Script data invalid or malformed).",
    errorCreatingTabBG: "Error creating new tab: $1",
    errorCannotOpenLinkBG: "Cannot open link: $1",
    errorInjectingScriptsBG: "Failed to extract content (injection failure): $1",
    errorPageLoadTimeoutBG: "Page load timeout, cannot extract content.",
    statusProcessingLinkSummBG: "Processing link summarization...",
	usageNoteText: " In template content, use {{text}} as a placeholder. When you click a template shortcut in the sidebar:",

  },
  zh: {
    // Options Page
    optionsHtmlTitle: "智能侧边栏API设置",
    apiConfigManagement: "API 配置管理",
    addEditConfig: "添加/编辑配置",
    configNameLabel: "配置名称:",
    configNamePlaceholder: "例如：我的 Gemini 主力",
    apiKeyLabel: "API 密钥:",
    apiKeyPlaceholder: "粘贴您的 API 密钥",
    apiTypeLabel: "API 类型:",
    apiTypeGemini: "Google Gemini",
    apiTypeOpenAI: "OpenAI 兼容 API",
    apiEndpointLabel: "API Endpoint URL:",
    apiEndpointPlaceholder: "例如: https://api.openai.com/v1/chat/completions",
    modelNameLabel: "模型名称:",
    modelNamePlaceholder: "例如: gemini-1.5-flash-latest 或 gpt-4o",
    saveConfigButton: "保存配置",
    clearFormButton: "清空表单",
    cancelEditButton: "取消编辑",
    savedConfigsTitle: "已保存的配置",
    noConfigsMessage: "暂无配置。请使用上面的表单添加一个新配置。",
    statusSuccess: "操作成功！",
    statusErrorSaving: "错误: 保存配置失败。$1",
    statusEmptyFields: "配置名称、API密钥和模型名称不能为空。",
    statusOpenAIEndpointMissing: "OpenAI 兼容 API 需要填写 Endpoint URL。",
    configActive: "(当前活动)",
    configTypeLabel: "类型:",
    configModelLabel: "模型:",
    setActiveButton: "设为活动",
    editButton: "编辑",
    deleteButton: "删除",
    confirmDeleteConfig: "确定要删除配置 \"$1\" 吗？",
    languageSettingLabel: "语言:",
    languageEn: "English",
    languageZh: "简体中文",

    // Sidebar
    sidebarHtmlTitle: "智能助手",
    summarizePageButton: "总结当前网页 (中文)",
    splitChatButton: "分割当前对话",
    viewArchivedButton: "查看已存档对话 ($1)",
    managePromptsButton: "管理 Prompt",
    promptShortcutsTitle: "Prompt 快捷方式:",
    clearImageButton: "清除图片",
    selectedImagePreviewContainerAlt: "已选择图片预览",
    selectedTextPreviewLabel: "引用内容:",
    clearSelectedTextButton: "清除",
    chatInputPlaceholder: "输入消息或使用快捷方式...",
    sendMessageButton: "发送",
    moreHistoryActions: "更多历史操作",
    clearAllHistoryButton: "清除所有历史",
    confirmClearAllHistory: "确定要清除所有对话历史吗？此操作无法撤销。",
    allHistoryCleared: "所有对话历史已清除。",
    chatSplitArchived: "对话已分割并存档。新的对话已开始。",
    qaArchived: "该问答已存档。",
    archiveFailedUserMessage: "存档失败：未能找到对应的用户问题。",
    summarizingLinkStatus: "正在总结链接: [$1]... 请稍候。",
    summarizingLinkFailed: "总结链接 [$1] 失败: $2",
    errorApiConfigIncomplete: "错误：当前活动的API配置不完整。请检查插件选项。",
    errorApiConfigMissing: "错误：未找到任何API配置或未设置活动配置。请在插件选项中添加并设置一个活动配置。",
    errorLoadingApiConfig: "错误：加载API配置失败。",
    configLoadedStatus: "已加载配置: \"$1\" ($2)",
    configUpdatedStatus: "API 配置已更新。",
    configSwitchedStatus: "已切换到配置: \"$1\" ($2)",
    errorNewApiConfigIncomplete: "错误：新的活动API配置不完整。请检查插件选项。",
    errorNoActiveConfig: "未找到有效的活动API配置。请在选项中设置。",
    errorApiKeyMissing: "错误：API 密钥未设置。请在插件选项中设置。",
    errorModelNameMissing: "错误：模型名称未设置。",
    errorOpenAIEndpointMissingSidebar: "错误：OpenAI API Endpoint 未设置。",
    promptNoTextOrImage: "请输入消息或选择图片/文本后再发送。",
    promptNoValidContent: "没有有效内容发送。",
    thinkingStatus: "正在思考中...",
    loadingImageStatusGemini: "正在加载并处理图片 (Gemini)...",
    loadingImageStatusOpenAI: "正在加载并处理图片 (OpenAI)...",
    imageProcessingErrorGemini: "图片处理错误 (Gemini): $1",
    imageProcessingErrorOpenAI: "图片处理错误 (OpenAI): $1",
    errorNoContentToAI: "没有内容可以发送给AI。",
    errorUnsupportedApiType: "错误：不支持的API类型 \"$1\"。",
    errorApiCallFailed: "API 调用失败 ($1): $2",
    errorApiComms: "与API ($1) 通讯时发生错误: $2",
    pageContentEmpty: "页面内容为空或未能提取到有效文本进行总结。",
    summaryRequestCurrentPage: "总结请求：当前页面",
    summaryRequestLink: "总结请求：[$1]($2) (内容长度: $3)",
    linkSummaryFailedNoText: "无法总结 [$1]($2)，未能提取到有效文本。",
    linkSummaryWarning: "注意: $1",
    sidebarInitiatedPageSummary: "侧边栏已发起页面总结。",
    selectedTextReceived: "侧边栏已收到选中文本",
    imageUrlReceived: "侧边栏已收到图片URL",
    defaultImagePrompt: "请描述这张图片。",
    selectedImageAndTextPrompt: "(图片已选择，并结合当前文本)",
    selectedImageDisplay: "(图片已选择)",
    combinedQueryPrefix: "关于以下引用内容：\n\"$1\"\n\n我的问题/指令是：\n\"$2\"",
    quotedTextDisplay: "(引用内容: $1...)",
    summaryErrorComms: "总结错误 (通讯): $1",
    summaryErrorUnknownResponse: "总结错误: 从背景脚本收到未知响应。",
    summaryErrorGeneric: "总结错误: $1",

    // Prompts Page
    promptsHtmlTitle: "管理 Prompt 模板",
    backToSidebarButton: "返回侧边栏",
    addEditPromptTitle: "添加/编辑模板",
    promptNameLabel: "模板名称:",
    promptNamePlaceholder: "例如：翻译成英文",
    promptContentLabel: "模板内容 (使用 {{text}} 作为选中文本的占位符):",
    promptContentPlaceholder: "例如：请将以下文本翻译成英文：\n\n{{text}}",
    savePromptButton: "保存模板",
    usageNoteTitle: "使用说明:",
    usageNoteLi1: "如果当前有选中的网页文本，{{text}} 将被替换为该文本。",
    usageNoteLi2: "如果没有选中的文本，{{text}} 将被原样保留或根据您的输入进行处理。",
    noPromptsYet: "还没有模板，请添加一个。",
    presetTagText: "预设",
    confirmDeletePrompt: "确定要删除这个模板吗？",
    alertPromptNameContentMissing: "模板名称和内容不能为空。",
    presetTranslateName: "翻译 (Translate)",
    presetTranslateContent: "请将以下文本翻译成[在此处填写目标语言，例如：英文]：\n\n{{text}}",
    presetSummarizeName: "总结 (Summarize)",
    presetSummarizeContent: "请总结以下文本的主要内容：\n\n{{text}}",


    // Archive Page
    archiveHtmlTitle: "已存档对话",
    loadArchiveStatus: "正在加载存档...",
    noArchivedChats: "没有已存档的对话。",
    clearAllArchivedButton: "清空所有存档",
    archiveChatItemTitle: "存档 $1",
    archiveChatItemQATitle: "问答: $1...",
    archiveChatItemConvTitle: "对话始于: $1...",
    archiveChatItemConvAiTitle: "对话始于 (AI): $1...",
    archiveDateLabel: "存档于: $1",
    roleYou: "您",
    roleAi: "AI",
    deleteFromArchiveButton: "从此存档中删除",
    confirmDeleteArchiveItem: "确定要从存档中删除这个对话 (\"$1\") 吗？此操作无法撤销。",
    confirmClearAllArchived: "确定要永久删除所有已存档的对话吗？此操作无法撤销。",

    // Popup
    popupHtmlTitle: "页面总结器",
    summarizeButtonLabel: "总结页面",
    summarizingStatusPopup: "正在总结...",
    failedToGetSummaryPopup: "未能获取总结。",
    errorPopup: "错误: $1",


    // Content Script (Preview Window)
    contentLinkPreviewTitle: "链接预览",
    contentPreviewCloseButtonTitle: "关闭预览",
    contentPreviewUrlLabel: "网址:",
    contentPreviewTextLabel: "文本:",
    contentPreviewSummarizeButton: "总结链接",

    // Background script context menu & messages
    analyzeImageWithGeminiCM: "用 Gemini 分析图片",
    errorNoActiveTabBG: "无法确定活动标签页。",
    errorGetPageContentBG: "获取页面内容失败 (内容脚本通讯错误): $1",
    errorGetPageContentDataBG: "未能从页面获取内容 (内容脚本数据无效或格式错误)。",
    errorCreatingTabBG: "创建新标签页时出错: $1",
    errorCannotOpenLinkBG: "无法打开链接: $1",
    errorInjectingScriptsBG: "无法提取内容 (注入脚本失败): $1",
    errorPageLoadTimeoutBG: "页面加载超时，无法提取内容。",
    statusProcessingLinkSummBG: "正在处理链接总结...",

	usageNoteText: " 在模板内容中使用 {{text}} 作为占位符。当您在侧边栏点击模板快捷方式时：",
  }
};

async function getActiveLanguage() {
  try {
    const result = await chrome.storage.sync.get('language');
    return result.language || 'zh'; // Default to Chinese if not set
  } catch (e) {
    // console.warn("Error getting language from storage, defaulting to 'zh'", e);
    return 'zh';
  }
}

async function getL10nString(key, ...args) {
  const lang = await getActiveLanguage();
  let msg = messages[lang]?.[key] || messages.en?.[key]; // Fallback to English
  if (msg === undefined) {
    console.warn(`Missing translation for key: ${key} in lang: ${lang}. Falling back to EN or key itself.`);
    msg = messages.en?.[key] || `_${key}_`; // Fallback to English key or key itself if EN also missing
  }
  
  if (args && args.length > 0) {
    args.forEach((arg, i) => {
      const placeholder = `$${i + 1}`;
      // Ensure arg is a string to prevent errors with replace if it's not
      const replacement = String(arg);
      //Escape $ in replacement to prevent it from being interpreted as a special replacement pattern
      const escapedReplacement = replacement.replace(/\$/g, '$$$$');
      try {
        msg = msg.replace(new RegExp(`\\${placeholder.replace('$', '\\$')}`, 'g'), escapedReplacement);
      } catch (e) {
        console.error("Error during string replacement for key:", key, "placeholder:", placeholder, "arg:", arg, e);
      }
    });
  }
  return msg;
}

async function applyPageLocalization(doc = document) {
  const elements = doc.querySelectorAll('[data-i18n-key]');
  for (const el of elements) {
    const key = el.dataset.i18nKey;
    const attr = el.dataset.i18nAttr || 
                 (el.placeholder ? 'placeholder' : 
                  (el.title && (!el.textContent || !el.textContent.trim()) ? 'title' : // prioritize title if textContent is empty or whitespace
                  (el.tagName === 'INPUT' && el.type === 'button' ? 'value' : 'textContent'))); 
    
    const localizedString = await getL10nString(key);

    if (attr === 'textContent') {
      el.textContent = localizedString;
    } else if (attr === 'innerHTML') {
      el.innerHTML = localizedString;
    } else if (attr === 'value' && (el.tagName === 'INPUT' || el.tagName === 'BUTTON')) {
      el.value = localizedString;
    } else if (attr === 'alt' && el.tagName === 'IMG') {
      el.alt = localizedString;
    }
    else {
      el.setAttribute(attr, localizedString);
    }
  }
  // Update document title if a key is provided on the body or html tag
  const pageTitleKey = doc.body.dataset.i18nPageTitleKey || doc.documentElement.dataset.i18nPageTitleKey;
  if (pageTitleKey) {
    doc.title = await getL10nString(pageTitleKey);
  }
}