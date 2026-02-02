-- =====================================================
-- SCRIPT: LIMPIAR E INYECTAR NUEVOS PROYECTOS
-- =====================================================
-- ADVERTENCIA: Este script eliminará TODOS los proyectos existentes
-- y los reemplazará con la nueva lista
-- =====================================================

-- Paso 1: Eliminar todos los proyectos existentes
-- Primero eliminamos registros dependientes
DELETE FROM favoritos;
DELETE FROM cambios;
DELETE FROM proyectos_ceco;
DELETE FROM solicitudes_oc WHERE proyecto_id IS NOT NULL;

-- Ahora eliminamos todos los proyectos
DELETE FROM proyectos;

-- Paso 2: Reiniciar secuencias si existen
-- (No aplica para UUID, pero por si acaso)

-- Paso 3: Insertar nuevos proyectos
-- Nota: Los campos ingresos, hh, gastos se dejan en 0 por defecto
-- El campo 'jefe' se puede actualizar después
-- El campo 'creador' se debe configurar con un email válido de admin

-- Ajusta este email al email del admin que debe aparecer como creador
-- Puedes obtenerlo con: SELECT email FROM perfiles WHERE rol = 'admin' LIMIT 1;
DO $$
DECLARE
  admin_email TEXT;
BEGIN
  SELECT email INTO admin_email FROM perfiles WHERE rol = 'admin' LIMIT 1;

  -- Si no hay admin, usa un email por defecto
  IF admin_email IS NULL THEN
    admin_email := 'admin@fch.cl';
  END IF;

  -- Insertar proyectos
  INSERT INTO proyectos (nombre, jefe, ingresos, hh, gastos, creador, fecha) VALUES
    ('1598.N.F50 PROYECTOS POR ADJUDICAR', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('1742.N.F00.ACELERADORA', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('2710.N.F00.CHILE GLOBAL ANGELS', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('2792.N.F99.INGRESO PAGO INVER. INNOVADORAS A FCH', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('2827.N.F00.GERENCIA CHILEGLOBAL VENTURES', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3257.N.F50 Bhp Donor Advise Fund', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3458.N.F30 Hackamine', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3510.N.F99 INICIATIVA DE INVERSION SOSTENIBLE-ANGLO', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3551.N.F99 RIO TINTO BHP', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3560.N.F99 Desafio Vitacura', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3571.N.F00 START UP CAMPUS', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3623.N.F99 Desafio Expomin', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3639.N.F00 DESARROLLO DE NEGOCIO', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3666.N.F00.POTENCIAL DESCARBONIZACION', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3667.N.F00 ESCALAMIENTO 2023', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3723.N.F50 INNOVACLARO 2024', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3751.N.F06 Green Hub', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3752.N.F99 Caja Los Andes 2024', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3762.N.F50 CGA FUND', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3765.N.F99 Ccu Impacta 2024-25', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3766.N.F99 Scale Bci 2025', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3767.N.F50 Administración Corporate', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3794.N.F50 Prospección Corporate', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3818.N.F99 Aceleradora SQM', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3819.N.F99 CVC Abastible', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3821.N.F99 CVC Coopeuch', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3822.N.F99 BHP TAD Expomin', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3773.N.F00 Hub M', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3829.N.F99 BHP TAD Open Calls', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3867.N.F99 AXIS CVC-E.D.C', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3830.N.F99 TECLA 8', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3820.N.F99 Scouting Abastible', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3666.R.F01 POTENCIAL DESCARBONIZACION', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3872.N.F00 StartupLab.01BID', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3928.N.F99 COOPEUCH CVC.C1', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('1598.N.F00 PROYECTOS POR ADJUDICAR', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3882.N.F30 Innovación Melón', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3771.N.F00 NEMa Corfo', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3908.N.F50 Innpacta 26-27', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3763.N.F99 Escalamiento 2025', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3886.N.F00 Potencia 2026 - 2028', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3879.N.F30 Propuesta Innpacta 2025-2026', 'Sin asignar', 0, 0, 0, admin_email, NOW()),
    ('3877.N.F30 Apoyo Pyme Abastible', 'Sin asignar', 0, 0, 0, admin_email, NOW());

  RAISE NOTICE 'Proyectos insertados exitosamente con creador: %', admin_email;
END $$;

-- Paso 4: Verificar inserción
SELECT COUNT(*) as total_proyectos FROM proyectos;
SELECT nombre FROM proyectos ORDER BY nombre LIMIT 10;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. Todos los proyectos tienen valores 0 en ingresos, hh y gastos
-- 2. El jefe está como "Sin asignar" - actualizar manualmente después
-- 3. El creador se asigna automáticamente al primer admin encontrado
-- 4. Los CECOs se deben agregar manualmente desde la UI
-- =====================================================
