# GalacticBet ⚡

Quinielas privadas de LaLiga y UEFA Champions League. React 19, TypeScript estricto, Vite, Tailwind 4 y Firebase. Sin apuestas de dinero.

## Arranque

Requisitos: Node.js 24 y npm. Java 21 para las pruebas de Firestore.

```sh
npm ci
npm run dev
```

En este entorno en la nube usa `npm ci --cache /tmp/galacticbet-npm-cache` si la caché personal no es escribible. Utiliza el checkout existente: las tareas ya están aisladas y no necesitan un worktree.

Sin configuración de Firebase la aplicación arranca y muestra estados vacíos reales. **Explorar demo** activa explícitamente cinco partidos ficticios de LaLiga, con un aviso permanente. Los pronósticos demo viven únicamente en memoria y desaparecen al recargar. No se mezclan con Firestore ni con la sincronización.

## Estado por fases

| Fase                   | Archivos principales                                                                                 | Implementado                                                                                                                                                       | Validación / pendiente                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1. Base y arquitectura | `src/main.tsx`, `App.tsx`, `components/`, `pages/`, `lib/domain.ts`, `styles.css`, Vite y TypeScript | Navegación, diseño móvil y escritorio, estados vacíos, carga, errores y demo explícita; rutas cargadas bajo demanda                                                | Compilación y navegación en Chromium comprobadas                                     |
| 2. Firebase            | `src/lib/firebase.ts`, `components/LoginModal.tsx`, `.env.example`                                   | Google, registro/correo, sesión persistente del SDK, logout y perfil básico                                                                                        | Falta un proyecto Firebase para verificar proveedores reales                         |
| 3. Grupos              | `src/lib/data.ts`, `pages/GroupsPage.tsx`, `firestore.rules`                                         | Crear, invitar por enlace/código, unirse mediante transacción, consultar miembros, abandonar, renombrar como admin, activar competiciones y modalidades inmutables | Flujo remoto pendiente de configuración Firebase y de ejecutar pruebas de reglas     |
| 4. Calendario          | `scripts/normalize.ts`, `scripts/sync.ts`, `pages/MatchesPage.tsx`                                   | API v4 PD/CL, fases y jornadas, partidos normalizados, escudos, resultados y estados                                                                               | Requiere token Football-Data y permisos de Firestore; no se ha llamado a la API real |
| 5. Pronósticos         | `pages/PredictionsPage.tsx`, `lib/domain.ts`, `firestore.rules`                                      | 1X2/exacto, guardado progresivo, consulta propia, cierre por partido, consulta de ajenos tras el inicio                                                            | Validación unitaria local; reglas pendientes de emulador                             |
| 6. Puntuación          | `scripts/standings.ts`, `scripts/sync.ts`, `pages/StandingsPage.tsx`                                 | Cálculo confiable, idempotencia, correcciones, clasificación general, por competición y jornada, empates y ganadores                                               | Funciones probadas; ejecución administrativa real pendiente                          |
| 7. PWA y despliegue    | `public/`, `.github/workflows/`, `firebase.json`                                                     | Manifest, iconos PNG, service worker, Pages y sincronización cada 2 h                                                                                              | Build comprobado; publicación e instalación física iOS/Android pendientes            |

## Conectar Firebase

1. Crea un proyecto Firebase y una base **Cloud Firestore**. Usa el plan gratuito Spark mientras las cuotas cubran al grupo. No se necesitan Cloud Functions ni un plan de pago para esta arquitectura.
2. Activa Authentication → Google y Email/Password. Añade los dominios autorizados de desarrollo y `TU_USUARIO.github.io`. La sesión se conserva con la persistencia local predeterminada de Firebase Auth.
3. Copia `.env.example` a `.env.local` y completa las cuatro variables públicas desde la configuración de tu aplicación web Firebase. Reinicia Vite. Estos identificadores públicos no sustituyen las reglas de seguridad.
4. Despliega las reglas **antes de usar datos reales**:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project TU_PROJECT_ID
```

El login es para tu máquina con tu propia cuenta. En automatización usa credenciales protegidas y permisos mínimos; no inicies sesión ni copies credenciales de otra identidad del entorno. No hay credenciales reales en este repositorio.

## Sincronización de partidos y clasificaciones

Consigue un token en Football-Data.org con acceso a `PD` y `CL` en su plan vigente. Revisa la cobertura real de tu cuenta; la aplicación no asume que una competición esté disponible si la API la rechaza.

En GitHub → Settings → Secrets and variables → Actions configura como **secrets**:

- `FOOTBALL_DATA_TOKEN`: token enviado solo desde Node en `X-Auth-Token`.
- `FIREBASE_SERVICE_ACCOUNT`: JSON de una cuenta de servicio del proyecto Firebase con permisos para los datos de la aplicación. Trátalo como una clave privada, limita sus permisos y rótalo si se expone. Nunca lo guardes en el repositorio.

Ejecuta el workflow **Synchronize football and standings** manualmente para cargar el primer calendario. Después se programa cada dos horas. GitHub puede retrasar o suspender ejecuciones programadas según actividad, plan y cuotas: el cierre de los pronósticos no depende de la puntualidad de Actions. Los resultados y rankings sí reflejan la última sincronización, no un marcador en directo.

Para ejecución local usa variables protegidas del proceso, nunca argumentos con claves ni archivos versionados:

```sh
npm run sync
```

El proceso admite `FIREBASE_SERVICE_ACCOUNT` o Application Default Credentials configuradas deliberadamente para el proyecto correspondiente. Con ADC es obligatorio indicar también `FIREBASE_PROJECT_ID` para elegir explícitamente el destino. No uses automáticamente una identidad desconocida de la máquina. Un fallo de acceso se informa y no se sustituye por datos demo.

La API se consulta solo en backend. Hace una consulta de competiciones y una de partidos por competición, con timeout, reintentos limitados y espera ante HTTP 429/5xx. No se desactiva TLS. Normaliza `seasonId`, `roundId`, fases de Champions, estado, equipos y resultado reglamentario. Los IDs de Football-Data evitan duplicados. Los resultados tras prórroga o penaltis solo puntúan si existe un `regularTime` explícito: nunca se usa `fullTime` como sustituto dudoso. Los partidos finalizados sin ese dato se registran como pendientes de puntuación.

Las escrituras se agrupan en lotes de menos de 500 y los metadatos repetidos se deduplican. Las clasificaciones consultan pronósticos solo de jornadas cuyos resultados han cambiado, con huellas del marcador y reemplazo atómico de totales. Las correcciones sustituyen puntos anteriores. Se recalculan las jornadas históricas cuando cambia la membresía, por ejemplo al volver a un grupo. No se incrementa un contador por cada ejecución. Las Actions de sincronización se serializan; evita lanzar otra sincronización administrativa simultánea fuera de Actions.

La primera importación/historial puede consumir más lecturas; monitoriza las cuotas gratuitas de Firestore y los minutos de Actions. Los grupos se limitan inicialmente a 30 participantes para contener operaciones y cuotas. Los logos y escudos los sirve el proveedor; hay alternativas de texto cuando no se descargan. No hay vínculo oficial con LaLiga ni UEFA.

## Modelo y seguridad

Se conserva la estructura solicitada:

```text
users/{uid}                         nombre y avatar públicos a usuarios autenticados
competitions/{PD|CL}                metadatos del proveedor
seasons/{PD-2026|CL-2026}            temporada y fechas
rounds/{competition-year-stage-day} fase + jornada/ronda
matches/{providerId}                kickoffAt Timestamp, utcDate, estado, marcador de 90 min
groups/{groupId}                    ownerId inmutable, memberIds, nombre
  members/{uid}                    membresía y fecha de unión
  gameSeasons/{competition-year}    modalidad fija, temporada y estado de recálculo backend
    predictions/{uid_matchId}      usuario, partido, jornada, valor y updatedAt
    standings/{uid}                puntos, aciertos y desglose por ronda
```

`memberIds` es una mejora deliberada para consultar los grupos del usuario sin leer todos los grupos. Las reglas solo permiten añadirse o quitarse a uno mismo; el propietario no puede borrarse ni transferirse desde el navegador. El subdocumento `members` permite listar participantes y se escribe junto con el grupo. Un administrador puede renombrar y activar una competición nueva; no puede cambiar una modalidad existente ni borrar temporadas para reiniciarlas.

El `groupId` aleatorio de Firestore es la invitación inicial. Un usuario autenticado con ese código puede consultar los metadatos del grupo y unirse; no puede listar grupos ajenos ni leer sus quinielas. Comparte enlaces solo con los invitados. Esta primera versión no incluye caducidad/revocación de invitaciones, expulsión ni transferencia de propietario.

Cada pronóstico es un documento independiente. Así las reglas pueden ocultar partidos futuros ajenos y permitir leer los propios mediante una consulta `where userId == auth.uid`. Los pronósticos del grupo se consultan por `matchId` solo después del comienzo; el servidor vuelve a comprobarlo. Las consultas no son filtros de seguridad: una consulta global de pronósticos abiertos se rechaza.

Firestore usa `request.time < kickoffAt`, no el reloj del navegador. Rechaza campos de puntos, identidades ajenas, marcadores inválidos, partidos de otra temporada, aplazados y cancelados. Calendarios, resultados y clasificaciones son de solo lectura para clientes. Solo Admin SDK, fuera de las reglas cliente, puede escribirlos. Revisa y prueba las reglas antes de desplegarlas; la configuración de Firebase en el frontend es pública por diseño.

Puntuación: clásica = 1 o 0; exacta = 3 por marcador o 1 por signo, sin sumar ambos. Empates en puntos comparten posición (`1,1,3`) y se muestran como ganadores compartidos. La clasificación por jornada está en el selector de historial. Las posiciones no usan un desempate artificial.

## Pruebas

```sh
npm test                # puntuación, cierre, normalización e idempotencia
npm run build           # tipado estricto + bundle
npm run test:rules      # Java 21 + emulador oficial de Firestore
```

`npm test` omite explícitamente las pruebas de reglas si no existe `FIRESTORE_EMULATOR_HOST`. **Omitido no equivale a aprobado.** `test:rules` inicia el emulador con un proyecto demo aislado y ejecuta las pruebas de privacidad, cierre, suplantación, membresía, puntos y modalidad fija. No usa datos de producción.

En este entorno, para evitar escribir la configuración de la CLI en un directorio protegido:

```sh
XDG_CONFIG_HOME=/tmp/galacticbet-cli-config npm run test:rules
```

Validación realizada durante el desarrollo: 14 pruebas unitarias aprobadas; navegación y demo comprobadas en Chromium a 1440 y 390 px, sin errores JavaScript ni desbordamiento horizontal. También se verificaron la reinstalación desde el lockfile, el build bajo `/galacticBet/`, la recarga de rutas, la protección de acceso, el manifest, los tres iconos PNG y el registro del service worker con ese scope. La descarga oficial del emulador desde `storage.googleapis.com` fue bloqueada por la red de este entorno, por lo que las 9 pruebas de reglas están pendientes. La política necesaria quedó guardada como borrador del entorno; guardarlo no aplica ni publica los cambios. No se han validado todavía autenticación, Firestore o sincronización contra un proyecto real.

## GitHub Pages

1. Sube el código a la rama `master` (o ajusta el workflow a tu rama real).
2. Configura Pages → Source: **GitHub Actions**.
3. Añade como **repository variables**, públicas, las cuatro `VITE_FIREBASE_*` del ejemplo.
4. Ejecuta **Deploy frontend**. El workflow comprueba las variables Firebase, ejecuta las pruebas unitarias y las de reglas con Java 21 y el emulador, compila y publica `dist/`.

Se utiliza `BASE_PATH=/<nombre-repositorio>/` y `HashRouter`, por lo que las recargas de rutas funcionan sin un servidor que reescriba URLs. Para un dominio raíz usa `BASE_PATH=/`. Ninguna clave de Football-Data ni cuenta de servicio debe tener prefijo `VITE_`: Vite incluye esas variables en el JavaScript público.

## PWA

En HTTPS, Android/Chrome puede instalar desde su menú; en iOS/Safari usa Compartir → Añadir a pantalla de inicio. Se incluyen iconos PNG de 192/512 y Apple Touch de 180, manifest con rutas relativas y modo standalone. El service worker muestra una respuesta de desconexión al navegar sin red. No mantiene caché persistente de pronósticos, perfiles ni respuestas Firebase. No ofrece edición offline: el backend tiene que confirmar el guardado antes del inicio. No se ha probado todavía la instalación en dispositivos físicos.

La vista de iPhone respeta las zonas seguras de la barra de estado y del indicador inferior, también en horizontal. El panel lateral se cierra con su botón, al tocar el fondo, con Escape y al navegar; conserva el desplazamiento de la pantalla y devuelve el foco al control de apertura. Los gestos de ampliación están desactivados dentro de la aplicación y los campos usan 16 px para evitar el autozoom de Safari. El logo de Champions utiliza una placa clara para conservar el contraste. Estos ajustes se comprueban en emulación móvil; la instalación y los gestos nativos siguen pendientes de verificación en un iPhone físico.

## Organización

- `src/components`: identidad visual, componentes comunes y acceso.
- `src/pages`: pantallas por ruta, cargadas bajo demanda.
- `src/lib`: tipos, reglas del dominio, Firebase y operaciones de datos; demo aislada.
- `scripts`: normalización del proveedor, sincronización y cálculo de clasificaciones.
- `tests`: pruebas unitarias y pruebas de reglas con emulador.
- `public`: iconos y configuración PWA.

Los ficheros se crearon desde cero: el repositorio original no tenía commits ni código. La publicación de la web requiere configurar los servicios y activar GitHub Pages. Esta es una base funcional local e integrada en código; la aceptación completa de las fases que dependen de servicios requiere configurar y probar esos servicios.
