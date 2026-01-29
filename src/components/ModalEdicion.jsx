export default function ModalEdicion({ edicionActual, setEdicionActual, guardarCambioIndividual, setModalAbierto, loading }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Editar {edicionActual.campo.toUpperCase()}
        </h3>
        <p className="text-gray-600 mb-2">
          Proyecto: <strong>{edicionActual.proyecto.nombre}</strong>
        </p>
        <p className="text-gray-600 mb-4">
          Valor actual: <strong>{edicionActual.valorActual}</strong>
        </p>
        
        <label className="block text-gray-700 font-medium mb-2">Nuevo valor (1 decimal):</label>
        <input
          type="number"
          step="0.1"
          value={edicionActual.valorNuevo}
          onChange={(e) => setEdicionActual({...edicionActual, valorNuevo: e.target.value})}
          className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
          autoFocus
        />

        <label className="block text-gray-700 font-medium mb-2">Motivo del cambio:</label>
        <textarea
          value={edicionActual.motivo}
          onChange={(e) => setEdicionActual({...edicionActual, motivo: e.target.value})}
          className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-6"
          rows="3"
          placeholder="Describe por qué se realiza este cambio..."
        />

        <div className="flex gap-2">
          <button
            onClick={guardarCambioIndividual}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FF5100' }}
          >
            Guardar
          </button>
          <button
            onClick={() => { setModalAbierto(false) }}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
