// Service Worker: プッシュ通知ハンドラ

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

// プッシュ通知受信
self.addEventListener('push', (e) => {
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
  }

  e.waitUntil(self.registration.showNotification(data.title ?? '新しいDM', options))
})

// 通知をタップ → DM画面へ遷移
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const targetUrl = e.notification.data?.url ?? '/'

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // すでに開いているウィンドウがあればフォーカスしてURL変更
        for (const client of windowClients) {
          if ('focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // 開いていなければ新しいウィンドウ
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})
