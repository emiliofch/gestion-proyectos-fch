import { useEffect, useMemo, useState } from 'react'
import FilterableTh from './FilterableTh'

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '-'
  const n = parseFloat(v)
  return Number.isNaN(n) ? v : n.toFixed(1)
}

export default function VistaControlCambios({ cambiosFiltrados, tipoControlCambios, setTipoControlCambios, perfil, onEliminarCambio }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('fecha')
  const [ordenDir, setOrdenDir] = useState('desc')
  const [pagina, setPagina] = useState(0)
  const FILAS_POR_PAGINA = 10
  const esAdmin = perfil?.rol === 'admin'

  const esVistaEstados = tipoControlCambios === 'estado'
  const muestraProyecto = tipoControlCambios === 'valor' || tipoControlCambios === 'proyecto' || esVistaEstados
  const muestraCampo = !esVistaEstados
  const muestraAnteriorNuevo = tipoControlCambios === 'valor' || esVistaEstados

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  useEffect(() => {
    setBusqueda('')
    setFiltros({})
    setDropdownFiltro(null)
    setOrdenCol('fecha')
    setOrdenDir('desc')
    setPagina(0)
  }, [tipoControlCambios])

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenCol, ordenDir])

  function setFiltro(col, valor) {
    setFiltros((prev) => ({ ...prev, [col]: valor }))
  }

  function toggleOrden(col) {
    if (ordenCol === col) {
      setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrdenCol(col)
      setOrdenDir('asc')
    }
  }

  const coincideFiltros = useMemo(() => (c, omitirCol = null) => {
    const q = busqueda.toLowerCase()
    const fechaStr = c.fecha ? new Date(c.fecha).toLocaleDateString('es-CL') : ''
    const matchBusqueda = !q || [c.proyecto_nombre, c.campo, c.usuario, c.motivo, String(c.valor_anterior ?? ''), String(c.valor_nuevo ?? ''), fechaStr].some(v => (v || '').toLowerCase().includes(q))
    const matchProyecto = omitirCol === 'proyecto' || !filtros.proyecto?.length || filtros.proyecto.includes(c.proyecto_nombre)
    const matchCampo = omitirCol === 'campo' || !filtros.campo?.length || filtros.campo.includes(c.campo)
    const matchFecha = omitirCol === 'fecha' || !filtros.fecha?.length || filtros.fecha.includes(fechaStr)
    const matchAnterior = omitirCol === 'anterior' || !filtros.anterior?.length || filtros.anterior.includes(String(c.valor_anterior ?? ''))
    const matchUsuario = omitirCol === 'usuario' || !filtros.usuario?.length || filtros.usuario.includes(c.usuario)
    const matchMotivo = omitirCol === 'motivo' || !filtros.motivo?.length || filtros.motivo.includes(c.motivo)
    const matchEstadoNuevo = omitirCol === 'estadoNuevo' || !filtros.estadoNuevo?.length || filtros.estadoNuevo.includes(c.valor_nuevo)
    return matchBusqueda && matchProyecto && matchCampo && matchFecha && matchAnterior && matchUsuario && matchMotivo && matchEstadoNuevo
  }, [filtros, busqueda])

  const opcionesPorColumna = useMemo(() => (col, obtenerValor) => {
    const visibles = cambiosFiltrados.filter((c) => coincideFiltros(c, col))
    const base = visibles.map(obtenerValor).filter(Boolean)
    const seleccionadas = Array.isArray(filtros[col]) ? filtros[col] : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }, [cambiosFiltrados, coincideFiltros, filtros])

  const opcionesProyecto = useMemo(() => opcionesPorColumna('proyecto', (c) => c.proyecto_nombre), [opcionesPorColumna])
  const opcionesCampo = useMemo(() => opcionesPorColumna('campo', (c) => c.campo), [opcionesPorColumna])
  const opcionesFecha = useMemo(() => opcionesPorColumna('fecha', (c) => c.fecha ? new Date(c.fecha).toLocaleDateString('es-CL') : null), [opcionesPorColumna])
  const opcionesAnterior = useMemo(() => opcionesPorColumna('anterior', (c) => String(c.valor_anterior ?? '') || null), [opcionesPorColumna])
  const opcionesUsuario = useMemo(() => opcionesPorColumna('usuario', (c) => c.usuario), [opcionesPorColumna])
  const opcionesMotivo = useMemo(() => opcionesPorColumna('motivo', (c) => c.motivo), [opcionesPorColumna])
  const opcionesEstadoNuevo = useMemo(() => opcionesPorColumna('estadoNuevo', (c) => c.valor_nuevo), [opcionesPorColumna])

  const cambiosConFiltros = useMemo(() => cambiosFiltrados.filter((c) => coincideFiltros(c)).sort((a, b) => {
    let vA = ''
    let vB = ''
    if (ordenCol === 'proyecto') { vA = a.proyecto_nombre || ''; vB = b.proyecto_nombre || '' }
    if (ordenCol === 'fecha') { vA = new Date(a.fecha).getTime() || 0; vB = new Date(b.fecha).getTime() || 0 }
    if (ordenCol === 'campo') { vA = a.campo || ''; vB = b.campo || '' }
    if (ordenCol === 'anterior') { vA = parseFloat(a.valor_anterior) || 0; vB = parseFloat(b.valor_anterior) || 0 }
    if (ordenCol === 'nuevo') { vA = parseFloat(a.valor_nuevo) || 0; vB = parseFloat(b.valor_nuevo) || 0 }
    if (ordenCol === 'usuario') { vA = a.usuario || ''; vB = b.usuario || '' }
    if (ordenCol === 'motivo') { vA = a.motivo || ''; vB = b.motivo || '' }
    if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
    return ordenDir === 'asc' ? vA - vB : vB - vA
  }), [cambiosFiltrados, coincideFiltros, ordenCol, ordenDir])

  const totalColumnas = (muestraProyecto ? 1 : 0) + 1 + (muestraCampo ? 1 : 0) + (muestraAnteriorNuevo ? 2 : 0) + 1 + 1 + (esAdmin ? 1 : 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center flex-shrink-0 pb-3 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Control de Cambios</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => setTipoControlCambios('valor')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'valor' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'valor' ? '#FF5100' : '' }}
            title="Ver cambios de valores"
          >
            Cambios de Valores
          </button>
          <button
            onClick={() => setTipoControlCambios('proyecto')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'proyecto' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'proyecto' ? '#FF5100' : '' }}
            title="Ver creacion y eliminacion de proyectos"
          >
            Cambios de Proyectos
          </button>
          <button
            onClick={() => setTipoControlCambios('estado')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'estado' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'estado' ? '#FF5100' : '' }}
            title="Ver cambios de estado"
          >
            Estados
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
              {muestraProyecto && (
                <FilterableTh
                  col="proyecto"
                  label="Proyecto"
                  style={{ width: '180px' }}
                  opciones={opcionesProyecto}
                  filtro={filtros.proyecto || ''}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'proyecto'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'proyecto'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
              )}
              <FilterableTh
                col="fecha"
                label="Fecha"
                style={{ width: '150px' }}
                opciones={opcionesFecha}
                filtro={filtros.fecha || []}
                onFiltro={setFiltro}
                dropdownAbierto={dropdownFiltro === 'fecha'}
                onToggleDropdown={setDropdownFiltro}
                sortable
                ordenActiva={ordenCol === 'fecha'}
                ordenDir={ordenDir}
                onOrdenar={toggleOrden}
              />
              {muestraCampo && (
                <FilterableTh
                  col="campo"
                  label="Campo"
                  style={{ width: '130px' }}
                  opciones={opcionesCampo}
                  filtro={filtros.campo || ''}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'campo'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'campo'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
              )}
              {muestraAnteriorNuevo && (
                <>
                  <FilterableTh
                    col="anterior"
                    label={esVistaEstados ? 'Estado anterior' : 'Anterior'}
                    style={{ width: '130px' }}
                    opciones={opcionesAnterior}
                    filtro={filtros.anterior || []}
                    onFiltro={setFiltro}
                    dropdownAbierto={dropdownFiltro === 'anterior'}
                    onToggleDropdown={setDropdownFiltro}
                    sortable
                    ordenActiva={ordenCol === 'anterior'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="nuevo"
                    label={esVistaEstados ? 'Estado nuevo' : 'Nuevo'}
                    style={{ width: '130px' }}
                    opciones={esVistaEstados ? opcionesEstadoNuevo : []}
                    filtro={esVistaEstados ? (filtros.estadoNuevo || '') : []}
                    onFiltro={esVistaEstados ? ((_, valor) => setFiltro('estadoNuevo', valor)) : (() => {})}
                    dropdownAbierto={esVistaEstados ? dropdownFiltro === 'estadoNuevo' : false}
                    onToggleDropdown={esVistaEstados ? ((abierto) => setDropdownFiltro(abierto === 'nuevo' ? 'estadoNuevo' : abierto)) : (() => {})}
                    sortable
                    ordenActiva={ordenCol === 'nuevo'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                </>
              )}
              <FilterableTh
                col="usuario"
                label="Usuario"
                style={{ width: '170px' }}
                opciones={opcionesUsuario}
                filtro={filtros.usuario || ''}
                onFiltro={setFiltro}
                dropdownAbierto={dropdownFiltro === 'usuario'}
                onToggleDropdown={setDropdownFiltro}
                sortable
                ordenActiva={ordenCol === 'usuario'}
                ordenDir={ordenDir}
                onOrdenar={toggleOrden}
              />
              <FilterableTh
                col="motivo"
                label="Motivo"
                opciones={opcionesMotivo}
                filtro={filtros.motivo || []}
                onFiltro={setFiltro}
                dropdownAbierto={dropdownFiltro === 'motivo'}
                onToggleDropdown={setDropdownFiltro}
                sortable
                ordenActiva={ordenCol === 'motivo'}
                ordenDir={ordenDir}
                onOrdenar={toggleOrden}
              />
              {esAdmin && (
                <th className="py-3 px-4 text-gray-800 font-semibold text-center" style={{ width: '76px', backgroundColor: '#FFF5F0' }}>
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {cambiosConFiltros.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA).map((c) => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                {muestraProyecto && (
                  <td className="py-3 px-4 text-gray-800 font-medium">{c.proyecto_nombre || 'N/A'}</td>
                )}
                <td className="py-3 px-4 text-gray-800 text-sm">{new Date(c.fecha).toLocaleString()}</td>
                {muestraCampo && <td className="py-3 px-4 text-gray-800">{c.campo}</td>}
                {muestraAnteriorNuevo && (
                  <>
                    <td className="py-3 px-4 text-gray-800">{fmtVal(c.valor_anterior)}</td>
                    <td className="py-3 px-4 text-gray-800">{fmtVal(c.valor_nuevo)}</td>
                  </>
                )}
                <td className="py-3 px-4 text-gray-800">{c.usuario}</td>
                <td className="py-3 px-4 text-gray-800">{c.motivo}</td>
                {esAdmin && (
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onEliminarCambio?.(c.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Eliminar registro"
                      aria-label="Eliminar registro"
                    >
                      <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {cambiosConFiltros.length === 0 && (
              <tr>
                <td colSpan={totalColumnas} className="py-8 px-4 text-center text-gray-500">
                  No hay registros para esta vista.
                </td>
              </tr>
            )}
            {cambiosConFiltros.length > 0 && (
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td colSpan={totalColumnas} className="py-3 px-4 text-gray-800 text-sm">
                  TOTAL: {cambiosConFiltros.length} registro{cambiosConFiltros.length !== 1 ? 's' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {cambiosConFiltros.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 px-2 text-sm text-gray-600 flex-shrink-0 border-t border-gray-200">
          <span>{pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, cambiosConFiltros.length)} de {cambiosConFiltros.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPagina(p => p + 1)} disabled={(pagina + 1) * FILAS_POR_PAGINA >= cambiosConFiltros.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  )
}
