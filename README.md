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

La opción **Por tipos de fuente** permite marcar uno o varios tipos y muestra el listado de sus **Informes asociados**, con referencia, título y fecha. Se puede seleccionar un informe, varios o todos; **Limpiar informes** permite empezar una selección puntual y **Seleccionar todos los informes** recupera el conjunto completo. Al cambiar los tipos se seleccionan todos sus informes asociados. La vista previa y el PDF incluyen únicamente los informes elegidos y sus hallazgos y acciones, sin duplicarlos; sin informes seleccionados, la descarga queda deshabilitada. Resuelve el tipo desde la fuente vinculada al informe; la selección y el alcance quedan visibles en la vista previa y en el PDF. Los registros sin informe verificable se conservan en **General con todo**, sin atribuirles un tipo de fuente.

El PDF usa un diseño ejecutivo horizontal A4: fondo blanco, verde corporativo, acentos dorados, bandas de sección con bordes redondeados y logo corporativo en todas las páginas. Las tablas tienen encabezados verdes, filas alternadas y líneas de separación y contornos visibles; los estados cerrados y vencidos se distinguen con fondos suaves y texto explícito. Después de la síntesis de alcance y fecha de corte en hora de Colombia, cada expediente se organiza en cuatro bloques: **Datos de la fuente**, **Informe emitido**, **Cuadro de hallazgos** y **Cuadro de acciones y estados**. **Datos de la fuente** muestra únicamente el tipo (por ejemplo, Programa de Auditoría, Auditoría Interna o Auditoría Externa), sin la ficha detallada de origen. La portada no incluye el párrafo de avance promedio ni la advertencia de integridad del repositorio.

La matriz de acciones se presenta en una página horizontal propia y conserva las 13 columnas y el orden de la descarga institucional de **Planes de acción**: número, descripción de observación/hallazgo, clase, áreas/procesos, acciones de mejoramiento, mecanismo de seguimiento, auditor, meta/unidad, fecha de inicio, fecha de terminación, plazo en semanas, estado/observación y responsable de mejoramiento. Incluye todas las acciones disponibles, también las que no tienen hallazgo visible, sin perder sus estados reales, avance ni evaluación. El plazo usa la diferencia absoluta de fechas en semanas, con un decimal, como el formato institucional; las fechas inválidas o ausentes se indican como no registradas.

Los párrafos fuera de las tablas se justifican. Dentro de las tablas, las descripciones, fichas y análisis se alinean a la izquierda con espaciado natural, sin estirar las líneas cortas ni separar artificialmente nombres, fechas o etiquetas. Las filas extensas continúan en la página siguiente, conservando el texto dentro de los bordes y repitiendo encabezados. En **Causa y análisis**, el tipo de fuente **Programa de Auditoría** muestra **NO APLICA**; las demás fuentes conservan su causa, metodología y análisis registrados.

Los separadores de punto medio se normalizan a guiones compatibles con la fuente PDF para evitar caracteres extraños en títulos y fichas. La ficha del informe se presenta en dos columnas para facilitar la lectura ejecutiva; los datos faltantes se señalan sin inventarlos. El rediseño solo afecta al PDF, no a la pantalla ni a la selección del alcance.

Las evidencias enlazadas, las evaluaciones registradas y el historial se conservan en un anexo documental, separado de los cuatro bloques ejecutivos y generado solo cuando hay contenido. Las acciones al 100% no se consideran cerradas mientras su workflow no esté cerrado. Los registros sin padre disponible y las inconsistencias aparecen explícitamente en el general; el reporte por informe sigue la relación acción > hallazgo > informe y señala vínculos conflictivos.

Para fuentes **Programa de Auditoría**, la evaluación ponderada corresponde al diseño inicial y un resultado **mayor o igual al 80%** habilita la ejecución, sin cerrar acciones. El reporte diferencia esa evaluación del dictamen final por acción, posterior a la ejecución al 100% y la validación del revisor. Las evaluaciones finales del flujo anterior conservan su tipo y resultado histórico. Para otras fuentes se conserva la eficacia por acción. Las pruebas de controles del módulo Trabajo de Campo no se presentan como evaluaciones de cierre. Fechas, evaluadores o avances faltantes se indican como no registrados; no se infieren fechas de cierre de una fecha límite.

### Flujo de acciones de Programa de Auditoría

Al guardar acciones, individualmente o en matriz, quedan **Pendiente Evaluación Auditor** y se notifica al auditor asignado, con copia informativa al ejecutor. La evaluación inicial usa los cinco criterios existentes (30%, 20%, 20%, 20%, 10%), calculados también en servidor. Desde 80% pasa a **En Ejecución** y se notifica al ejecutor; debajo del 80% requiere justificación, pasa a **Requiere Ajustes Auditor** y permite corregir el diseño, pero no ejecutar. Al guardar las correcciones se reenvía al auditor. Cambiar un diseño de esta fuente requiere una nueva evaluación, conservando su historial y avance previo.

Al alcanzar el 100%, pasa a **Pendiente Validación Revisor** y se notifica al revisor. Su aprobación remite cada acción a **En Revisión (100%)** y notifica al auditor asignado. El dictamen final del auditor cierra únicamente esa acción; el hallazgo se cierra cuando todas sus acciones están cerradas. Tanto el rechazo del revisor como el del auditor requieren motivo y devuelven al ejecutor al 90%, que debe pasar otra vez por ambas revisiones.

En pantalla, **Evaluar matriz** abre la evaluación inicial del auditor asignado. El bloque **Seguimiento de tus acciones** muestra al ejecutor si debe esperar, corregir el diseño o ejecutar; al revisor le habilita **Revisar matriz** solo cuando la acción está pendiente de su validación al 100%; al auditor le habilita **Evaluar y cerrar acción** después de esa validación. Los avisos se retiran al cambiar de etapa. La aprobación inicial envía a cada ejecutor únicamente sus acciones, sin solicitar tareas prematuras al revisor. Los correos de transición enlazan al informe en Planes de Acción; las evidencias se consultan desde la matriz.

Los planes que ya estaban en ejecución, revisión o cerrados conservan estado, avance e historial; no se migran ni se les exige retroactivamente una evaluación inicial. Los pendientes de aprobación del flujo anterior se evalúan al inicio. El tipo de fuente, no la presencia de un ID de programa, determina esta ruta. Las otras fuentes mantienen su flujo. Las notificaciones transaccionales de esta ruta no se pueden desmarcar en el formulario; si Gmail no está autorizado o falla el envío, se conserva el guardado, se informa el error y se utiliza la cola existente de reintentos. El correo no se considera entregado hasta que el despacho confirme éxito.

Validación del flujo y destinatarios con persistencia y correos simulados: `node --test tests/programPlanWorkflow.test.js tests/reporte360.test.js`.

El documento es una copia de seguimiento al momento de descargar, no una certificación de integridad del repositorio. Los enlaces a evidencias mantienen los controles de acceso del repositorio corporativo. El generador usa las dependencias existentes `jspdf` y `jspdf-autotable`, con texto seleccionable, tablas paginadas y encabezados y pies en todas las páginas.

Validación local: `node tests/reporte360.test.js`.

## Confirmación de eliminaciones

Las opciones de eliminar registros, fuentes, catálogos, históricos, controles, filas de matrices y adjuntos utilizan un diálogo compartido con aviso de acción irreversible. El diálogo detalla el elemento y, cuando corresponde, los registros vinculados que también se eliminarán. Quitar un adjunto retira su vínculo del registro, no el archivo del repositorio corporativo. La restauración JSON y el reemplazo de la matriz de riesgos o del cronograma también requieren confirmación.

El foco inicial está en **Cancelar, conservar**; Escape y el botón de cierre cancelan sin ejecutar la eliminación. La ventana bloquea la interacción con el fondo y se adapta a móvil. Los permisos y las reglas de guardado de cada módulo se conservan. Las deselecciones de filtros, responsables o sedes no son eliminaciones y no muestran este aviso.

Validación local sin escribir datos reales: `node --test tests/deleteConfirmation.test.js`.

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
