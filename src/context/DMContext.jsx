import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useUser } from './UserContext'

const DMContext = createContext(null)

// localStorage キー: 最後に既読にした日時
const readKey = (myId, partnerId) => `dm_read_${myId}_${partnerId}`

export function DMProvider({ children }) {
  const { user } = useUser()
  // { [partnerId]: number } 未読件数
  const [unreadByPartner, setUnreadByPartner] = useState({})
  // { senderId, senderName, content } | null
  const [notification, setNotification] = useState(null)
  const timerRef = useRef(null)

  // 既読マーク: DM画面を開いたときに呼ぶ
  const markRead = useCallback((partnerId) => {
    if (!user) return
    localStorage.setItem(readKey(user.id, partnerId), new Date().toISOString())
    setUnreadByPartner((prev) => {
      const next = { ...prev }
      delete next[partnerId]
      return next
    })
  }, [user?.id])

  // 初期化: アプリ起動時に過去の未読を計算
  useEffect(() => {
    if (!user) return
    const compute = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('sender_id, created_at')
        .eq('receiver_id', user.id)
      if (!data) return
      const counts = {}
      for (const msg of data) {
        const last = localStorage.getItem(readKey(user.id, msg.sender_id))
        if (!last || new Date(msg.created_at) > new Date(last)) {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1
        }
      }
      setUnreadByPartner(counts)
    }
    compute()
  }, [user?.id])

  // グローバル購読: 自分宛ての新着DM
  const locationRef = useRef(window.location.pathname)
  useEffect(() => {
    const onNav = () => { locationRef.current = window.location.pathname }
    window.addEventListener('popstate', onNav)
    return () => window.removeEventListener('popstate', onNav)
  }, [])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`dm-global-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const msg = payload.new
          // 未読カウントに追加
          setUnreadByPartner((prev) => ({
            ...prev,
            [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
          }))
          // 現在そのDM画面を開いていれば通知不要
          if (locationRef.current === `/dm/${msg.sender_id}`) {
            markRead(msg.sender_id)
            return
          }
          // 送信者名を取得してトースト表示
          const { data: sender } = await supabase
            .from('users').select('nickname').eq('id', msg.sender_id).single()
          if (timerRef.current) clearTimeout(timerRef.current)
          setNotification({
            senderId: msg.sender_id,
            senderName: sender?.nickname ?? '誰か',
            content: msg.content,
          })
          timerRef.current = setTimeout(() => setNotification(null), 5000)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user?.id, markRead])

  const totalUnread = Object.values(unreadByPartner).reduce((a, b) => a + b, 0)

  return (
    <DMContext.Provider value={{ unreadByPartner, totalUnread, markRead, notification, setNotification }}>
      {children}
    </DMContext.Provider>
  )
}

export const useDM = () => useContext(DMContext)
