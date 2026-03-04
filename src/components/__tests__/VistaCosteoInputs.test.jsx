import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VistaCosteoInputs from '../VistaCosteoInputs'

const toastWarningMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('react-toastify', () => ({
  toast: {
    warning: (...args) => toastWarningMock(...args),
    success: (...args) => toastSuccessMock(...args),
    error: (...args) => toastErrorMock(...args),
  },
}))

describe('VistaCosteoInputs', () => {
  beforeEach(() => {
    toastWarningMock.mockClear()
    toastSuccessMock.mockClear()
    toastErrorMock.mockClear()
  })

  it('renderiza secciones clave de nuevo costeo', () => {
    render(<VistaCosteoInputs mode="nuevo" />)

    expect(screen.getByRole('heading', { name: 'Costos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Costo de Recurso Humano' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Costos Operacionales' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Temporalidad de Proyecto' })).toBeInTheDocument()
    expect(screen.getByText('Tipo de costo')).toBeInTheDocument()
  })

  it('agrega items en ambos contenedores y los muestra en matriz por tipo', async () => {
    const user = userEvent.setup()
    render(<VistaCosteoInputs mode="nuevo" />)

    const contenedorRh = screen.getByRole('heading', { name: 'Costo de Recurso Humano' }).closest('div')
    const contenedorOp = screen.getByRole('heading', { name: 'Costos Operacionales' }).closest('div')

    const inputsRh = within(contenedorRh).getAllByPlaceholderText(/Item|Valor/i)
    await user.type(inputsRh[0], 'Analista')
    await user.type(inputsRh[1], '1000000')
    await user.click(within(contenedorRh).getByRole('button', { name: 'Agregar' }))

    const inputsOp = within(contenedorOp).getAllByPlaceholderText(/Item|Valor/i)
    await user.type(inputsOp[0], 'Software')
    await user.type(inputsOp[1], '200000')
    await user.click(within(contenedorOp).getByRole('button', { name: 'Agregar' }))

    expect(toastSuccessMock).toHaveBeenCalled()
    expect(screen.getByText('Gasto en Recurso Humano')).toBeInTheDocument()
    expect(screen.getByText('Gasto Operacional')).toBeInTheDocument()
    expect(screen.getAllByText('Analista').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Software').length).toBeGreaterThan(0)
  })

  it('bloquea guardar si no se define IVA', async () => {
    const user = userEvent.setup()
    render(<VistaCosteoInputs mode="nuevo" />)

    await user.type(screen.getByPlaceholderText('Nombre del proyecto a costear'), 'Proyecto Test')
    await user.click(screen.getByRole('button', { name: /Guardar costeo/i }))

    expect(toastWarningMock).toHaveBeenCalledWith('Debes indicar si el IVA aplica (si/no) antes de guardar.')
  })
})
