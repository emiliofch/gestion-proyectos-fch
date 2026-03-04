import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'

function mesActualIso() {
  return new Date().toISOString().slice(0, 7)
}

function primerDiaMes(yyyyMm) {
  return `${yyyyMm}-01`
}

export default function VistaIngresoHH({ user, perfil }) {
  const [mes, setMes] = useState(mesActualIso())
  const [proyectos, setProyectos] = useState([])
  const [registros, setRegistros] = useState([])
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState('')
  const [horasInput, setHorasInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarProyectos()
  }, [])

  useEffect(() => {
    cargarRegistrosMes()
  }, [mes, user?.id])

  async function cargarProyectos() {
    const { data, error } = await supabase
      .from('proyectos')
      .select('id, nombre')
      .order('nombre', { ascending: true })

    if (error) {
      toast.error('Error cargando proyectos: ' + error.message)
      setProyectos([])
      return
    }
    setProyectos(data || [])
  }

  async function cargarRegistrosMes() {
    if (!user?.id) return
    setLoading(true)
    const mesDb = primerDiaMes(mes)

    const { data, error } = await supabase
      .from('ingreso_hh')
      .select('id, proyecto_id, horas, proyectos:proyecto_id(id, nombre)')
      .eq('user_id', user.id)
      .eq('mes', mesDb)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Error cargando HH del mes: ' + error.message)
      setRegistros([])
    } else {
      setRegistros((data || []).map((r) => ({
        id: r.id,
        proyecto_id: r.proyecto_id,
        horas: Number(r.horas) || 0,
        proyecto_nombre: r.proyectos?.nombre || 'Proyecto',
      })))
    }
    setLoading(false)
  }

  const totalHoras = useMemo(
    () => Number(registros.reduce((acc, r) => acc + (Number(r.horas) || 0), 0).toFixed(2)),
    [registros],
  )

  const faltante = Number((170 - totalHoras).toFixed(2))
  const puedeGuardar = registros.length > 0 && totalHoras === 170

  function agregarOActualizarLinea() {
    if (!proyectoSeleccionado) {
      toast.error('Debes seleccionar un proyecto')
      return
    }

    const horas = Number(horasInput)
    if (!Number.isFinite(horas) || horas <= 0) {
      toast.error('Debes ingresar horas válidas (> 0)')
      return
    }

    const proyecto = proyectos.find((p) => p.id === proyectoSeleccionado)
    const nombre = proyecto?.nombre || 'Proyecto'

    setRegistros((prev) => {
      const existe = prev.find((r) => r.proyecto_id === proyectoSeleccionado)
      if (existe) {
        return prev.map((r) => (
          r.proyecto_id === proyectoSeleccionado
            ? { ...r, horas, proyecto_nombre: nombre }
            : r
        ))
      }
      return [...prev, { id: null, proyecto_id: proyectoSeleccionado, horas, proyecto_nombre: nombre }]
    })

    setProyectoSeleccionado('')
    setHorasInput('')
  }

  function actualizarHorasFila(proyectoId, valor) {
    const horas = Number(valor)
    setRegistros((prev) => prev.map((r) => (
      r.proyecto_id === proyectoId
        ? { ...r, horas: Number.isFinite(horas) ? horas : 0 }
        : r
    )))
  }

  function eliminarFila(proyectoId) {
    setRegistros((prev) => prev.filter((r) => r.proyecto_id !== proyectoId))
  }

  async function guardarMes() {
    if (!puedeGuardar) {
      toast.error('Solo puedes guardar cuando el total del mes sea exactamente 170 horas')
      return
    }
    if (!user?.id) return

    setGuardando(true)
    const mesDb = primerDiaMes(mes)

    const { error: errorDelete } = await supabase
      .from('ingreso_hh')
      .delete()
      .eq('user_id', user.id)
      .eq('mes', mesDb)

    if (errorDelete) {
      toast.error('Error limpiando registros previos: ' + errorDelete.message)
      setGuardando(false)
      return
    }

    const payload = registros.map((r) => ({
      user_id: user.id,
      proyecto_id: r.proyecto_id,
      mes: mesDb,
      horas: Number(r.horas),
      empresa: perfil?.empresa,
    }))

    const { error: errorInsert } = await supabase.from('ingreso_hh').insert(payload)
    if (errorInsert) {
      toast.error('Error guardando HH: ' + errorInsert.message)
      setGuardando(false)
      return
    }

    toast.success('Ingreso de HH guardado correctamente')
    await cargarRegistrosMes()
    setGuardando(false)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Ingreso de HH</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 font-medium">Mes</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-gray-700">
        Debes completar exactamente <strong>170 horas</strong> para guardar el mes.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 mb-4">
        <select
          value={proyectoSeleccionado}
          onChange={(e) => setProyectoSeleccionado(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Seleccionar proyecto...</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.5"
          min="0"
          value={horasInput}
          onChange={(e) => setHorasInput(e.target.value)}
          placeholder="Horas"
          className="px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          onClick={agregarOActualizarLinea}
          className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: '#FF5100' }}
        >
          Agregar/Actualizar
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 text-sm">
        <div className="text-gray-700">
          Total: <strong>{totalHoras}</strong> / 170
        </div>
        <div className={faltante > 0 ? 'text-orange-700' : faltante < 0 ? 'text-red-700' : 'text-green-700'}>
          {faltante > 0 && `Faltan ${faltante} horas`}
          {faltante < 0 && `Exceso de ${Math.abs(faltante)} horas`}
          {faltante === 0 && 'Total completo'}
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando datos del mes...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</th>
                <th className="text-right py-3 px-4 text-gray-800 font-semibold" style={{ width: '160px' }}>Horas</th>
                <th className="text-center py-3 px-4 text-gray-800 font-semibold" style={{ width: '90px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.proyecto_id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-800">{r.proyecto_nombre}</td>
                  <td className="py-3 px-4 text-right">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={r.horas}
                      onChange={(e) => actualizarHorasFila(r.proyecto_id, e.target.value)}
                      className="w-28 px-3 py-1 rounded border border-gray-300 text-right focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => eliminarFila(r.proyecto_id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 px-4 text-center text-gray-500">
                    No hay horas registradas para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="pt-4 flex justify-end">
        <button
          onClick={guardarMes}
          disabled={!puedeGuardar || guardando}
          className="px-5 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#FF5100' }}
        >
          {guardando ? 'Guardando...' : 'Guardar Mes'}
        </button>
      </div>
    </div>
  )
}
