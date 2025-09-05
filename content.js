// 注入脚本
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// 保存被禁弹幕的内容
const bannedMessages = new Set();

// 监听来自注入脚本的消息
window.addEventListener('message', function(event) {
  try {
    if (event.data && event.data.type === 'BILIBILI_DANMAKU_RESPONSE') {
      const responseData = event.data.data;
      if (!responseData || !responseData.response) {
        console.warn('接收到无效的弹幕响应数据');
        return;
      }
      
      const { response, content } = responseData;
      
      if (response.message === "f" && response.msg === "f") {
        if (content && typeof content === 'string') {
          console.log('检测到被禁弹幕:', content);
          bannedMessages.add(content);
          setTimeout(() => {
            markBannedMessage(content);
          }, 500);
        } else {
          console.warn('被禁弹幕内容为空或无效');
        }
      }
    } else if (event.data && event.data.type === 'BILIBILI_DANMAKU_ERROR') {
      console.warn('注入脚本报告错误:', event.data.data.error);
    }
  } catch (error) {
    console.error('处理弹幕响应消息时出错:', error);
  }
});

function markBannedMessage(content) {
  try {
    const danmakuItems = document.querySelectorAll('.danmaku-item');
    if (!danmakuItems || danmakuItems.length === 0) {
      console.warn('未找到弹幕项元素');
      return;
    }
    
    danmakuItems.forEach(item => {
      const itemContent = item.getAttribute('data-danmaku');
      if (itemContent === content) {
        item.classList.add('banned-message');
        console.log('已标记被禁弹幕:', content);
      }
    });
  } catch (error) {
    console.error('标记被禁弹幕时出错:', error);
  }
}

// 监听新增的弹幕 - 优化性能
const chatObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // 只处理新增的元素节点
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        // 只处理元素节点，跳过文本节点等
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 检查节点本身
          if (node.classList && node.classList.contains('danmaku-item')) {
            checkAndMarkBannedMessage(node);
          }
          // 检查子节点中的弹幕项
          const danmakuItems = node.querySelectorAll ? node.querySelectorAll('.danmaku-item') : [];
          danmakuItems.forEach(checkAndMarkBannedMessage);
        }
      });
    }
  });
});

function checkAndMarkBannedMessage(node) {
  const content = node.getAttribute('data-danmaku');
  if (content && bannedMessages.has(content)) {
    node.classList.add('banned-message');
    console.log('标记新增的被禁弹幕:', content);
  }
}

function initializeChatObserver(retryCount = 0) {
  const maxRetries = 10;
  const baseDelay = 1000;
  
  const chatContainer = document.querySelector('.chat-items');
  if (chatContainer) {
    chatObserver.observe(chatContainer, {
      childList: true,
      subtree: true
    });
    console.log('弹幕观察器已初始化');
    return true;
  } else if (retryCount < maxRetries) {
    // 指数退避重试机制
    const delay = baseDelay * Math.pow(1.5, retryCount);
    setTimeout(() => initializeChatObserver(retryCount + 1), delay);
    console.log(`弹幕容器未找到，${delay}ms后进行第${retryCount + 1}次重试`);
  } else {
    console.warn('达到最大重试次数，弹幕观察器初始化失败');
    return false;
  }
}

// 页面重载检测 - 使用更高效的URL变化检测
let lastUrl = location.href;
let urlCheckTimer;

function handleUrlChange() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('页面URL发生变化，重新初始化...');
    bannedMessages.clear(); // 清除之前的被禁弹幕记录
    injectScript();
    initializeChatObserver();
  }
}

// 使用定时检查代替高频率的MutationObserver
function startUrlMonitoring() {
  urlCheckTimer = setInterval(handleUrlChange, 1000);
}

// 监听浏览器历史变化
window.addEventListener('popstate', handleUrlChange);

// 重写pushState和replaceState以捕获程序化导航
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(history, arguments);
  setTimeout(handleUrlChange, 0);
};

history.replaceState = function() {
  originalReplaceState.apply(history, arguments);
  setTimeout(handleUrlChange, 0);
};

// 初始化
function initialize() {
  try {
    if (!window._injected) {
      injectScript();
      initializeChatObserver();
      startUrlMonitoring();
    }
  } catch (error) {
    console.error('初始化插件时出错:', error);
  }
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
  if (urlCheckTimer) {
    clearInterval(urlCheckTimer);
  }
  if (chatObserver) {
    chatObserver.disconnect();
  }
});

// 在文档开始时就执行初始化
initialize();