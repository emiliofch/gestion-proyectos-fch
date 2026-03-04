import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterableTh from '../FilterableTh'

function renderInTable(ui) {
  return render(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>
  )
}

describe('FilterableTh', () => {
  it('dispara ordenamiento al hacer click en el label cuando es sortable', async () => {
    const user = userEvent.setup()
    const onOrdenar = vi.fn()

    renderInTable(
      <FilterableTh
        col="proyecto"
        label="Proyecto"
        opciones={[]}
        filtro={[]}
        onFiltro={() => {}}
        dropdownAbierto={false}
        onToggleDropdown={() => {}}
        sortable
        onOrdenar={onOrdenar}
      />
    )

    await user.click(screen.getByText('Proyecto'))
    expect(onOrdenar).toHaveBeenCalledWith('proyecto')
  })

  it('permite seleccionar multiples opciones y aplica solo al aceptar', async () => {
    const user = userEvent.setup()
    const onFiltro = vi.fn()
    const onToggleDropdown = vi.fn()

    renderInTable(
      <FilterableTh
        col="estado"
        label="Estado"
        opciones={['Efectivo', 'No Efectivo']}
        filtro={[]}
        onFiltro={onFiltro}
        dropdownAbierto
        onToggleDropdown={onToggleDropdown}
      />
    )

    const checks = screen.getAllByRole('checkbox')
    expect(checks.length).toBe(3) // (Todos) + 2 opciones

    await user.click(screen.getByText('Efectivo'))
    expect(onFiltro).not.toHaveBeenCalled()

    await user.click(screen.getByText('(Todos)'))
    expect(onFiltro).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onFiltro).toHaveBeenCalledWith('estado', [])
    expect(onToggleDropdown).toHaveBeenCalledWith(null)
  })

  it('cierra sin aplicar cambios al cancelar', async () => {
    const user = userEvent.setup()
    const onFiltro = vi.fn()
    const onToggleDropdown = vi.fn()

    renderInTable(
      <FilterableTh
        col="estado"
        label="Estado"
        opciones={['Efectivo', 'No Efectivo']}
        filtro={[]}
        onFiltro={onFiltro}
        dropdownAbierto
        onToggleDropdown={onToggleDropdown}
      />
    )

    await user.click(screen.getByText('Efectivo'))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onFiltro).not.toHaveBeenCalled()
    expect(onToggleDropdown).toHaveBeenCalledWith(null)
  })

  it('toggle del boton de filtro abre/cierra segun estado', async () => {
    const user = userEvent.setup()
    const onToggleDropdown = vi.fn()

    const { rerender } = renderInTable(
      <FilterableTh
        col="linea"
        label="Linea"
        opciones={['A']}
        filtro={[]}
        onFiltro={() => {}}
        dropdownAbierto={false}
        onToggleDropdown={onToggleDropdown}
      />
    )

    await user.click(screen.getByTitle('Filtrar'))
    expect(onToggleDropdown).toHaveBeenCalledWith('linea')

    onToggleDropdown.mockClear()

    rerender(
      <table>
        <thead>
          <tr>
            <FilterableTh
              col="linea"
              label="Linea"
              opciones={['A']}
              filtro={[]}
              onFiltro={() => {}}
              dropdownAbierto
              onToggleDropdown={onToggleDropdown}
            />
          </tr>
        </thead>
      </table>
    )

    await user.click(screen.getByTitle('Filtrar'))
    expect(onToggleDropdown).toHaveBeenCalledWith(null)
  })
})
