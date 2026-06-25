// Service Worker
// キャッシュ戦略:
//   /assets/* (Vite コンテンツハッシュ付き) → cache-first (永久キャッシュOK)
//   index.html / その他HTML         → network-only (常に最新を取得)
//   Supabase API / 外部URL          → スルー (キャッシュしない)

const CACHE_NAME = 'chat-app-assets-v1'

// ── インストール: キャッシュ準備なし、即座に有効化 ──
self.addEventListener('install', () => {
  self.skipWaiting()
})

// ── アクティベート: 古いキャッシュを全削除 → 全クライアントを掌握 ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => clients.claim())
  )
})

// ── フェッチ ──
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // 外部リクエスト (Supabase, CDN等) はスルー
  if (url.origin !== self.location.origin) return

  // Vite のコンテンツハッシュ付きアセット → cache-first
  // (例: /assets/index-BDPJTrAE.js — ファイル名が変われば自動的に別エントリ)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // アイコン・manifest など静的ファイル → cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.svg'
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // index.html / その他 → network-only (キャッシュしない)
  // デプロイのたびに最新の index.html を取得する
  // オフライン時は簡易エラー画面を返す
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match('/') ?? new Response('オフラインです。接続を確認してください。', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  )
})

// ── プッシュ通知受信 ──
self.addEventListener('push', (e) => {
  if (!e.data) return
  let data
  try { data = e.data.json() }
  catch { data = { title: '新しいDM', body: e.data.text(), url: '/' } }

  e.waitUntil(
    self.registration.showNotification(data.title ?? '新しいDM', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url ?? '/' },
      vibrate: [200, 100, 200],
      tag: data.tag ?? 'dm-notification',
      renotify: true,
      requireInteraction: false,
    })
  )
})

// ── 通知タップ → DM 画面へ ──
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const targetUrl = e.notification.data?.url ?? '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
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
