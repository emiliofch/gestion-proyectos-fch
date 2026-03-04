import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VistaProyectos from '../VistaProyectos'

function buildProps() {
  return {
    proyectos: [
      { id: 'p1', nombre: 'Proyecto Alfa', jefe: 'Ana', ingresos: '10', hh: '2', gastos: '1' },
      { id: 'p2', nombre: 'Proyecto Beta', jefe: 'Luis', ingresos: '5', hh: '4', gastos: '3' },
    ],
    jefes: ['Ana', 'Luis'],
    filtroJefe: '',
    setFiltroJefe: vi.fn(),
    busqueda: '',
    setBusqueda: vi.fn(),
    mostrarInstrucciones: false,
    setMostrarInstrucciones: vi.fn(),
    importarExcel: vi.fn(),
    crearProyecto: vi.fn(),
    borrarTodosProyectos: vi.fn(),
    abrirModalEdicion: vi.fn(),
    borrarProyecto: vi.fn(),
    totales: { ingresos: 15, hh: 6, gastos: 4, margen: 5 },
    loading: false,
    ordenarPor: vi.fn(),
    ordenColumna: '',
    ordenDireccion: 'asc',
    favoritos: [],
    toggleFavorito: vi.fn(),
    exportarExcel: vi.fn(),
    exportarPDF: vi.fn(),
  }
}

describe('VistaProyectos', () => {
  it('dispara acciones principales de toolbar', async () => {
    const user = userEvent.setup()
    const props = buildProps()

    render(<VistaProyectos {...props} />)

    await user.type(screen.getByPlaceholderText(/buscar/i), 'Alfa')
    expect(props.setBusqueda).toHaveBeenCalled()

    await user.selectOptions(screen.getByRole('combobox'), 'Ana')
    expect(props.setFiltroJefe).toHaveBeenCalledWith('Ana')

    await user.click(screen.getByTitle(/formato excel/i))
    await user.click(screen.getByTitle('Exportar a Excel'))
    await user.click(screen.getByTitle('Exportar a PDF'))
    await user.click(screen.getByTitle('Crear nuevo proyecto'))
    await user.click(screen.getByTitle('Eliminar todos los proyectos'))

    expect(props.setMostrarInstrucciones).toHaveBeenCalledWith(true)
    expect(props.exportarExcel).toHaveBeenCalled()
    expect(props.exportarPDF).toHaveBeenCalled()
    expect(props.crearProyecto).toHaveBeenCalled()
    expect(props.borrarTodosProyectos).toHaveBeenCalled()
  })

  it('dispara ordenamiento y acciones por fila', async () => {
    const user = userEvent.setup()
    const props = buildProps()

    render(<VistaProyectos {...props} />)

    await user.click(screen.getByText('Proyecto'))
    expect(props.ordenarPor).toHaveBeenCalledWith('nombre')

    const btnFavoritos = screen.getAllByTitle('Agregar a favoritos')
    await user.click(btnFavoritos[0])
    expect(props.toggleFavorito).toHaveBeenCalledWith('p1')

    const celdasEditables = screen.getAllByTitle('Click para editar')
    await user.click(celdasEditables[0])
    expect(props.abrirModalEdicion).toHaveBeenCalledWith(props.proyectos[0], 'ingresos', '10')

    const btnEliminar = screen.getAllByTitle('Eliminar proyecto')
    await user.click(btnEliminar[0])
    expect(props.borrarProyecto).toHaveBeenCalledWith(props.proyectos[0])
  })

  it('muestra fila de totales calculada', () => {
    const props = buildProps()
    render(<VistaProyectos {...props} />)

    const filaTotal = screen.getByText('TOTAL').closest('tr')
    expect(filaTotal).toBeInTheDocument()

    expect(within(filaTotal).getByText('15.0')).toBeInTheDocument()
    expect(within(filaTotal).getByText('6.0')).toBeInTheDocument()
    expect(within(filaTotal).getByText('4.0')).toBeInTheDocument()
    expect(within(filaTotal).getByText('5.0')).toBeInTheDocument()
  })
})

