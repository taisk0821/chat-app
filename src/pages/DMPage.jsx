import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'
import { useDM } from '../context/DMContext'
import { triggerPushNotification } from '../hooks/usePushNotifications'

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

// アクティブマッチを取得（双方向）
async function fetchActiveMatch(userId, partnerId) {
  const { data } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, created_at')
    .or(
      `and(user1_id.eq.${userId},user2_id.eq.${partnerId}),and(user1_id.eq.${partnerId},user2_id.eq.${userId})`
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

export default function DMPage() {
  const { userId } = useParams()
  const { user } = useUser()
  const { markRead } = useDM()
  const navigate = useNavigate()

  const [partner, setPartner]         = useState(null)
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [access, setAccess]           = useState('loading') // 'loading'|'granted'|'blocked'
  const [activeMatch, setActiveMatch] = useState(null)      // null | { id, ... }
  const [unmatching, setUnmatching]   = useState(false)
  const [unmatchError, setUnmatchError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (userId) markRead(userId)
  }, [userId, markRead])

  useEffect(() => {
    supabase.from('users').select('*').eq('id', userId).single()
      .then(({ data }) => {
        if (!data) navigate('/users')
        else setPartner(data)
      })
  }, [userId, navigate])

  // アクセス権チェック：マッチ or DM申請承認 or 非鍵アカ
  useEffect(() => {
    if (!partner || !user) return

    const check = async () => {
      // ブロックチェック（双方向）
      const { data: blockData } = await supabase
        .from('blocks')
        .select('id')
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.eq.${partner.id}),and(blocker_id.eq.${partner.id},blocked_id.eq.${user.id})`
        )
        .maybeSingle()
      if (blockData) { setAccess('blocked'); return }

      // まずアクティブマッチを確認（プライベート問わず取得）
      const match = await fetchActiveMatch(user.id, partner.id)
      setActiveMatch(match)

      // 非鍵アカ or マッチ中ならアクセス許可
      if (!partner.is_private || match) {
        setAccess('granted')
        return
      }

      // 鍵アカ：DM申請の承認を確認
      const { data: dmData } = await supabase
        .from('dm_requests')
        .select('status')
        .eq('sender_id', user.id)
        .eq('receiver_id', partner.id)
        .eq('status', 'accepted')
        .maybeSingle()

      if (dmData) {
        setAccess('granted')
      } else {
        navigate(`/profile/${partner.id}`, { replace: true })
      }
    }

    check()
  }, [partner?.id, user?.id, navigate])

  // メッセージ取得 + リアルタイム購読
  useEffect(() => {
    if (!user) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(100)
      if (data) setMessages(data)
    }
    fetchMessages()

    const channelName = `dm:${[user.id, userId].sort().join(':')}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new
        const relevant =
          (msg.sender_id === user.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === user.id)
        if (!relevant) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (msg.sender_id === userId) markRead(userId)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const { error } = await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content: text,
    })
    if (!error) {
      triggerPushNotification({ receiverId: userId, senderName: user.nickname, senderId: user.id, content: text })
    }
    setSending(false)
  }

  // マッチ解除
  const handleUnmatch = async () => {
    if (!activeMatch || unmatching) return
    setUnmatching(true)
    setUnmatchError('')

    const { error } = await supabase
      .from('matches')
      .update({ status: 'unmatched' })
      .eq('id', activeMatch.id)

    if (error) {
      setUnmatchError(`解除に失敗しました: ${error.message}`)
      setUnmatching(false)
      return
    }

    // 相手に通知
    triggerPushNotification({
      receiverId: partner.id,
      senderName: user.nickname,
      senderId: user.id,
      content: `${user.nickname}さんがマッチを解除しました`,
    })

    setActiveMatch(null)
    setUnmatching(false)
    navigate('/users')
  }

  if (access === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  if (access === 'blocked') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="text-5xl">🚫</div>
          <h2 className="text-base font-bold text-gray-800">メッセージを送れません</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            ブロックが有効なため、このユーザーとのDMはご利用いただけません。
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 text-sm text-indigo-500 hover:text-indigo-700 font-medium"
          >
            ← 戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pb-4"
      style={{ height: 'calc(100dvh - 52px - 56px - env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden mt-4">

        {/* ── ヘッダー ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => navigate('/users')} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ←
          </button>
          {partner && (
            <>
              {partner.avatar_url ? (
                <img src={partner.avatar_url} alt={partner.nickname} className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                  {partner.nickname[0].toUpperCase()}
                </div>
              )}
              <button onClick={() => navigate(`/profile/${partner.id}`)} className="text-left hover:opacity-70 transition min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{partner.nickname}</p>
                  {activeMatch && (
                    <span className="shrink-0 text-[10px] bg-pink-100 text-pink-600 font-bold px-1.5 py-0.5 rounded-full">
                      🎲 マッチ中
                    </span>
                  )}
                </div>
                {partner.bio && <p className="text-xs text-gray-400 truncate">{partner.bio}</p>}
              </button>
            </>
          )}
          {/* マッチ解除ボタン */}
          {activeMatch && (
            <button
              onClick={handleUnmatch}
              disabled={unmatching}
              className="shrink-0 text-xs font-medium text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-3 py-1.5 transition disabled:opacity-50"
            >
              {unmatching ? '...' : 'マッチ解除'}
            </button>
          )}
        </div>

        {/* マッチ解除エラー */}
        {unmatchError && (
          <div className="mx-4 mt-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            ⚠ {unmatchError}
          </div>
        )}

        {/* マッチ通知バナー（マッチ直後に表示） */}
        {activeMatch && messages.length === 0 && (
          <div className="mx-4 mt-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl px-4 py-3 text-center">
            <p className="text-sm font-semibold text-indigo-700">🎲 マッチしました！</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {partner?.nickname}さんに最初のメッセージを送りましょう
            </p>
          </div>
        )}

        {/* ── メッセージ一覧 ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !activeMatch && (
            <p className="text-center text-gray-400 text-sm mt-8">
              {partner ? `${partner.nickname}さんへ最初のメッセージを送ってみましょう` : 'メッセージはまだありません'}
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id
            return (
              <div key={msg.id} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-2 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words ${
                    isMe ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p>{msg.content}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── 入力欄 ── */}
        <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            placeholder={`${partner?.nickname ?? ''}さんにメッセージ...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white rounded-xl px-4 py-2.5 transition font-medium text-sm"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  )
}
