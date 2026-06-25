import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// base64url → Uint8Array（Web Push API 用）
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// iOS かどうか判定
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

// PWA（ホーム画面追加済み）として動作しているか
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// プッシュ通知がサポートされているか
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'denied'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // 起動時に既存サブスクリプションを確認
  useEffect(() => {
    if (!userId || !isPushSupported()) return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub && Notification.permission === 'granted') {
        setSubscribed(true)
        setPermission('granted')
      }
    })
  }, [userId])

  // 通知許可を求めてプッシュ購読を開始
  const subscribe = useCallback(async () => {
    if (!userId || !isPushSupported()) return false
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY が未設定')
      return false
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setLoading(false); return false }

      const reg = await navigator.serviceWorker.ready

      // 既存のサブスクリプションを再利用 or 新規作成
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const { endpoint, keys } = sub.toJSON()

      // Supabase の push_subscriptions テーブルに保存
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[Push] DB保存失敗:', error.message)
        setLoading(false)
        return false
      }

      setSubscribed(true)
      setLoading(false)
      return true
    } catch (err) {
      console.error('[Push] サブスクリプション失敗:', err)
      setLoading(false)
      return false
    }
  }, [userId])

  return { permission, subscribed, loading, subscribe }
}

// DM送信後にプッシュ通知をトリガー（送信者のブラウザから Edge Function を呼ぶ）
export async function triggerPushNotification({ receiverId, senderName, senderId, content }) {
  if (!VAPID_PUBLIC_KEY) return // 未設定なら何もしない
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        receiver_id: receiverId,
        sender_name: senderName,
        sender_id: senderId,
        content,
      }),
    })
  } catch (err) {
    // Edge Function 未デプロイ時はサイレントに無視
    console.warn('[Push] 送信スキップ:', err.message)
  }
}
