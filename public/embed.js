/* ASCS embed: no dependencies; each script owns one isolated comment frame. */
;(function () {
  'use strict'
  var script = document.currentScript
  if (!script || !script.dataset.site) return
  var base = new URL(script.src).origin
  var target = document.getElementById(script.dataset.target || 'ascs-comments')
  if (!target || target.querySelector('iframe[data-ascs]')) return
  var page = new URL(script.dataset.url || window.location.href)
  page.hash = ''
  var url = new URL('/widget', base)
  url.searchParams.set('siteId', script.dataset.site)
  url.searchParams.set('pageUrl', page.href)
  if (script.dataset.page) url.searchParams.set('pageKey', script.dataset.page)
  if (/^(auto|light|dark)$/.test(script.dataset.theme || ''))
    url.searchParams.set('theme', script.dataset.theme)
  if (/^#[0-9a-f]{6}$/i.test(script.dataset.accent || ''))
    url.searchParams.set('accent', script.dataset.accent)
  var status = document.createElement('p')
  status.textContent = '正在加载评论…'
  status.setAttribute('role', 'status')
  status.style.cssText =
    'margin:1rem 0;color:inherit;font:14px system-ui,sans-serif;'
  target.appendChild(status)
  var frame = document.createElement('iframe')
  frame.dataset.ascs = 'true'
  frame.title = 'ASCS comments'
  frame.src = url.href
  frame.loading = 'lazy'
  frame.referrerPolicy = 'strict-origin-when-cross-origin'
  frame.style.cssText =
    'width:100%;height:520px;border:0;display:block;color-scheme:normal;'
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
  )
  target.appendChild(frame)
  var fallback = document.createElement('div')
  fallback.hidden = true
  fallback.style.cssText =
    'margin:1rem 0;color:inherit;font:14px system-ui,sans-serif;'
  fallback.innerHTML =
    '评论区暂时无法加载。<a target="_blank" rel="noopener noreferrer">在新窗口打开评论</a>，或稍后重试。'
  fallback.querySelector('a').href = url.href
  target.appendChild(fallback)
  var ready = false
  var timeout = window.setTimeout(function () {
    if (!ready) {
      status.hidden = true
      frame.hidden = true
      fallback.hidden = false
    }
  }, 12000)
  var listener = function (event) {
    if (
      event.origin !== base ||
      event.source !== frame.contentWindow ||
      !event.data ||
      event.data.type !== 'ascs:resize' ||
      event.data.siteId !== script.dataset.site
    )
      return
    ready = true
    window.clearTimeout(timeout)
    status.hidden = true
    frame.hidden = false
    fallback.hidden = true
    var height = Number(event.data.height)
    if (Number.isFinite(height) && height > 0 && height <= 100000)
      frame.style.height = Math.max(200, Math.ceil(height)) + 'px'
  }
  window.addEventListener('message', listener)
  var observer = new MutationObserver(function () {
    if (!frame.isConnected) {
      window.clearTimeout(timeout)
      window.removeEventListener('message', listener)
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
})()
