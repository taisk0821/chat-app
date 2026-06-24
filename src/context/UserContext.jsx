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
    const userData = { id, nickname, bio: bio || '', hobbies: hobbies || '' }
    await supabase.from('users').upsert({
      id,
      nickname,
      bio: bio || '',
      hobbies: hobbies || '',
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

  // Heartbeat: update last_seen_at every 30s
  useEffect(() => {
    if (!user) return
    const tick = () =>
      supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [user?.id])

  return (
    <UserContext.Provider value={{ user, login, logout, updateProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
