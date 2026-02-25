import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmtCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)
}

function num(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

export default function VistaCosteo() {
  const [inputs, setInputs] = useState([])
  const [sheetGenerated, setSheetGenerated] = useState(false)
  const [rows, setRows] = useState([])
  const [pricing, setPricing] = useState({ imprevistos: 0.05, overhead: 0.1, margen: 0.2 })

  const [newItem, setNewItem] = useState({ tipo: 'GGOO', nombre: '', valor: '' })
  const [removeId, setRemoveId] = useState('')
  const [extraItem, setExtraItem] = useState({ tipo: 'GGOO', nombre: '', valor: '' })
  const [pricingDraft, setPricingDraft] = useState({
    imprevistos: 5,
    overhead: 10,
    margen: 20,
  })

  function addInput(payload, extra = false) {
    const name = payload.nombre.trim()
    const value = num(payload.valor)
    if (!name) return toast.warning('Debes ingresar nombre del ítem')
    if (value <= 0) return toast.warning('Debes ingresar un valor numérico mayor a 0')

    const item = {
      id: crypto.randomUUID(),
      tipo: payload.tipo,
      nombre: name,
      valor: value,
    }
    setInputs((prev) => [...prev, item])

    if (extra && sheetGenerated) {
      setRows((prev) => [...prev, { ...item, plan: Array(12).fill(0) }])
    }

    return item
  }

  function handleAddInput() {
    const item = addInput(newItem, false)
    if (!item) return
    setNewItem({ tipo: 'GGOO', nombre: '', valor: '' })
    toast.success('Ítem agregado en INPUTS')
  }

  function handleDeleteInput() {
    if (!removeId) return toast.warning('Selecciona un ítem para eliminar')
    const toDelete = inputs.find((x) => x.id === removeId)
    setInputs((prev) => prev.filter((x) => x.id !== removeId))
    if (sheetGenerated) {
      setRows((prev) => prev.filter((x) => x.id !== removeId))
    }
    setRemoveId('')
    toast.success(`Ítem eliminado: ${toDelete?.nombre || ''}`)
  }

  function handleGenerateSheet() {
    if (!inputs.length) return toast.warning('Primero agrega inputs GGOO/HH')
    setRows(inputs.map((x) => ({ ...x, plan: Array(12).fill(0) })))
    setSheetGenerated(true)
    toast.success('Hoja de costeo generada')
  }

  function handleAddExtra() {
    if (!sheetGenerated) return toast.warning('Primero debes generar hoja de costeo')
    const item = addInput(extraItem, true)
    if (!item) return
    setExtraItem({ tipo: 'GGOO', nombre: '', valor: '' })
    toast.success('Ítem extra agregado a INPUTS y COSTEO')
  }

  function handleSavePricing() {
    const imp = num(pricingDraft.imprevistos)
    const ovh = num(pricingDraft.overhead)
    const mar = num(pricingDraft.margen)
    if (imp < 0 || ovh < 0 || mar < 0) return toast.warning('Los parámetros no pueden ser negativos')

    setPricing({
      imprevistos: imp / 100,
      overhead: ovh / 100,
      margen: mar / 100,
    })
    toast.success('Parámetros de pricing actualizados')
  }

  function updatePlan(rowId, monthIdx, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const plan = [...r.plan]
        plan[monthIdx] = num(value)
        return { ...r, plan }
      })
    )
  }

  const calc = useMemo(() => {
    const byType = { GGOO: [], HH: [] }
    rows.forEach((r) => {
      const planTotal = r.plan.reduce((a, b) => a + num(b), 0)
      const monthlyCost = r.plan.map((p) => (r.tipo === 'HH' ? (num(p) / 100) * r.valor : num(p) * r.valor))
      const costTotal = monthlyCost.reduce((a, b) => a + b, 0)
      byType[r.tipo].push({ ...r, planTotal, monthlyCost, costTotal })
    })

    function sumMonths(list, key) {
      return Array.from({ length: 12 }, (_, idx) => list.reduce((acc, r) => acc + num(r[key][idx]), 0))
    }

    const ggooMonthly = sumMonths(byType.GGOO, 'monthlyCost')
    const hhMonthly = sumMonths(byType.HH, 'monthlyCost')
    const subtotalMonthly = ggooMonthly.map((x, i) => x + hhMonthly[i])

    const subtotal = subtotalMonthly.reduce((a, b) => a + b, 0)
    const imprevistos = subtotal * pricing.imprevistos
    const overhead = subtotal * pricing.overhead
    const baseConRecargos = subtotal + imprevistos + overhead
    const margen = baseConRecargos * pricing.margen
    const precioSugerido = baseConRecargos + margen

    return {
      ggoo: byType.GGOO,
      hh: byType.HH,
      subtotal,
      imprevistos,
      overhead,
      margen,
      precioSugerido,
    }
  }, [rows, pricing])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#FF5100' }}>Sistema de Costeo</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <button onClick={handleAddInput} className="px-4 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: '#FF5100' }}>1) Agregar input</button>
        <button onClick={handleDeleteInput} className="px-4 py-3 rounded-lg bg-gray-200 font-medium">2) Eliminar input</button>
        <button onClick={handleGenerateSheet} className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">3) Generar hoja</button>
        <button onClick={handleAddExtra} className="px-4 py-3 rounded-lg bg-teal-600 text-white font-medium">4) Agregar extra</button>
        <button onClick={handleSavePricing} className="px-4 py-3 rounded-lg bg-purple-600 text-white font-medium">5) Guardar pricing</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Paso 1: Agregar input</h3>
          <select value={newItem.tipo} onChange={(e) => setNewItem({ ...newItem, tipo: e.target.value })} className="w-full mb-2 px-3 py-2 border rounded">
            <option value="GGOO">GGOO</option>
            <option value="HH">HH</option>
          </select>
          <input value={newItem.nombre} onChange={(e) => setNewItem({ ...newItem, nombre: e.target.value })} placeholder="Nombre ítem" className="w-full mb-2 px-3 py-2 border rounded" />
          <input type="number" value={newItem.valor} onChange={(e) => setNewItem({ ...newItem, valor: e.target.value })} placeholder={newItem.tipo === 'HH' ? 'Valor hora/mensual' : 'Valor total servicio'} className="w-full px-3 py-2 border rounded" />
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Paso 2: Eliminar input</h3>
          <select value={removeId} onChange={(e) => setRemoveId(e.target.value)} className="w-full mb-2 px-3 py-2 border rounded">
            <option value="">Seleccionar ítem</option>
            {inputs.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.tipo})</option>)}
          </select>
          <p className="text-sm text-gray-600">Elimina en INPUTS y también en COSTEO si ya fue generado.</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Paso 5: Parámetros pricing (%)</h3>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={pricingDraft.imprevistos} onChange={(e) => setPricingDraft({ ...pricingDraft, imprevistos: e.target.value })} className="px-3 py-2 border rounded" placeholder="Imprev." />
            <input type="number" value={pricingDraft.overhead} onChange={(e) => setPricingDraft({ ...pricingDraft, overhead: e.target.value })} className="px-3 py-2 border rounded" placeholder="Overhead" />
            <input type="number" value={pricingDraft.margen} onChange={(e) => setPricingDraft({ ...pricingDraft, margen: e.target.value })} className="px-3 py-2 border rounded" placeholder="Margen" />
          </div>
        </div>
      </div>

      {sheetGenerated && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3">Paso 4: Agregar input a hoja ya generada</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select value={extraItem.tipo} onChange={(e) => setExtraItem({ ...extraItem, tipo: e.target.value })} className="px-3 py-2 border rounded">
              <option value="GGOO">GGOO</option>
              <option value="HH">HH</option>
            </select>
            <input value={extraItem.nombre} onChange={(e) => setExtraItem({ ...extraItem, nombre: e.target.value })} placeholder="Nombre ítem extra" className="px-3 py-2 border rounded" />
            <input type="number" value={extraItem.valor} onChange={(e) => setExtraItem({ ...extraItem, valor: e.target.value })} placeholder="Valor" className="px-3 py-2 border rounded" />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-[#FFF5F0]">
              <th className="text-left py-2 px-3">Ítem</th>
              <th className="text-left py-2 px-3">Tipo</th>
              <th className="text-right py-2 px-3">Valor base</th>
              {MONTHS.map((m) => <th key={m} className="text-right py-2 px-2">{m}</th>)}
              <th className="text-right py-2 px-3">Total plan</th>
              <th className="text-right py-2 px-3">Costo total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const planTotal = r.plan.reduce((a, b) => a + num(b), 0)
              const costTotal = r.plan.reduce((acc, p) => acc + (r.tipo === 'HH' ? (num(p) / 100) * r.valor : num(p) * r.valor), 0)
              return (
                <tr key={r.id} className="border-b border-gray-200">
                  <td className="py-2 px-3">{r.nombre}</td>
                  <td className="py-2 px-3">{r.tipo}</td>
                  <td className="py-2 px-3 text-right">{fmtCLP(r.valor)}</td>
                  {r.plan.map((p, idx) => (
                    <td key={idx} className="py-1 px-1">
                      <input
                        type="number"
                        value={p}
                        onChange={(e) => updatePlan(r.id, idx, e.target.value)}
                        className="w-16 px-2 py-1 border rounded text-right"
                        placeholder={r.tipo === 'HH' ? '%' : '0'}
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right">{r.tipo === 'HH' ? `${planTotal.toFixed(2)}%` : planTotal.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-semibold">{fmtCLP(costTotal)}</td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={17} className="py-8 text-center text-gray-500">
                  Aún no hay hoja de costeo generada. Agrega inputs y ejecuta Paso 3.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Resumen pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <p>Subtotal costos: <strong>{fmtCLP(calc.subtotal)}</strong></p>
          <p>Imprevistos ({(pricing.imprevistos * 100).toFixed(2)}%): <strong>{fmtCLP(calc.imprevistos)}</strong></p>
          <p>Overhead ({(pricing.overhead * 100).toFixed(2)}%): <strong>{fmtCLP(calc.overhead)}</strong></p>
          <p>Margen ({(pricing.margen * 100).toFixed(2)}%): <strong>{fmtCLP(calc.margen)}</strong></p>
          <p className="md:col-span-2 text-lg">Precio sugerido: <strong style={{ color: '#FF5100' }}>{fmtCLP(calc.precioSugerido)}</strong></p>
        </div>
      </div>
    </div>
  )
}

