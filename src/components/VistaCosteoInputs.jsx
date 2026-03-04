import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'

const TIPOS = [
  { value: 'GASTO_OPERACIONAL', label: 'Gasto Operacional' },
  { value: 'GASTO_RH', label: 'Gasto en Recurso Humano' },
]

const DEFAULT_PORCENTAJES = { imprevistos: 1, overhead: 5, margen: 10 }

function formatCLP(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0)
}

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function cloneData(v) {
  return JSON.parse(JSON.stringify(v))
}

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

export default function VistaCosteoInputs({ user, perfil, mode = 'nuevo' }) {
  const [rows, setRows] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [duracionMeses, setDuracionMeses] = useState(1)
  const [celdasActivas, setCeldasActivas] = useState({})
  const [nombreProyecto, setNombreProyecto] = useState('')
  const [proyectosGuardados, setProyectosGuardados] = useState([])
  const [selectedProyectoId, setSelectedProyectoId] = useState(null)
  const [porcentajes, setPorcentajes] = useState(DEFAULT_PORCENTAJES)
  const [ivaAplica, setIvaAplica] = useState(null)
  const [, setCargandoDatos] = useState(true)
  const [, setGuardandoDatos] = useState(false)
  const [hidratado, setHidratado] = useState(false)
  const [form, setForm] = useState({ item: '', valor: '', tipo: TIPOS[0].value })

  const isEditing = editingId !== null
  const isModoNuevo = mode === 'nuevo'
  const isModoEditar = mode === 'editar'
  const empresa = perfil?.empresa || 'CGV'
  const userId = user?.id || null

  const rowsRH = useMemo(() => rows.filter((row) => row.tipo === 'GASTO_RH'), [rows])
  const rowsOperacionales = useMemo(() => rows.filter((row) => row.tipo === 'GASTO_OPERACIONAL'), [rows])
  const rowsOrdenadas = useMemo(() => [...rowsRH, ...rowsOperacionales], [rowsRH, rowsOperacionales])
  const editingRow = useMemo(() => rows.find((row) => row.id === editingId) || null, [rows, editingId])

  const proyectosUsuario = useMemo(
    () => proyectosGuardados.filter((p) => !p.owner_id || p.owner_id === userId),
    [proyectosGuardados, userId]
  )

  const meses = useMemo(() => {
    const count = Math.max(1, Number(duracionMeses) || 1)
    return Array.from({ length: count }, (_, idx) => idx + 1)
  }, [duracionMeses])

  const totalesPorItem = useMemo(() => rows.reduce((acc, row) => {
    acc[row.id] = meses.reduce((sum, mes) => {
      const key = `${mes}-${row.id}`
      return sum + (celdasActivas[key] ? Number(row.valor) || 0 : 0)
    }, 0)
    return acc
  }, {}), [meses, rows, celdasActivas])

  const costoFch = useMemo(() => Object.values(totalesPorItem).reduce((acc, value) => acc + (Number(value) || 0), 0), [totalesPorItem])
  const imprevistosMonto = useMemo(() => costoFch * ((Number(porcentajes.imprevistos) || 0) / 100), [costoFch, porcentajes.imprevistos])
  const subtotal1 = costoFch + imprevistosMonto
  const overheadMonto = useMemo(() => costoFch * ((Number(porcentajes.overhead) || 0) / 100), [costoFch, porcentajes.overhead])
  const subtotal2 = subtotal1 + overheadMonto
  const margenMonto = useMemo(() => costoFch * ((Number(porcentajes.margen) || 0) / 100), [costoFch, porcentajes.margen])
  const pricingSinIva = subtotal2 + margenMonto
  const ivaMonto = useMemo(() => (ivaAplica ? pricingSinIva * 0.19 : 0), [ivaAplica, pricingSinIva])
  const pricingMasIva = pricingSinIva + ivaMonto

  function resetForm() {
    setEditingId(null)
    setForm({ item: '', valor: '', tipo: TIPOS[0].value })
  }

  function snapshotActual(overrides = {}) {
    return {
      rows: cloneData(overrides.rows ?? rows),
      duracionMeses: Number(overrides.duracionMeses ?? duracionMeses) || 1,
      celdasActivas: cloneData(overrides.celdasActivas ?? celdasActivas),
      porcentajes: cloneData(overrides.porcentajes ?? porcentajes),
      ivaAplica: overrides.ivaAplica ?? ivaAplica,
    }
  }

  function limpiarCosteoActual() {
    resetForm()
    setRows([])
    setDuracionMeses(1)
    setCeldasActivas({})
    setPorcentajes(DEFAULT_PORCENTAJES)
    setIvaAplica(null)
    setNombreProyecto('')
    setSelectedProyectoId(null)
  }

  function cargarSnapshot(snapshot, meta = {}) {
    resetForm()
    setRows(Array.isArray(snapshot?.rows) ? snapshot.rows : [])
    setDuracionMeses(Math.max(1, Number(snapshot?.duracionMeses) || 1))
    setCeldasActivas(snapshot?.celdasActivas && typeof snapshot.celdasActivas === 'object' ? snapshot.celdasActivas : {})
    setPorcentajes(snapshot?.porcentajes && typeof snapshot.porcentajes === 'object' ? {
      imprevistos: Number(snapshot.porcentajes.imprevistos) || 0,
      overhead: Number(snapshot.porcentajes.overhead) || 0,
      margen: Number(snapshot.porcentajes.margen) || 0,
    } : DEFAULT_PORCENTAJES)
    setIvaAplica(typeof snapshot?.ivaAplica === 'boolean' ? snapshot.ivaAplica : null)
    setNombreProyecto(meta.nombre || '')
    setSelectedProyectoId(meta.id || null)
  }

  // Intencional: hidrata datos base del usuario/empresa al entrar a la vista.
  useEffect(() => {
    async function cargarProceso() {
      if (!userId) {
        setCargandoDatos(false)
        setHidratado(true)
        return
      }

      setCargandoDatos(true)
      const { data, error } = await supabase
        .from('costeo_procesos')
        .select('duracion_meses, inputs, celdas_activas')
        .eq('user_id', userId)
        .eq('empresa', empresa)
        .maybeSingle()

      if (error) {
        console.error('Error cargando proceso de costeo:', error)
        toast.error('No se pudo cargar el proceso de costeo')
      } else if (data) {
        const meta = data.celdas_activas || {}
        const lista = Array.isArray(meta.__proyectos_guardados) ? meta.__proyectos_guardados : []
        setProyectosGuardados(lista)

        if (isModoNuevo) {
          limpiarCosteoActual()
          setCargandoDatos(false)
          setHidratado(true)
          return
        }

        if (meta.__selected_proyecto_id) {
          const selected = lista.find((p) => p.id === meta.__selected_proyecto_id)
          if (selected?.snapshot) {
            cargarSnapshot(selected.snapshot, { nombre: selected.nombre, id: selected.id })
          } else {
            cargarSnapshot({
              rows: data.inputs || [],
              duracionMeses: data.duracion_meses || 1,
              celdasActivas: meta,
              porcentajes: meta.__porcentajes || DEFAULT_PORCENTAJES,
              ivaAplica: typeof meta.__iva_aplica === 'boolean' ? meta.__iva_aplica : null,
            }, { nombre: meta.__nombre_proyecto || '' })
          }
        } else {
          cargarSnapshot({
            rows: data.inputs || [],
            duracionMeses: data.duracion_meses || 1,
            celdasActivas: meta,
            porcentajes: meta.__porcentajes || DEFAULT_PORCENTAJES,
            ivaAplica: typeof meta.__iva_aplica === 'boolean' ? meta.__iva_aplica : null,
          }, { nombre: meta.__nombre_proyecto || '' })
        }
      }

      setCargandoDatos(false)
      setHidratado(true)
    }

    cargarProceso()
  }, [userId, empresa, isModoNuevo])

  // Intencional: en modo nuevo siempre se parte con formulario limpio.
  useEffect(() => {
    if (isModoNuevo) {
      limpiarCosteoActual()
    }
  }, [isModoNuevo])

  // Intencional: autosave por debounce sobre estado actual.
  useEffect(() => {
    if (!hidratado || !userId) return undefined
    const timeoutId = setTimeout(() => { guardarProceso(true) }, 800)
    return () => clearTimeout(timeoutId)
  }, [rows, duracionMeses, celdasActivas, porcentajes, ivaAplica, nombreProyecto, proyectosGuardados, selectedProyectoId, hidratado, userId, empresa])

  async function guardarProceso(silencioso = false, overrides = {}) {
    if (!userId) return

    setGuardandoDatos(true)
    const payload = {
      user_id: userId,
      empresa,
      duracion_meses: Math.max(1, Number(overrides.duracionMeses ?? duracionMeses) || 1),
      inputs: overrides.rows ?? rows,
      celdas_activas: {
        ...(overrides.celdasActivas ?? celdasActivas),
        __nombre_proyecto: overrides.nombreProyecto ?? nombreProyecto,
        __proyectos_guardados: overrides.proyectosGuardados ?? proyectosGuardados,
        __porcentajes: overrides.porcentajes ?? porcentajes,
        __iva_aplica: overrides.ivaAplica ?? ivaAplica,
        __selected_proyecto_id: overrides.selectedProyectoId ?? selectedProyectoId,
      },
    }

    const { error } = await supabase.from('costeo_procesos').upsert(payload, { onConflict: 'user_id,empresa' })
    setGuardandoDatos(false)

    if (error) {
      console.error('Error guardando proceso de costeo:', error)
      if (!silencioso) toast.error('No se pudo guardar el proceso de costeo')
      return
    }
    if (!silencioso) toast.success('Proceso de costeo guardado')
  }

  function handleSubmit(event, forcedTipo = form.tipo) {
    event.preventDefault()

    const item = form.item.trim()
    const valor = Number(form.valor)
    const tipo = forcedTipo
    if (!item) return toast.warning('Debes ingresar un item.')
    if (!Number.isFinite(valor) || valor < 0) return toast.warning('Debes ingresar un valor numerico valido.')
    if (!TIPOS.some((t) => t.value === tipo)) return toast.warning('Tipo de input invalido.')
    if (isEditing && editingRow && editingRow.tipo !== tipo) {
      return toast.warning('Finaliza la edicion en su misma seccion.')
    }

    if (isEditing) {
      setRows((prev) => prev.map((row) => row.id === editingId ? { ...row, item, valor, tipo } : row))
      toast.success('Input actualizado.')
      return resetForm()
    }

    setRows((prev) => [...prev, { id: makeId(), item, valor, tipo }])
    toast.success('Input agregado.')
    resetForm()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({ item: row.item, valor: String(row.valor), tipo: row.tipo })
  }

  function handleDelete(id) {
    setRows((prev) => prev.filter((row) => row.id !== id))
    setCeldasActivas((prev) => {
      const next = {}
      Object.entries(prev).forEach(([key, value]) => { if (!key.endsWith(`-${id}`)) next[key] = value })
      return next
    })
    if (editingId === id) resetForm()
    toast.success('Input eliminado.')
  }

  function toggleCelda(mes, rowId) {
    const key = `${mes}-${rowId}`
    setCeldasActivas((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function guardarCosteoProyecto({ guardarComo = false } = {}) {
    const nombre = nombreProyecto.trim()
    if (!nombre) return toast.warning('Debes ingresar el nombre del proyecto a costear.')
    if (ivaAplica === null) return toast.warning('Debes indicar si el IVA aplica (si/no) antes de guardar.')

    const snapshot = snapshotActual()
    const base = {
      owner_id: userId,
      nombre,
      fecha: new Date().toISOString(),
      costoFch,
      pricingMasIva,
      snapshot,
    }

    let next = [...proyectosGuardados]

    if (!guardarComo && selectedProyectoId) {
      next = next.map((p) => p.id === selectedProyectoId ? { ...p, ...base, id: p.id } : p)
    } else if (!guardarComo) {
      const byName = next.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
      if (byName) {
        next = next.map((p) => p.id === byName.id ? { ...p, ...base, id: p.id } : p)
      } else {
        next = [{ ...base, id: makeId() }, ...next]
      }
    } else {
      next = [{ ...base, id: makeId(), nombre: `${nombre} (copia)` }, ...next]
    }

    setProyectosGuardados(next)

    if (isModoEditar && !guardarComo) {
      const actual = next.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase()) || next.find((p) => p.id === selectedProyectoId)
      if (actual?.snapshot) {
        setSelectedProyectoId(actual.id)
        await guardarProceso(false, {
          proyectosGuardados: next,
          selectedProyectoId: actual.id,
          nombreProyecto: actual.nombre,
        })
        toast.success('Costeo actualizado')
        return
      }
    }

    await guardarProceso(false, {
      proyectosGuardados: next,
      selectedProyectoId: null,
      nombreProyecto: '',
      rows: [],
      duracionMeses: 1,
      celdasActivas: {},
      porcentajes: DEFAULT_PORCENTAJES,
      ivaAplica: null,
    })

    limpiarCosteoActual()
    toast.success('Costeo guardado y formulario reiniciado')
  }

  async function duplicarProyecto(proyecto) {
    if (!proyecto?.snapshot) return toast.warning('Este proyecto no tiene detalle completo guardado.')
    const next = [{
      ...proyecto,
      id: makeId(),
      nombre: `${proyecto.nombre} (copia)`,
      fecha: new Date().toISOString(),
      owner_id: userId,
      snapshot: cloneData(proyecto.snapshot),
    }, ...proyectosGuardados]
    setProyectosGuardados(next)
    await guardarProceso(false, { proyectosGuardados: next })
    toast.success('Proyecto duplicado')
  }

  async function renombrarProyecto(proyecto) {
    const nuevoNombre = window.prompt('Nuevo nombre del proyecto', proyecto.nombre)
    if (!nuevoNombre || !nuevoNombre.trim()) return
    const clean = nuevoNombre.trim()
    const next = proyectosGuardados.map((p) => p.id === proyecto.id ? { ...p, nombre: clean } : p)
    setProyectosGuardados(next)
    if (selectedProyectoId === proyecto.id) setNombreProyecto(clean)
    await guardarProceso(false, { proyectosGuardados: next, nombreProyecto: selectedProyectoId === proyecto.id ? clean : nombreProyecto })
    toast.success('Proyecto renombrado')
  }

  async function eliminarProyecto(proyecto) {
    if (!window.confirm(`¿Eliminar costeo "${proyecto.nombre}"?`)) return
    const next = proyectosGuardados.filter((p) => p.id !== proyecto.id)
    setProyectosGuardados(next)

    if (selectedProyectoId === proyecto.id) {
      limpiarCosteoActual()
      await guardarProceso(false, {
        proyectosGuardados: next,
        selectedProyectoId: null,
        nombreProyecto: '',
        rows: [],
        duracionMeses: 1,
        celdasActivas: {},
        porcentajes: DEFAULT_PORCENTAJES,
        ivaAplica: null,
      })
    } else {
      await guardarProceso(false, { proyectosGuardados: next })
    }
    toast.success('Proyecto eliminado')
  }

  function abrirCosteoGuardado(proyecto) {
    if (!proyecto?.snapshot) return toast.warning('Este proyecto no tiene detalle completo guardado.')
    cargarSnapshot(proyecto.snapshot, { nombre: proyecto.nombre, id: proyecto.id })
    toast.success(`Proyecto cargado: ${proyecto.nombre}`)
  }

  function exportarExcelCosteo() {
    const data = [
      ['Temporalidad de Proyecto'],
      ['Item', 'Tipo', ...meses.map((m) => `Mes ${m}`), 'Total'],
      ...rowsOrdenadas.map((row) => [
        row.item,
        TIPOS.find((t) => t.value === row.tipo)?.label || row.tipo,
        ...meses.map((mes) => (celdasActivas[`${mes}-${row.id}`] ? 'X' : '')),
        Number(totalesPorItem[row.id] || 0),
      ]),
      [],
      ['Concepto', 'Valor'],
      ['Costo FCH', costoFch],
      ['Imprevistos (%)', Number(porcentajes.imprevistos) || 0],
      ['Imprevistos ($)', imprevistosMonto],
      ['Subtotal 1', subtotal1],
      ['Overhead (%)', Number(porcentajes.overhead) || 0],
      ['Overhead ($)', overheadMonto],
      ['Subtotal 2', subtotal2],
      ['Margen (%)', Number(porcentajes.margen) || 0],
      ['Margen ($)', margenMonto],
      ['Pricing (sin IVA)', pricingSinIva],
      ['IVA aplica', ivaAplica === null ? 'No definido' : ivaAplica ? 'Si' : 'No'],
      ['IVA ($)', ivaMonto],
      ['Pricing (+ IVA)', pricingMasIva],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Costeo')
    const safe = (nombreProyecto || 'costeo').replace(/[\\/:*?"<>|]/g, '_')
    XLSX.writeFile(wb, `costeo_${safe}_${buildTimestamp()}.xlsx`)
  }

  function exportarPdfCosteo() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(`Costeo: ${nombreProyecto || 'Sin nombre'}`, 14, 16)
    autoTable(doc, {
      startY: 22,
      head: [['Concepto', 'Valor']],
      body: [
        ['Costo FCH', formatCLP(costoFch)],
        ['Imprevistos (%)', `${Number(porcentajes.imprevistos) || 0}%`],
        ['Imprevistos ($)', formatCLP(imprevistosMonto)],
        ['Subtotal 1', formatCLP(subtotal1)],
        ['Overhead (%)', `${Number(porcentajes.overhead) || 0}%`],
        ['Overhead ($)', formatCLP(overheadMonto)],
        ['Subtotal 2', formatCLP(subtotal2)],
        ['Margen (%)', `${Number(porcentajes.margen) || 0}%`],
        ['Margen ($)', formatCLP(margenMonto)],
        ['Pricing (sin IVA)', formatCLP(pricingSinIva)],
        ['IVA aplica', ivaAplica === null ? 'No definido' : ivaAplica ? 'Si' : 'No'],
        ['IVA ($)', formatCLP(ivaMonto)],
        ['Pricing (+ IVA)', formatCLP(pricingMasIva)],
      ],
      headStyles: { fillColor: [255, 81, 0] },
      styles: { fontSize: 10 },
    })
    const safe = (nombreProyecto || 'costeo').replace(/[\\/:*?"<>|]/g, '_')
    doc.save(`costeo_${safe}_${buildTimestamp()}.pdf`)
  }

  return (
    <div>
      {isModoEditar && (
        <>
          <h2 className="text-2xl font-bold mt-2 mb-4" style={{ color: '#FF5100' }}>Editar Costeo</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">Costeos existentes</h3>
            <div className="overflow-x-auto border border-gray-300 rounded-lg bg-white">
              <table className="w-full text-sm">
                <thead className="bg-[#FFF5F0]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Proyecto</th>
                    <th className="text-right px-3 py-2 font-semibold">Costo FCH</th>
                    <th className="text-right px-3 py-2 font-semibold">Pricing (+ IVA)</th>
                    <th className="text-left px-3 py-2 font-semibold">Fecha</th>
                    <th className="text-left px-3 py-2 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectosUsuario.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                        Aún no hay proyectos de costeo guardados.
                      </td>
                    </tr>
                  )}
                  {proyectosUsuario.map((p) => (
                    <tr
                      key={`${p.id}-${p.fecha}`}
                      className="border-t border-gray-100 cursor-pointer hover:bg-orange-50"
                      onClick={() => abrirCosteoGuardado(p)}
                      title="Click para abrir este costeo"
                    >
                      <td className="px-3 py-2">{p.nombre}</td>
                      <td className="px-3 py-2 text-right">{formatCLP(p.costoFch)}</td>
                      <td className="px-3 py-2 text-right">{formatCLP(p.pricingMasIva)}</td>
                      <td className="px-3 py-2">{p.fecha ? new Date(p.fecha).toLocaleString('es-CL') : '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); abrirCosteoGuardado(p) }} className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">Abrir</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); duplicarProyecto(p) }} className="px-2 py-1 rounded bg-purple-50 text-purple-700 font-medium">Duplicar</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); renombrarProyecto(p) }} className="px-2 py-1 rounded bg-gray-200 text-gray-800 font-medium">Renombrar</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); eliminarProyecto(p) }} className="px-2 py-1 rounded bg-red-50 text-red-700 font-medium">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#FF5100' }}>Costos</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Costo de Recurso Humano</h3>
        <form onSubmit={(event) => handleSubmit(event, 'GASTO_RH')} className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value, tipo: 'GASTO_RH' })} className="px-3 py-2 border rounded-lg" placeholder="Item" />
            <input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value, tipo: 'GASTO_RH' })} className="px-3 py-2 border rounded-lg" placeholder="Valor" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: '#FF5100' }}>{isEditing && editingRow?.tipo === 'GASTO_RH' ? 'Guardar' : 'Agregar'}</button>
              {isEditing && <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-gray-200 font-medium">Cancelar</button>}
            </div>
          </div>
        </form>
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#FFF5F0]"><tr><th className="text-left px-4 py-3 font-semibold">Item</th><th className="text-right px-4 py-3 font-semibold">Valor</th><th className="text-left px-4 py-3 font-semibold">Acciones</th></tr></thead>
            <tbody>
              {rowsRH.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">No hay costos de recurso humano.</td></tr>}
              {rowsRH.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.item}</td>
                  <td className="px-4 py-3 text-right">{formatCLP(row.valor)}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => handleEdit(row)} className="px-3 py-1 rounded bg-blue-50 text-blue-700 font-medium">Editar</button><button type="button" onClick={() => handleDelete(row.id)} className="px-3 py-1 rounded bg-red-50 text-red-700 font-medium">Quitar</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Costos Operacionales</h3>
        <form onSubmit={(event) => handleSubmit(event, 'GASTO_OPERACIONAL')} className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value, tipo: 'GASTO_OPERACIONAL' })} className="px-3 py-2 border rounded-lg" placeholder="Item" />
            <input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value, tipo: 'GASTO_OPERACIONAL' })} className="px-3 py-2 border rounded-lg" placeholder="Valor" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: '#FF5100' }}>{isEditing && editingRow?.tipo === 'GASTO_OPERACIONAL' ? 'Guardar' : 'Agregar'}</button>
              {isEditing && <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-gray-200 font-medium">Cancelar</button>}
            </div>
          </div>
        </form>
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#FFF5F0]"><tr><th className="text-left px-4 py-3 font-semibold">Item</th><th className="text-right px-4 py-3 font-semibold">Valor</th><th className="text-left px-4 py-3 font-semibold">Acciones</th></tr></thead>
            <tbody>
              {rowsOperacionales.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">No hay costos operacionales.</td></tr>}
              {rowsOperacionales.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.item}</td>
                  <td className="px-4 py-3 text-right">{formatCLP(row.valor)}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => handleEdit(row)} className="px-3 py-1 rounded bg-blue-50 text-blue-700 font-medium">Editar</button><button type="button" onClick={() => handleDelete(row.id)} className="px-3 py-1 rounded bg-red-50 text-red-700 font-medium">Quitar</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#FF5100' }}>Temporalidad de Proyecto</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Duracion del proyecto (meses)</label><input type="number" min="1" step="1" value={duracionMeses} onChange={(e) => setDuracionMeses(Math.max(1, Number(e.target.value) || 1))} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="md:col-span-2" />
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#FFF5F0]"><tr><th className="text-left px-4 py-3 font-semibold">Tipo de costo</th><th className="text-left px-4 py-3 font-semibold">Item</th>{meses.map((mes) => <th key={mes} className="text-center px-4 py-3 font-semibold min-w-24">Mes {mes}</th>)}<th className="text-right px-4 py-3 font-semibold">Total</th></tr></thead>
            <tbody>
              {rowsOrdenadas.map((row) => (<tr key={row.id} className="border-t border-gray-100"><td className="px-4 py-3">{TIPOS.find((t) => t.value === row.tipo)?.label || row.tipo}</td><td className="px-4 py-3 font-medium">{row.item}</td>{meses.map((mes) => { const key = `${mes}-${row.id}`; return <td key={key} className="px-4 py-3 text-center"><input type="checkbox" checked={Boolean(celdasActivas[key])} onChange={() => toggleCelda(mes, row.id)} className="h-4 w-4 accent-[#FF5100]" /></td> })}<td className="px-4 py-3 text-right font-semibold">{formatCLP(totalesPorItem[row.id] || 0)}</td></tr>))}
              {rows.length === 0 && <tr><td colSpan={meses.length + 3} className="px-4 py-8 text-center text-gray-500">Agrega inputs para generar la matriz de costeo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#FF5100' }}>Costeo</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={exportarExcelCosteo} className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium">Exportar Excel</button>
          <button type="button" onClick={exportarPdfCosteo} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">Exportar PDF</button>
        </div>
        <div className="overflow-x-auto border border-gray-300 rounded-lg bg-white">
          <table className="w-full text-sm"><tbody>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Costo FCH</td><td className="px-3 py-2 text-right font-semibold">{formatCLP(costoFch)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Imprevistos (%)</td><td className="px-3 py-2 text-right"><input type="number" step="0.01" min="0" value={porcentajes.imprevistos} onChange={(e) => setPorcentajes((p) => ({ ...p, imprevistos: Math.max(0, Number(e.target.value) || 0) }))} className="w-24 px-2 py-1 border rounded text-right" /></td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Imprevistos ($)</td><td className="px-3 py-2 text-right">{formatCLP(imprevistosMonto)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Subtotal 1</td><td className="px-3 py-2 text-right font-semibold">{formatCLP(subtotal1)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Overhead (%)</td><td className="px-3 py-2 text-right"><input type="number" step="0.01" min="0" value={porcentajes.overhead} onChange={(e) => setPorcentajes((p) => ({ ...p, overhead: Math.max(0, Number(e.target.value) || 0) }))} className="w-24 px-2 py-1 border rounded text-right" /></td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Overhead ($)</td><td className="px-3 py-2 text-right">{formatCLP(overheadMonto)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Subtotal 2</td><td className="px-3 py-2 text-right font-semibold">{formatCLP(subtotal2)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Margen (%)</td><td className="px-3 py-2 text-right"><input type="number" step="0.01" min="0" value={porcentajes.margen} onChange={(e) => setPorcentajes((p) => ({ ...p, margen: Math.max(0, Number(e.target.value) || 0) }))} className="w-24 px-2 py-1 border rounded text-right" /></td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Margen ($)</td><td className="px-3 py-2 text-right">{formatCLP(margenMonto)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">Pricing (sin IVA)</td><td className="px-3 py-2 text-right font-semibold">{formatCLP(pricingSinIva)}</td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">IVA</td><td className="px-3 py-2 text-right"><select value={ivaAplica === null ? '' : ivaAplica ? 'SI' : 'NO'} onChange={(e) => setIvaAplica(e.target.value === '' ? null : e.target.value === 'SI')} className="w-24 px-2 py-1 border rounded text-right"><option value="">Elegir</option><option value="SI">Si</option><option value="NO">No</option></select></td></tr>
            <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold bg-gray-100">IVA ($)</td><td className="px-3 py-2 text-right">{formatCLP(ivaMonto)}</td></tr>
            <tr><td className="px-3 py-2 font-semibold bg-gray-100">Pricing (+ IVA)</td><td className="px-3 py-2 text-right font-bold">{formatCLP(pricingMasIva)}</td></tr>
          </tbody></table>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#FF5100' }}>Guardar Costeo</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="text" value={nombreProyecto} onChange={(e) => setNombreProyecto(e.target.value)} className="flex-1 min-w-64 px-3 py-2 border rounded-lg" placeholder="Nombre del proyecto a costear" />
          <button type="button" onClick={() => guardarCosteoProyecto({ guardarComo: false })} className="px-4 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: '#FF5100' }}>Guardar costeo</button>
          <button type="button" onClick={() => guardarCosteoProyecto({ guardarComo: true })} className="px-4 py-2 rounded-lg bg-gray-200 font-medium">Guardar como...</button>
        </div>

        {isModoNuevo && (
          <div className="text-sm text-gray-600">
            Al guardar, este costeo se agregará a la lista disponible en <strong>Editar Costeo</strong>.
          </div>
        )}
      </div>
    </div>
  )
}

