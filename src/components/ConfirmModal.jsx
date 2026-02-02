import { toast } from 'react-toastify'

export default function ConfirmModal({ mensaje, onConfirmar, onCancelar, tipo = 'warning' }) {
  const handleConfirmar = () => {
    onConfirmar()
    onCancelar()
  }

  const handleCancelar = () => {
    toast.info('Operación cancelada')
    onCancelar()
  }

  const colores = {
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', btn: 'bg-yellow-500 hover:bg-yellow-600' },
    danger: { bg: 'bg-red-50', border: 'border-red-300', btn: 'bg-red-500 hover:bg-red-600' },
    info: { bg: 'bg-blue-50', border: 'border-blue-300', btn: 'bg-blue-500 hover:bg-blue-600' }
  }

  const color = colores[tipo]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`${color.bg} border-2 ${color.border} rounded-lg p-6 max-w-md w-full mx-4 shadow-xl`}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Confirmación</h3>
        <p className="text-gray-700 mb-6">{mensaje}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCancelar}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className={`px-4 py-2 ${color.btn} text-white font-medium rounded-lg transition-colors`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
