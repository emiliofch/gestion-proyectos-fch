# Plan Interno para Pasar Auditoría SonarQube

## Objetivo
Pasar la auditoría de SonarQube con `Quality Gate: PASSED`, sin hallazgos críticos abiertos y con cobertura suficiente en código nuevo.

## Criterios de aprobación (Definition of Done)
- `0` Vulnerabilities `Blocker/Critical` en código nuevo.
- `0` Bugs `Blocker/Critical` en código nuevo.
- `0` Security Hotspots sin revisar.
- Cobertura en código nuevo `>= 70%` (meta recomendada: `80%`).
- Duplicación en código nuevo `< 3%`.
- `0` `console.log` de debug en producción.

## Fase 1: Línea base (obligatoria)
- Ejecutar análisis SonarQube inicial y capturar backlog por severidad.
- Clasificar hallazgos en: Seguridad, Bugs, Mantenibilidad, Tests.
- Crear lista de remediación priorizada por impacto.

## Fase 2: Seguridad
- Mover secretos/configuración sensible a variables de entorno.
- Revisar validación y sanitización de entradas en frontend/API.
- Revisar políticas RLS y acceso por `empresa`/rol en Supabase.
- Resolver o justificar formalmente cada Security Hotspot.

## Fase 3: Confiabilidad (Bugs)
- Corregir errores de manejo de nulos/undefined.
- Corregir promesas no manejadas y flujos asíncronos frágiles.
- Endurecer manejo de errores con mensajes útiles para diagnóstico.

## Fase 4: Mantenibilidad
- Reducir complejidad cognitiva en funciones largas.
- Eliminar duplicación de lógica en vistas similares.
- Corregir problemas de codificación/UTF-8 (texto corrupto).
- Eliminar `console.log` de debug (mantener `console.error` útil).

## Fase 5: Tests y cobertura
- Priorizar tests para módulos críticos:
  - `VistaCosteoInputs` (cálculos, matriz, totales).
  - Tabla con filtros/ordenamiento (`FilterableTh` y vistas que lo usan).
  - Flujos críticos de OC y validaciones.
- Garantizar que el reporte de cobertura se publique para SonarQube.

## Fase 6: Cierre pre-auditoría
- Re-ejecutar análisis completo.
- Confirmar `Quality Gate` en verde.
- Registrar pendientes no críticas con fecha y responsable.

## Checklist operativo por PR
- [ ] Sin vulnerabilidades nuevas.
- [ ] Sin bugs críticos nuevos.
- [ ] Sin `console.log` de debug.
- [ ] Cobertura de código nuevo en umbral.
- [ ] Sin duplicación excesiva en código nuevo.
- [ ] `audit_log/app/changelog.md` actualizado (si aplica).
- [ ] `audit_log/db/changelog.md` y `audit_log/db/migraciones.md` actualizados (si aplica).

## Política de priorización
1. Seguridad (Vulnerabilities + Hotspots)
2. Bugs críticos
3. Cobertura mínima de código nuevo
4. Code smells/duplicación

## Riesgos actuales del proyecto
- Baja cobertura automatizada.
- Módulos grandes con alta complejidad en frontend.
- Riesgo de texto corrupto (encoding) en archivos editados históricamente.

## Regla permanente para este repositorio
Toda tarea de desarrollo debe evaluarse también contra este plan para no acumular deuda que bloquee la auditoría SonarQube.
