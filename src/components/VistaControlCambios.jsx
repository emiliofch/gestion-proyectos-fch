import ResizableTh from './ResizableTh'

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '-'
  const n = parseFloat(v)
  return isNaN(n) ? v : n.toFixed(1)
}

export default function VistaControlCambios({ cambiosFiltrados, tipoControlCambios, setTipoControlCambios }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Control de Cambios</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTipoControlCambios('valor')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'valor' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'valor' ? '#FF5100' : '' }}
            title="Ver cambios de valores numéricos"
          >
            Cambios de Valores
          </button>
          <button
            onClick={() => setTipoControlCambios('proyecto')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'proyecto' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'proyecto' ? '#FF5100' : '' }}
            title="Ver creación/eliminación de proyectos"
          >
            Cambios de Proyectos
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
              {tipoControlCambios === 'valor' && (
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '160px' }}>Proyecto</ResizableTh>
              )}
              <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '150px' }}>Fecha</ResizableTh>
              <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '130px' }}>Campo</ResizableTh>
              {tipoControlCambios === 'valor' && (
                <>
                  <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '110px' }}>Anterior</ResizableTh>
                  <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '110px' }}>Nuevo</ResizableTh>
                </>
              )}
              <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '160px' }}>Usuario</ResizableTh>
              <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold">Motivo</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {cambiosFiltrados.map(c => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                {tipoControlCambios === 'valor' && (
                  <td className="py-3 px-4 text-gray-800 font-medium">{c.proyecto_nombre || 'N/A'}</td>
                )}
                <td className="py-3 px-4 text-gray-800 text-sm">{new Date(c.fecha).toLocaleString()}</td>
                <td className="py-3 px-4 text-gray-800">{c.campo}</td>
                {tipoControlCambios === 'valor' && (
                  <>
                    <td className="py-3 px-4 text-gray-800">{fmtVal(c.valor_anterior)}</td>
                    <td className="py-3 px-4 text-gray-800">{fmtVal(c.valor_nuevo)}</td>
                  </>
                )}
                <td className="py-3 px-4 text-gray-800">{c.usuario}</td>
                <td className="py-3 px-4 text-gray-800">{c.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
