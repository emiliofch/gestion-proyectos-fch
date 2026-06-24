// Lógica de "traspaso de margen".
//
// Cuando una importación de real deja "Por Ingresar" o "Por Gastar" en negativo,
// trasladamos ese negativo al otro lado como positivo. Como sumamos la MISMA
// cantidad a ambos lados, el margen (Ingresos - Gastos) se conserva exacto.
//
// El valor `traspaso` (firmado) recuerda el ajuste para poder revertirlo:
//   > 0  el negativo se originó en "Por Ingresar"
//   < 0  el negativo se originó en "Por Gastar"
//   = 0  no hubo traslado
// La magnitud |traspaso| es lo que se sumó a AMBOS lados.

// Dados los valores "crudos" (pueden ser negativos), devuelve los valores
// a mostrar/guardar (nunca negativos) y el traspaso firmado.
export function aplicarTraspaso(rawIngresar, rawGastar) {
  const M = Math.max(0, -rawIngresar, -rawGastar)
  const porIngresar = rawIngresar + M
  const porGastar = rawGastar + M
  let traspaso = 0
  if (M > 0) traspaso = rawIngresar <= rawGastar ? M : -M
  return { porIngresar, porGastar, traspaso }
}

// Inverso de aplicarTraspaso: a partir de los valores guardados y el traspaso,
// recupera los valores crudos (restando la magnitud a ambos lados).
export function recuperarCrudos(porIngresar, porGastar, traspaso) {
  const M = Math.abs(traspaso || 0)
  return {
    rawIngresar: (porIngresar || 0) - M,
    rawGastar: (porGastar || 0) - M,
  }
}
