import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

const LOGO_URL = 'https://bisccrlqcixkaguspntw.supabase.co/storage/v1/object/public/public-assets/FCh50-Eslogan_blanco.png'

export default function Login({ loading }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [empresa, setEmpresa] = useState('CGV')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')
  const [modo, setModo] = useState('login') // 'login', 'signup', 'forgot'
  const [authLoading, setAuthLoading] = useState(false)
  const ssoDomain = import.meta.env.VITE_SSO_DOMAIN
  const ssoProviderId = import.meta.env.VITE_SSO_PROVIDER_ID

  function emailNormalizado() {
    return String(email || '').trim().toLowerCase()
  }

  function mensajeAuth(error) {
    const msg = String(error?.message || '').toLowerCase()
    if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
    if (msg.includes('email not confirmed')) return 'Debes confirmar tu correo antes de iniciar sesión.'
    if (msg.includes('for security purposes')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.'
    return error?.message || 'No se pudo iniciar sesión.'
  }

  async function login(e) {
    e.preventDefault()
    setErrorLogin('')
    setAuthLoading(true)
    try {
      const emailLimpio = emailNormalizado()
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailLimpio, password })
      if (error) {
        setErrorLogin(mensajeAuth(error))
        return
      }

      if (!data?.session?.user) {
        setErrorLogin('No se pudo crear la sesion. Verifica confirmacion de correo y vuelve a intentar.')
      }
    } catch (error) {
      setErrorLogin(mensajeAuth(error))
    } finally {
      setAuthLoading(false)
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

    setAuthLoading(true)
    try {
      const emailLimpio = emailNormalizado()
      const { error } = await supabase.auth.signUp({
        email: emailLimpio,
        password,
        options: {
          data: {
            primera_vez: true,
            empresa: empresa
          }
        }
      })

      if (error) {
        setErrorLogin(mensajeAuth(error))
      } else {
        toast.success('Registro exitoso. Revisa tu correo para confirmar tu cuenta.')
        setModo('login')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setEmpresa('CGV')
      }
    } catch (error) {
      setErrorLogin(mensajeAuth(error))
    } finally {
      setAuthLoading(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setErrorLogin('')
    setAuthLoading(true)

    const emailLimpio = emailNormalizado()
    const { error } = await supabase.auth.resetPasswordForEmail(emailLimpio, {
      redirectTo: window.location.origin
    })

    if (error) {
      setErrorLogin(mensajeAuth(error))
      setAuthLoading(false)
    } else {
      toast.success('Se ha enviado un correo para restablecer tu contraseña')
      setModo('login')
      setEmail('')
      setAuthLoading(false)
    }
  }

  async function loginConMicrosoft() {
    setErrorLogin('')
    setAuthLoading(true)
    try {
      const redirectTo = window.location.origin
      const identifier = ssoProviderId
        ? { providerId: ssoProviderId }
        : (ssoDomain ? { domain: ssoDomain } : null)

      if (!identifier) {
        setErrorLogin('Falta configurar SSO. Define VITE_SSO_DOMAIN o VITE_SSO_PROVIDER_ID.')
        return
      }

      const { error } = await supabase.auth.signInWithSSO({
        ...identifier,
        options: { redirectTo },
      })

      if (error) {
        setErrorLogin(mensajeAuth(error))
      }
    } catch (error) {
      setErrorLogin(mensajeAuth(error))
    } finally {
      setAuthLoading(false)
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
            <button
              type="button"
              onClick={loginConMicrosoft}
              disabled={loading || authLoading}
              className="w-full py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium transition-all disabled:opacity-50 mb-4"
            >
              Ingresar con Microsoft 365
            </button>

            <div className="mb-4 text-center text-xs text-gray-500">o ingresa con email y contraseña</div>

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
              disabled={loading || authLoading}
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

            <div className="mb-4">
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

            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Empresa</label>
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              >
                <option value="CGV">CGV</option>
                <option value="HUB_MET">HUB MET</option>
              </select>
            </div>

            {errorLogin && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {errorLogin}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-4"
              style={{ backgroundColor: '#FF5100' }}
            >
              Registrarse
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setModo('login'); setErrorLogin(''); setEmail(''); setPassword(''); setConfirmPassword(''); setEmpresa('CGV') }}
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
              disabled={loading || authLoading}
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
