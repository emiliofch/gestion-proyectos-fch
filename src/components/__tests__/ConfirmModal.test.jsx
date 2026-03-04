import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmModal from '../ConfirmModal'

const toastInfoMock = vi.fn()

vi.mock('react-toastify', () => ({
  toast: {
    info: (...args) => toastInfoMock(...args),
  },
}))

describe('ConfirmModal', () => {
  beforeEach(() => {
    toastInfoMock.mockClear()
  })

  it('ejecuta confirmar y luego cerrar', async () => {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmModal
        mensaje="Mensaje de prueba"
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
        tipo="danger"
      />
    )

    await user.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it('ejecuta cancelar y notifica por toast', async () => {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmModal
        mensaje="Mensaje de prueba"
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />
    )

    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onConfirmar).not.toHaveBeenCalled()
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(toastInfoMock).toHaveBeenCalledTimes(1)
  })
})
