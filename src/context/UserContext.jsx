import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const UserContext = createContext(null)

// UUIDがSupabaseのusersテーブルに存在するか確認
async function userExistsInDB(id) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  return !!data
}

// 全ユーザー関連localStorageキーを消去
function clearAllUserStorage(userId) {
  // dm_read プレフィックスのキーを収集
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (userId ? key.startsWith(`dm_read_${userId}_`) : key.startsWith('dm_read_'))) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
  localStorage.removeItem('chat_user')
  localStorage.removeItem('chat_user_id')
}

// INSERT → 23505(重複) → UPDATE のフォールバック
async function syncUserToDB(userData) {
  const payload = {
    id: userData.id,
    nickname: userData.nickname,
    bio: userData.bio || '',
    hobbies: userData.hobbies || '',
    last_seen_at: new Date().toISOString(),
  }

  const { error: insertError } = await supabase.from('users').insert(payload)

  if (insertError) {
    if (insertError.code === '23505') {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          nickname: payload.nickname,
          bio: payload.bio,
          hobbies: payload.hobbies,
          last_seen_at: payload.last_seen_at,
        })
        .eq('id', payload.id)

      if (updateError) {
        console.error('[DB] UPDATE失敗:', updateError)
        return { ok: false, error: updateError }
      }
      console.log('[DB] UPDATE成功:', payload.nickname)
      return { ok: true }
    }

    console.error('[DB] INSERT失敗:', insertError)
    return { ok: false, error: insertError }
  }

  console.log('[DB] INSERT成功:', payload.nickname)
  return { ok: true }
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [dbError, setDbError] = useState(null)

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('chat_user')
      if (saved) {
        const userData = JSON.parse(saved)

        // DBから最新プロフィールを取得（age/gender/prefecture 等を含む）
        const { data: dbUser } = await supabase
          .from('users').select('*').eq('id', userData.id).maybeSingle()

        if (!dbUser) {
          // DB に存在しない → 強制ログアウト（削除済みアカウントの復活防止）
          console.log('[init] UUIDがDBに存在しないため強制ログアウト:', userData.id)
          clearAllUserStorage(userData.id)
          setInitializing(false)
          return
        }

        // DB の最新値を localStorage に統合してセット
        const merged = {
          ...userData,
          nickname: dbUser.nickname,
          bio: dbUser.bio ?? '',
          hobbies: dbUser.hobbies ?? '',
          age: dbUser.age ?? null,
          gender: dbUser.gender ?? null,
          prefecture: dbUser.prefecture ?? null,
          is_private: dbUser.is_private ?? false,
          avatar_url: dbUser.avatar_url ?? userData.avatar_url ?? null,
        }
        localStorage.setItem('chat_user', JSON.stringify(merged))
        setUser(merged)

        // last_seen_at を更新
        supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userData.id)
      }
      setInitializing(false)
    }
    init()
  }, [])

  const login = async (nickname, bio, hobbies) => {
    let id = localStorage.getItem('chat_user_id')

    if (id) {
      // UUIDがDBに存在するか確認（削除済みIDの再利用を防ぐ）
      const exists = await userExistsInDB(id)
      if (!exists) {
        console.log('[login] 削除済みUUIDのため新規発行:', id)
        id = crypto.randomUUID()
        localStorage.setItem('chat_user_id', id)
      }
    } else {
      id = crypto.randomUUID()
      localStorage.setItem('chat_user_id', id)
    }

    const userData = { id, nickname, bio: bio || '', hobbies: hobbies || '', avatar_url: null }
    const { ok, error } = await syncUserToDB(userData)
    const errMsg = ok ? null : (error?.message ?? 'DB同期エラー')
    setDbError(errMsg)
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setUser(userData)
    return { ok, errMsg }
  }

  // 通常ログアウト: chat_user のみ消去（UUID は保持して再ログイン可能にする）
  const logout = () => {
    localStorage.removeItem('chat_user')
    setUser(null)
    setDbError(null)
  }

  // アカウント削除完了後に呼ぶ: UUID を含む全データを消去
  const clearAccountStorage = (userId) => {
    clearAllUserStorage(userId)
    setUser(null)
    setDbError(null)
  }

  const updateProfile = async (bio, hobbies, age, gender, prefecture, isPrivate = false) => {
    if (!user) return { ok: false, error: 'ユーザー未ログイン' }
    const patch = {
      bio,
      hobbies,
      age: age !== '' && age !== null && age !== undefined ? Number(age) : null,
      gender: gender || null,
      prefecture: prefecture || null,
      is_private: isPrivate === true,
    }
    const { error } = await supabase.from('users').update(patch).eq('id', user.id)
    if (error) {
      console.error('[DB] updateProfile失敗:', error.message, error.code)
      return { ok: false, error: error.message }
    }
    const updated = { ...user, ...patch }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
    return { ok: true }
  }

  const updateAvatar = async (avatarUrl) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id)
    if (error) { console.error('[DB] updateAvatar失敗:', error.message); return }
    const updated = { ...user, avatar_url: avatarUrl }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
  }

  // Heartbeat: last_seen_at を 30 秒ごとに更新
  useEffect(() => {
    if (!user) return
    const tick = () =>
      supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
    const intervalId = setInterval(tick, 30000)
    return () => clearInterval(intervalId)
  }, [user?.id])

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <UserContext.Provider value={{ user, login, logout, clearAccountStorage, updateProfile, updateAvatar, dbError }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
