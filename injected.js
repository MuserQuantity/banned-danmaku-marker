(function() {
    // 存储原始的XMLHttpRequest和fetch
    const originalXHR = window.XMLHttpRequest;
    const originalFetch = window.fetch;
    
    // 创建拦截器
    function createInterceptor() {
      // 拦截 XMLHttpRequest
      function interceptXHR() {
        const XHR = originalXHR;
        function newXHR() {
          const xhr = new XHR();
          const originalOpen = xhr.open;
          const originalSend = xhr.send;
          
          xhr.open = function() {
            this._url = arguments[1];
            return originalOpen.apply(this, arguments);
          };
          
          xhr.send = function(postData) {
            this.addEventListener('load', function() {
              if (this._url && this._url.includes('api.live.bilibili.com/msg/send')) {
                try {
                  if (!this.responseText) {
                    console.warn('XHR响应内容为空');
                    return;
                  }
                  
                  const response = JSON.parse(this.responseText);
                  if (!postData) {
                    console.warn('POST数据为空，无法提取弹幕内容');
                    return;
                  }
                  
                  const formData = new URLSearchParams(postData);
                  const msgContent = formData.get('msg');
                  
                  if (msgContent) {
                    window.postMessage({
                      type: 'BILIBILI_DANMAKU_RESPONSE',
                      data: {
                        response: response,
                        content: msgContent
                      }
                    }, '*');
                  } else {
                    console.warn('无法从表单数据中提取弹幕内容');
                  }
                } catch (err) {
                  console.error('处理XHR响应时出错:', err);
                  // 降级处理：即使解析失败也要尝试通知content script
                  try {
                    window.postMessage({
                      type: 'BILIBILI_DANMAKU_ERROR',
                      data: { error: err.message }
                    }, '*');
                  } catch (e) {
                    console.error('发送错误消息失败:', e);
                  }
                }
              }
            });
            return originalSend.apply(this, arguments);
          };
          
          return xhr;
        }
        
        window.XMLHttpRequest = newXHR;
      }
      
      // 拦截 fetch
      function interceptFetch() {
        window.fetch = async function(url, options) {
          try {
            const response = await originalFetch.apply(this, arguments);
            
            if (url.toString().includes('api.live.bilibili.com/msg/send')) {
              const clonedResponse = response.clone();
              try {
                const data = await clonedResponse.json();
                
                if (!options || !options.body) {
                  console.warn('Fetch请求体为空，无法提取弹幕内容');
                  return response;
                }
                
                const formData = new URLSearchParams(options.body);
                const msgContent = formData.get('msg');
                
                if (msgContent) {
                  window.postMessage({
                    type: 'BILIBILI_DANMAKU_RESPONSE',
                    data: {
                      response: data,
                      content: msgContent
                    }
                  }, '*');
                } else {
                  console.warn('无法从Fetch请求体中提取弹幕内容');
                }
              } catch (err) {
                console.error('处理Fetch响应时出错:', err);
                // 降级处理
                try {
                  window.postMessage({
                    type: 'BILIBILI_DANMAKU_ERROR',
                    data: { error: err.message }
                  }, '*');
                } catch (e) {
                  console.error('发送错误消息失败:', e);
                }
              }
            }
            
            return response;
          } catch (error) {
            console.error('Fetch请求失败:', error);
            throw error;
          }
        };
      }
      
      // 应用拦截器
      interceptXHR();
      interceptFetch();
    }
    
    // 初始应用拦截器
    createInterceptor();
    
    // 标记已注入
    window._injected = true;
  })();