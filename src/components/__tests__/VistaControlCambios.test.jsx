import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VistaControlCambios from '../VistaControlCambios'

const cambiosBase = [
  {
    id: '1',
    proyecto_nombre: 'Proyecto Alfa',
    fecha: '2026-02-25T10:00:00.000Z',
    campo: 'INGRESOS',
    valor_anterior: '10',
    valor_nuevo: '20',
    usuario: 'ana@fch.cl',
    motivo: 'Ajuste comercial',
  },
  {
    id: '2',
    proyecto_nombre: 'Proyecto Beta',
    fecha: '2026-02-24T10:00:00.000Z',
    campo: 'HH',
    valor_anterior: '5',
    valor_nuevo: '7',
    usuario: 'luis@fch.cl',
    motivo: 'Reestimacion',
  },
]

describe('VistaControlCambios', () => {
  it('dispara cambio de tabs (valor/proyecto/estado)', async () => {
    const user = userEvent.setup()
    const setTipoControlCambios = vi.fn()

    render(
      <VistaControlCambios
        cambiosFiltrados={cambiosBase}
        tipoControlCambios="valor"
        setTipoControlCambios={setTipoControlCambios}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Cambios de Proyectos' }))
    await user.click(screen.getByRole('button', { name: 'Estados' }))

    expect(setTipoControlCambios).toHaveBeenNthCalledWith(1, 'proyecto')
    expect(setTipoControlCambios).toHaveBeenNthCalledWith(2, 'estado')
  })

  it('en vista estado muestra columnas de estado y oculta Campo', () => {
    render(
      <VistaControlCambios
        cambiosFiltrados={cambiosBase}
        tipoControlCambios="estado"
        setTipoControlCambios={() => {}}
      />
    )

    expect(screen.getByText('Estado anterior')).toBeInTheDocument()
    expect(screen.getByText('Estado nuevo')).toBeInTheDocument()
    expect(screen.queryByText('Campo')).not.toBeInTheDocument()
  })

  it('filtra por usuario usando dropdown de columna', async () => {
    const user = userEvent.setup()

    render(
      <VistaControlCambios
        cambiosFiltrados={cambiosBase}
        tipoControlCambios="valor"
        setTipoControlCambios={() => {}}
      />
    )

    const thUsuario = screen.getByText('Usuario').closest('th')
    await user.click(within(thUsuario).getByTitle('Filtrar'))

    await user.click(screen.getByRole('checkbox', { name: 'ana@fch.cl' }))

    expect(screen.getByText('Ajuste comercial')).toBeInTheDocument()
    expect(screen.queryByText('Reestimacion')).not.toBeInTheDocument()
  })
})
