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
                  const response = JSON.parse(this.responseText);
                  const formData = new URLSearchParams(postData);
                  const msgContent = formData.get('msg');
                  
                  window.postMessage({
                    type: 'BILIBILI_DANMAKU_RESPONSE',
                    data: {
                      response: response,
                      content: msgContent
                    }
                  }, '*');
                } catch (err) {
                  console.error('Error processing XHR response:', err);
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
          const response = await originalFetch.apply(this, arguments);
          
          if (url.toString().includes('api.live.bilibili.com/msg/send')) {
            const clonedResponse = response.clone();
            try {
              const data = await clonedResponse.json();
              const formData = new URLSearchParams(options.body);
              const msgContent = formData.get('msg');
              
              window.postMessage({
                type: 'BILIBILI_DANMAKU_RESPONSE',
                data: {
                  response: data,
                  content: msgContent
                }
              }, '*');
            } catch (err) {
              console.error('Error processing fetch response:', err);
            }
          }
          
          return response;
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