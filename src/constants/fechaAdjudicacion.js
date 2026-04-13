export const MESES_ADJUDICACION = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function normalizarMesAdjudicacion(raw) {
  const txt = String(raw || '').trim().toLowerCase()
  if (!txt) return null
  const match = txt.match(/^([a-z]{3})-(\d{2})$/)
  if (match) {
    const mes = match[1]
    const anio = match[2]
    if (!MESES_ADJUDICACION.includes(mes)) return undefined
    return `${mes}-${anio}`
  }

  const matchSep = txt.match(/^([a-z]{3})[\\s._/\\-](\\d{2,4})$/)
  if (matchSep) {
    const mes = matchSep[1]
    const anio = matchSep[2].slice(-2)
    if (!MESES_ADJUDICACION.includes(mes)) return undefined
    return `${mes}-${anio}`
  }

  const match4 = txt.match(/^([a-z]{3})-(\d{4})$/)
  if (match4) {
    const mes = match4[1]
    const anio = match4[2].slice(-2)
    if (!MESES_ADJUDICACION.includes(mes)) return undefined
    return `${mes}-${anio}`
  }

  if (/^\d{4}-\d{2}(-\d{2})?$/.test(txt)) {
    const parsed = new Date(txt)
    if (!Number.isNaN(parsed.getTime())) {
      const mes = MESES_ADJUDICACION[parsed.getMonth()]
      return `${mes}-${String(parsed.getFullYear()).slice(-2)}`
    }
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    const [dd, mm, yyyy] = txt.split('/')
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (!Number.isNaN(parsed.getTime())) {
      const mes = MESES_ADJUDICACION[parsed.getMonth()]
      return `${mes}-${String(parsed.getFullYear()).slice(-2)}`
    }
  }

  return undefined
}
