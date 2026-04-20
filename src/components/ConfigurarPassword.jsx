import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

const LOGO_URL = 'https://bisccrlqcixkaguspntw.supabase.co/storage/v1/object/public/public-assets/FCh50-Eslogan_blanco.png'

export default function ConfigurarPassword({ user, perfil, setPerfil, onDone }) {
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function configurar(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    toast.success('¡Contraseña actualizada exitosamente!')

    if (onDone) {
      onDone()
      return
    }

    // Flujo primera vez: marcar perfil y recargar
    await supabase.from('perfiles').update({ primera_vez: false }).eq('id', user.id)
    setPerfil({ ...perfil, primera_vez: false })
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <img src={LOGO_URL} alt="Logo FCH" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#FF5100' }}>{onDone ? 'Restablecer Contraseña' : 'Configura tu Contraseña'}</h1>
          <p className="text-gray-600">{user.email}</p>
          <p className="text-gray-500 text-sm mt-2">{onDone ? 'Ingresa tu nueva contraseña.' : 'Por favor, crea una contraseña segura para tu cuenta.'}</p>
        </div>
        
        <form onSubmit={configurar}>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Nueva Contraseña</label>
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
                {mostrarPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">Mínimo 6 caracteres</p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">Confirmar Contraseña</label>
            <div className="relative">
              <input
                type={mostrarConfirmar ? "text" : "password"}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
              >
                {mostrarConfirmar ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FF5100' }}
          >
            {loading ? 'Configurando...' : 'Configurar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
