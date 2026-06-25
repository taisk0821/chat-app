import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Service Worker 登録 + 自動更新
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 登録前に既存の controller があるか記録
    // → controller が変わったとき「更新」と判断してリロードする
    const hadController = !!navigator.serviceWorker.controller

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[SW] 登録失敗:', err)
    })

    // 新しい SW が skipWaiting + clients.claim() を実行すると controllerchange が発火する
    // hadController が true の場合は「更新」なのでページをリロードして最新 JS を読み込む
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) {
        console.log('[SW] 新しいバージョンが有効になりました。リロードします。')
        window.location.reload()
      }
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
