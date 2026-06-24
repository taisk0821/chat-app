import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const UserContext = createContext(null)

// INSERT を試みて重複キーエラー(23505)なら UPDATE に切り替える
// upsert().select() の組み合わせによる問題を回避
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
      // 重複 → UPDATE
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
        const { ok, error } = await syncUserToDB(userData)
        if (!ok) setDbError(error?.message ?? 'DB同期エラー')
        else setDbError(null)
        setUser(userData)
      }
      setInitializing(false)
    }
    init()
  }, [])

  const login = async (nickname, bio, hobbies) => {
    let id = localStorage.getItem('chat_user_id')
    if (!id) {
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

  const logout = () => {
    localStorage.removeItem('chat_user')
    setUser(null)
    setDbError(null)
  }

  const updateProfile = async (bio, hobbies) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ bio, hobbies }).eq('id', user.id)
    if (error) { console.error('[DB] updateProfile失敗:', error.message); return }
    const updated = { ...user, bio, hobbies }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
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
    <UserContext.Provider value={{ user, login, logout, updateProfile, updateAvatar, dbError }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
