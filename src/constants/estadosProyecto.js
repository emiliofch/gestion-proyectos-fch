export const ESTADOS_PROYECTO = ['Efectivo', 'No Efectivo', 'Adjudicado', 'Cancelado']

const ESTADOS_LEGACY_MAP = {
  activo: 'Efectivo',
  'en pausa': 'No Efectivo',
  terminado: 'Adjudicado',
  cancelado: 'Cancelado',
}

export function normalizarEstadoProyecto(raw) {
  const estado = String(raw || '').trim()
  if (!estado) return null
  if (ESTADOS_PROYECTO.includes(estado)) return estado
  const legacy = ESTADOS_LEGACY_MAP[estado.toLowerCase()]
  return legacy || null
}

export function clasesBadgeEstadoProyecto(estado) {
  const colores = {
    'Efectivo': 'bg-green-100 text-green-800',
    'No Efectivo': 'bg-red-100 text-red-800',
    'Adjudicado': 'bg-blue-100 text-blue-800',
    'Cancelado': 'bg-gray-200 text-gray-800',
  }
  return colores[estado] || 'bg-gray-100 text-gray-700'
}
