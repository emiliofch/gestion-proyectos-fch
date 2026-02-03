import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

const LOGO_URL = 'https://bisccrlqcixkaguspntw.supabase.co/storage/v1/object/public/public-assets/logo%20FCH.png'

export default function Login({ loading, setLoading }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')
  const [modo, setModo] = useState('login') // 'login', 'signup', 'forgot'

  async function login(e) {
    e.preventDefault()
    setErrorLogin('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorLogin(error.message)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }

  async function signup(e) {
    e.preventDefault()
    setErrorLogin('')

    if (password !== confirmPassword) {
      setErrorLogin('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setErrorLogin('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          primera_vez: true
        }
      }
    })

    if (error) {
      setErrorLogin(error.message)
      setLoading(false)
    } else {
      toast.success('Registro exitoso. Revisa tu correo para confirmar tu cuenta.')
      setModo('login')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setLoading(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setErrorLogin('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })

    if (error) {
      setErrorLogin(error.message)
      setLoading(false)
    } else {
      toast.success('Se ha enviado un correo para restablecer tu contraseña')
      setModo('login')
      setEmail('')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <img src={LOGO_URL} alt="Logo FCH" className="h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#FF5100' }}>DeskFlow CGV</h1>
          <p className="text-gray-600">
            {modo === 'login' && 'Inicia sesión para continuar'}
            {modo === 'signup' && 'Crea tu cuenta'}
            {modo === 'forgot' && 'Recupera tu contraseña'}
          </p>
        </div>

        {modo === 'login' && (
          <form onSubmit={login}>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                  title={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {mostrarPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="mb-6 text-right">
              <button
                type="button"
                onClick={() => setModo('forgot')}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {errorLogin && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {errorLogin}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-4"
              style={{ backgroundColor: '#FF5100' }}
            >
              Iniciar Sesión
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setModo('signup'); setErrorLogin('') }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ¿No tienes cuenta? <span className="text-orange-600 font-medium">Regístrate</span>
              </button>
            </div>
          </form>
        )}

        {modo === 'signup' && (
          <form onSubmit={signup}>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {mostrarPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Confirmar Contraseña</label>
              <input
                type={mostrarPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                minLength={6}
              />
            </div>

            {errorLogin && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {errorLogin}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-4"
              style={{ backgroundColor: '#FF5100' }}
            >
              Registrarse
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setModo('login'); setErrorLogin(''); setEmail(''); setPassword(''); setConfirmPassword('') }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ¿Ya tienes cuenta? <span className="text-orange-600 font-medium">Inicia sesión</span>
              </button>
            </div>
          </form>
        )}

        {modo === 'forgot' && (
          <form onSubmit={resetPassword}>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
              <p className="text-sm text-gray-600 mt-2">
                Te enviaremos un correo con instrucciones para restablecer tu contraseña.
              </p>
            </div>

            {errorLogin && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {errorLogin}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-4"
              style={{ backgroundColor: '#FF5100' }}
            >
              Enviar Correo
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setModo('login'); setErrorLogin(''); setEmail('') }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                <span className="text-orange-600 font-medium">← Volver al inicio de sesión</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
