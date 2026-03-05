import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VistaSolicitudOC from '../VistaSolicitudOC'

const {
  toastWarningMock,
  toastErrorMock,
  toastSuccessMock,
  supabaseMock,
  uploadMock,
  createSignedUrlMock,
  getState,
} = vi.hoisted(() => {
  const state = {
    proyectos: [{ id: 'p1', nombre: 'Proyecto Test', ceco: 'Linea Test' }],
    solicitudes: [],
    inserted: null,
    updated: null,
  }

  function makeQuery(table) {
    const filters = {}
    let mode = 'select'
    let payload = null

    function applyFilters(rows) {
      return rows.filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value)
      )
    }

    function getRows() {
      if (table === 'proyectos') {
        return [...state.proyectos]
      }

      if (table === 'solicitudes_oc') {
        return applyFilters([...state.solicitudes])
      }

      return []
    }

    const self = {
      select: vi.fn(() => self),
      eq: vi.fn((column, value) => {
        filters[column] = value
        return self
      }),
      order: vi.fn(async () => ({ data: getRows(), error: null })),
      limit: vi.fn(async (n = 1) => ({ data: getRows().slice(0, n), error: null })),
      insert: vi.fn((values) => {
        mode = 'insert'
        payload = values
        return self
      }),
      update: vi.fn((values) => {
        mode = 'update'
        payload = values
        state.updated = values
        return self
      }),
      single: vi.fn(async () => {
        if (table === 'solicitudes_oc' && mode === 'insert') {
          const inserted = {
            id: 'sol-1',
            estado: 'enviada',
            fecha_creacion: '2026-02-26T12:00:00.000Z',
            ...payload,
          }
          state.inserted = inserted
          state.solicitudes.unshift(inserted)
          return { data: inserted, error: null }
        }

        return { data: getRows()[0] || null, error: null }
      }),
    }

    return self
  }

  const uploadMock = vi.fn(async () => ({ data: { path: 'ruta/archivo.pdf' }, error: null }))
  const createSignedUrlMock = vi.fn(async () => ({
    data: { signedUrl: 'https://example.com/file.pdf' },
    error: null,
  }))

  return {
    toastWarningMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    uploadMock,
    createSignedUrlMock,
    getState: () => state,
    supabaseMock: {
      from: vi.fn((table) => makeQuery(table)),
      rpc: vi.fn(async () => ({ data: 1, error: null })),
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
        })),
      },
    },
  }
})

vi.mock('react-toastify', () => ({
  toast: {
    warning: (...args) => toastWarningMock(...args),
    error: (...args) => toastErrorMock(...args),
    success: (...args) => toastSuccessMock(...args),
  },
}))

vi.mock('../../supabaseClient', () => ({
  supabase: supabaseMock,
}))

describe('VistaSolicitudOC', () => {
  const user = { id: 'user-1', email: 'qa@fch.cl' }
  const perfil = { empresa: 'CGV' }

  beforeEach(() => {
    toastWarningMock.mockClear()
    toastErrorMock.mockClear()
    toastSuccessMock.mockClear()
    uploadMock.mockClear()
    createSignedUrlMock.mockClear()
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }))
  })

  it('muestra warning cuando falta proveedor', async () => {
    render(<VistaSolicitudOC user={user} perfil={perfil} />)

    const form = screen.getByRole('button', { name: /enviar solicitud/i }).closest('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledWith('Ingrese el nombre del proveedor')
    })
  })

  it('exige adjunto minimo cuando el monto es menor a 1.500.000', async () => {
    const ui = userEvent.setup()
    render(<VistaSolicitudOC user={user} perfil={perfil} />)

    await ui.type(screen.getByPlaceholderText('Nombre del proveedor'), 'Proveedor QA')
    await ui.type(screen.getByPlaceholderText('12.345.678-9'), '11.111.111-1')

    const comboboxes = screen.getAllByRole('combobox')
    await ui.selectOptions(comboboxes[1], 'p1')

    await waitFor(() => expect(screen.getByDisplayValue('Linea Test')).toBeInTheDocument())
    await ui.type(screen.getByPlaceholderText(/descrip/i), 'Glosa QA')
    await ui.type(screen.getByPlaceholderText('Ej: 500000'), '1000000')

    await ui.click(screen.getByRole('button', { name: /enviar solicitud/i }))

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledWith(
        expect.stringContaining('se requieren al menos 1 archivo(s) adjunto(s)')
      )
    })
  })

  it('muestra regla de 3 adjuntos para montos mayores o iguales a 1.500.000', async () => {
    const ui = userEvent.setup()
    render(<VistaSolicitudOC user={user} perfil={perfil} />)

    await ui.type(screen.getByPlaceholderText('Ej: 500000'), '1500000')

    expect(screen.getByText(/se requieren 3 archivos adjuntos/i)).toBeInTheDocument()
    expect(screen.getByText(/requerido:\s*3/i)).toBeInTheDocument()
  })

  it('rechaza archivos sobre 5MB', async () => {
    const ui = userEvent.setup()
    render(<VistaSolicitudOC user={user} perfil={perfil} />)

    const fileInput = document.getElementById('file-input')
    expect(fileInput).not.toBeNull()

    const bigFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.pdf', {
      type: 'application/pdf',
    })

    await ui.upload(fileInput, bigFile)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('grande.pdf excede el tama')
      )
    })
  })

  it('envia solicitud exitosa y limpia formulario', async () => {
    const ui = userEvent.setup()
    render(<VistaSolicitudOC user={user} perfil={perfil} />)

    await ui.type(screen.getByPlaceholderText('Nombre del proveedor'), 'Proveedor QA')
    await ui.type(screen.getByPlaceholderText('12.345.678-9'), '11.111.111-1')

    const comboboxes = screen.getAllByRole('combobox')
    await ui.selectOptions(comboboxes[1], 'p1')

    await waitFor(() => expect(screen.getByDisplayValue('Linea Test')).toBeInTheDocument())

    await ui.type(screen.getByPlaceholderText(/descripci/i), 'Glosa QA')
    await ui.type(screen.getByPlaceholderText('Ej: 500000'), '500000')

    const fileInput = document.getElementById('file-input')
    expect(fileInput).not.toBeNull()

    const file = new File(['contenido'], 'adjunto.pdf', { type: 'application/pdf' })
    await ui.upload(fileInput, file)

    await ui.click(screen.getByRole('button', { name: /enviar solicitud/i }))

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Solicitud de OC enviada exitosamente. Revise su correo.'
      )
    })

    expect(uploadMock).toHaveBeenCalled()
    expect(createSignedUrlMock).toHaveBeenCalled()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/enviar-email-oc',
      expect.objectContaining({ method: 'POST' })
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nombre del proveedor')).toHaveValue('')
      expect(screen.getByPlaceholderText('12.345.678-9')).toHaveValue('')
      expect(screen.getByText(/0 archivo\(s\) seleccionado\(s\)/i)).toBeInTheDocument()
    })

    expect(getState().inserted).not.toBeNull()
    expect(getState().updated).toEqual(
      expect.objectContaining({
        archivos_adjuntos: expect.any(Array),
      })
    )
  })
})
