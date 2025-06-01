// content_script.js

const SIDEBAR_MAIN_CONTAINER_ID = 'gemini-sidebar-main-container'; // 侧边栏最外层容器
const PAGE_CONTENT_WRAPPER_ID = 'gemini-original-page-content-wrapper'; // 原始页面内容包装器
const SIDEBAR_IFRAME_ID = 'gemini-sidebar-iframe'; // 侧边栏iframe
const RESIZER_ID = 'gemini-sidebar-resizer'; // 宽度调整条

// --- 全局变量 ---
let sidebarIframe = null; // 对iframe元素的引用
let sidebarContainer = null; // 侧边栏的直接容器 (包含iframe和resizer)
let pageContentWrapper = null; // 包裹原始页面内容的容器
let resizer = null; // 宽度调整条元素
let sidebarVisible = false; // 侧边栏当前是否可见
let initialSidebarWidth = 350; // 侧边栏初始宽度 (px)
const MIN_SIDEBAR_WIDTH = 250; // 侧边栏最小宽度 (px)
const MAX_SIDEBAR_WIDTH = 800; // 侧边栏最大宽度 (px)
let sidebarIframeReady = false; // 侧边栏iframe是否已加载并发送 'SIDEBAR_READY'

// --- DOM 操作和侧边栏结构初始化 ---

/**
 * 设置页面结构以容纳侧边栏。
 * 这包括创建包装器，移动现有页面内容，以及创建侧边栏容器。
 */
async function setupPageStructure() {
    console.log("Content Script: Setting up page structure...");

    // 尝试从存储中加载用户上次保存的侧边栏宽度
    try {
        const data = await chrome.storage.local.get('sidebarWidth');
        if (data.sidebarWidth) {
            initialSidebarWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, data.sidebarWidth));
        }
    } catch (e) {
        console.error("Content Script: Error loading sidebar width from storage:", e);
    }


    // 1. 创建原始页面内容的包装器
    pageContentWrapper = document.createElement('div');
    pageContentWrapper.id = PAGE_CONTENT_WRAPPER_ID;
    pageContentWrapper.style.cssText = `
        flex-grow: 1; /* 占据剩余空间 */
        overflow-x: auto; /* 根据内容决定是否显示滚动条 */
        overflow-y: auto;
        height: 100%;
        transition: margin-right 0.3s ease-in-out; /* 如果使用 margin 推开内容 */
        box-sizing: border-box;
    `;

    // 2. 将 <body> 的现有直接子元素移动到 pageContentWrapper 中
    //    使用 DocumentFragment 以提高性能并避免多次重绘
    const fragment = document.createDocumentFragment();
    while (document.body.firstChild) {
        fragment.appendChild(document.body.firstChild);
    }
    pageContentWrapper.appendChild(fragment);

    // 3. 创建侧边栏的直接容器 (将包含 iframe 和 resizer)
    sidebarContainer = document.createElement('div');
    sidebarContainer.id = SIDEBAR_MAIN_CONTAINER_ID;
    sidebarContainer.style.cssText = `
        width: ${initialSidebarWidth}px;
        height: 100%;
        display: none; /* 初始时隐藏，通过 toggleSidebar 显示 */
        flex-shrink: 0; /* 防止侧边栏在空间不足时被压缩 */
        position: relative; /* 用于内部 resizer 的定位 */
        border-left: 1px solid #ccc; /* 外观分隔线 */
        box-sizing: border-box;
        overflow: hidden; /* 确保iframe内容不会溢出这个容器 */
    `;

    // 4. 创建宽度调整条 (resizer)
    resizer = document.createElement('div');
    resizer.id = RESIZER_ID;
    resizer.style.cssText = `
        width: 8px; /* 调整条的宽度，增加可点击区域 */
        height: 100%;
        position: absolute;
        top: 0;
        left: -4px; /* 让它部分覆盖在左边框上，视觉效果更好 */
        cursor: ew-resize; /* 水平调整大小的光标 */
        background-color: transparent; /* 可以设置为透明，或一个细微的颜色/图案 */
        z-index: 10; /* 确保它在iframe之上，但在可能出现的页面最高层元素之下 */
    `;
    initResizerEvents(resizer); // 初始化调整条的事件监听
    sidebarContainer.appendChild(resizer);

    // 5. 创建侧边栏 iframe
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = SIDEBAR_IFRAME_ID;
    // src 在 toggleSidebar 中首次显示时设置，或在此处设置
    // sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
    sidebarIframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none; /* 移除 iframe 默认边框 */
        display: block; /* 确保 iframe 正确填充容器 */
    `;
    sidebarContainer.appendChild(sidebarIframe);

    // 6. 修改 <html> 和 <body> 样式以适应新的 flex 布局
    document.documentElement.style.height = '100vh'; // 或者 '100%'
    document.documentElement.style.overflow = 'hidden'; // 防止根元素出现滚动条

    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'row'; // 主内容和侧边栏水平排列
    document.body.style.height = '100vh'; // body 占据整个视口高度
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden'; // body 本身不滚动，由内部 wrapper 滚动

    // 7. 将新的包装器和侧边栏容器添加到 body
    document.body.appendChild(pageContentWrapper);
    document.body.appendChild(sidebarContainer);

    console.log("Content Script: Page structure setup complete.");
}

/**
 * 切换侧边栏的显示/隐藏状态。
 */
function toggleSidebar() {
    if (!sidebarContainer) { // 如果是第一次打开，需要构建DOM结构
        console.log("Content Script: First toggle, setting up page structure.");
        setupPageStructure().then(() => {
            // DOM结构创建完毕后，设置iframe的src并显示侧边栏
            if (sidebarIframe && !sidebarIframe.src) {
                sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
            }
            sidebarContainer.style.display = 'flex'; // 使用flex确保内部元素正确布局
            sidebarVisible = true;
            console.log("Content Script: Sidebar is now visible.");
        }).catch(error => {
            console.error("Content Script: Error during setupPageStructure:", error);
        });
    } else {
        // 如果DOM结构已存在，则仅切换显示状态
        if (sidebarVisible) {
            sidebarContainer.style.display = 'none';
            sidebarVisible = false;
            console.log("Content Script: Sidebar is now hidden.");
        } else {
            if (sidebarIframe && !sidebarIframe.src) { // 如果iframe的src被清空过，重新设置
                sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
            }
            sidebarContainer.style.display = 'flex';
            sidebarVisible = true;
            console.log("Content Script: Sidebar is now visible again.");
        }
    }
}

// --- 宽度调整逻辑 ---

/**
 * 初始化宽度调整条的鼠标事件。
 * @param {HTMLElement} resizerElement - 调整条的DOM元素。
 */
function initResizerEvents(resizerElement) {
    let isResizing = false;
    let startX, startWidth;

    resizerElement.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 防止拖动时选择文本或触发其他默认行为
        isResizing = true;
        startX = e.clientX; // 记录鼠标按下时的X坐标
        startWidth = parseInt(document.defaultView.getComputedStyle(sidebarContainer).width, 10); // 获取侧边栏当前宽度

        // 在拖动期间，禁用页面文本选择和iframe的鼠标事件，以提供更流畅的体验
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none'; // 阻止鼠标事件穿透到iframe

        // 在整个文档上监听 mousemove 和 mouseup，以便鼠标移出调整条时仍能响应
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const diffX = e.clientX - startX;
        // 因为调整条在侧边栏左侧，所以向左拖动 (e.clientX < startX, diffX < 0) 是增加宽度
        // 向右拖动 (e.clientX > startX, diffX > 0) 是减小宽度
        let newWidth = startWidth - diffX;

        // 限制侧边栏宽度在最小和最大值之间
        newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH));
        sidebarContainer.style.width = `${newWidth}px`;
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;

        // 恢复页面文本选择和iframe的鼠标事件
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // 保存新的宽度到本地存储
        const finalWidth = parseInt(document.defaultView.getComputedStyle(sidebarContainer).width, 10);
        chrome.storage.local.set({ 'sidebarWidth': finalWidth }).catch(e => {
            console.error("Content Script: Error saving sidebar width:", e);
        });
        console.log("Content Script: Sidebar width saved:", finalWidth);
    }
}

// --- Chrome Runtime 消息监听 (来自 background.js) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content Script: Received message from background:", request);
    if (request.action === 'toggleSidebar') {
        toggleSidebar();
        sendResponse({
            status: sidebarVisible ? "visible" : "hidden",
            currentWidth: sidebarVisible && sidebarContainer ? sidebarContainer.offsetWidth : 0
        });
    } else if (request.action === 'getPageContentForSummarize') {
        // 优先从 pageContentWrapper 获取文本内容，如果它存在的话
        const mainContent = pageContentWrapper ? pageContentWrapper.innerText : document.body.innerText;
        sendResponse({ contentForSummary: mainContent });
    }
    return true; // 表示我们将异步发送响应 (如果需要的话)
});

// --- Window Message 监听 (来自 sidebar iframe) ---

window.addEventListener('message', (event) => {
    // 我们主要关心的是 'SIDEBAR_READY' 类型的消息
    if (event.data && event.data.type === 'SIDEBAR_READY') {
        // 只有当 sidebarIframe 已经被创建并且消息源确实是这个 iframe 时，才处理
        // event.source 是发送消息的窗口对象，即 iframe 的 contentWindow
        if (sidebarIframe && event.source === sidebarIframe.contentWindow) {
            sidebarIframeReady = true;
            console.log("Content Script: Sidebar is ready to receive messages (SIDEBAR_READY received).");
            // 如果有因为 iframe 未准备好而缓存的选择，可以在这里发送
        } else if (!sidebarIframe) {
            console.warn("Content Script: Received SIDEBAR_READY, but 'sidebarIframe' is still null in content_script. This might indicate a race condition.");
        } else {
             // console.log("Content Script: Received SIDEBAR_READY, but event.source does not match sidebarIframe.contentWindow. Ignoring.");
        }
    }
    // 这里可以处理来自iframe的其他类型的消息
});

// --- 页面文本选择监听 ---

document.addEventListener('mouseup', () => {
  if (!sidebarVisible) return; // 如果侧边栏不可见，则不处理

  // 必须确保 sidebarIframe 存在、其 contentWindow 存在，并且 iframe 已通知准备就绪
  if (!sidebarIframe || !sidebarIframe.contentWindow) {
    // console.log("Content Script (mouseup): sidebarIframe or contentWindow is not available yet.");
    return;
  }
  if (!sidebarIframeReady) {
    // console.log("Content Script (mouseup): Sidebar not ready (sidebarIframeReady is false). Waiting for SIDEBAR_READY.");
    return;
  }

  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    // console.log("Content Script (mouseup): Text selected:", selectedText);
    try {
        // targetOrigin 应该是 iframe 的正确 origin
        // chrome.runtime.getURL('') 返回如 "chrome-extension://<id>/"
        // new URL(...).origin 会得到 "chrome-extension://<id>"
        const targetOrigin = new URL(chrome.runtime.getURL('')).origin;
        sidebarIframe.contentWindow.postMessage({ type: 'TEXT_SELECTED', text: selectedText }, targetOrigin);
        // console.log("Content Script (mouseup): Sent TEXT_SELECTED to sidebar with targetOrigin:", targetOrigin);
    } catch (e) {
        console.error("Content Script (mouseup): Error posting message to iframe:", e);
    }
  }
});

console.log("Content Script loaded and running.");