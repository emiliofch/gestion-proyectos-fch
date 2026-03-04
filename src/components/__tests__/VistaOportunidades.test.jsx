import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VistaOportunidades from '../VistaOportunidades'

const {
  toastErrorMock,
  toastSuccessMock,
  toastWarningMock,
  supabaseMock,
} = vi.hoisted(() => {
  const initialProyectos = [
    { id: 'p1', nombre: 'Proyecto Uno', ceco: 'Linea 1' },
    { id: 'p2', nombre: 'Proyecto Dos', ceco: 'Linea 2' },
  ]

  const initialOportunidades = [
    {
      id: 'o1',
      proyecto_id: 'p1',
      ingresos: 1000000,
      hh: 200000,
      gastos: 100000,
      proyectos: {
        id: 'p1',
        nombre: 'Proyecto Uno',
        ceco: 'Linea 1',
        estado: 'Efectivo',
        colaboradores: { colaborador: 'Ana Jefe' },
      },
    },
    {
      id: 'o2',
      proyecto_id: 'p2',
      ingresos: 500000,
      hh: 120000,
      gastos: 90000,
      proyectos: {
        id: 'p2',
        nombre: 'Proyecto Dos',
        ceco: 'Linea 2',
        estado: 'No Efectivo',
        colaboradores: { colaborador: 'Luis Jefe' },
      },
    },
  ]

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  const state = {
    proyectos: clone(initialProyectos),
    oportunidades: clone(initialOportunidades),
  }

  const spies = {
    proyectosUpdateEq: vi.fn(async () => ({ error: null })),
    oportunidadesInsert: vi.fn(async () => ({ error: null })),
    oportunidadesUpdateEq: vi.fn(async () => ({ error: null })),
    oportunidadesDeleteEq: vi.fn(async () => ({ error: null })),
    cambiosInsert: vi.fn(async () => ({ error: null })),
    reset: () => {
      state.proyectos = clone(initialProyectos)
      state.oportunidades = clone(initialOportunidades)
    },
  }

  function getProyectoById(id) {
    return state.proyectos.find((p) => p.id === id)
  }

  function selectQueryForTable(table) {
    if (table === 'proyectos') {
      return {
        order: vi.fn(async () => ({ data: clone(state.proyectos), error: null })),
        ilike: vi.fn((_, pattern) => {
          const prefix = String(pattern || '').replace('%', '').toLowerCase()
          const found = state.proyectos.filter((p) => p.nombre.toLowerCase().startsWith(prefix)).slice(0, 1)
          return { limit: vi.fn(async () => ({ data: clone(found), error: null })) }
        }),
      }
    }

    if (table === 'oportunidades') {
      return {
        order: vi.fn(async () => ({ data: clone(state.oportunidades), error: null })),
      }
    }

    return {
      order: vi.fn(async () => ({ data: [], error: null })),
    }
  }

  return {
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastWarningMock: vi.fn(),
    supabaseMock: {
      from: vi.fn((table) => {
        const selectQuery = selectQueryForTable(table)

        const query = {
          select: vi.fn(() => ({ ...query, ...selectQuery })),
          insert: vi.fn((payload) => {
            if (table === 'cambios') {
              return spies.cambiosInsert(payload)
            }

            if (table === 'oportunidades') {
              spies.oportunidadesInsert(payload)
              const proyecto = getProyectoById(payload.proyecto_id)
              state.oportunidades.unshift({
                id: `o${state.oportunidades.length + 1}`,
                proyecto_id: payload.proyecto_id,
                ingresos: payload.ingresos,
                hh: payload.hh,
                gastos: payload.gastos,
                proyectos: {
                  id: proyecto?.id,
                  nombre: proyecto?.nombre,
                  ceco: proyecto?.ceco,
                  estado: proyecto?.estado || null,
                  colaboradores: { colaborador: null },
                },
              })
              return Promise.resolve({ error: null })
            }

            return Promise.resolve({ error: null })
          }),
          update: vi.fn((values) => {
            if (table === 'proyectos') {
              return {
                eq: async (col, value) => {
                  spies.proyectosUpdateEq(col, value)
                  if (col === 'id') {
                    state.proyectos = state.proyectos.map((p) => (p.id === value ? { ...p, ...values } : p))
                    state.oportunidades = state.oportunidades.map((o) => {
                      if (o.proyecto_id !== value) return o
                      return {
                        ...o,
                        proyectos: { ...o.proyectos, ...values },
                      }
                    })
                  }
                  return { error: null }
                },
              }
            }

            if (table === 'oportunidades') {
              return {
                eq: async (col, value) => {
                  spies.oportunidadesUpdateEq(col, value)
                  if (col === 'id') {
                    state.oportunidades = state.oportunidades.map((o) => (o.id === value ? { ...o, ...values } : o))
                  }
                  return { error: null }
                },
              }
            }

            return { eq: vi.fn(async () => ({ error: null })) }
          }),
          delete: vi.fn(() => {
            if (table === 'oportunidades') {
              return {
                eq: async (col, value) => {
                  spies.oportunidadesDeleteEq(col, value)
                  if (col === 'id') {
                    state.oportunidades = state.oportunidades.filter((o) => o.id !== value)
                  }
                  return { error: null }
                },
              }
            }

            return { eq: vi.fn(async () => ({ error: null })) }
          }),
          eq: vi.fn(async () => ({ error: null })),
        }

        return query
      }),
      __spies: spies,
    },
  }
})

vi.mock('../../supabaseClient', () => ({
  supabase: supabaseMock,
}))

vi.mock('react-toastify', () => ({
  toast: {
    error: (...args) => toastErrorMock(...args),
    success: (...args) => toastSuccessMock(...args),
    warning: (...args) => toastWarningMock(...args),
  },
}))

describe('VistaOportunidades', () => {
  const user = { email: 'qa@fch.cl' }

  beforeEach(() => {
    toastErrorMock.mockClear()
    toastSuccessMock.mockClear()
    toastWarningMock.mockClear()
    supabaseMock.from.mockClear()
    supabaseMock.__spies.proyectosUpdateEq.mockClear()
    supabaseMock.__spies.oportunidadesInsert.mockClear()
    supabaseMock.__spies.oportunidadesUpdateEq.mockClear()
    supabaseMock.__spies.oportunidadesDeleteEq.mockClear()
    supabaseMock.__spies.cambiosInsert.mockClear()
    supabaseMock.__spies.reset()
  })

  it('exige motivo al cambiar estado y luego guarda cuando se ingresa', async () => {
    const ui = userEvent.setup()
    const onCambioRegistrado = vi.fn()

    render(<VistaOportunidades user={user} onCambioRegistrado={onCambioRegistrado} />)

    await waitFor(() => expect(screen.getByText('Proyecto Uno')).toBeInTheDocument())

    const selectEstado = screen.getByDisplayValue('Efectivo')
    await ui.selectOptions(selectEstado, 'Adjudicado')

    await ui.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(toastErrorMock).toHaveBeenCalledWith('Debes ingresar un motivo')

    await ui.type(screen.getByPlaceholderText(/explica el motivo/i), 'Cambio aprobado por comité')
    await ui.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => {
      expect(supabaseMock.__spies.proyectosUpdateEq).toHaveBeenCalledWith('id', 'p1')
      expect(supabaseMock.__spies.cambiosInsert).toHaveBeenCalled()
      expect(onCambioRegistrado).toHaveBeenCalled()
      expect(toastSuccessMock).toHaveBeenCalledWith('Estado actualizado')
    })
  })

  it('permite cambiar estado a Cancelado', async () => {
    const ui = userEvent.setup()

    render(<VistaOportunidades user={user} onCambioRegistrado={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Proyecto Uno')).toBeInTheDocument())

    const selectEstado = screen.getByDisplayValue('Efectivo')
    await ui.selectOptions(selectEstado, 'Cancelado')
    await ui.type(screen.getByPlaceholderText(/explica el motivo/i), 'Proyecto cerrado por decisión de negocio')
    await ui.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => {
      expect(supabaseMock.__spies.cambiosInsert).toHaveBeenCalledWith(
        expect.objectContaining({ campo: 'ESTADO', valor_nuevo: 'Cancelado' }),
      )
      expect(toastSuccessMock).toHaveBeenCalledWith('Estado actualizado')
    })
  })

  it('agrega oportunidad y exige seleccionar proyecto', async () => {
    const ui = userEvent.setup()

    render(<VistaOportunidades user={user} onCambioRegistrado={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Proyecto Uno')).toBeInTheDocument())

    await ui.click(screen.getByRole('button', { name: /agregar oportunidad/i }))
    await ui.click(screen.getByRole('button', { name: /^Agregar$/i }))

    expect(toastErrorMock).toHaveBeenCalledWith('Selecciona un proyecto')

    const modalAgregar = screen.getByText('Agregar Oportunidad').closest('div')
    const selectProyecto = within(modalAgregar).getByRole('combobox')
    await ui.selectOptions(selectProyecto, 'p2')
    const inputsNumericos = within(modalAgregar).getAllByRole('spinbutton')
    await ui.type(inputsNumericos[0], '700000')
    await ui.type(inputsNumericos[1], '200000')
    await ui.type(inputsNumericos[2], '100000')
    await ui.click(screen.getByRole('button', { name: /^Agregar$/i }))

    await waitFor(() => {
      expect(supabaseMock.__spies.oportunidadesInsert).toHaveBeenCalled()
      expect(toastSuccessMock).toHaveBeenCalledWith('Oportunidad agregada')
    })
  })

  it('edita valor y exige motivo antes de guardar', async () => {
    const ui = userEvent.setup()
    const onCambioRegistrado = vi.fn()

    render(<VistaOportunidades user={user} onCambioRegistrado={onCambioRegistrado} />)

    await waitFor(() => expect(screen.getByText('Proyecto Uno')).toBeInTheDocument())

    const celdasEditables = screen.getAllByTitle('Click para editar')
    await ui.click(celdasEditables[0])

    const modalEditar = screen.getByText(/editar ingresos/i).closest('div')
    const inputNuevoValor = within(modalEditar).getByRole('spinbutton')
    await ui.clear(inputNuevoValor)
    await ui.type(inputNuevoValor, '1200000')
    await ui.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(toastErrorMock).toHaveBeenCalledWith('Debes ingresar un motivo para el cambio')

    await ui.type(screen.getByPlaceholderText(/explica el motivo del cambio/i), 'Ajuste comercial validado')
    await ui.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(supabaseMock.__spies.oportunidadesUpdateEq).toHaveBeenCalledWith('id', 'o1')
      expect(supabaseMock.__spies.cambiosInsert).toHaveBeenCalled()
      expect(onCambioRegistrado).toHaveBeenCalled()
      expect(toastSuccessMock).toHaveBeenCalledWith('Valor actualizado')
    })
  })

  it('elimina oportunidad con motivo y permite cancelar', async () => {
    const ui = userEvent.setup()

    render(<VistaOportunidades user={user} onCambioRegistrado={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Proyecto Uno')).toBeInTheDocument())

    await ui.click(screen.getAllByTitle('Eliminar oportunidad')[0])
    expect(screen.getByText(/eliminar oportunidad/i)).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByText(/eliminar oportunidad/i)).not.toBeInTheDocument()
    })

    await ui.click(screen.getAllByTitle('Eliminar oportunidad')[0])
    await ui.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(toastErrorMock).toHaveBeenCalledWith('Debes ingresar un motivo')

    await ui.type(screen.getByPlaceholderText(/explica el motivo/i), 'Se duplicó en carga inicial')
    await ui.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => {
      expect(supabaseMock.__spies.oportunidadesDeleteEq).toHaveBeenCalledWith('id', 'o1')
      expect(supabaseMock.__spies.cambiosInsert).toHaveBeenCalled()
      expect(toastSuccessMock).toHaveBeenCalledWith('Oportunidad eliminada')
    })
  })

  it('aplica busqueda y recalcula total visible', async () => {
    const ui = userEvent.setup()

    render(<VistaOportunidades user={user} onCambioRegistrado={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Proyecto Uno')).toBeInTheDocument())

    expect(screen.getByText('TOTAL (2)')).toBeInTheDocument()

    await ui.type(screen.getByPlaceholderText(/buscar/i), 'Linea 2')

    await waitFor(() => {
      expect(screen.queryByText('Proyecto Uno')).not.toBeInTheDocument()
      expect(screen.getByText('Proyecto Dos')).toBeInTheDocument()
      expect(screen.getByText('TOTAL (1)')).toBeInTheDocument()
    })
  })
})


