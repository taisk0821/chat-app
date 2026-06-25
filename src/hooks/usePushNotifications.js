import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

const LS_SUBSCRIBED = 'push_subscribed'
const LS_BANNER_DISMISSED = 'push_banner_dismissed'

export function usePushBannerDismissed() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(LS_BANNER_DISMISSED) === '1'
  )
  const dismiss = useCallback(() => {
    localStorage.setItem(LS_BANNER_DISMISSED, '1')
    setDismissed(true)
  }, [])
  return [dismissed, dismiss]
}

export function usePushNotifications(userId) {
  // Notification.permission が authoritative source
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'default'
  )
  // localStorage でページをまたいで購読済み状態を保持
  const [subscribed, setSubscribed] = useState(() => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    return localStorage.getItem(LS_SUBSCRIBED) === '1'
  })
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // 起動時: SW サブスクリプションの有無を確認して同期
  useEffect(() => {
    if (!userId || !isPushSupported()) return
    const perm = Notification.permission
    setPermission(perm)
    if (perm === 'denied') {
      setSubscribed(false)
      localStorage.removeItem(LS_SUBSCRIBED)
      return
    }
    if (perm === 'granted') {
      setSubscribed(true)
      localStorage.setItem(LS_SUBSCRIBED, '1')
    }
  }, [userId])

  const subscribe = useCallback(async () => {
    if (!isPushSupported()) {
      setErrorMsg('このブラウザはプッシュ通知に対応していません')
      return false
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      // ── Step 1: ブラウザに通知許可を求める（VAPID 不要）──
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm === 'denied') {
        setErrorMsg('通知がブロックされています。ブラウザ設定から変更してください。')
        setLoading(false)
        return false
      }
      if (perm !== 'granted') {
        setLoading(false)
        return false
      }

      // ── Step 2: Web Push サブスクリプション（VAPID が設定済みの場合のみ）──
      if (VAPID_PUBLIC_KEY && userId) {
        try {
          const reg = await navigator.serviceWorker.ready
          let sub = await reg.pushManager.getSubscription()
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            })
          }
          const { endpoint, keys } = sub.toJSON()

          // ── Step 3: Supabase に購読情報を保存（テーブル未作成でも続行）──
          const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
            user_id: userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            updated_at: new Date().toISOString(),
          })
          if (dbErr) {
            // テーブルが存在しなくてもアプリ内通知は機能するので続行
            console.warn('[Push] DB保存スキップ（テーブル未作成？）:', dbErr.message)
          }
        } catch (webPushErr) {
          // Web Push の失敗はアプリ内トーストに影響しないのでサイレント
          console.warn('[Push] Web Push登録スキップ:', webPushErr.message)
        }
      } else if (!VAPID_PUBLIC_KEY) {
        console.info('[Push] VITE_VAPID_PUBLIC_KEY 未設定 — アプリ内通知のみ有効')
      }

      // 許可されたので "購読済み" として記録
      setSubscribed(true)
      localStorage.setItem(LS_SUBSCRIBED, '1')
      setLoading(false)
      return true
    } catch (err) {
      console.error('[Push] subscribe error:', err)
      setErrorMsg('通知の設定中にエラーが発生しました')
      setLoading(false)
      return false
    }
  }, [userId])

  return { permission, subscribed, loading, errorMsg, subscribe }
}

// DM 送信後にバックグラウンドで Edge Function を呼び出す
export async function triggerPushNotification({ receiverId, senderName, senderId, content }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey || !VAPID_PUBLIC_KEY) return

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
    console.warn('[Push] Edge Function 呼び出しスキップ:', err.message)
  }
}
