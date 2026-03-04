export const MESES_ADJUDICACION = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function normalizarMesAdjudicacion(raw) {
  const txt = String(raw || '').trim().toLowerCase()
  if (!txt) return null
  const match = txt.match(/^([a-z]{3})-(\d{2})$/)
  if (!match) return undefined
  const mes = match[1]
  const anio = match[2]
  if (!MESES_ADJUDICACION.includes(mes)) return undefined
  return `${mes}-${anio}`
}
