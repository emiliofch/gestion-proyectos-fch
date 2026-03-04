import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ResizableTh from './ResizableTh'

function SortIcon({ active, dir }) {
  if (!active) {
    return (
      <svg className="w-3 h-3 inline-block ml-1 text-gray-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2l3 4H5l3-4z" fill="currentColor" />
        <path d="M8 14l-3-4h6l-3 4z" fill="currentColor" />
      </svg>
    )
  }

  if (dir === 'asc') {
    return (
      <svg className="w-3 h-3 inline-block ml-1 text-gray-500" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3l4 5H4l4-5z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg className="w-3 h-3 inline-block ml-1 text-gray-500" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13l-4-5h8l-4 5z" fill="currentColor" />
    </svg>
  )
}

function FilterIcon({ active }) {
  return (
    <svg className={`w-3.5 h-3.5 inline-block ${active ? 'text-orange-500' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="currentColor" />
    </svg>
  )
}

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
  const seleccionados = Array.isArray(filtro) ? filtro : (filtro ? [filtro] : [])
  const [seleccionTemporal, setSeleccionTemporal] = useState(seleccionados)

  useEffect(() => {
    if (dropdownAbierto) {
      setSeleccionTemporal(seleccionados)
    }
  }, [dropdownAbierto, filtro])

  function handleToggle(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX })
    }
    onToggleDropdown(dropdownAbierto ? null : col)
  }

  const hasOptions = opciones && opciones.length > 0
  const total = opciones?.length || 0
  const todosMarcados = total > 0 && seleccionTemporal.length === total
  const activoFiltro = seleccionados.length > 0

  function toggleValor(valor) {
    const existe = seleccionTemporal.includes(valor)
    const next = existe
      ? seleccionTemporal.filter(v => v !== valor)
      : [...seleccionTemporal, valor]
    setSeleccionTemporal(next)
  }

  function cancelarFiltro() {
    setSeleccionTemporal(seleccionados)
    onToggleDropdown(null)
  }

  function aceptarFiltro() {
    onFiltro(col, seleccionTemporal)
    onToggleDropdown(null)
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
          {sortable && <SortIcon active={ordenActiva} dir={ordenDir} />}
        </span>
        {hasOptions && (
          <div className="flex-shrink-0">
            <button
              ref={btnRef}
              onClick={handleToggle}
              className={`text-xs px-1 py-1 rounded transition-all leading-none ${activoFiltro ? 'font-bold' : 'hover:text-gray-700'}`}
              title={activoFiltro ? `Filtrado (${seleccionados.length})` : 'Filtrar'}
            >
              <FilterIcon active={activoFiltro} />
            </button>
            {dropdownAbierto && createPortal(
              <div
                className="bg-white border border-gray-200 rounded-lg shadow-xl w-[240px]"
                style={{ position: 'absolute', top: dropPos.top + 2, left: dropPos.left, zIndex: 9999 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-h-[240px] overflow-y-auto">
                  <label className="flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 bg-gray-50">
                    <input
                      type="checkbox"
                      checked={todosMarcados || seleccionTemporal.length === 0}
                      onChange={() => setSeleccionTemporal([])}
                    />
                    <span className={seleccionTemporal.length === 0 ? 'font-semibold text-orange-600' : 'text-gray-700'}>(Todos)</span>
                  </label>
                  {opciones.map((op) => (
                    <label
                      key={op}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionTemporal.includes(op)}
                        onChange={() => toggleValor(op)}
                      />
                      <span className={seleccionTemporal.includes(op) ? 'font-semibold text-orange-600' : 'text-gray-700'}>
                        {op}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 p-2 border-t border-gray-100 bg-gray-50">
                  <button
                    type="button"
                    onClick={cancelarFiltro}
                    className="px-3 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={aceptarFiltro}
                    className="px-3 py-1 text-xs rounded text-white hover:opacity-90"
                    style={{ backgroundColor: '#FF5100' }}
                  >
                    Aceptar
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </ResizableTh>
  )
}
