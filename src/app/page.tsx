'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
    } else {
      router.push('/map')
    }
    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>App Mãe</h1>
        <p style={styles.subtitle}>Monitoramento de localização</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input}
            placeholder="seu@email.com"
            required
          />

          <label style={styles.label}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            placeholder="••••••••"
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 4,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    marginBottom: 2,
  },
  input: {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1.5px solid #ddd',
    fontSize: 15,
    outline: 'none',
    marginBottom: 12,
    transition: 'border-color 0.2s',
  },
  button: {
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
  error: {
    color: '#e53e3e',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
}
