import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const UserContext = createContext(null)

async function syncUserToDB(userData) {
  // .select() を付けることで upsert のエラーが正確に返るようになる
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: userData.id,
        nickname: userData.nickname,
        bio: userData.bio || '',
        hobbies: userData.hobbies || '',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()

  if (error) {
    console.error('[chat] syncUserToDB 失敗:', error.code, error.message, error.details)
    return { ok: false, error }
  }
  console.log('[chat] syncUserToDB 成功:', data)
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
        if (!ok) setDbError(error?.message || 'DB同期エラー')
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
    if (!ok) {
      console.error('[chat] login DB sync 失敗:', error)
      setDbError(error?.message || 'DB同期エラー')
    } else {
      setDbError(null)
    }
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('chat_user')
    setUser(null)
    setDbError(null)
  }

  const updateProfile = async (bio, hobbies) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ bio, hobbies }).eq('id', user.id)
    if (error) { console.error('[chat] updateProfile 失敗:', error.message); return }
    const updated = { ...user, bio, hobbies }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
  }

  const updateAvatar = async (avatarUrl) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id)
    if (error) { console.error('[chat] updateAvatar 失敗:', error.message); return }
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
