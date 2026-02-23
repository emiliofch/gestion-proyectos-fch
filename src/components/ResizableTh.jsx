import { useRef, useState } from 'react'

/**
 * <th> con handle de redimensionado en el borde derecho.
 * Acepta todos los props de un <th> normal (className, style, onClick, etc.)
 * El handle intercepta mousedown para no disparar eventos de click/sort del padre.
 */
export default function ResizableTh({ children, className = '', style = {}, ...props }) {
  const [width, setWidth] = useState(null)
  const thRef = useRef(null)

  function onMouseDown(e) {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startW = thRef.current?.getBoundingClientRect().width || 100
    let dragged = false

    // Fija el ancho al valor actual para que el arrastre sea predecible
    setWidth(startW)

    function onMove(ev) {
      dragged = true
      setWidth(Math.max(40, startW + ev.clientX - startX))
    }
    function onUp(ev) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // Si hubo movimiento real, bloquea el click que el browser dispara al soltar
      if (dragged) {
        ev.stopPropagation()
        window.addEventListener('click', e => e.stopPropagation(), { capture: true, once: true })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <th
      ref={thRef}
      style={{
        ...style,
        ...(width != null ? { width: `${width}px`, minWidth: `${width}px` } : {}),
        position: 'relative',
        overflow: 'hidden',
      }}
      className={className}
      {...props}
    >
      {children}

      {/* Handle de redimensionado */}
      <span
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          userSelect: 'none',
          zIndex: 10,
        }}
        title="Arrastrar para redimensionar"
      />
    </th>
  )
}
