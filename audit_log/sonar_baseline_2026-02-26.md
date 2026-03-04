# Baseline Interno SonarQube - 2026-02-26

## Estado actual (inicio de plan)
- Config SonarQube en repo: **no existe** (`sonar-project.properties` ausente).
- Tests automatizados: **no configurados** en `package.json`.
- Cobertura (`lcov`): **no disponible**.
- Lint actual (`npm run lint`): **50 errores / 8 warnings**.

## Hallazgos priorizados

### P0 - Bloqueantes para auditoría
1. **Errores masivos de lint/react-hooks** (`react-hooks/immutability`): funciones usadas en `useEffect` antes de declararse.
   - Archivos críticos: `src/App.jsx`, `src/components/VistaOportunidades.jsx`, `src/components/VistaProyectosBase.jsx`, `src/components/AdministracionOC.jsx`, etc.
2. **Sin baseline Sonar ejecutable**: falta `sonar-project.properties` y pipeline de análisis.
3. **Sin cobertura de tests**: hoy el proyecto no puede cumplir umbral en código nuevo.

### P1 - Seguridad / Mantenibilidad
1. `api/enviar-email-oc.js` con errores lint de entorno Node (`process`, `Buffer`) por configuración de lint no segmentada.
2. Múltiples textos con **mojibake** (`Ã`, `â`, `ð`) visibles en `src/components/VistaOportunidades.jsx`.
3. Consistencia de auditoría interna (`audit_log`) aún requiere normalización de encoding.

### P2 - Higiene de código
1. Variables no usadas en varios componentes.
2. Warnings de dependencias en `useEffect` (exhaustive-deps).

## Quick wins ya ejecutados en este arranque
- Eliminados `console.log` de debug detectados en:
  - `src/App.jsx`
  - `api/enviar-email-oc.js`

## Plan de ejecución técnico (sprints cortos)

### Bloque A (P0) - 1 a 2 días
- Crear configuración Sonar (`sonar-project.properties`).
- Ajustar lint para frontend/backend (override Node en `api/**`).
- Resolver errores de `react-hooks/immutability` en `App` y 3 vistas críticas.

### Bloque B (P0/P1) - 2 a 3 días
- Introducir framework de tests (`vitest` + `@testing-library/react`).
- Tests base para:
  - `VistaCosteoInputs` (cálculos)
  - `FilterableTh` (filtro/orden)
- Generar `lcov.info`.

### Bloque C (P1/P2) - 1 a 2 días
- Barrido mojibake (UI visible primero).
- Limpieza de warnings/dead code.
- Revisión final de hotspots de seguridad y secretos.

## KPIs de salida para pre-auditoría
- Lint: 0 errores.
- Sonar análisis ejecutándose en rama principal.
- Coverage en código nuevo >= 70%.
- 0 vulnerabilidades críticas y 0 hotspots sin revisar.

## Siguiente paso recomendado inmediato
Comenzar por **Bloque A**: dejar `lint` estable y configurar Sonar para obtener el primer reporte real.
