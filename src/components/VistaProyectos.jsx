import { useState } from 'react'

export default function VistaProyectos({
  proyectos, jefes, filtroJefe, setFiltroJefe, busqueda, setBusqueda,
  mostrarInstrucciones, setMostrarInstrucciones, importarExcel, crearProyecto,
  borrarTodosProyectos, abrirModalEdicion, borrarProyecto, totales, loading,
  ordenarPor, ordenColumna, ordenDireccion, favoritos, toggleFavorito, exportarExcel, exportarPDF
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Proyectos y Ajustes</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Buscar por nombre o jefe"
          />
          <select
            value={filtroJefe}
            onChange={(e) => setFiltroJefe(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Filtrar por jefe de proyecto"
          >
            <option value="">Todos los jefes</option>
            {jefes.map(jefe => (
              <option key={jefe} value={jefe}>{jefe}</option>
            ))}
          </select>
          <button
            onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
            title="Información sobre formato Excel"
          >
            ℹ️
          </button>
          <button
            onClick={exportarExcel}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-all"
            title="Exportar a Excel"
          >
            📊
          </button>
          <button
            onClick={exportarPDF}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all"
            title="Exportar a PDF"
          >
            📄
          </button>
          <label 
            className="px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
            title="Importar proyectos desde Excel"
          >
            📤 Importar
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={importarExcel}
              className="hidden"
              disabled={loading}
            />
          </label>
          <button
            onClick={crearProyecto}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
            title="Crear nuevo proyecto"
          >
            ➕ Nuevo
          </button>
          <button
            onClick={borrarTodosProyectos}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50"
            title="Eliminar todos los proyectos"
          >
            🗑️ Borrar Todos
          </button>
        </div>
      </div>

      {mostrarInstrucciones && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h3 className="text-gray-800 font-bold mb-2">📋 Formato Excel para importar Oportunidades:</h3>
          <p className="text-gray-700 text-sm mb-2">PROYECTO | JEFE PROYECTO | INGRESOS | HH | GGOO</p>
          <p className="text-gray-500 text-xs">⚠️ El nombre del proyecto debe coincidir con uno existente en el sistema</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold" title="Marcar como favorito">⭐</th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('nombre')}
                title="Ordenar por proyecto"
              >
                Proyecto {ordenColumna === 'nombre' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('jefe')}
                title="Ordenar por jefe"
              >
                Jefe {ordenColumna === 'jefe' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('ingresos')}
                title="Ordenar por ingresos"
              >
                Ingresos {ordenColumna === 'ingresos' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('hh')}
                title="Ordenar por HH"
              >
                HH {ordenColumna === 'hh' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('gastos')}
                title="Ordenar por GGOO"
              >
                GGOO {ordenColumna === 'gastos' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="text-left py-3 px-4 text-gray-800 font-semibold cursor-pointer hover:bg-orange-100"
                onClick={() => ordenarPor('margen')}
                title="Ordenar por margen"
              >
                Margen {ordenColumna === 'margen' && (ordenDireccion === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left py-3 px-4 text-gray-800 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map(p => {
              const margen = (parseFloat(p.ingresos) || 0) - (parseFloat(p.hh) || 0) - (parseFloat(p.gastos) || 0)
              const esFavorito = favoritos.includes(p.id)
              return (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4">
                    <button 
                      onClick={() => toggleFavorito(p.id)} 
                      className="text-xl"
                      title={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
                    >
                      {esFavorito ? '⭐' : '☆'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-gray-800">{p.nombre}</td>
                  <td className="py-3 px-4 text-gray-800">{p.jefe}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => abrirModalEdicion(p, 'ingresos', p.ingresos)}
                      className="w-24 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-left"
                      title="Click para editar"
                    >
                      {parseFloat(p.ingresos).toFixed(1)}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => abrirModalEdicion(p, 'hh', p.hh)}
                      className="w-24 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-left"
                      title="Click para editar"
                    >
                      {parseFloat(p.hh).toFixed(1)}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => abrirModalEdicion(p, 'gastos', p.gastos)}
                      className="w-24 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-left"
                      title="Click para editar"
                    >
                      {parseFloat(p.gastos).toFixed(1)}
                    </button>
                  </td>
                  <td className={`py-3 px-4 font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {margen.toFixed(1)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => borrarProyecto(p)}
                      className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all text-sm"
                      title="Eliminar proyecto"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
              <td></td>
              <td className="py-3 px-4 text-gray-800">TOTAL</td>
              <td></td>
              <td className="py-3 px-4 text-gray-800">{totales.ingresos.toFixed(1)}</td>
              <td className="py-3 px-4 text-gray-800">{totales.hh.toFixed(1)}</td>
              <td className="py-3 px-4 text-gray-800">{totales.gastos.toFixed(1)}</td>
              <td className={`py-3 px-4 ${totales.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totales.margen.toFixed(1)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
