import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'
import { useDM } from '../context/DMContext'

// ---- DM申請セクション ----
function DMRequestsSection({ userId }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('dm_requests')
      .select('*')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchRequests()
    const ch = supabase
      .channel('dm_requests_talks')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dm_requests',
        filter: `receiver_id=eq.${userId}`,
      }, fetchRequests)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchRequests, userId])

  const respond = async (requestId, senderId, status) => {
    await supabase.from('dm_requests').update({ status }).eq('id', requestId)
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
    if (status === 'accepted') navigate(`/dm/${senderId}`)
  }

  if (loading || requests.length === 0) return null

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">
        🔒 DM申請
        <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{requests.length}</span>
      </p>
      <div className="space-y-2 mb-4">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{req.sender_nickname}</p>
                <p className="text-xs text-gray-400 mt-0.5">DMの申請が届いています</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => respond(req.id, req.sender_id, 'accepted')}
                  className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl transition font-medium"
                >
                  承認
                </button>
                <button
                  onClick={() => respond(req.id, req.sender_id, 'rejected')}
                  className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-xl transition"
                >
                  拒否
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 mb-4" />
    </div>
  )
}

function formatTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now - d
  const diffH = diffMs / 1000 / 3600
  if (diffH < 24) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function Avatar({ u }) {
  if (u?.avatar_url) {
    return <img src={u.avatar_url} alt={u.nickname} className="w-12 h-12 rounded-full object-cover" />
  }
  return (
    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
      {(u?.nickname ?? '?')[0].toUpperCase()}
    </div>
  )
}

export default function TalksPage() {
  const { user } = useUser()
  const { unreadByPartner, markRead } = useDM()
  const navigate = useNavigate()
  const [talks, setTalks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTalks = useCallback(async () => {
    setLoading(true)

    // 自分が絡む全DM（最新順）
    const { data: messages } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!messages || messages.length === 0) { setTalks([]); setLoading(false); return }

    // 相手IDの一覧（重複なし・順序保持）
    const seen = new Set()
    const partnerIds = []
    for (const m of messages) {
      const pid = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!seen.has(pid)) { seen.add(pid); partnerIds.push(pid) }
    }

    // 相手プロフィール取得
    const { data: partners } = await supabase
      .from('users').select('*').in('id', partnerIds)

    const partnerMap = Object.fromEntries((partners ?? []).map((p) => [p.id, p]))

    // トーク一覧を組み立て
    const result = partnerIds.map((pid) => {
      const thread = messages.filter(
        (m) =>
          (m.sender_id === pid && m.receiver_id === user.id) ||
          (m.sender_id === user.id && m.receiver_id === pid)
      )
      const lastMsg = thread[0]
      return {
        partner: partnerMap[pid],
        lastMsg,
        unread: unreadByPartner[pid] ?? 0,
      }
    })

    setTalks(result)
    setLoading(false)
  }, [user?.id, unreadByPartner])

  useEffect(() => {
    fetchTalks()
  }, [fetchTalks])

  const openDM = (partnerId) => {
    markRead(partnerId)
    navigate(`/dm/${partnerId}`)
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-2">
      {/* DM申請セクション（鍵アカウント向け） */}
      <DMRequestsSection userId={user.id} />
      <p className="text-sm font-semibold text-gray-700">📨 トーク一覧</p>

      {loading && <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>}

      {!loading && talks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">まだトークがありません</p>
          <p className="text-gray-300 text-xs mt-1">ユーザー一覧から話しかけてみましょう</p>
          <button
            onClick={() => navigate('/users')}
            className="mt-4 text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl transition"
          >
            ユーザー一覧へ
          </button>
        </div>
      )}

      {talks.map(({ partner, lastMsg, unread }) => (
        <button
          key={partner?.id ?? lastMsg.sender_id}
          onClick={() => openDM(partner?.id ?? lastMsg.sender_id)}
          className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 hover:bg-indigo-50 transition text-left"
        >
          <div className="relative shrink-0">
            <Avatar u={partner} />
            {unread > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold truncate ${unread > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                {partner?.nickname ?? '不明なユーザー'}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{lastMsg ? formatTime(lastMsg.created_at) : ''}</span>
            </div>
            <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {lastMsg
                ? `${lastMsg.sender_id === user.id ? 'あなた: ' : ''}${lastMsg.content}`
                : ''}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
