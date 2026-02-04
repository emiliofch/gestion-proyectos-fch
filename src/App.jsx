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
import ConfirmModal from './components/ConfirmModal'
import VistaSolicitudOC from './components/VistaSolicitudOC'
import AdministracionOC from './components/AdministracionOC'
import VistaProyectosBase from './components/VistaProyectosBase'
import VistaOportunidades from './components/VistaOportunidades'

const COLORS = ['#FF5100', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6']
const LOGO_URL = 'https://bisccrlqcixkaguspntw.supabase.co/storage/v1/object/public/public-assets/FCh50-Eslogan_blanco.png'

function App() {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [proyectos, setProyectos] = useState([])
  const [confirmacion, setConfirmacion] = useState(null)
  const [cambios, setCambios] = useState([])
  const [vista, setVista] = useState('oportunidades')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [submenuEstimacion, setSubmenuEstimacion] = useState(false)
  const [submenuOC, setSubmenuOC] = useState(false)
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
    const { data } = await supabase.from('proyectos').select('*').order('nombre')
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

    console.log('🔵 crearSugerencia llamada con:', texto)
    setProcesando(true)
    const { error } = await supabase.from('sugerencias').insert({
      texto,
      usuario: user.email,
      estado: 'sugerido',
      user_id: user.id
    })

    if (error) {
      console.error('❌ Error en sugerencia:', error)
      toast.error('Error: ' + error.message)
    } else {
      console.log('✅ Sugerencia creada exitosamente')
      toast.success('Sugerencia enviada')
      cargarSugerencias()
    }
    setProcesando(false)
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
    setProcesando(true)
    const { error } = await supabase.from('sugerencias').update({ estado: nuevoEstado }).eq('id', sugerenciaId)

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('Estado actualizado')
      cargarSugerencias()
    }
    setProcesando(false)
  }

  async function borrarSugerencia(sugerenciaId) {
    setConfirmacion({
      mensaje: '¿Estás seguro de que deseas eliminar esta sugerencia?',
      tipo: 'danger',
      onConfirmar: async () => {
        setProcesando(true)
        console.log('🔵 borrarSugerencia llamada con ID:', sugerenciaId)
        
        let { error, data } = await supabase.from('sugerencias').delete().eq('id', sugerenciaId).select()

        console.log('📤 Respuesta delete:', { error, data })

        if (!error && (!data || data.length === 0)) {
          console.warn('⚠️ Delete ejecutado pero sin datos eliminados - posible problema RLS')
          
          const { data: checkData } = await supabase.from('sugerencias').select('id').eq('id', sugerenciaId).single()
          console.log('🔍 Sugerencia existe después de delete:', checkData)
        }

        if (error) {
          console.error('❌ Error eliminando sugerencia:', error)
          toast.error('Error: ' + error.message)
        } else {
          console.log('✅ Sugerencia eliminada exitosamente')
          toast.success('Sugerencia eliminada')
          await cargarSugerencias()
        }
        setProcesando(false)
      }
    })
  }

  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        console.log('=== INICIO IMPORTACIÓN EXCEL ===')
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        console.log('Hoja:', sheetName)
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)
        console.log('Total filas:', data.length)
        console.log('Primera fila:', JSON.stringify(data[0]))
        console.log('Columnas detectadas:', Object.keys(data[0] || {}))

        let insertados = 0
        let errores = 0
        let noEncontrados = []

        // Función para parsear números con coma decimal
        const parseNumero = (val) => {
          if (val === null || val === undefined || val === '') return 0
          if (typeof val === 'number') return val
          return parseFloat(String(val).replace(',', '.')) || 0
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          console.log(`--- Fila ${i + 1} ---`)
          console.log('Row:', JSON.stringify(row))

          const proyectoNombre = row.PROYECTO || row.proyecto || row['PROYECTO '] || ''
          const ingresos = parseNumero(row.INGRESOS || row.ingresos)
          const hh = parseNumero(row.HH || row.hh)
          const gastos = parseNumero(row.GGOO || row.ggoo || row.GASTOS || row.gastos)

          console.log('Parsed:', { proyectoNombre, ingresos, hh, gastos })

          if (!proyectoNombre || proyectoNombre.trim() === '') {
            console.log('⚠️ Proyecto vacío')
            errores++
            continue
          }

          // Extraer código del proyecto para búsqueda más flexible
          const codigoMatch = proyectoNombre.match(/^[\d]+\.[\w]+\.[\w]+/)
          const codigoBusqueda = codigoMatch ? codigoMatch[0] : proyectoNombre.trim()
          console.log('Buscando código:', codigoBusqueda)

          // Buscar el proyecto por código
          const { data: proyectosEncontrados, error: errorBusqueda } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .ilike('nombre', `${codigoBusqueda}%`)

          console.log('Resultado búsqueda:', { encontrados: proyectosEncontrados?.length, error: errorBusqueda })

          if (errorBusqueda || !proyectosEncontrados || proyectosEncontrados.length === 0) {
            console.log('❌ NO encontrado:', proyectoNombre)
            errores++
            noEncontrados.push(proyectoNombre)
            continue
          }

          const proyectoExistente = proyectosEncontrados[0]
          console.log('✓ Encontrado:', proyectoExistente.nombre)

          // Insertar oportunidad vinculada al proyecto (NO modificamos tabla proyectos)
          const { error: errorInsert } = await supabase.from('oportunidades').insert({
            proyecto_id: proyectoExistente.id,
            ingresos,
            hh,
            gastos,
            creador: user.email,
            estado: 'abierta'
          })

          if (errorInsert) {
            console.error('❌ Error insert:', errorInsert)
            errores++
          } else {
            console.log('✓ Oportunidad creada')
            insertados++
            await supabase.from('cambios').insert({
              proyecto_id: proyectoExistente.id,
              campo: 'OPORTUNIDAD CREADA',
              valor_anterior: '0',
              valor_nuevo: ingresos.toString(),
              usuario: user.email,
              motivo: 'Oportunidad importada desde Excel',
              tipo_cambio: 'oportunidad',
              proyecto_nombre: proyectoExistente.nombre
            })
          }
        }

        console.log('=== RESUMEN ===')
        console.log('Insertados:', insertados, 'Errores:', errores)
        console.log('No encontrados:', noEncontrados)

        if (noEncontrados.length > 0) {
          toast.warning(`${noEncontrados.length} proyectos no encontrados. Ver consola F12.`)
        }

        toast.success(`Importación: ✓ ${insertados} oportunidades ✗ ${errores} errores`)
        cargarProyectos()
        cargarCambios()
      } catch (error) {
        toast.error('Error: ' + error.message)
        console.error('❌ Error importación:', error)
      }
      setProcesando(false)
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
      console.log('❌ Ingresos no válido:', ingresos)
      toast.error('Debe ser número')
      return
    }
    
    const gastos = prompt('Estimación GGOO:')
    if (!gastos || isNaN(gastos)) {
      console.log('❌ Gastos no válido:', gastos)
      toast.error('Debe ser número')
      return
    }
    
    const hh = prompt('HH del proyecto:')
    if (!hh || isNaN(hh)) {
      console.log('❌ HH no válido:', hh)
      toast.error('Debe ser número')
      return
    }

    console.log('🔵 crearProyecto llamada:', { nombre, jefe, ingresos, gastos, hh })
    setProcesando(true)
    const { data: nuevoProyecto, error } = await supabase.from('proyectos').insert({
      nombre,
      jefe,
      ingresos: parseFloat(parseFloat(ingresos).toFixed(1)),
      gastos: parseFloat(parseFloat(gastos).toFixed(1)),
      hh: parseFloat(parseFloat(hh).toFixed(1)),
      creador: user.email
    }).select().single()
    
    if (error) {
      console.error('❌ Error creando proyecto:', error)
      toast.error('Error: ' + error.message)
    } else {
      console.log('✅ Proyecto creado:', nuevoProyecto.id)
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
    setProcesando(false)
  }

  async function borrarProyecto(proyecto) {
    setConfirmacion({
      mensaje: `¿Seguro que deseas eliminar el proyecto "${proyecto.nombre}"?`,
      tipo: 'danger',
      onConfirmar: async () => {
        setProcesando(true)
    
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
        setProcesando(false)
      }
    })
  }

  async function borrarTodosProyectos() {
    setConfirmacion({
      mensaje: '⚠️ ¿Estás SEGURO de eliminar TODOS los proyectos? Esta acción es irreversible.',
      tipo: 'danger',
      onConfirmar: async () => {
        setProcesando(true)
        await supabase.from('cambios').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('proyectos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        
        toast.success('Todos los proyectos fueron eliminados')
        cargarProyectos()
        cargarCambios()
        setProcesando(false)
      }
    })
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

    setProcesando(true)

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

    setProcesando(false)
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

  const cambiosFiltrados = cambios.filter(c => {
    if (tipoControlCambios === 'valor') {
      return c.tipo_cambio === 'valor' || c.tipo_cambio === 'oportunidad'
    }
    return c.tipo_cambio === tipoControlCambios
  })

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
    <>
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
        style={{ zIndex: 99999 }}
      />
      
      <div className="min-h-screen bg-gray-50">
      
      {console.log('📱 App renderizado - User:', user?.email, 'Perfil:', perfil?.rol)}
      
      {/* Header Fixed */}
      <div className="fixed top-0 left-0 right-0 z-40 w-full" style={{ backgroundColor: '#FF5100' }}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between gap-4">
            <img src={LOGO_URL} alt="Logo FCH" className="h-16 md:h-20 object-contain" />

            <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-white whitespace-nowrap">
                DeskFlow {perfil?.empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}
              </h1>
              <p className="text-white text-sm mt-1 whitespace-nowrap">{user.email} • {perfil?.rol} • {perfil?.empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}</p>
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
      <div className={`fixed top-32 right-0 h-screen w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
        menuAbierto ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 space-y-2">

          {/* 1. Estimación de cierre (con submenú) */}
          <div>
            <button
              onClick={() => setSubmenuEstimacion(!submenuEstimacion)}
              className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100 flex items-center justify-between"
              style={{ color: ['proyectos-base', 'oportunidades', 'cambios', 'dashboard'].includes(vista) ? '#FF5100' : '#374151', backgroundColor: ['proyectos-base', 'oportunidades', 'cambios', 'dashboard'].includes(vista) ? '#FFF5F0' : 'transparent' }}
            >
              <span>📊 Estimación de cierre</span>
              <svg className={`w-5 h-5 transition-transform ${submenuEstimacion ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Submenú */}
            {submenuEstimacion && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                <button
                  onClick={() => { setVista('proyectos-base'); setMenuAbierto(false) }}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                  style={{ color: vista === 'proyectos-base' ? '#FF5100' : '#374151', backgroundColor: vista === 'proyectos-base' ? '#FFF5F0' : 'transparent' }}
                >
                  📂 Proyectos
                </button>
                <button
                  onClick={() => { setVista('oportunidades'); setMenuAbierto(false) }}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                  style={{ color: vista === 'oportunidades' ? '#FF5100' : '#374151', backgroundColor: vista === 'oportunidades' ? '#FFF5F0' : 'transparent' }}
                >
                  📁 Oportunidades
                </button>
                <button
                  onClick={() => { setVista('cambios'); setMenuAbierto(false) }}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                  style={{ color: vista === 'cambios' ? '#FF5100' : '#374151', backgroundColor: vista === 'cambios' ? '#FFF5F0' : 'transparent' }}
                >
                  📝 Control de cambios
                </button>
                <button
                  onClick={() => { setVista('dashboard'); setMenuAbierto(false) }}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                  style={{ color: vista === 'dashboard' ? '#FF5100' : '#374151', backgroundColor: vista === 'dashboard' ? '#FFF5F0' : 'transparent' }}
                >
                  📈 Dashboard
                </button>
              </div>
            )}
          </div>

          {/* 2. OC (con submenú) */}
          <div>
            <button
              onClick={() => setSubmenuOC(!submenuOC)}
              className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100 flex items-center justify-between"
              style={{ color: ['solicitud-oc', 'admin-oc'].includes(vista) ? '#FF5100' : '#374151', backgroundColor: ['solicitud-oc', 'admin-oc'].includes(vista) ? '#FFF5F0' : 'transparent' }}
            >
              <span>🧾 OC</span>
              <svg className={`w-5 h-5 transition-transform ${submenuOC ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Submenú OC */}
            {submenuOC && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                <button
                  onClick={() => { setVista('solicitud-oc'); setMenuAbierto(false) }}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                  style={{ color: vista === 'solicitud-oc' ? '#FF5100' : '#374151', backgroundColor: vista === 'solicitud-oc' ? '#FFF5F0' : 'transparent' }}
                >
                  📝 Solicitud OC
                </button>
                {perfil?.rol === 'admin' && (
                  <button
                    onClick={() => { setVista('admin-oc'); setMenuAbierto(false) }}
                    className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
                    style={{ color: vista === 'admin-oc' ? '#FF5100' : '#374151', backgroundColor: vista === 'admin-oc' ? '#FFF5F0' : 'transparent' }}
                  >
                    🔧 Administración de OC
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Solicitud egreso */}
          <button
            onClick={() => { setVista('solicitud-egreso'); setMenuAbierto(false) }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'solicitud-egreso' ? '#FF5100' : '#374151', backgroundColor: vista === 'solicitud-egreso' ? '#FFF5F0' : 'transparent' }}
          >
            💸 Solicitud egreso
          </button>

          {/* 4. Ingreso HH */}
          <button
            onClick={() => { setVista('ingreso-hh'); setMenuAbierto(false) }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'ingreso-hh' ? '#FF5100' : '#374151', backgroundColor: vista === 'ingreso-hh' ? '#FFF5F0' : 'transparent' }}
          >
            ⏱️ Ingreso HH
          </button>

          {/* 5. Config (solo admin) */}
          {perfil?.rol === 'admin' && (
            <button
              onClick={() => { setVista('usuarios'); setMenuAbierto(false) }}
              className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
              style={{ color: vista === 'usuarios' ? '#FF5100' : '#374151', backgroundColor: vista === 'usuarios' ? '#FFF5F0' : 'transparent' }}
            >
              ⚙️ Config
            </button>
          )}

          {/* 6. Sugerencias */}
          <button
            onClick={() => { setVista('sugerencias'); setMenuAbierto(false) }}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-gray-100"
            style={{ color: vista === 'sugerencias' ? '#FF5100' : '#374151', backgroundColor: vista === 'sugerencias' ? '#FFF5F0' : 'transparent' }}
          >
            💡 Sugerencias
          </button>

          <hr className="my-2" />

          {/* 7. Cerrar sesión */}
          <button
            onClick={logout}
            className="w-full text-left px-4 py-3 rounded-lg font-medium transition-all hover:bg-red-50 text-red-600"
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido principal con margen superior para el header fixed */}
      <div className="pt-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            
            {vista === 'dashboard' && (
              <Dashboard />
            )}

            {vista === 'proyectos-base' && (
              <VistaProyectosBase user={user} />
            )}

            {vista === 'oportunidades' && (
              <VistaOportunidades user={user} />
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
                borrarSugerencia={borrarSugerencia}
                perfil={perfil}
                user={user}
                loading={loading}
              />
            )}

            {vista === 'solicitud-oc' && (
              <VistaSolicitudOC key={Date.now()} user={user} perfil={perfil} />
            )}

            {vista === 'admin-oc' && perfil?.rol === 'admin' && (
              <AdministracionOC perfil={perfil} />
            )}

            {vista === 'solicitud-egreso' && (
              <div>
                <h2 className="text-2xl font-bold mb-6" style={{ color: '#FF5100' }}>
                  💸 Solicitud de Egreso
                </h2>
                <div className="bg-gray-50 rounded-lg p-12 text-center">
                  <p className="text-gray-600 text-lg mb-4">Esta funcionalidad estará disponible próximamente.</p>
                  <p className="text-gray-500 text-sm">Aquí podrás crear y gestionar solicitudes de egreso.</p>
                </div>
              </div>
            )}

            {vista === 'ingreso-hh' && (
              <div>
                <h2 className="text-2xl font-bold mb-6" style={{ color: '#FF5100' }}>
                  ⏱️ Ingreso de Horas Hombre
                </h2>
                <div className="bg-gray-50 rounded-lg p-12 text-center">
                  <p className="text-gray-600 text-lg mb-4">Esta funcionalidad estará disponible próximamente.</p>
                  <p className="text-gray-500 text-sm">Aquí podrás registrar y gestionar las horas hombre de tus proyectos.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmacion && (
        <ConfirmModal
          mensaje={confirmacion.mensaje}
          tipo={confirmacion.tipo}
          onConfirmar={confirmacion.onConfirmar}
          onCancelar={() => setConfirmacion(null)}
        />
      )}

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
    </>
  )
}

export default App
