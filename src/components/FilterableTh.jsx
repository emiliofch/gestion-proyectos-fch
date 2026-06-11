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
  bgColor,
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
  const todosRef = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const seleccionados = Array.isArray(filtro) ? filtro : (filtro ? [filtro] : [])
  const [seleccionTemporal, setSeleccionTemporal] = useState(seleccionados)
  const [busquedaInterna, setBusquedaInterna] = useState('')

  const hasOptions = opciones && opciones.length > 0
  const total = opciones?.length || 0
  const activoFiltro = seleccionados.length > 0

  useEffect(() => {
    if (dropdownAbierto) {
      setSeleccionTemporal(seleccionados)
      setBusquedaInterna('')
    }
  }, [dropdownAbierto, filtro])

  useEffect(() => {
    if (todosRef.current) {
      todosRef.current.indeterminate = seleccionTemporal.length > 0 && seleccionTemporal.length < total
    }
  }, [seleccionTemporal, total])

  function handleToggle(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX })
    }
    onToggleDropdown(dropdownAbierto ? null : col)
  }

  const opcionesFiltradas = busquedaInterna
    ? opciones.filter(op => String(op).toLowerCase().includes(busquedaInterna.toLowerCase()))
    : opciones

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
    const result = seleccionTemporal.length === total ? [] : seleccionTemporal
    onFiltro(col, result)
    onToggleDropdown(null)
  }

  return (
    <ResizableTh
      className={`py-3 px-4 text-gray-800 font-semibold select-none transition-colors text-${align} ${activoFiltro ? 'bg-orange-100' : ''}`}
      style={{ ...(style || {}), ...(!activoFiltro && bgColor ? { backgroundColor: bgColor } : !activoFiltro ? { backgroundColor: '#FFF5F0' } : {}) }}
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
                {/* Barra de búsqueda interna */}
                <div className="px-2 py-1.5 border-b border-gray-100">
                  <input
                    type="text"
                    value={busquedaInterna}
                    onChange={e => setBusquedaInterna(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400"
                    placeholder="Buscar..."
                  />
                </div>
                <div className="max-h-[220px] overflow-y-auto">
                  {!busquedaInterna && (
                    <label className="flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 bg-gray-50 cursor-pointer hover:bg-orange-50">
                      <input
                        ref={todosRef}
                        type="checkbox"
                        checked={seleccionTemporal.length === total && total > 0}
                        onChange={() => {
                          if (seleccionTemporal.length === total) setSeleccionTemporal([])
                          else setSeleccionTemporal([...opciones])
                        }}
                      />
                      <span className={
                        (seleccionTemporal.length === total && total > 0) || seleccionTemporal.length === 0
                          ? 'font-semibold text-orange-600' : 'text-gray-700'
                      }>Todos</span>
                    </label>
                  )}
                  {opcionesFiltradas.length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</div>
                  )}
                  {opcionesFiltradas.map((op) => (
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
                <div className="flex items-center justify-between gap-2 p-2 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-400">
                    {seleccionTemporal.length > 0 ? `${seleccionTemporal.length} sel.` : `${total} opciones`}
                  </span>
                  <div className="flex gap-2">
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
