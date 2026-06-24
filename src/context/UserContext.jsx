import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const UserContext = createContext(null)

// Upsert the user's core profile to DB (no avatar_url — added separately via updateAvatar)
async function syncUserToDB(userData) {
  const { error } = await supabase.from('users').upsert({
    id: userData.id,
    nickname: userData.nickname,
    bio: userData.bio || '',
    hobbies: userData.hobbies || '',
    last_seen_at: new Date().toISOString(),
  })
  if (error) console.error('[chat] DB sync failed:', error.message, error)
  return !error
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  // On mount: restore session from localStorage and sync to DB before rendering
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('chat_user')
      if (saved) {
        const userData = JSON.parse(saved)
        // Sync to DB first — this ensures the user appears in UsersPage immediately
        await syncUserToDB(userData)
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
    await syncUserToDB(userData)
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('chat_user')
    setUser(null)
  }

  const updateProfile = async (bio, hobbies) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ bio, hobbies }).eq('id', user.id)
    if (error) { console.error('[chat] updateProfile failed:', error.message); return }
    const updated = { ...user, bio, hobbies }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
  }

  const updateAvatar = async (avatarUrl) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id)
    if (error) { console.error('[chat] updateAvatar failed:', error.message); return }
    const updated = { ...user, avatar_url: avatarUrl }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
  }

  // Heartbeat: just update last_seen_at every 30s (no upsert — avoids column mismatch issues)
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
    <UserContext.Provider value={{ user, login, logout, updateProfile, updateAvatar }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
