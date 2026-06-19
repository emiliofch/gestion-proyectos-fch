import { render, screen, within, waitFor } from '@testing-library/react'
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

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(async () => ({ data: [{ cargo: 'Analista' }], error: null })),
    })),
    rpc: vi.fn((name) => {
      if (name === 'listar_cargos_rh') return Promise.resolve({ data: [{ cargo: 'Analista' }], error: null })
      return Promise.resolve({ data: 1000000, error: null })
    }),
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

    // RH: esperar que cargue el select de cargos, seleccionar y agregar
    const cargoSelect = await within(contenedorRh).findByRole('combobox')
    await user.selectOptions(cargoSelect, 'Analista')
    await user.click(within(contenedorRh).getByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledTimes(1))

    // Operacional: seleccionar cuenta contable, ingresar valor y agregar
    const cuentaSelect = within(contenedorOp).getByRole('combobox')
    await user.selectOptions(cuentaSelect, '42200048 Subcontratos')
    await user.type(within(contenedorOp).getByPlaceholderText('Valor'), '200000')
    await user.click(within(contenedorOp).getByRole('button', { name: 'Agregar' }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Gasto en Recurso Humano')).toBeInTheDocument()
      expect(screen.getByText('Gasto Operacional')).toBeInTheDocument()
      expect(screen.getAllByText('Analista').length).toBeGreaterThan(0)
      expect(screen.getAllByText('42200048 Subcontratos').length).toBeGreaterThan(0)
    })
  })

  it('bloquea guardar si no se define IVA', async () => {
    const user = userEvent.setup()
    render(<VistaCosteoInputs mode="nuevo" />)

    await user.type(screen.getByPlaceholderText('Nombre del proyecto a costear'), 'Proyecto Test')
    await user.click(screen.getByRole('button', { name: /Guardar costeo/i }))

    expect(toastWarningMock).toHaveBeenCalledWith('Debes indicar si el IVA aplica (si/no) antes de guardar.')
  })
})
