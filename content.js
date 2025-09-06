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

// 弹幕存储功能
const BannedDanmakuStorage = {
  // 保存被禁弹幕到storage
  async saveBannedDanmaku(content) {
    try {
      const roomInfo = this.getCurrentRoomInfo();
      const danmakuRecord = {
        content: content,
        timestamp: Date.now(),
        date: new Date().toLocaleString('zh-CN'),
        roomId: roomInfo.roomId,
        upName: roomInfo.upName,
        roomTitle: roomInfo.roomTitle
      };

      const result = await chrome.storage.local.get(['bannedDanmakus']);
      const bannedDanmakus = result.bannedDanmakus || [];
      
      // 避免重复存储同样内容的弹幕（同一直播间内）
      const isDuplicate = bannedDanmakus.some(item => 
        item.content === content && item.roomId === roomInfo.roomId
      );
      
      if (!isDuplicate) {
        bannedDanmakus.push(danmakuRecord);
        await chrome.storage.local.set({ bannedDanmakus });
        console.log('已保存被禁弹幕到存储:', danmakuRecord);
      }
    } catch (error) {
      console.error('保存被禁弹幕失败:', error);
    }
  },

  // 获取当前直播间信息
  getCurrentRoomInfo() {
    const roomId = this.getRoomIdFromUrl();
    const upNameEl = document.querySelector('.room-owner-username');
    const roomTitleEl = document.querySelector('.live-title');
    
    return {
      roomId: roomId,
      upName: upNameEl ? upNameEl.textContent.trim() : '未知UP主',
      roomTitle: roomTitleEl ? roomTitleEl.textContent.trim() : '未知标题'
    };
  },

  // 从URL获取房间ID
  getRoomIdFromUrl() {
    const urlMatch = window.location.href.match(/live\.bilibili\.com\/(\d+)/);
    return urlMatch ? urlMatch[1] : 'unknown';
  },

  // 从storage加载被禁弹幕
  async loadBannedDanmakus() {
    try {
      const result = await chrome.storage.local.get(['bannedDanmakus']);
      const bannedDanmakus = result.bannedDanmakus || [];
      const currentRoomId = this.getRoomIdFromUrl();
      
      // 只加载当前直播间的被禁弹幕到内存中
      bannedDanmakus
        .filter(item => item.roomId === currentRoomId)
        .forEach(item => bannedMessages.add(item.content));
      
      console.log(`已从存储加载 ${bannedMessages.size} 条被禁弹幕`);
    } catch (error) {
      console.error('加载被禁弹幕失败:', error);
    }
  }
};

// 悬浮查看按钮功能
const FloatingButton = {
  button: null,
  panel: null,
  
  // 创建悬浮按钮
  createButton() {
    if (this.button) return;
    
    this.button = document.createElement('div');
    this.button.id = 'banned-danmaku-float-btn';
    this.button.innerHTML = '🚫';
    this.button.title = '查看被禁弹幕';
    this.button.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      width: 50px;
      height: 50px;
      background: #ff6b6b;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10000;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
      transition: all 0.3s ease;
      user-select: none;
    `;
    
    this.button.addEventListener('mouseenter', () => {
      this.button.style.transform = 'scale(1.1)';
      this.button.style.boxShadow = '0 6px 16px rgba(255, 107, 107, 0.6)';
    });
    
    this.button.addEventListener('mouseleave', () => {
      this.button.style.transform = 'scale(1)';
      this.button.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.4)';
    });
    
    this.button.addEventListener('click', () => {
      this.togglePanel();
    });
    
    document.body.appendChild(this.button);
  },
  
  // 创建弹幕查看面板
  createPanel() {
    if (this.panel) return;
    
    this.panel = document.createElement('div');
    this.panel.id = 'banned-danmaku-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 50%;
      right: 80px;
      width: 350px;
      max-height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      transform: translateY(-50%);
      display: none;
      overflow: hidden;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
    `;
    
    document.body.appendChild(this.panel);
  },
  
  // 切换面板显示/隐藏
  async togglePanel() {
    if (!this.panel) this.createPanel();
    
    if (this.panel.style.display === 'block') {
      this.panel.style.display = 'none';
    } else {
      await this.updatePanel();
      this.panel.style.display = 'block';
    }
  },
  
  // 更新面板内容
  async updatePanel() {
    try {
      const result = await chrome.storage.local.get(['bannedDanmakus']);
      const allDanmakus = result.bannedDanmakus || [];
      const currentRoomId = BannedDanmakuStorage.getRoomIdFromUrl();
      
      // 筛选当前直播间的弹幕
      const currentRoomDanmakus = allDanmakus
        .filter(item => item.roomId === currentRoomId)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      const roomInfo = BannedDanmakuStorage.getCurrentRoomInfo();
      
      let panelHTML = `
        <div style="background: #ff6b6b; color: white; padding: 12px 16px; font-size: 14px; font-weight: bold;">
          当前直播间被禁弹幕
        </div>
        <div style="padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 12px; color: #666;">
          ${roomInfo.upName} · ${roomInfo.roomId}<br>
          共 ${currentRoomDanmakus.length} 条记录
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      if (currentRoomDanmakus.length === 0) {
        panelHTML += `
          <div style="text-align: center; padding: 40px 20px; color: #999; font-size: 12px;">
            当前直播间暂无被禁弹幕记录
          </div>
        `;
      } else {
        currentRoomDanmakus.slice(0, 20).forEach(item => { // 最多显示20条
          panelHTML += `
            <div style="padding: 10px 16px; border-bottom: 1px solid #f5f5f5;">
              <div style="font-size: 13px; color: #333; margin-bottom: 4px; word-break: break-all; line-height: 1.4;">
                ${this.escapeHtml(item.content)}
              </div>
              <div style="font-size: 10px; color: #999;">
                ${item.date}
              </div>
            </div>
          `;
        });
        
        if (currentRoomDanmakus.length > 20) {
          panelHTML += `
            <div style="text-align: center; padding: 10px; color: #999; font-size: 11px;">
              还有 ${currentRoomDanmakus.length - 20} 条记录，点击扩展图标查看全部
            </div>
          `;
        }
      }
      
      panelHTML += `
        </div>
        <div style="padding: 10px 16px; text-align: center; border-top: 1px solid #eee;">
          <button onclick="document.getElementById('banned-danmaku-panel').style.display='none'" 
                  style="padding: 6px 12px; background: #00a1d6; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
            关闭
          </button>
        </div>
      `;
      
      this.panel.innerHTML = panelHTML;
      
    } catch (error) {
      console.error('更新面板内容失败:', error);
      this.panel.innerHTML = `
        <div style="background: #ff6b6b; color: white; padding: 12px 16px; font-size: 14px; font-weight: bold;">
          被禁弹幕面板
        </div>
        <div style="text-align: center; padding: 40px 20px; color: #ff4757; font-size: 12px;">
          加载数据失败
        </div>
      `;
    }
  },
  
  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

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
          // 保存到持久存储
          BannedDanmakuStorage.saveBannedDanmaku(content);
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
    // 加载当前直播间的被禁弹幕
    BannedDanmakuStorage.loadBannedDanmakus();
    injectScript();
    initializeChatObserver();
    
    // 重新创建悬浮按钮（如果需要）
    setTimeout(() => {
      if (!document.getElementById('banned-danmaku-float-btn')) {
        FloatingButton.createButton();
      }
    }, 1000);
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
async function initialize() {
  try {
    if (!window._injected) {
      // 加载被禁弹幕数据
      await BannedDanmakuStorage.loadBannedDanmakus();
      injectScript();
      initializeChatObserver();
      startUrlMonitoring();
      
      // 创建悬浮按钮
      setTimeout(() => {
        FloatingButton.createButton();
      }, 2000); // 延迟创建以确保页面完全加载
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