import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('chat_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = async (nickname, bio, hobbies) => {
    let id = localStorage.getItem('chat_user_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('chat_user_id', id)
    }
    const userData = { id, nickname, bio: bio || '', hobbies: hobbies || '', avatar_url: null }
    await supabase.from('users').upsert({
      id,
      nickname,
      bio: bio || '',
      hobbies: hobbies || '',
      avatar_url: null,
      last_seen_at: new Date().toISOString(),
    })
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('chat_user')
    setUser(null)
  }

  const updateProfile = async (bio, hobbies) => {
    if (!user) return
    await supabase.from('users').update({ bio, hobbies }).eq('id', user.id)
    const updated = { ...user, bio, hobbies }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
  }

  const updateAvatar = async (avatarUrl) => {
    if (!user) return
    await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id)
    const updated = { ...user, avatar_url: avatarUrl }
    localStorage.setItem('chat_user', JSON.stringify(updated))
    setUser(updated)
  }

  // Heartbeat: upsert every 30s to keep last_seen_at fresh and ensure user exists in DB
  useEffect(() => {
    if (!user) return
    const tick = () =>
      supabase.from('users').upsert({
        id: user.id,
        nickname: user.nickname,
        bio: user.bio || '',
        hobbies: user.hobbies || '',
        avatar_url: user.avatar_url || null,
        last_seen_at: new Date().toISOString(),
      })
    tick()
    const intervalId = setInterval(tick, 30000)
    return () => clearInterval(intervalId)
  }, [user?.id])

  return (
    <UserContext.Provider value={{ user, login, logout, updateProfile, updateAvatar }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
