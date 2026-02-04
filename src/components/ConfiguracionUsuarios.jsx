import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

export default function ConfiguracionUsuarios({ user }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState('usuario')
  const [nuevaEmpresa, setNuevaEmpresa] = useState('CGV')
  const [mensaje, setMensaje] = useState('')

  // Estado para configuración de correos
  const [correosCGV, setCorreosCGV] = useState([])
  const [correosHUBMET, setCorreosHUBMET] = useState([])
  const [nuevoCorreoCGV, setNuevoCorreoCGV] = useState('')
  const [nuevoCorreoHUBMET, setNuevoCorreoHUBMET] = useState('')
  const [guardandoCorreos, setGuardandoCorreos] = useState(false)

  useEffect(() => {
    cargarUsuarios()
    cargarConfiguracionCorreos()
  }, [])

  async function cargarUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false })
    setUsuarios(data || [])
  }

  async function cargarConfiguracionCorreos() {
    const { data, error } = await supabase.from('configuracion_emails').select('*')
    if (error) {
      console.error('Error cargando config emails:', error)
      return
    }

    const cgvConfig = data?.find(c => c.tipo === 'CGV')
    const hubmetConfig = data?.find(c => c.tipo === 'HUB_MET')

    setCorreosCGV(cgvConfig?.correos || [])
    setCorreosHUBMET(hubmetConfig?.correos || [])
  }

  async function invitarUsuario(e) {
    e.preventDefault()
    if (!nuevoEmail) return toast.warning('Ingrese un email')

    setLoading(true)
    setMensaje('')

    const { data: adminData } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
    const adminNombre = adminData?.email || 'El administrador'

    const redirectUrl = window.location.origin
    const { data, error } = await supabase.auth.signInWithOtp({
      email: nuevoEmail,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          rol: nuevoRol,
          empresa: nuevaEmpresa,
          invitado_por: adminNombre
        }
      }
    })

    if (error) {
      toast.error('Error: ' + error.message)
      setLoading(false)
      return
    }

    setMensaje(`Invitacion enviada a ${nuevoEmail} (${nuevaEmpresa})`)
    setNuevoEmail('')
    setNuevoRol('usuario')
    setNuevaEmpresa('CGV')

    setTimeout(() => setMensaje(''), 5000)
    setLoading(false)
  }

  async function cambiarEmpresaUsuario(userId, nuevaEmpresa) {
    const { error } = await supabase
      .from('perfiles')
      .update({ empresa: nuevaEmpresa })
      .eq('id', userId)

    if (error) {
      toast.error('Error al cambiar empresa: ' + error.message)
    } else {
      toast.success('Empresa actualizada')
      cargarUsuarios()
    }
  }

  async function cambiarRolUsuario(userId, nuevoRol) {
    const { error } = await supabase
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', userId)

    if (error) {
      toast.error('Error al cambiar rol: ' + error.message)
    } else {
      toast.success('Rol actualizado')
      cargarUsuarios()
    }
  }

  // Funciones para gestionar correos CGV
  function agregarCorreoCGV() {
    if (!nuevoCorreoCGV.trim()) return
    if (!nuevoCorreoCGV.includes('@')) {
      toast.warning('Ingrese un email valido')
      return
    }
    if (correosCGV.includes(nuevoCorreoCGV.trim())) {
      toast.warning('Este correo ya esta en la lista')
      return
    }
    setCorreosCGV([...correosCGV, nuevoCorreoCGV.trim()])
    setNuevoCorreoCGV('')
  }

  function eliminarCorreoCGV(correo) {
    setCorreosCGV(correosCGV.filter(c => c !== correo))
  }

  // Funciones para gestionar correos HUB MET
  function agregarCorreoHUBMET() {
    if (!nuevoCorreoHUBMET.trim()) return
    if (!nuevoCorreoHUBMET.includes('@')) {
      toast.warning('Ingrese un email valido')
      return
    }
    if (correosHUBMET.includes(nuevoCorreoHUBMET.trim())) {
      toast.warning('Este correo ya esta en la lista')
      return
    }
    setCorreosHUBMET([...correosHUBMET, nuevoCorreoHUBMET.trim()])
    setNuevoCorreoHUBMET('')
  }

  function eliminarCorreoHUBMET(correo) {
    setCorreosHUBMET(correosHUBMET.filter(c => c !== correo))
  }

  async function guardarConfiguracionCorreos() {
    setGuardandoCorreos(true)

    // Guardar CGV
    const { error: errorCGV } = await supabase
      .from('configuracion_emails')
      .update({ correos: correosCGV, updated_at: new Date().toISOString() })
      .eq('tipo', 'CGV')

    // Guardar HUB_MET
    const { error: errorHUBMET } = await supabase
      .from('configuracion_emails')
      .update({ correos: correosHUBMET, updated_at: new Date().toISOString() })
      .eq('tipo', 'HUB_MET')

    if (errorCGV || errorHUBMET) {
      toast.error('Error al guardar: ' + (errorCGV?.message || errorHUBMET?.message))
    } else {
      toast.success('Configuracion de correos guardada')
    }

    setGuardandoCorreos(false)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Configuracion - Gestion de Usuarios</h2>

      {/* Invitar Usuario */}
      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Invitar Nuevo Usuario</h3>
        <form onSubmit={invitarUsuario} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-gray-700 font-medium mb-2">Empresa</label>
              <select
                value={nuevaEmpresa}
                onChange={(e) => setNuevaEmpresa(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="CGV">CGV</option>
                <option value="HUB_MET">HUB MET</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FF5100' }}
          >
            {loading ? 'Enviando invitacion...' : 'Enviar Invitacion por Email'}
          </button>
          {mensaje && (
            <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm">
              {mensaje}
            </div>
          )}
        </form>
      </div>

      {/* Configuración de Correos */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Configuracion de Correos para Solicitudes OC</h3>
        <p className="text-sm text-gray-600 mb-4">
          Cuando un usuario envia una solicitud de OC, el correo se enviara a los destinatarios configurados segun su empresa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CGV */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-3">Destinatarios CGV</h4>
            <div className="space-y-2 mb-3">
              {correosCGV.map((correo, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                  <span className="text-gray-800 text-sm">{correo}</span>
                  <button
                    onClick={() => eliminarCorreoCGV(correo)}
                    className="text-red-500 hover:text-red-700 text-sm font-bold"
                  >
                    X
                  </button>
                </div>
              ))}
              {correosCGV.length === 0 && (
                <p className="text-gray-500 text-sm italic">No hay correos configurados</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={nuevoCorreoCGV}
                onChange={(e) => setNuevoCorreoCGV(e.target.value)}
                placeholder="nuevo@correo.com"
                className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarCorreoCGV())}
              />
              <button
                type="button"
                onClick={agregarCorreoCGV}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium text-sm"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* HUB MET */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-bold text-purple-800 mb-3">Destinatarios HUB MET</h4>
            <div className="space-y-2 mb-3">
              {correosHUBMET.map((correo, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                  <span className="text-gray-800 text-sm">{correo}</span>
                  <button
                    onClick={() => eliminarCorreoHUBMET(correo)}
                    className="text-red-500 hover:text-red-700 text-sm font-bold"
                  >
                    X
                  </button>
                </div>
              ))}
              {correosHUBMET.length === 0 && (
                <p className="text-gray-500 text-sm italic">No hay correos configurados</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={nuevoCorreoHUBMET}
                onChange={(e) => setNuevoCorreoHUBMET(e.target.value)}
                placeholder="nuevo@correo.com"
                className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarCorreoHUBMET())}
              />
              <button
                type="button"
                onClick={agregarCorreoHUBMET}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium text-sm"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={guardarConfiguracionCorreos}
            disabled={guardandoCorreos}
            className="px-6 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FF5100' }}
          >
            {guardandoCorreos ? 'Guardando...' : 'Guardar Configuracion de Correos'}
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="overflow-x-auto">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Usuarios Registrados</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Email</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Rol</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Empresa</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Fecha Creacion</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-800">{u.email}</td>
                <td className="py-3 px-4">
                  <select
                    value={u.rol || 'usuario'}
                    onChange={(e) => cambiarRolUsuario(u.id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border-2 cursor-pointer focus:outline-none ${
                      u.rol === 'admin'
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300'
                    }`}
                  >
                    <option value="usuario">usuario</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <select
                    value={u.empresa || 'CGV'}
                    onChange={(e) => cambiarEmpresaUsuario(u.id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border-2 cursor-pointer focus:outline-none ${
                      u.empresa === 'HUB_MET'
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-green-100 text-green-800 border-green-300'
                    }`}
                  >
                    <option value="CGV">CGV</option>
                    <option value="HUB_MET">HUB MET</option>
                  </select>
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
