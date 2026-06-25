// Service Worker: プッシュ通知 + オフラインキャッシュ
const CACHE_NAME = 'chat-app-v1'
const APP_SHELL = ['/', '/index.html']

// ── インストール: アプリシェルをキャッシュ ──
self.addEventListener('install', (e) => {
  console.log('[SW] install')
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

// ── アクティベート: 古いキャッシュを削除 ──
self.addEventListener('activate', (e) => {
  console.log('[SW] activate')
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => clients.claim())
  )
})

// ── ネットワークリクエスト: ネットワーク優先、失敗時はキャッシュ ──
self.addEventListener('fetch', (e) => {
  // POST / WebSocket / 外部リクエストはスキップ
  if (
    e.request.method !== 'GET' ||
    !e.request.url.startsWith(self.location.origin)
  ) return

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // HTML + JS + CSS のみキャッシュ更新
        if (res.ok && ['document', 'script', 'style'].includes(e.request.destination)) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ── プッシュ通知受信 ──
self.addEventListener('push', (e) => {
  console.log('[SW] push received')
  if (!e.data) return

  let data
  try {
    data = e.data.json()
  } catch {
    data = { title: '新しいDM', body: e.data.text(), url: '/' }
  }

  const options = {
    body: data.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: { url: data.url ?? '/' },
    vibrate: [200, 100, 200],
    tag: data.tag ?? 'dm-notification',
    renotify: true,
    requireInteraction: false,
  }

  e.waitUntil(self.registration.showNotification(data.title ?? '新しいDM', options))
})

// ── 通知タップ → DM 画面へ ──
self.addEventListener('notificationclick', (e) => {
  console.log('[SW] notification click:', e.notification.data?.url)
  e.notification.close()
  const targetUrl = e.notification.data?.url ?? '/'

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 既に開いているタブがあればそこへ
        for (const client of windowClients) {
          if ('focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        return clients.openWindow(targetUrl)
      })
  )
})
