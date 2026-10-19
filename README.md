# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## GRC synchronization and sessions

The client listens to `sistema/semaforo` and sends its revision to the secured sync endpoint. Reads of the same revision and process scope share a 30-second in-memory cache and an in-flight request per server instance. Authorization and per-user response filtering still run for every request. Writes invalidate local caches; a different semaphore revision bypasses older cache entries on other instances. This is not a distributed cache and does not guarantee one database read across all Vercel instances.

Returning to a visible tab or reconnecting checks the semaphore at most once per minute per mounted client. Unchanged revisions do not reload the workspace. Failed syncs have three additional bounded retries, not continuous polling. Cached snapshots are ignored until a server snapshot arrives; a delayed initial API read remains available if the listener is unavailable.

Temporary authentication infrastructure or profile-read failures return 503, not 401. Failed 401 cookie renewals preserve the Firebase client session; explicit 403 renewal rejections still sign out. Expired or invalid cookies cannot authorize requests. The cookie lifetime remains five days.

Run `node tests/syncSession.test.js` for mocked regression checks of 30 concurrent requests, revision changes, process-scope isolation, cache invalidation races, temporary auth errors, renewal behavior, reconnect recovery and retry cleanup. These checks do not authenticate against production or simulate 30 independent server instances.

Firestore's standard free quota is 50,000 document reads per day per project, not per user. Check Firebase Console > Firestore > Usage before and after a representative workday. Semaphore deliveries, profile reads, full workspace reads, queries and reconnects all contribute. Thirty users do not imply a fixed read count; data volume and activity determine whether the quota is sufficient. Do not claim free-tier capacity without measuring it.

## Reporte 360 de planes de acción

En **Planes de acción > Reporte 360**, debajo de Gestión de Planes, se puede descargar un PDF por informe emitido, por uno o varios tipos de fuente de mejora consolidados, o un general con todos los registros disponibles para la sesión autorizada. No amplía el alcance de lectura ni modifica los registros.

La opción **Por tipos de fuente** permite marcar varios tipos y reúne sus informes, hallazgos y acciones sin duplicarlos. Resuelve el tipo desde la fuente vinculada al informe; la selección y el alcance quedan visibles en la vista previa y en el PDF. Los registros sin informe verificable se conservan en **General con todo**, sin atribuirles un tipo de fuente.

El PDF incorpora el logo corporativo, fecha de corte en hora de Colombia, usuario generador, resumen ejecutivo, informe y fuente de mejora, hallazgos, acciones, responsables, fechas, evidencias enlazadas e historial. Las acciones al 100% no se consideran cerradas mientras su workflow no esté cerrado. Los registros sin padre disponible y las inconsistencias aparecen explícitamente en el general; el reporte por informe sigue la relación acción > hallazgo > informe y señala vínculos conflictivos.

Se separan las dos evaluaciones de cierre: integral del paquete para informes de **Programa de Auditoría** con programa vinculado (mayor a 80% aprueba), y eficacia por acción para otras fuentes. Las pruebas de controles del módulo Trabajo de Campo no se presentan como evaluaciones de cierre. Fechas, evaluadores o avances faltantes se indican como no registrados; no se infieren fechas de cierre de una fecha límite.

El documento es una copia de seguimiento al momento de descargar, no una certificación de integridad del repositorio. Los enlaces a evidencias mantienen los controles de acceso del repositorio corporativo. El generador usa las dependencias existentes `jspdf` y `jspdf-autotable`, con texto seleccionable, tablas paginadas y encabezados y pies en todas las páginas.

Validación local: `node tests/reporte360.test.js`.

## Gmail OAuth

The application sends notifications from the signed-in user's Gmail account. Configure `VITE_GOOGLE_CLIENT_ID` as a Vite build environment variable in Vercel and in local `.env.local` development.

Create a Google OAuth client of type Web application, add the application origin (for example, `https://auditoria-gcm.vercel.app`) and both `http://localhost:5173` and `http://127.0.0.1:5173` as authorized JavaScript origins, enable the Gmail API, and allow the `gmail.send`, `openid`, and `email` scopes in the OAuth consent configuration. For a Google Workspace-only organization, use an Internal consent audience when available. The OAuth client ID is public; do not put a client secret in the frontend.

The user authorizes Gmail once per browser session. The short-lived access token stays in memory and is not written to local storage.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
