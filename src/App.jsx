import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Login from './components/Login'
import ConfigurarPassword from './components/ConfigurarPassword'
import Dashboard from './components/Dashboard'
import VistaProyectos from './components/VistaProyectos'
import VistaControlCambios from './components/VistaControlCambios'
import ConfiguracionUsuarios from './components/ConfiguracionUsuarios'
import ModalEdicion from './components/ModalEdicion'
import VistaSugerencias from './components/VistaSugerencias'

const COLORS = ['#FF5100', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6']
const LOGO_URL = 'https://bisccrlqcixkaguspntw.supabase.co/storage/v1/object/public/public-assets/logo%20FCH.png'

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
  const [sugerencias, setSugerencias] = useState([])
  const [votos, setVotos] = useState([])
  const [filtroEstadoSugerencias, setFiltroEstadoSugerencias] = useState('')

  useEffect(() => {
    verificarSesion()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
        if (session?.user) {
          cargarPerfil(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setPerfil(null)
      }
    })
    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user && perfil) {
      if (perfil.primera_vez) {
        // Usuario debe cambiar contraseña
        return
      }
      cargarProyectos()
      cargarCambios()
      cargarFavoritos()
      cargarSugerencias()
      cargarVotos()
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

  async function cargarSugerencias() {
    const { data } = await supabase.from('sugerencias').select('*').order('fecha_creacion', { ascending: false })
    setSugerencias(data || [])
  }

  async function cargarVotos() {
    const { data } = await supabase.from('votos_sugerencias').select('*')
    setVotos(data || [])
  }

  async function crearSugerencia(texto) {
    if (!texto.trim()) return

    setLoading(true)
    const { error } = await supabase.from('sugerencias').insert({
      texto,
      usuario: user.email,
      estado: 'sugerido',
      user_id: user.id
    })

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('Sugerencia enviada')
      cargarSugerencias()
    }
    setLoading(false)
  }

  async function votarSugerencia(sugerenciaId) {
    const yaVoto = votos.find(v => v.sugerencia_id === sugerenciaId && v.user_id === user.id)

    if (yaVoto) {
      // Remover voto
      await supabase.from('votos_sugerencias').delete().eq('id', yaVoto.id)
      setVotos(votos.filter(v => v.id !== yaVoto.id))
    } else {
      // Agregar voto
      const { data } = await supabase.from('votos_sugerencias').insert({
        sugerencia_id: sugerenciaId,
        user_id: user.id
      }).select().single()

      if (data) {
        setVotos([...votos, data])
      }
    }
  }

  async function cambiarEstadoSugerencia(sugerenciaId, nuevoEstado) {
    setLoading(true)
    const { error } = await supabase.from('sugerencias').update({ estado: nuevoEstado }).eq('id', sugerenciaId)

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('Estado actualizado')
      cargarSugerencias()
    }
    setLoading(false)
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

        toast.success(`Importación completada: ✓ ${insertados} ✗ ${errores}`)
        cargarProyectos()
        cargarCambios()
      } catch (error) {
        toast.error('Error al procesar el archivo: ' + error.message)
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
    if (!ingresos || isNaN(ingresos)) {
      toast.error('Debe ser número')
      return
    }
    
    const gastos = prompt('Estimación GGOO:')
    if (!gastos || isNaN(gastos)) {
      toast.error('Debe ser número')
      return
    }
    
    const hh = prompt('HH del proyecto:')
    if (!hh || isNaN(hh)) {
      toast.error('Debe ser número')
      return
    }

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
      toast.error('Error: ' + error.message)
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
      toast.success('Proyecto creado')
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
    
    if (error) toast.error('Error: ' + error.message)
    else {
      toast.success('Proyecto eliminado')
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
    
    toast.success('Todos los proyectos fueron eliminados')
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
      toast.error('Debe ser un número válido')
      return
    }

    const valorNuevoRedondeado = parseFloat(parseFloat(edicionActual.valorNuevo).toFixed(1))
    const valorActualRedondeado = parseFloat(parseFloat(edicionActual.valorActual).toFixed(1))

    if (valorNuevoRedondeado === valorActualRedondeado) {
      toast.warning('El valor no ha cambiado')
      setModalAbierto(false)
      return
    }

    if (!edicionActual.motivo.trim()) {
      toast.warning('Debe ingresar un motivo del cambio')
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
        tipo_cambio: 'valor',
        proyecto_nombre: edicionActual.proyecto.nombre
      })

      toast.success('Cambio registrado exitosamente')
      cargarProyectos()
      cargarCambios()
    } else {
      toast.error('Error: ' + error.message)
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

  // Primera vez - configurar contraseña
  if (user && perfil?.primera_vez) {
    return <ConfigurarPassword user={user} perfil={perfil} setPerfil={setPerfil} />
  }

  // Login screen
  if (!user) {
    return <Login loading={loading} setLoading={setLoading} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      {/* Header Fixed */}
      <div className="fixed top-0 left-0 right-0 z-40 w-full" style={{ backgroundColor: '#FF5100' }}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between gap-4">
            <img src={LOGO_URL} alt="Logo FCH" className="h-16 md:h-20 object-contain" />
            
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
        </div>
      </div>

      {/* Overlay del menú */}
      {menuAbierto && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 mt-32"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* Menú Lateral */}
      <div className={`fixed top-32 right-0 h-screen w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        menuAbierto ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 space-y-2">
          <button
            onClick={() => { setVista('ajustes'); setMenuAbierto(false); setFiltroJefe(''); setBusqueda('') }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'ajustes' ? '#FF5100' : '#374151', backgroundColor: vista === 'ajustes' ? '#FFF5F0' : 'transparent' }}
          >
            ⚙️ Proyectos y Ajustes
          </button>
          <button
            onClick={() => { setVista('cambios'); setMenuAbierto(false) }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'cambios' ? '#FF5100' : '#374151', backgroundColor: vista === 'cambios' ? '#FFF5F0' : 'transparent' }}
          >
            📝 Control de Cambios
          </button>
          <button
            onClick={() => { setVista('dashboard'); setMenuAbierto(false) }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'dashboard' ? '#FF5100' : '#374151', backgroundColor: vista === 'dashboard' ? '#FFF5F0' : 'transparent' }}
          >
            📊 Dashboard
          </button>
          {perfil?.rol === 'admin' && (
            <button
              onClick={() => { setVista('usuarios'); setMenuAbierto(false) }}
              className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
              style={{ color: vista === 'usuarios' ? '#FF5100' : '#374151', backgroundColor: vista === 'usuarios' ? '#FFF5F0' : 'transparent' }}
            >
              👥 Configuración
            </button>
          )}
          <button
            onClick={() => { setVista('sugerencias'); setMenuAbierto(false) }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'sugerencias' ? '#FF5100' : '#374151', backgroundColor: vista === 'sugerencias' ? '#FFF5F0' : 'transparent' }}
          >
            💡 Sugerencias
          </button>
          <hr className="my-2" />
          <button
            onClick={logout}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-red-50 text-red-600"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Contenido principal con margen superior para el header fixed */}
      <div className="pt-32">
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

            {vista === 'sugerencias' && (
              <VistaSugerencias
                sugerencias={sugerencias}
                votos={votos}
                filtroEstado={filtroEstadoSugerencias}
                setFiltroEstado={setFiltroEstadoSugerencias}
                crearSugerencia={crearSugerencia}
                votarSugerencia={votarSugerencia}
                cambiarEstadoSugerencia={cambiarEstadoSugerencia}
                perfil={perfil}
                user={user}
                loading={loading}
              />
            )}
          </div>
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

export default App
