import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

export default function ConfiguracionUsuarios({ user }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState('usuario')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    const { data } = await supabase.from('perfiles').select('*')
    setUsuarios(data || [])
  }

  async function invitarUsuario(e) {
    e.preventDefault()
    if (!nuevoEmail) return toast.warning('Ingrese un email')

    setLoading(true)
    setMensaje('')

    // Obtener datos del admin que invita
    const { data: adminData } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
    const adminNombre = adminData?.email || 'El administrador'

    // Generar magic link
    const redirectUrl = window.location.origin
    const { data, error } = await supabase.auth.signInWithOtp({
      email: nuevoEmail,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          rol: nuevoRol,
          invitado_por: adminNombre
        }
      }
    })

    if (error) {
      toast.error('Error: ' + error.message)
      setLoading(false)
      return
    }

    setMensaje(`✅ Invitación enviada exitosamente a ${nuevoEmail}`)
    setNuevoEmail('')
    setNuevoRol('usuario')
    
    setTimeout(() => setMensaje(''), 5000)
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Configuración - Gestión de Usuarios</h2>
      
      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Invitar Nuevo Usuario</h3>
        <form onSubmit={invitarUsuario} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Email</label>
            <input
              type="email"
              value={nuevoEmail}
              onChange={(e) => setNuevoEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Rol</label>
            <select
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FF5100' }}
          >
            {loading ? 'Enviando invitación...' : 'Enviar Invitación por Email'}
          </button>
          {mensaje && (
            <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm">
              {mensaje}
            </div>
          )}
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-bold text-blue-900 mb-2">📧 Template del Email de Invitación</h4>
        <p className="text-sm text-blue-800 mb-2">El usuario recibirá un email con:</p>
        <ul className="text-sm text-blue-700 space-y-1 ml-4">
          <li>• Logo de FCH</li>
          <li>• Mensaje de bienvenida (indicando quién lo invitó)</li>
          <li>• Botón naranja para "Configurar mi cuenta"</li>
          <li>• Link válido por 24 horas</li>
        </ul>
      </div>

      <div className="overflow-x-auto">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Usuarios Registrados</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Email</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Rol</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Fecha Creación</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-800">{u.email}</td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${u.rol === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-800 text-sm">{new Date(u.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
