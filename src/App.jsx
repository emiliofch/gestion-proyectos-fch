import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import * as XLSX from 'xlsx'
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS = ['#FF5100', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6']

function App() {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [cambios, setCambios] = useState([])
  const [vista, setVista] = useState('ajustes')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [filtroJefe, setFiltroJefe] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [ordenColumna, setOrdenColumna] = useState('nombre')
  const [ordenDireccion, setOrdenDireccion] = useState('asc')
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [edicionActual, setEdicionActual] = useState(null)
  const [tipoControlCambios, setTipoControlCambios] = useState('valor')
  const [favoritos, setFavoritos] = useState([])

  // Auth
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorLogin, setErrorLogin] = useState('')

  useEffect(() => {
    verificarSesion()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        cargarPerfil(session.user.id)
      }
    })
    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user && perfil) {
      cargarProyectos()
      cargarCambios()
      cargarFavoritos()
    }
  }, [user, perfil])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    if (session?.user) {
      await cargarPerfil(session.user.id)
    }
    setLoading(false)
  }

  async function cargarPerfil(userId) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', userId).single()
    setPerfil(data)
  }

  async function cargarFavoritos() {
    const { data } = await supabase.from('favoritos').select('proyecto_id').eq('user_id', user.id)
    setFavoritos(data?.map(f => f.proyecto_id) || [])
  }

  async function toggleFavorito(proyectoId) {
    if (favoritos.includes(proyectoId)) {
      await supabase.from('favoritos').delete().eq('user_id', user.id).eq('proyecto_id', proyectoId)
      setFavoritos(favoritos.filter(id => id !== proyectoId))
    } else {
      await supabase.from('favoritos').insert({ user_id: user.id, proyecto_id: proyectoId })
      setFavoritos([...favoritos, proyectoId])
    }
  }

  async function login(e) {
    e.preventDefault()
    setErrorLogin('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorLogin(error.message)
    }
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
  }

  async function cargarProyectos() {
    const { data } = await supabase.from('proyectos').select('*').order('fecha', { ascending: false })
    setProyectos(data || [])
  }

  async function cargarCambios() {
    const { data } = await supabase.from('cambios').select('*').order('fecha', { ascending: false })
    setCambios(data || [])
  }

  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    const reader = new FileReader()
    
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        let insertados = 0
        let errores = 0

        for (let row of data) {
          const proyecto = row.PROYECTO || row.proyecto
          const jefe = row['JEFE PROYECTO'] || row['JEFE'] || row.jefe || 'Sin asignar'
          const ingresos = parseFloat(row.INGRESOS || row.ingresos || 0).toFixed(1)
          const hh = parseFloat(row.HH || row.hh || 0).toFixed(1)
          const gastos = parseFloat(row.GGOO || row.ggoo || 0).toFixed(1)

          if (!proyecto) {
            errores++
            continue
          }

          const { data: nuevoProyecto, error } = await supabase.from('proyectos').insert({
            nombre: proyecto,
            jefe,
            ingresos: parseFloat(ingresos),
            hh: parseFloat(hh),
            gastos: parseFloat(gastos),
            creador: user.email
          }).select().single()

          if (error) {
            errores++
          } else {
            insertados++
            await supabase.from('cambios').insert({
              proyecto_id: nuevoProyecto.id,
              campo: 'PROYECTO CREADO',
              valor_anterior: 0,
              valor_nuevo: 0,
              usuario: user.email,
              motivo: `Proyecto importado desde Excel`,
              tipo_cambio: 'proyecto'
            })
          }
        }

        alert(`Importación completada:\n✓ ${insertados} proyectos importados\n✗ ${errores} errores`)
        cargarProyectos()
        cargarCambios()
      } catch (error) {
        alert('Error al procesar el archivo: ' + error.message)
      }
      setLoading(false)
    }

    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function crearProyecto() {
    const nombre = prompt('Nombre del proyecto:')
    if (!nombre) return
    
    const jefe = prompt('Jefe de proyecto:')
    if (!jefe) return
    
    const ingresos = prompt('Estimación ingresos:')
    if (!ingresos || isNaN(ingresos)) return alert('Debe ser número')
    
    const gastos = prompt('Estimación GGOO:')
    if (!gastos || isNaN(gastos)) return alert('Debe ser número')
    
    const hh = prompt('HH del proyecto:')
    if (!hh || isNaN(hh)) return alert('Debe ser número')

    setLoading(true)
    const { data: nuevoProyecto, error } = await supabase.from('proyectos').insert({
      nombre,
      jefe,
      ingresos: parseFloat(parseFloat(ingresos).toFixed(1)),
      gastos: parseFloat(parseFloat(gastos).toFixed(1)),
      hh: parseFloat(parseFloat(hh).toFixed(1)),
      creador: user.email
    }).select().single()
    
    if (error) {
      alert('Error: ' + error.message)
    } else {
      await supabase.from('cambios').insert({
        proyecto_id: nuevoProyecto.id,
        campo: 'PROYECTO CREADO',
        valor_anterior: 0,
        valor_nuevo: 0,
        usuario: user.email,
        motivo: `Proyecto creado: ${nombre}`,
        tipo_cambio: 'proyecto'
      })
      alert('Proyecto creado')
      cargarProyectos()
      cargarCambios()
    }
    setLoading(false)
  }

  async function borrarProyecto(proyecto) {
    if (!confirm(`¿Seguro que deseas eliminar el proyecto "${proyecto.nombre}"?`)) return

    setLoading(true)
    
    await supabase.from('cambios').insert({
      proyecto_id: proyecto.id,
      campo: 'PROYECTO ELIMINADO',
      valor_anterior: 0,
      valor_nuevo: 0,
      usuario: user.email,
      motivo: `Proyecto eliminado: ${proyecto.nombre}`,
      tipo_cambio: 'proyecto'
    })
    
    await supabase.from('cambios').delete().eq('proyecto_id', proyecto.id).neq('tipo_cambio', 'proyecto')
    const { error } = await supabase.from('proyectos').delete().eq('id', proyecto.id)
    
    if (error) alert('Error: ' + error.message)
    else {
      alert('Proyecto eliminado')
      cargarProyectos()
      cargarCambios()
    }
    setLoading(false)
  }

  async function borrarTodosProyectos() {
    if (!confirm('⚠️ ¿Estás SEGURO de eliminar TODOS los proyectos?')) return
    if (!confirm('Última confirmación: ¿Eliminar TODOS los proyectos?')) return

    setLoading(true)
    await supabase.from('cambios').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('proyectos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    alert('Todos los proyectos fueron eliminados')
    cargarProyectos()
    cargarCambios()
    setLoading(false)
  }

  function abrirModalEdicion(proyecto, campo, valorActual) {
    setEdicionActual({
      proyecto,
      campo,
      valorActual: parseFloat(valorActual).toFixed(1),
      valorNuevo: parseFloat(valorActual).toFixed(1),
      motivo: ''
    })
    setModalAbierto(true)
  }

  async function guardarCambioIndividual() {
    if (!edicionActual.valorNuevo || isNaN(edicionActual.valorNuevo)) {
      alert('Debe ser un número válido')
      return
    }

    const valorNuevoRedondeado = parseFloat(parseFloat(edicionActual.valorNuevo).toFixed(1))
    const valorActualRedondeado = parseFloat(parseFloat(edicionActual.valorActual).toFixed(1))

    if (valorNuevoRedondeado === valorActualRedondeado) {
      alert('El valor no ha cambiado')
      setModalAbierto(false)
      return
    }

    if (!edicionActual.motivo.trim()) {
      alert('Debe ingresar un motivo del cambio')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('proyectos').update({
      [edicionActual.campo]: valorNuevoRedondeado
    }).eq('id', edicionActual.proyecto.id)

    if (!error) {
      await supabase.from('cambios').insert({
        proyecto_id: edicionActual.proyecto.id,
        campo: edicionActual.campo.toUpperCase(),
        valor_anterior: valorActualRedondeado,
        valor_nuevo: valorNuevoRedondeado,
        usuario: user.email,
        motivo: edicionActual.motivo,
        tipo_cambio: 'valor'
      })

      alert('Cambio registrado exitosamente')
      cargarProyectos()
      cargarCambios()
    } else {
      alert('Error: ' + error.message)
    }

    setLoading(false)
    setModalAbierto(false)
    setEdicionActual(null)
  }

  function exportarExcel() {
    const datos = proyectosFiltrados.map(p => ({
      'Proyecto': p.nombre,
      'Jefe': p.jefe,
      'Ingresos': parseFloat(p.ingresos).toFixed(1),
      'HH': parseFloat(p.hh).toFixed(1),
      'GGOO': parseFloat(p.gastos).toFixed(1),
      'Margen': ((parseFloat(p.ingresos) || 0) - (parseFloat(p.hh) || 0) - (parseFloat(p.gastos) || 0)).toFixed(1)
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datos)
    XLSX.utils.book_append_sheet(wb, ws, "Proyectos")
    XLSX.writeFile(wb, `proyectos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function exportarPDF() {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text('Reporte de Proyectos', 14, 15)
    
    const datos = proyectosFiltrados.map(p => [
      p.nombre,
      p.jefe,
      parseFloat(p.ingresos).toFixed(1),
      parseFloat(p.hh).toFixed(1),
      parseFloat(p.gastos).toFixed(1),
      ((parseFloat(p.ingresos) || 0) - (parseFloat(p.hh) || 0) - (parseFloat(p.gastos) || 0)).toFixed(1)
    ])

    autoTable(doc, {
      head: [['Proyecto', 'Jefe', 'Ingresos', 'HH', 'GGOO', 'Margen']],
      body: datos,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 81, 0] }
    })

    doc.save(`proyectos_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  function ordenarPor(columna) {
    if (ordenColumna === columna) {
      setOrdenDireccion(ordenDireccion === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenColumna(columna)
      setOrdenDireccion('asc')
    }
  }

  const jefes = [...new Set(proyectos.map(p => p.jefe))]
  
  let proyectosFiltrados = proyectos
  
  if (filtroJefe) {
    proyectosFiltrados = proyectosFiltrados.filter(p => p.jefe === filtroJefe)
  }
  
  if (busqueda) {
    proyectosFiltrados = proyectosFiltrados.filter(p => 
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.jefe.toLowerCase().includes(busqueda.toLowerCase())
    )
  }

  proyectosFiltrados = [...proyectosFiltrados].sort((a, b) => {
    let valorA, valorB
    
    if (ordenColumna === 'margen') {
      valorA = (parseFloat(a.ingresos) || 0) - (parseFloat(a.hh) || 0) - (parseFloat(a.gastos) || 0)
      valorB = (parseFloat(b.ingresos) || 0) - (parseFloat(b.hh) || 0) - (parseFloat(b.gastos) || 0)
    } else if (['ingresos', 'hh', 'gastos'].includes(ordenColumna)) {
      valorA = parseFloat(a[ordenColumna]) || 0
      valorB = parseFloat(b[ordenColumna]) || 0
    } else {
      valorA = a[ordenColumna]
      valorB = b[ordenColumna]
    }
    
    if (valorA < valorB) return ordenDireccion === 'asc' ? -1 : 1
    if (valorA > valorB) return ordenDireccion === 'asc' ? 1 : -1
    return 0
  })

  const totales = {
    ingresos: proyectosFiltrados.reduce((sum, p) => sum + (parseFloat(p.ingresos) || 0), 0),
    hh: proyectosFiltrados.reduce((sum, p) => sum + (parseFloat(p.hh) || 0), 0),
    gastos: proyectosFiltrados.reduce((sum, p) => sum + (parseFloat(p.gastos) || 0), 0),
  }
  totales.margen = totales.ingresos - totales.hh - totales.gastos

  const cambiosFiltrados = cambios.filter(c => c.tipo_cambio === tipoControlCambios)

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-800">Cargando...</div>
    </div>
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#FF5100' }}>Gestión de Proyectos</h1>
            <p className="text-gray-600">Inicia sesión para continuar</p>
          </div>
          
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
            
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
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
              className="w-full py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50"
              style={{ backgroundColor: '#FF5100' }}
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mb-8" style={{ backgroundColor: '#FF5100' }}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between gap-4">
            <img src="/logo_FCH.png" alt="Logo FCH" className="h-16 md:h-20 object-contain" />
            
            <div className="flex-1 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Gestión de Proyectos
              </h1>
              <p className="text-white text-sm mt-1">{user.email} • {perfil?.rol}</p>
            </div>
            
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="p-2 rounded-lg hover:bg-white/20 transition-all"
              title="Menú"
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuAbierto ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {menuAbierto && (
            <div className="mt-4 space-y-2">
              <button
                onClick={() => { setVista('ajustes'); setMenuAbierto(false); setFiltroJefe(''); setBusqueda('') }}
                className="w-full text-left px-4 py-3 rounded-lg text-white font-medium transition-all hover:bg-white/20"
                style={{ backgroundColor: vista === 'ajustes' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
              >
                ⚙️ Proyectos y Ajustes
              </button>
              <button
                onClick={() => { setVista('cambios'); setMenuAbierto(false) }}
                className="w-full text-left px-4 py-3 rounded-lg text-white font-medium transition-all hover:bg-white/20"
                style={{ backgroundColor: vista === 'cambios' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
              >
                📝 Control de Cambios
              </button>
              <button
                onClick={() => { setVista('dashboard'); setMenuAbierto(false) }}
                className="w-full text-left px-4 py-3 rounded-lg text-white font-medium transition-all hover:bg-white/20"
                style={{ backgroundColor: vista === 'dashboard' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
              >
                📊 Dashboard
              </button>
              {perfil?.rol === 'admin' && (
                <button
                  onClick={() => { setVista('usuarios'); setMenuAbierto(false) }}
                  className="w-full text-left px-4 py-3 rounded-lg text-white font-medium transition-all hover:bg-white/20"
                  style={{ backgroundColor: vista === 'usuarios' ? 'rgba(255,255,255,0.2)' : 'transparent' }}
                >
                  👥 Configuración
                </button>
              )}
              <button
                onClick={logout}
                className="w-full text-left px-4 py-3 rounded-lg text-white font-medium transition-all hover:bg-white/20"
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          
          {vista === 'dashboard' && (
            <Dashboard proyectos={proyectos} exportarExcel={exportarExcel} exportarPDF={exportarPDF} />
          )}

          {vista === 'ajustes' && (
            <VistaProyectos
              proyectos={proyectosFiltrados}
              jefes={jefes}
              filtroJefe={filtroJefe}
              setFiltroJefe={setFiltroJefe}
              busqueda={busqueda}
              setBusqueda={setBusqueda}
              mostrarInstrucciones={mostrarInstrucciones}
              setMostrarInstrucciones={setMostrarInstrucciones}
              importarExcel={importarExcel}
              crearProyecto={crearProyecto}
              borrarTodosProyectos={borrarTodosProyectos}
              abrirModalEdicion={abrirModalEdicion}
              borrarProyecto={borrarProyecto}
              totales={totales}
              loading={loading}
              ordenarPor={ordenarPor}
              ordenColumna={ordenColumna}
              ordenDireccion={ordenDireccion}
              favoritos={favoritos}
              toggleFavorito={toggleFavorito}
              exportarExcel={exportarExcel}
              exportarPDF={exportarPDF}
            />
          )}

          {vista === 'cambios' && (
            <VistaControlCambios
              cambiosFiltrados={cambiosFiltrados}
              tipoControlCambios={tipoControlCambios}
              setTipoControlCambios={setTipoControlCambios}
            />
          )}

          {vista === 'usuarios' && perfil?.rol === 'admin' && (
            <ConfiguracionUsuarios user={user} />
          )}
        </div>
      </div>

      {modalAbierto && edicionActual && (
        <ModalEdicion
          edicionActual={edicionActual}
          setEdicionActual={setEdicionActual}
          guardarCambioIndividual={guardarCambioIndividual}
          setModalAbierto={setModalAbierto}
          loading={loading}
        />
      )}
    </div>
  )
}

// Componentes auxiliares siguen igual...
function Dashboard({ proyectos, exportarExcel, exportarPDF }) {
  const totalProyectos = proyectos.length
  const totalIngresos = proyectos.reduce((sum, p) => sum + (parseFloat(p.ingresos) || 0), 0)
  const totalHH = proyectos.reduce((sum, p) => sum + (parseFloat(p.hh) || 0), 0)
  const totalGastos = proyectos.reduce((sum, p) => sum + (parseFloat(p.gastos) || 0), 0)
  const margenTotal = totalIngresos - totalHH - totalGastos
  const margenPromedio = totalProyectos > 0 ? margenTotal / totalProyectos : 0
  
  const proyectosPositivos = proyectos.filter(p => {
    const margen = (parseFloat(p.ingresos) || 0) - (parseFloat(p.hh) || 0) - (parseFloat(p.gastos) || 0)
    return margen >= 0
  }).length
  
  const proyectosNegativos = totalProyectos - proyectosPositivos

  const pieData = [
    { name: 'Positivos', value: proyectosPositivos },
    { name: 'Negativos', value: proyectosNegativos }
  ]

  const topProyectos = [...proyectos]
    .map(p => ({
      nombre: p.nombre.length > 20 ? p.nombre.substring(0, 20) + '...' : p.nombre,
      margen: (parseFloat(p.ingresos) || 0) - (parseFloat(p.hh) || 0) - (parseFloat(p.gastos) || 0)
    }))
    .sort((a, b) => b.margen - a.margen)
    .slice(0, 5)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-all"
            title="Exportar a Excel"
          >
            📊 Excel
          </button>
          <button
            onClick={exportarPDF}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all"
            title="Exportar a PDF"
          >
            📄 PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Total Proyectos</div>
          <div className="text-3xl font-bold mt-2">{totalProyectos}</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Ingresos Totales</div>
          <div className="text-3xl font-bold mt-2">{totalIngresos.toFixed(1)}</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Margen Total</div>
          <div className="text-3xl font-bold mt-2">{margenTotal.toFixed(1)}</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Margen Promedio</div>
          <div className="text-3xl font-bold mt-2">{margenPromedio.toFixed(1)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Distribución de Márgenes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 Proyectos por Margen</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProyectos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="margen" fill="#FF5100" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Resumen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">Proyectos con margen positivo:</p>
            <p className="text-2xl font-bold text-green-600">{proyectosPositivos} ({totalProyectos > 0 ? ((proyectosPositivos / totalProyectos) * 100).toFixed(1) : 0}%)</p>
          </div>
          <div>
            <p className="text-gray-600">Proyectos con margen negativo:</p>
            <p className="text-2xl font-bold text-red-600">{proyectosNegativos} ({totalProyectos > 0 ? ((proyectosNegativos / totalProyectos) * 100).toFixed(1) : 0}%)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function VistaProyectos({
  proyectos, jefes, filtroJefe, setFiltroJefe, busqueda, setBusqueda,
  mostrarInstrucciones, setMostrarInstrucciones, importarExcel, crearProyecto,
  borrarTodosProyectos, abrirModalEdicion, borrarProyecto, totales, loading,
  ordenarPor, ordenColumna, ordenDireccion, favoritos, toggleFavorito, exportarExcel, exportarPDF
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Proyectos y Ajustes</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Buscar por nombre o jefe"
          />
          <select
            value={filtroJefe}
            onChange={(e) => setFiltroJefe(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Filtrar por jefe de proyecto"
          >
            <option value="">Todos los jefes</option>
            {jefes.map(jefe => (
              <option key={jefe} value={jefe}>{jefe}</option>
            ))}
          </select>
          <button
            onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
            title="Información sobre formato Excel"
          >
            ℹ️
          </button>
          <button
            onClick={exportarExcel}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-all"
            title="Exportar a Excel"
          >
            📊
          </button>
          <button
            onClick={exportarPDF}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all"
            title="Exportar a PDF"
          >
            📄
          </button>
          <label 
            className="px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
            title="Importar proyectos desde Excel"
          >
            📤 Importar
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={importarExcel}
              className="hidden"
              disabled={loading}
            />
          </label>
          <button
            onClick={crearProyecto}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
            title="Crear nuevo proyecto"
          >
            ➕ Nuevo
          </button>
          <button
            onClick={borrarTodosProyectos}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50"
            title="Eliminar todos los proyectos"
          >
            🗑️ Borrar Todos
          </button>
        </div>
      </div>

      {mostrarInstrucciones && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h3 className="text-gray-800 font-bold mb-2">📋 Formato Excel:</h3>
          <p className="text-gray-700 text-sm">PROYECTO | JEFE PROYECTO | INGRESOS | HH | GGOO</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold" title="Marcar como favorito">⭐</th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('nombre')}
                title="Ordenar por proyecto"
              >
                Proyecto {ordenColumna === 'nombre' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('jefe')}
                title="Ordenar por jefe"
              >
                Jefe {ordenColumna === 'jefe' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('ingresos')}
                title="Ordenar por ingresos"
              >
                Ingresos {ordenColumna === 'ingresos' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('hh')}
                title="Ordenar por HH"
              >
                HH {ordenColumna === 'hh' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('gastos')}
                title="Ordenar por GGOO"
              >
                GGOO {ordenColumna === 'gastos' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('margen')}
                title="Ordenar por margen"
              >
                Margen {ordenColumna === 'margen' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map(p => {
              const margen = (parseFloat(p.ingresos) || 0) - (parseFloat(p.hh) || 0) - (parseFloat(p.gastos) || 0)
              const esFavorito = favoritos.includes(p.id)
              return (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4">
                    <button 
                      onClick={() => toggleFavorito(p.id)} 
                      className="text-xl"
                      title={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
                    >
                      {esFavorito ? '⭐' : '☆'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-gray-800">{p.nombre}</td>
                  <td className="py-3 px-4 text-gray-800">{p.jefe}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => abrirModalEdicion(p, 'ingresos', p.ingresos)}
                      className="w-24 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-left"
                      title="Click para editar"
                    >
                      {parseFloat(p.ingresos).toFixed(1)}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => abrirModalEdicion(p, 'hh', p.hh)}
                      className="w-24 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-left"
                      title="Click para editar"
                    >
                      {parseFloat(p.hh).toFixed(1)}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => abrirModalEdicion(p, 'gastos', p.gastos)}
                      className="w-24 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-left"
                      title="Click para editar"
                    >
                      {parseFloat(p.gastos).toFixed(1)}
                    </button>
                  </td>
                  <td className={`py-3 px-4 font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {margen.toFixed(1)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => borrarProyecto(p)}
                      className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all text-sm"
                      title="Eliminar proyecto"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
              <td></td>
              <td className="py-3 px-4 text-gray-800">TOTAL</td>
              <td></td>
              <td className="py-3 px-4 text-gray-800">{totales.ingresos.toFixed(1)}</td>
              <td className="py-3 px-4 text-gray-800">{totales.hh.toFixed(1)}</td>
              <td className="py-3 px-4 text-gray-800">{totales.gastos.toFixed(1)}</td>
              <td className={`py-3 px-4 ${totales.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totales.margen.toFixed(1)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VistaControlCambios({ cambiosFiltrados, tipoControlCambios, setTipoControlCambios }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Control de Cambios</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTipoControlCambios('valor')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'valor' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'valor' ? '#FF5100' : '' }}
            title="Ver cambios de valores numéricos"
          >
            Cambios de Valores
          </button>
          <button
            onClick={() => setTipoControlCambios('proyecto')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'proyecto' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'proyecto' ? '#FF5100' : '' }}
            title="Ver creación/eliminación de proyectos"
          >
            Cambios de Proyectos
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
              {tipoControlCambios === 'valor' && (
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</th>
              )}
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Fecha</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Campo</th>
              {tipoControlCambios === 'valor' && (
                <>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Anterior</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Nuevo</th>
                </>
              )}
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Usuario</th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {cambiosFiltrados.map(c => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                {tipoControlCambios === 'valor' && (
                  <td className="py-3 px-4 text-gray-800 font-medium">{c.proyecto_nombre || 'N/A'}</td>
                )}
                <td className="py-3 px-4 text-gray-800 text-sm">{new Date(c.fecha).toLocaleString()}</td>
                <td className="py-3 px-4 text-gray-800">{c.campo}</td>
                {tipoControlCambios === 'valor' && (
                  <>
                    <td className="py-3 px-4 text-gray-800">{parseFloat(c.valor_anterior).toFixed(1)}</td>
                    <td className="py-3 px-4 text-gray-800">{parseFloat(c.valor_nuevo).toFixed(1)}</td>
                  </>
                )}
                <td className="py-3 px-4 text-gray-800">{c.usuario}</td>
                <td className="py-3 px-4 text-gray-800">{c.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function ConfiguracionUsuarios({ user }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoPassword, setNuevoPassword] = useState('')
  const [nuevoRol, setNuevoRol] = useState('usuario')

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    const { data } = await supabase.from('perfiles').select('*')
    setUsuarios(data || [])
  }

  async function invitarUsuario(e) {
    e.preventDefault()
    if (!nuevoEmail || !nuevoPassword) return alert('Complete todos los campos')

    setLoading(true)
    
    // Registrar usuario usando signUp público
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nuevoEmail,
      password: nuevoPassword,
      options: {
        data: {
          rol: nuevoRol
        }
      }
    })

    if (authError) {
      alert('Error: ' + authError.message)
      setLoading(false)
      return
    }

    // Actualizar rol si es admin
    if (authData.user && nuevoRol === 'admin') {
      await supabase.from('perfiles').update({ rol: 'admin' }).eq('id', authData.user.id)
    }

    alert(`Usuario invitado exitosamente.\nEmail: ${nuevoEmail}\nContraseña temporal: ${nuevoPassword}\n\nComparte estas credenciales con el usuario.`)
    setNuevoEmail('')
    setNuevoPassword('')
    setNuevoRol('usuario')
    
    // Recargar después de un breve delay para que se cree el perfil
    setTimeout(() => cargarUsuarios(), 1000)
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
            <label className="block text-gray-700 font-medium mb-2">Contraseña temporal</label>
            <input
              type="password"
              value={nuevoPassword}
              onChange={(e) => setNuevoPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              minLength={6}
            />
            <p className="text-sm text-gray-500 mt-1">Mínimo 6 caracteres</p>
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
            {loading ? 'Invitando...' : 'Invitar Usuario'}
          </button>
        </form>
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

function ModalEdicion({ edicionActual, setEdicionActual, guardarCambioIndividual, setModalAbierto, loading }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Editar {edicionActual.campo.toUpperCase()}
        </h3>
        <p className="text-gray-600 mb-2">
          Proyecto: <strong>{edicionActual.proyecto.nombre}</strong>
        </p>
        <p className="text-gray-600 mb-4">
          Valor actual: <strong>{edicionActual.valorActual}</strong>
        </p>
        
        <label className="block text-gray-700 font-medium mb-2">Nuevo valor (1 decimal):</label>
        <input
          type="number"
          step="0.1"
          value={edicionActual.valorNuevo}
          onChange={(e) => setEdicionActual({...edicionActual, valorNuevo: e.target.value})}
          className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
          autoFocus
        />

        <label className="block text-gray-700 font-medium mb-2">Motivo del cambio:</label>
        <textarea
          value={edicionActual.motivo}
          onChange={(e) => setEdicionActual({...edicionActual, motivo: e.target.value})}
          className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-6"
          rows="3"
          placeholder="Describe por qué se realiza este cambio..."
        />

        <div className="flex gap-2">
          <button
            onClick={guardarCambioIndividual}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FF5100' }}
          >
            Guardar
          </button>
          <button
            onClick={() => { setModalAbierto(false) }}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
