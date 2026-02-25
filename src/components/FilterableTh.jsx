import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ResizableTh from './ResizableTh'

export default function FilterableTh({
  col,
  label,
  align = 'left',
  style,
  opciones,
  filtro,
  onFiltro,
  dropdownAbierto,
  onToggleDropdown,
  sortable = false,
  ordenActiva = false,
  ordenDir = 'asc',
  onOrdenar,
}) {
  const btnRef = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  function handleToggle(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX })
    }
    onToggleDropdown(dropdownAbierto ? null : col)
  }

  const hasOptions = opciones && opciones.length > 0
  const seleccionados = Array.isArray(filtro) ? filtro : (filtro ? [filtro] : [])
  const total = opciones?.length || 0
  const todosMarcados = total > 0 && seleccionados.length === total
  const activoFiltro = seleccionados.length > 0
  const flecha = ordenActiva ? (ordenDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  function toggleValor(valor) {
    const existe = seleccionados.includes(valor)
    const next = existe
      ? seleccionados.filter(v => v !== valor)
      : [...seleccionados, valor]
    onFiltro(col, next)
  }

  return (
    <ResizableTh
      className={`py-3 px-4 text-gray-800 font-semibold select-none transition-colors text-${align} ${activoFiltro ? 'bg-orange-100' : 'bg-[#FFF5F0]'}`}
      style={style}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between'}`}>
        <span
          className={sortable ? 'cursor-pointer hover:text-orange-600 py-1' : ''}
          onClick={() => sortable && onOrdenar?.(col)}
        >
          {label}
          {sortable && <span className="text-gray-400 text-xs ml-0.5">{flecha}</span>}
        </span>
        {hasOptions && (
          <div className="flex-shrink-0">
            <button
              ref={btnRef}
              onClick={handleToggle}
              className={`text-xs px-0.5 py-1 rounded transition-all leading-none ${activoFiltro ? 'text-orange-500 font-bold' : 'text-gray-400 hover:text-gray-700'}`}
              title={activoFiltro ? `Filtrado (${seleccionados.length})` : 'Filtrar'}
            >
              {activoFiltro ? '▼' : '⏷'}
            </button>
            {dropdownAbierto && createPortal(
              <div
                className="bg-white border border-gray-200 rounded-lg shadow-xl w-[240px] max-h-[280px] overflow-y-auto"
                style={{ position: 'absolute', top: dropPos.top + 2, left: dropPos.left, zIndex: 9999 }}
                onClick={(e) => e.stopPropagation()}
              >
                <label className="flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={todosMarcados || seleccionados.length === 0}
                    onChange={() => onFiltro(col, [])}
                  />
                  <span className={seleccionados.length === 0 ? 'font-semibold text-orange-600' : 'text-gray-700'}>(Todos)</span>
                </label>
                {opciones.map((op) => (
                  <label
                    key={op}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(op)}
                      onChange={() => toggleValor(op)}
                    />
                    <span className={seleccionados.includes(op) ? 'font-semibold text-orange-600' : 'text-gray-700'}>
                      {op}
                    </span>
                  </label>
                ))}
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </ResizableTh>
  )
}
