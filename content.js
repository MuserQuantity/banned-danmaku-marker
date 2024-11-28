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
  if (event.data.type === 'BILIBILI_DANMAKU_RESPONSE') {
    const { response, content } = event.data.data;
    
    if (response.message === "f" && response.msg === "f") {
      console.log('检测到被禁弹幕:', content);
      bannedMessages.add(content);
      setTimeout(() => {
        markBannedMessage(content);
      }, 500);
    }
  }
});

function markBannedMessage(content) {
  const danmakuItems = document.querySelectorAll('.danmaku-item');
  danmakuItems.forEach(item => {
    const itemContent = item.getAttribute('data-danmaku');
    if (itemContent === content) {
      item.classList.add('banned-message');
      console.log('已标记被禁弹幕:', content);
      console.log(bannedMessages);
    }
  });
}

// 监听新增的弹幕
const chatObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.classList && node.classList.contains('danmaku-item')) {
        const content = node.getAttribute('data-danmaku');
        if (bannedMessages.has(content)) {
          node.classList.add('banned-message');
          console.log('标记新增的被禁弹幕:', content);
        }
      }
    });
  });
});

function initializeChatObserver() {
  const chatContainer = document.querySelector('.chat-items');
  if (chatContainer) {
    chatObserver.observe(chatContainer, {
      childList: true,
      subtree: true
    });
    console.log('弹幕观察器已初始化');
  } else {
    setTimeout(initializeChatObserver, 1000);
  }
}

// 页面重载检测
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('页面URL发生变化，重新初始化...');
    injectScript();
    initializeChatObserver();
  }
}).observe(document, { subtree: true, childList: true });

// 初始化
function initialize() {
  if (!window._injected) {
    injectScript();
    initializeChatObserver();
  }
}

// 在文档开始时就执行初始化
initialize();