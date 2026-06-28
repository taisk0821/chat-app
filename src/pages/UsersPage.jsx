import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'
import { PREFECTURES, GENDERS, GENDER_LABEL } from '../constants/profile'
import { triggerPushNotification } from '../hooks/usePushNotifications'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

function Avatar({ u }) {
  if (u.avatar_url) {
    return <img src={u.avatar_url} alt={u.nickname} className="w-11 h-11 rounded-full object-cover" />
  }
  return (
    <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
      {u.nickname[0].toUpperCase()}
    </div>
  )
}

// ---- 絞り込みパネル ----
function FilterPanel({ filters, onChange, onReset, count }) {
  const [open, setOpen] = useState(false)
  const hasFilter = filters.gender !== '' || filters.ageMin !== '' || filters.ageMax !== '' || filters.prefecture !== ''

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* トグルヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-500">
            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
          </svg>
          絞り込み
          {hasFilter && (
            <span className="bg-indigo-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              ON
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{count}人</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {/* フィルター詳細 */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* 性別 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">性別</label>
            <div className="flex flex-wrap gap-2">
              {[{ value: '', label: 'すべて' }, ...GENDERS].map((g) => (
                <button
                  key={g.value}
                  onClick={() => onChange('gender', g.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
                    filters.gender === g.value
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* 年齢範囲 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">年齢</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={120} placeholder="下限"
                value={filters.ageMin}
                onChange={(e) => onChange('ageMin', e.target.value)}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-sm text-gray-400">〜</span>
              <input
                type="number" min={0} max={120} placeholder="上限"
                value={filters.ageMax}
                onChange={(e) => onChange('ageMax', e.target.value)}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-sm text-gray-500">歳</span>
            </div>
          </div>

          {/* 居住地 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">居住地</label>
            <select
              value={filters.prefecture}
              onChange={(e) => onChange('prefecture', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">すべて</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* リセット */}
          {hasFilter && (
            <button
              onClick={onReset}
              className="w-full text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl py-2 transition"
            >
              フィルターをリセット
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---- ユーザーカード ----
// requestStatus: undefined | 'pending' | 'accepted' | 'rejected'
function UserCard({ u, me, requestStatus, onSendRequest }) {
  const navigate = useNavigate()
  const online = isOnline(u.last_seen_at)

  const badges = []
  if (u.age) badges.push(`${u.age}歳`)
  if (u.gender && u.gender !== 'private') badges.push(GENDER_LABEL[u.gender])
  if (u.prefecture) badges.push(u.prefecture)

  // 右側ボタンの設定
  const getButton = () => {
    if (!u.is_private) {
      return {
        label: '話しかける',
        cls: 'bg-indigo-500 hover:bg-indigo-600 text-white',
        disabled: false,
        onClick: () => navigate(`/dm/${u.id}`),
      }
    }
    if (requestStatus === 'accepted') {
      return {
        label: '💬 話しかける',
        cls: 'bg-indigo-500 hover:bg-indigo-600 text-white',
        disabled: false,
        onClick: () => navigate(`/dm/${u.id}`),
      }
    }
    if (requestStatus === 'pending') {
      return {
        label: '🕐 申請済み',
        cls: 'bg-gray-100 text-gray-400 cursor-not-allowed',
        disabled: true,
        onClick: () => {},
      }
    }
    // 未申請 or 拒否済み
    return {
      label: '🔒 申請する',
      cls: 'border border-indigo-300 text-indigo-600 hover:bg-indigo-50',
      disabled: false,
      onClick: () => onSendRequest(u.id, u.nickname),
    }
  }

  const btn = getButton()

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
      <button
        onClick={() => navigate(`/profile/${u.id}`)}
        className="flex items-center gap-3 min-w-0 text-left flex-1 hover:opacity-80 transition"
      >
        <div className="relative shrink-0">
          <Avatar u={u} />
          {online && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{u.nickname}</span>
            {u.is_private && (
              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">🔒</span>
            )}
            {u.id === me.id && (
              <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">あなた</span>
            )}
            {online && (
              <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">オンライン</span>
            )}
          </div>
          {badges.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {badges.map((b) => (
                <span key={b} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{b}</span>
              ))}
            </div>
          )}
          {u.bio && <p className="text-xs text-gray-400 mt-0.5 truncate">{u.bio}</p>}
        </div>
      </button>
      {u.id !== me.id && (
        <button
          onClick={btn.onClick}
          disabled={btn.disabled}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-xl transition font-medium ${btn.cls}`}
        >
          {btn.label}
        </button>
      )}
    </div>
  )
}

// ---- DB診断パネル ----
function DiagPanel({ user, onRetryRegister }) {
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    const out = {}
    const { data: rows, error: selErr } = await supabase.from('users').select('id, nickname, created_at').limit(10)
    out.select = selErr ? { error: `${selErr.code}: ${selErr.message}` } : { count: rows.length, rows }
    const { error: insErr } = await supabase.from('users').insert({
      id: user.id, nickname: user.nickname, bio: user.bio || '', hobbies: user.hobbies || '',
      last_seen_at: new Date().toISOString(),
    })
    if (insErr?.code === '23505') out.insert = '既に存在（正常）'
    else if (insErr) out.insert = { error: `${insErr.code}: ${insErr.message}` }
    else out.insert = '新規登録成功'
    setResult(out)
    setRunning(false)
    onRetryRegister()
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-600">🔍 DB診断</span>
        <button onClick={run} disabled={running}
          className="bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg">
          {running ? '診断中...' : '診断を実行'}
        </button>
      </div>
      <div className="text-gray-500">
        <p>ユーザーID: <span className="font-mono text-gray-700 break-all">{user.id}</span></p>
        <p>ニックネーム: {user.nickname}</p>
      </div>
      {result && (
        <pre className="bg-white border border-gray-200 rounded-lg p-2 overflow-auto max-h-48 text-gray-700">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---- メインページ ----
export default function UsersPage() {
  const { user, dbError } = useUser()
  const navigate = useNavigate()
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [filters, setFilters]     = useState({ gender: '', ageMin: '', ageMax: '', prefecture: '' })
  // { [receiverId]: 'pending'|'accepted'|'rejected' }
  const [myRequests, setMyRequests] = useState({})

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users').select('*').order('last_seen_at', { ascending: false })
    if (error) {
      setFetchError(`${error.code}: ${error.message}`)
      setLoading(false); return
    }
    setFetchError(null)
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
    const channel = supabase
      .channel('realtime:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchUsers])

  // 自分が送った DM 申請を一括取得
  useEffect(() => {
    supabase
      .from('dm_requests')
      .select('receiver_id, status')
      .eq('sender_id', user.id)
      .then(({ data }) => {
        const map = {}
        ;(data ?? []).forEach((r) => { map[r.receiver_id] = r.status })
        setMyRequests(map)
      })
  }, [user.id])

  // 申請を送信してプッシュ通知を送る
  const handleSendRequest = async (targetId, targetNickname) => {
    setMyRequests((prev) => ({ ...prev, [targetId]: 'pending' })) // 楽観的更新
    const { error } = await supabase.from('dm_requests').upsert(
      { sender_id: user.id, sender_nickname: user.nickname, receiver_id: targetId, status: 'pending' },
      { onConflict: 'sender_id,receiver_id' }
    )
    if (!error) {
      triggerPushNotification({
        receiverId: targetId,
        senderName: user.nickname,
        senderId: user.id,
        content: 'DMの申請が届いています',
      })
    } else {
      setMyRequests((prev) => ({ ...prev, [targetId]: undefined }))
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleFilterReset = () => {
    setFilters({ gender: '', ageMin: '', ageMax: '', prefecture: '' })
  }

  // クライアントサイドでフィルタリング
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filters.gender && u.gender !== filters.gender) return false
      if (filters.ageMin !== '' && (u.age == null || u.age < Number(filters.ageMin))) return false
      if (filters.ageMax !== '' && (u.age == null || u.age > Number(filters.ageMax))) return false
      if (filters.prefecture && u.prefecture !== filters.prefecture) return false
      return true
    })
  }, [users, filters])

  const anyError = dbError || fetchError
  const showDiag = anyError || (!loading && users.length === 0)

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">👥 ユーザー一覧</p>
        <button onClick={fetchUsers}
          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg px-2.5 py-1 transition">
          再読み込み
        </button>
      </div>

      {anyError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
          <p className="font-semibold">⚠ エラー: {anyError}</p>
        </div>
      )}

      {/* フィルターパネル */}
      <FilterPanel
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
        count={filteredUsers.length}
      />

      {loading && (
        <p className="text-center text-gray-400 text-sm py-4">読み込み中...</p>
      )}

      {!loading && filteredUsers.length === 0 && !anyError && (
        <p className="text-center text-gray-400 text-sm py-4">
          {users.length > 0 ? '条件に一致するユーザーがいません' : 'ユーザーがいません'}
        </p>
      )}

      {filteredUsers.map((u) => (
        <UserCard
          key={u.id}
          u={u}
          me={user}
          requestStatus={myRequests[u.id]}
          onSendRequest={handleSendRequest}
        />
      ))}

      {showDiag && (
        <DiagPanel user={user} onRetryRegister={fetchUsers} />
      )}
    </div>
  )
}
