(function() {
  'use strict';
  
  // 防止重复加载
  if (window.ASCS_LOADED) {
    console.warn('ASCS: 评论系统已经加载，跳过重复加载');
    return;
  }
  window.ASCS_LOADED = true;
  
  // 获取当前页面信息
  const currentHostname = window.location.hostname;
  const currentPath = window.location.pathname;
  
  // 获取当前执行的脚本标签
  function getCurrentScript() {
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
      if (script.src && (script.src.includes('/comments.js') || script.src.includes('/embed.js'))) {
        return script;
      }
    }
    return null;
  }
  
  const currentScript = getCurrentScript();
  
  // 获取配置信息的函数
  function getConfig(key, defaultValue = null) {
    // 优先级：script标签配置 > 容器配置 > 默认值
    
    // 1. 从script标签获取配置
    if (currentScript && currentScript.hasAttribute(`data-${key}`)) {
      return currentScript.getAttribute(`data-${key}`);
    }
    
    // 2. 从容器获取配置
    if (container && container.hasAttribute(`data-${key}`)) {
      return container.getAttribute(`data-${key}`);
    }
    
    // 3. 返回默认值
    return defaultValue;
  }
  
  // 查找评论容器 - 支持自定义容器ID
  const scriptContainerId = currentScript ? currentScript.getAttribute('data-container-id') : null;
  const defaultContainerId = scriptContainerId || 'comments';
  
  let container = document.getElementById(defaultContainerId);
  
  // 如果找不到指定容器，尝试查找其他带有 data-container-id 的元素
  if (!container) {
    const elementsWithContainerId = document.querySelectorAll('[data-container-id]');
    for (const element of elementsWithContainerId) {
      const customContainerId = element.getAttribute('data-container-id');
      if (customContainerId && document.getElementById(customContainerId)) {
        container = document.getElementById(customContainerId);
        break;
      }
    }
  }
  
  // 最后尝试默认的 comments 容器
  if (!container) {
    container = document.getElementById('comments');
  }
  
  if (!container) {
    console.error('ASCS: 找不到评论容器，请确保页面中有对应的容器元素');
    return;
  }
  
  // 获取配置信息
  const customPageId = getConfig('page-id', currentPath);
  const customHost = getConfig('ascs-host');
  
  // 确定 ASCS 服务器地址
  let ASCS_HOST;
  if (customHost) {
    ASCS_HOST = customHost.replace(/\/$/, ''); // 移除末尾的斜杠
  } else if (currentScript && currentScript.src) {
    // 从脚本标签的 src 属性推断
    const url = new URL(currentScript.src);
    ASCS_HOST = `${url.protocol}//${url.host}`;
  } else {
    // 如果还是找不到，使用当前域名（开发环境）
    ASCS_HOST = window.location.origin;
  }
  
  // 创建加载提示
  const loadingHtml = `
    <div style="
      text-align: center; 
      padding: 40px 20px; 
      color: #666; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    ">
      <div style="
        width: 20px; 
        height: 20px; 
        border: 2px solid #e5e7eb; 
        border-top: 2px solid #3b82f6; 
        border-radius: 50%; 
        animation: spin 1s linear infinite; 
        margin: 0 auto 10px;
      "></div>
      <div>加载评论系统中...</div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;
  container.innerHTML = loadingHtml;
  
  // 获取站点信息
  fetch(`${ASCS_HOST}/api/sites?host=${encodeURIComponent(currentHostname)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(site => {
      // 创建 iframe
      const iframe = document.createElement('iframe');
      const iframeSrc = `${ASCS_HOST}/embed?siteId=${encodeURIComponent(site.id)}&pageId=${encodeURIComponent(customPageId)}`;
      
      iframe.src = iframeSrc;
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.minHeight = '400px';
      iframe.style.borderRadius = '8px';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('title', 'ASCS 评论系统');
      
      // 监听 iframe 高度变化
      const messageHandler = function(event) {
        // 验证消息来源
        if (event.origin !== ASCS_HOST) return;
        
        if (event.data && event.data.type === 'ascs-resize') {
          const height = parseInt(event.data.height);
          if (height && height > 0) {
            iframe.style.height = height + 'px';
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // iframe 加载完成后的处理
      iframe.onload = function() {
        console.log('ASCS: 评论系统加载完成');
      };
      
      iframe.onerror = function() {
        console.error('ASCS: iframe 加载失败');
        showError('评论系统 iframe 加载失败');
      };
      
      // 替换容器内容
      container.innerHTML = '';
      container.appendChild(iframe);
      
      // 清理函数（可选）
      window.ASCS_CLEANUP = function() {
        window.removeEventListener('message', messageHandler);
        if (container && container.parentNode) {
          container.innerHTML = '';
        }
      };
    })
    .catch(error => {
      console.error('ASCS: 加载失败', error);
      showError('评论系统加载失败: ' + error.message);
    });
  
  // 显示错误信息
  function showError(message) {
    const errorHtml = `
      <div style="
        text-align: center; 
        padding: 40px 20px; 
        color: #dc2626; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border: 1px solid #fecaca;
        border-radius: 8px;
        background: #fef2f2;
      ">
        <div style="font-size: 18px; margin-bottom: 8px;">⚠️</div>
        <div style="font-weight: 500; margin-bottom: 4px;">评论系统加载失败</div>
        <div style="font-size: 14px; opacity: 0.8;">${message}</div>
        <div style="font-size: 12px; margin-top: 10px; opacity: 0.6;">
          请检查网络连接或联系网站管理员
        </div>
      </div>
    `;
    container.innerHTML = errorHtml;
  }
})();