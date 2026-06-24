import { describe, it, expect } from 'vitest'
import { aplicarTraspaso, recuperarCrudos } from './traspasoMargen'

describe('aplicarTraspaso', () => {
  it('no traslada cuando ambos son positivos', () => {
    expect(aplicarTraspaso(10, 4)).toEqual({ porIngresar: 10, porGastar: 4, traspaso: 0 })
  })

  it('traslada un Por Ingresar negativo a Por Gastar (signo +)', () => {
    expect(aplicarTraspaso(-3, 4)).toEqual({ porIngresar: 0, porGastar: 7, traspaso: 3 })
  })

  it('traslada un Por Gastar negativo a Por Ingresar (signo -)', () => {
    expect(aplicarTraspaso(5, -2)).toEqual({ porIngresar: 7, porGastar: 0, traspaso: -2 })
  })

  it('con ambos negativos toma el más negativo como origen', () => {
    expect(aplicarTraspaso(-3, -6)).toEqual({ porIngresar: 3, porGastar: 0, traspaso: -6 })
  })

  it('conserva el margen (Ingresos - Gastos)', () => {
    const realI = 13, realG = 0
    const { porIngresar, porGastar } = aplicarTraspaso(-3, 4)
    const margenMostrado = (realI + porIngresar) - (realG + porGastar)
    const margenCrudo = (realI + (-3)) - (realG + 4)
    expect(margenMostrado).toBe(margenCrudo)
    expect(margenMostrado).toBe(6)
  })
})

describe('recuperarCrudos', () => {
  it('revierte un traslado originado en Por Ingresar', () => {
    expect(recuperarCrudos(0, 7, 3)).toEqual({ rawIngresar: -3, rawGastar: 4 })
  })

  it('revierte un traslado originado en Por Gastar', () => {
    expect(recuperarCrudos(7, 0, -2)).toEqual({ rawIngresar: 5, rawGastar: -2 })
  })

  it('es identidad cuando no hubo traslado', () => {
    expect(recuperarCrudos(10, 4, 0)).toEqual({ rawIngresar: 10, rawGastar: 4 })
  })

  it('round-trip: aplicar y luego recuperar devuelve los crudos', () => {
    for (const [i, g] of [[-3, 4], [5, -2], [-3, -6], [10, 4]]) {
      const { porIngresar, porGastar, traspaso } = aplicarTraspaso(i, g)
      expect(recuperarCrudos(porIngresar, porGastar, traspaso)).toEqual({ rawIngresar: i, rawGastar: g })
    }
  })
})
