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
| 2. Firebase            | `src/lib/firebase.ts`, `components/LoginModal.tsx`, `.env.example`                                   | Google, registro/correo, sesión persistente del SDK, logout solo desde el perfil, nombre editable y pestañas de grupos y ayuda                                                                                        | Falta un proyecto Firebase para verificar proveedores reales                         |
| 3. Grupos              | `src/lib/data.ts`, `pages/GroupsPage.tsx`, `firestore.rules`                                         | Lista con nombres de miembros, detalles al pulsar, crear/unirse en modales, ambas competiciones incluidas, invitaciones, abandono y nombre administrable | Flujo remoto pendiente de configuración Firebase y de validar los servicios reales   |
| 4. Calendario          | `scripts/normalize.ts`, `scripts/sync.ts`, `pages/MatchesPage.tsx`                                   | API v4 PD/CL, fases y jornadas, partidos normalizados, escudos, resultados y estados                                                                               | Requiere token Football-Data y permisos de Firestore; no se ha llamado a la API real |
| 5. Pronósticos         | `pages/PredictionsPage.tsx`, `lib/domain.ts`, `firestore.rules`                                      | 1X2/exacto, entrega completa antes del primer partido, cierre definitivo, pendientes y visibilidad recíproca entre quienes entregan                                        | Validación unitaria local; reglas verificadas en emulador                            |
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

## Información de partidos

«Partidos» presenta tarjetas con horario local (Hoy/Mañana), estado y forma de ambos equipos. Al pulsarlas se abre una ficha con rendimiento de temporada (partidos, victorias, empates, derrotas y goles), enfrentamientos anteriores y contexto de ida/vuelta de Champions cuando el calendario permite identificar el cruce. El global se orienta hacia los equipos local y visitante del partido abierto y se calcula solo con marcadores reglamentarios finalizados y fiables; se distingue de la clasificación oficial tras prórroga o penaltis.

Los cinco puntos de forma se muestran también en ambas vistas de la quiniela: verde = victoria, gris = empate, rojo = derrota; hueco = historial no disponible. No contienen letras y tienen descripciones accesibles. Las leyendas, explicaciones sobre forma y las notas generales de horarios, actualización y marcadores se encuentran solo en Perfil → Cómo jugar; las fichas conservan los datos y sus estados concretos. Se ordenan de antiguo a reciente (el último está a la derecha), combinando resultados anteriores disponibles de PD y CL. Para partidos pasados se corta el historial antes de su inicio, evitando incluir resultados posteriores; las estadísticas de temporada se limitan a su competición y temporada. Todo se calcula a 90 minutos sobre los partidos ya descargados, sin nuevas llamadas a Football-Data, nuevas credenciales ni librerías.

La normalización conserva los IDs de los equipos y la duración del partido desde la próxima sincronización. Los documentos anteriores siguen funcionando por coincidencia de nombre cuando no hay IDs. No se inventan datos ausentes ni se ofrecen estadísticas de otras competiciones no sincronizadas; la actualización de resultados sigue dependiendo de las tareas programadas y del retraso del proveedor. La demo conserva sus cinco partidos ficticios, sin añadir resultados pasados inventados para rellenar los indicadores.

## Preferencias y fluidez

Se recuerda el último grupo y la competición por cuenta en `localStorage` (dos identificadores por usuario, máximo cinco cuentas y un registro menor de 4 KB). Quiniela y clasificación abren ese grupo automáticamente; un enlace explícito válido tiene prioridad. La selección siempre se valida contra los grupos de la sesión actual: si se ha abandonado un grupo, se usa uno disponible. Almacenamiento bloqueado o corrupto no impide navegar. Las preferencias son propias de este dispositivo; los pronósticos siguen sincronizados por Firestore.

Clasificación usa dos botones con logos para LaLiga y Champions y abre «Por jornada» con la ronda en juego, recién iniciada, próxima o última finalizada según el calendario disponible. Se puede elegir otra jornada y consultar «Todas las jornadas»; dentro del acumulado, «Sumar LaLiga y Champions» conserva el ranking global. Cambiar entre esos filtros trabaja con los datos ya cargados.

Una caché exclusivamente en memoria, limitada a 20 entradas, comparte peticiones simultáneas y reutiliza participantes/modalidades durante 60 segundos y clasificaciones durante 30 segundos. Al volver a una clasificación recién abierta se muestra directamente, sin repetir la consulta; al retornar al primer plano tras caducar se consulta de nuevo. Se invalida al cambiar de sesión, modificar el perfil, crear/unirse/abandonar/renombrar grupos o preparar competiciones nuevas. No guarda pronósticos ni documentos de cierre y nunca los usa para autorizar una edición. No se activa persistencia de Firestore ni se añaden librerías.

Las pantallas se cargan bajo demanda, con precarga al tocar, enfocar o apuntar a su enlace; no se descargan todas al iniciar. Las transiciones usan opacidad y un desplazamiento corto, el selector de competición mueve su fondo y se respeta «Reducir movimiento». Los puntos de forma no se recalculan cada segundo cuando el calendario no cambia. Se han probado navegación, recarga, enlaces, grupos no disponibles, caché compartida, movimiento reducido y pantallas de 320, 390 y 1440 píxeles sin escribir en producción.

## Reducción de lecturas de Firestore

La sincronización reutiliza en memoria los partidos recién descargados de Football-Data para calcular los puntos; no vuelve a consultar `matches where seasonId == …` para las temporadas de esa descarga. Compara el calendario con una copia pública por temporada y escribe únicamente los partidos modificados. Cuando resultados, versión del cálculo y participantes no han cambiado, tampoco lee pronósticos, clasificaciones ni perfiles. Los perfiles que sí necesita se comparten entre grupos durante la ejecución.

El frontend lee `calendars/{seasonId}`: un documento con los partidos públicos normalizados de esa temporada, en vez de un documento por partido. Por ejemplo, 262 partidos requieren una lectura de calendario en lugar de 262. Con una temporada de LaLiga y otra de Champions son dos documentos; temporadas históricas adicionales añaden un documento cada una. Esto reduce lecturas, no elimina la transferencia del calendario. El campo JSON `payload` no se indexa y se limita a 800 KB por temporada, por debajo del máximo de documento de Firestore. Los partidos individuales siguen siendo la fuente del cierre y de las reglas de seguridad.

Solo ese calendario público se conserva en `localStorage`, separado por proyecto Firebase, con una vigencia de cinco minutos y un máximo de 1,5 millones de caracteres para todo el registro. Peticiones simultáneas se comparten. Durante su vigencia, recargar no vuelve a leer el calendario; al caducar, volver al primer plano o permanecer con la aplicación visible permite refrescarlo. No hay consultas periódicas en segundo plano. Almacenamiento bloqueado, lleno o corrupto no impide continuar con caché en memoria. No se guardan pronósticos, cierres ni perfiles en esta persistencia y no se utiliza para autorizar operaciones. Los resultados mantienen la frecuencia de actualización del backend, con hasta cinco minutos adicionales de caché local.

Los pronósticos propios se escuchan por **usuario y jornada**, aprovechando el índice compuesto existente; entrar en una jornada ya no descarga toda la temporada. Las modalidades se comparten entre quiniela y clasificación mediante la caché existente. Se mantienen la ocultación de elecciones ajenas, el cierre irreversible y la validación de hora del servidor.

Para activar la optimización en una instalación existente:

1. Espera a que termine **Deploy frontend**, que publica también las reglas y la exclusión de índice del calendario.
2. Ejecuta **Synchronize football and standings → Run workflow**, seleccionando `master`, para generar las copias públicas. No necesitas credenciales nuevas.
3. Reabre la web tras cinco minutos y compara las nuevas ejecuciones en las estadísticas de Firestore. El consumo acumulado de hoy no se elimina con el cambio.

Hasta que exista el primer calendario agregado, la web conserva la lectura antigua como compatibilidad temporal, con la misma caché de cinco minutos. Las temporadas históricas de los grupos que ya no devuelve la API se convierten una sola vez desde los partidos existentes. Esa migración y la primera actualización del estado de puntuación pueden realizar más operaciones; las siguientes sincronizaciones reutilizan los documentos agregados.

Las consultas desde el explorador de datos de Firebase también pueden consumir lecturas. `SELECT _none_ PageSize 300` no se genera en el código de la aplicación; puede corresponder a una consulta de esa herramienta. El emulador verifica los documentos leídos y las escrituras omitidas, pero la reducción del consumo total del proyecto debe confirmarse con sus métricas reales, que incluyen navegación, reglas, sincronización y consultas administrativas.

## Perfil y grupos

El icono de usuario abre directamente `/perfil`. «Mi perfil» permite cambiar el nombre en Authentication y en el documento público de perfil; el correo es informativo. «Mis grupos» muestra los grupos con los nombres de sus miembros y enlaza a sus detalles. «Cómo jugar» explica modalidades, cierre y clasificaciones. El único botón de cerrar sesión está al final del perfil, con estilo discreto.

En `/grupos` aparecen primero las tarjetas con los participantes; al pulsar se muestran invitación, modalidades, accesos a quiniela y clasificación, y acciones según permisos. Crear y unirse se abren desde los botones inferiores en modales con foco controlado y bloqueo del fondo para iPhone. La creación guarda el grupo, su membresía y las dos competiciones (PD y CL) en un lote; se elige una modalidad común inicial, fija toda la temporada. Cuando entra el administrador de un grupo antiguo, una transacción añade solo las competiciones de la temporada actual que falten, copiando la modalidad existente o usando clásica si no hay ninguna. Nunca modifica temporadas, modalidades ni pronósticos existentes. Los miembros no pueden activar competiciones por su cuenta.

En Mi quiniela se elige la competición pulsando su logo; la modalidad se muestra debajo. Solo aparece un selector de temporada separado si hay varias temporadas de la misma competición, con años legibles.

## Sincronización de partidos y clasificaciones

Consigue un token en Football-Data.org con acceso a `PD` y `CL` en su plan vigente. Revisa la cobertura real de tu cuenta; la aplicación no asume que una competición esté disponible si la API la rechaza.

En GitHub → Settings → Secrets and variables → Actions configura como **secrets**:

- `FOOTBALL_DATA_TOKEN`: token enviado solo desde Node en `X-Auth-Token`.
- `FIREBASE_SERVICE_ACCOUNT`: JSON de una cuenta de servicio del proyecto Firebase con permisos para los datos de la aplicación. Trátalo como una clave privada, limita sus permisos y rótalo si se expone. Nunca lo guardes en el repositorio.

Ejecuta el workflow **Synchronize football and standings** manualmente para cargar el primer calendario. Después se programa cada dos horas y se ejecuta cuando se actualizan los scripts del backend en `master`. GitHub puede retrasar o suspender ejecuciones programadas según actividad, plan y cuotas: el cierre de los pronósticos no depende de la puntualidad de Actions. Los resultados y rankings sí reflejan la última sincronización, no un marcador en directo.

Para ejecución local usa variables protegidas del proceso, nunca argumentos con claves ni archivos versionados:

```sh
npm run sync
```

El proceso admite `FIREBASE_SERVICE_ACCOUNT` o Application Default Credentials configuradas deliberadamente para el proyecto correspondiente. Con ADC es obligatorio indicar también `FIREBASE_PROJECT_ID` para elegir explícitamente el destino. No uses automáticamente una identidad desconocida de la máquina. Un fallo de acceso se informa y no se sustituye por datos demo.

La API se consulta solo en backend. Hace una consulta de competiciones y una de partidos por competición, con timeout, reintentos limitados y espera ante HTTP 429/5xx. No se desactiva TLS. Normaliza `seasonId`, `roundId`, fases de Champions, estado, equipos y resultado reglamentario. Los IDs de Football-Data evitan duplicados. Los resultados tras prórroga o penaltis solo puntúan si existe un `regularTime` explícito: nunca se usa `fullTime` como sustituto dudoso. Los partidos finalizados sin ese dato se registran como pendientes de puntuación.

Las escrituras de partidos modificados se agrupan en lotes de menos de 500 y los metadatos repetidos se deduplican. El calendario agregado se publica después de confirmar esos lotes; una ejecución interrumpida conserva la copia publicada y reintenta los cambios pendientes. Las clasificaciones consultan pronósticos solo de jornadas cuyos resultados han cambiado, con huellas del marcador y reemplazo atómico de totales. Las correcciones sustituyen puntos anteriores. Se recalculan las jornadas históricas cuando cambia la membresía, por ejemplo al volver a un grupo. No se incrementa un contador por cada ejecución. Las Actions de sincronización se serializan; evita lanzar otra sincronización administrativa simultánea fuera de Actions.

La primera importación/historial puede consumir más lecturas; monitoriza las cuotas gratuitas de Firestore y los minutos de Actions. Los grupos se limitan inicialmente a 30 participantes para contener operaciones y cuotas. Los logos y escudos los sirve el proveedor; hay alternativas de texto cuando no se descargan. No hay vínculo oficial con LaLiga ni UEFA.

## Modelo y seguridad

Se conserva la estructura solicitada:

```text
users/{uid}                         nombre y avatar públicos a usuarios autenticados
competitions/{PD|CL}                metadatos del proveedor
seasons/{PD-2026|CL-2026}            temporada y fechas
rounds/{competition-year-stage-day} fase + jornada, requiredMatchIds y submissionDeadline del backend
matches/{providerId}                kickoffAt Timestamp, utcDate, estado, marcador de 90 min
calendars/{competition-year}        copia pública normalizada por temporada, solo escritura backend
groups/{groupId}                    ownerId inmutable, memberIds, nombre
  members/{uid}                    membresía y fecha de unión
  gameSeasons/{competition-year}    modalidad fija, temporada y estado de recálculo backend
    predictions/{uid_matchId}      usuario, partido, jornada, valor y updatedAt
    submissions/{uid}/rounds/{id}  cierre definitivo por usuario y jornada (submittedAt del servidor)
    roundEntries/{id}/players/{uid} entrega completa inmutable, compartida solo entre quienes entregan
    roundAttendance/{id}           mapa de miembros que han entregado (sin pronósticos)
    standings/{uid}                puntos, aciertos y desglose por ronda
```

`memberIds` es una mejora deliberada para consultar los grupos del usuario sin leer todos los grupos. Las reglas solo permiten añadirse o quitarse a uno mismo; el propietario no puede borrarse ni transferirse desde el navegador. El subdocumento `members` permite listar participantes y se escribe junto con el grupo. Un administrador puede renombrar y preparar las competiciones que falten; no puede cambiar una modalidad existente ni borrar temporadas para reiniciarlas.

El `groupId` aleatorio de Firestore es la invitación inicial. Un usuario autenticado con ese código puede consultar los metadatos del grupo y unirse; no puede listar grupos ajenos ni leer sus quinielas. Comparte enlaces solo con los invitados. Esta primera versión no incluye caducidad/revocación de invitaciones, expulsión ni transferencia de propietario.

Los pronósticos progresivos de `predictions` son siempre privados, incluso después de comenzar los partidos. Solo su autor puede consultarlos. La entrega completa crea una copia inmutable en `roundEntries/{roundId}/players/{uid}`: el servidor permite leerla exclusivamente a miembros actuales del mismo grupo que también tengan su propia entrega completa para esa jornada. Esto permite comparar elecciones antes del inicio sin que alguien copie y luego cambie las suyas. La protección también se aplica a lecturas directas y consultas desde el navegador; el inicio del partido no concede acceso a quien no entregó.

**Guardar quiniela** exige pronosticar todos los encuentros disponibles de la jornada antes del inicio del primero. Cancelados y aplazados no exigen elección ni fijan una fecha antigua como cierre; si no queda ningún horario válido, no se puede entregar. `rounds` contiene los IDs oficiales requeridos y el plazo (`submissionDeadline`), publicados por la sincronización. El reloj de Firestore valida tanto los borradores como la entrega final: no se pueden completar partidos posteriores una vez iniciado el primero. El aviso muestra la fecha y hora local, el recuento de entregas y los nombres de los miembros pendientes; al llegar el plazo, pasa a «Plazo cerrado». Los horarios y aplazamientos se actualizan cuando llega la información del proveedor.

Una transacción revisa que las elecciones coincidan con las leídas de Firestore y guarda conjuntamente el marcador privado `submissions/{uid}/rounds/{roundId}`, la copia completa y el resumen de asistencia. Los tres se validan de forma atómica; no se pueden fingir estados de entrega ni modificar o eliminar una copia cerrada, ni siquiera siendo administrador del grupo. La copia contiene el orden oficial de partidos y una cadena acotada de elecciones con su modalidad: las reglas comprueban todos sus valores con una expresión regular, evitando los límites de evaluación y de lecturas de las jornadas largas. Se admiten hasta 32 encuentros por ronda; LaLiga usa 10 y la fase liga de Champions, 18. Los campos que no se consultan no se indexan.

El resumen público al grupo contiene únicamente IDs y fechas de entrega. Usa un solo documento y un listener por jornada. Los pronósticos compartidos se cargan al desplegar «Ver grupo», con una única consulta por ronda limitada a los IDs de los miembros actuales, y se reutilizan en todas las tarjetas; una entrega nueva actualiza la vista en directo. No se consulta una colección por cada partido ni se guardan entregas privadas en almacenamiento persistente.

Tras guardar se mantiene **El grupo**, con el estado «Ya estás jugando», la elección propia visible y sin controles de edición. Solo aparecen las filas de compañeros que también han guardado. La elección propia sigue visible si falla la carga de perfiles y no se duplica entre los compañeros. La demo sigue identificada y no escribe en Firestore.

La primera sincronización de esta actualización prepara los plazos aunque el calendario no haya cambiado y convierte una sola vez los cierres antiguos completos en entregas compartibles. No reabre quinielas ni publica las incompletas. Las rondas que ya habían empezado al activar el cambio conservan su contrato de puntuación anterior; las siguientes solo puntúan las copias completas entregadas a tiempo. Se conserva la fecha de activación por temporada, por lo que una sincronización repetida no cambia esa frontera. Las correcciones de resultados siguen sustituyendo los puntos previos sin duplicarlos.

Los cambios del backend disparan automáticamente **Synchronize football and standings** al subir a `master`, además de su programación habitual. Para activar esta actualización, espera a que terminen **Deploy frontend** (reglas e índices incluidos) y **Synchronize football and standings**; después reabre la web. Si la sincronización falla, corrige su error y vuelve a ejecutarla con `Run workflow` en `master`. No necesitas secretos nuevos. Hasta preparar una jornada, el frontend no habilita entregas sin validación del servidor.

Las opciones 1/X/2 y los logos de competición indican la selección con su fondo y borde, sin ticks ni iconos añadidos. La vista guardada coloca el pronóstico en el centro, entre los dos equipos con sus escudos y puntos de forma; el marcador real a 90 minutos aparece separado en el pie cuando está disponible. Los estados se reducen a una línea y los compañeros aparecen en filas compactas, sin repetir el pronóstico propio ni etiquetas de jugador. Los colores de fondo, bordes, botones y campos se han unificado con tonos oscuros más neutros y controles táctiles de selección de 44 píxeles. Los ajustes visuales no añaden consultas a Firestore ni dependencias. Se ha verificado el guardado, recarga, privacidad y ambos modos, además de nombres largos, resultados, aplazados, cancelados, elecciones ausentes y un marcador de dos cifras en pantallas de 320, 390, 768 y 1440 píxeles usando servicios simulados.

Firestore usa `request.time < submissionDeadline` y `request.time < kickoffAt` para los borradores, y el plazo común para las entregas, independientemente del reloj del navegador. Rechaza campos de puntos, identidades ajenas, marcadores inválidos, partidos de otra temporada, aplazados y cancelados. Calendarios, resultados y clasificaciones son de solo lectura para clientes. Solo Admin SDK, fuera de las reglas cliente, puede escribirlos. Revisa y prueba las reglas antes de desplegarlas; la configuración de Firebase en el frontend es pública por diseño.

Puntuación: clásica = 1 o 0; exacta = 3 por marcador o 1 por signo, sin sumar ambos. Al seleccionar un grupo, la clasificación muestra todos los miembros actuales, incluso con 0 puntos y sin puntuaciones sincronizadas; los antiguos miembros quedan excluidos. La vista inicial «Por jornada» selecciona la ronda actual disponible. Los botones LaLiga/Champions filtran la competición, «Todas las jornadas» consulta el acumulado y su opción de sumar ambas conserva el global del grupo. El selector incluye jornadas del calendario aunque todavía no hayan terminado, y distingue competición y temporada. Los puntos proceden exclusivamente de los totales calculados por el backend. Empates en puntos comparten posición (`1,1,3`), con orden alfabético visual entre empatados. Se muestran ganadores compartidos cuando hay puntos; una tabla inicial a cero no muestra trofeos.

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

Validación actual: 117 pruebas unitarias y 39 pruebas de Firestore aprobadas, estas últimas ejecutadas contra el emulador con proyectos demo aislados. Incluyen la sincronización de 380 partidos con una lectura de calendario, ausencia de escrituras si no cambian, puntuación y correcciones, altas y bajas, recuperación tras un fallo parcial, migración histórica y privacidad de los nuevos calendarios. Se comprueban también el cierre irreversible, la protección frente a suplantación, la comparación con un resumen antiguo y ambos modos de pronóstico. En Chromium se han comprobado dos lecturas de calendario iniciales, ninguna al recargar dentro de los cinco minutos y dos al caducar; además, el cambio de jornada/competición con consultas por usuario y ronda, sin barridos de partidos ni errores de interfaz. Además, Chromium ha ejecutado la aplicación con usuarios independientes y el SDK real conectado al emulador: entrega parcial bloqueada, confirmación atómica, comparación previa al inicio, incorporación en directo de otro participante, marcador exacto y cierre común con partidos posteriores. Se verifican 320, 390, 768 y 1440 píxeles sin desbordamiento. Ninguna comprobación escribe en producción. Las revisiones anteriores verificaron también móvil/escritorio, navegación, preferencias y la confirmación del cierre. La compilación usa el prefijo `/galacticBet/`. No se han ejecutado publicaciones administrativas contra un proyecto Firebase real desde esta máquina.

## GitHub Pages

1. Sube el código a la rama `master` (o ajusta el workflow a tu rama real).
2. Configura Pages → Source: **GitHub Actions**.
3. Añade como **repository variables**, públicas, las cuatro `VITE_FIREBASE_*` del ejemplo.
4. Ejecuta **Deploy frontend**. El workflow comprueba las variables Firebase, ejecuta las pruebas unitarias y las de reglas con Java 21 y el emulador, compila, publica las reglas e índices y sube `dist/` a Pages.

La publicación de reglas usa el Secret `FIREBASE_SERVICE_ACCOUNT` ya utilizado por la sincronización. `npm run deploy:firestore` comprueba que el `project_id` del JSON coincide con `VITE_FIREBASE_PROJECT_ID`, escribe las credenciales en un directorio temporal privado y lo elimina al terminar. La cuenta necesita permisos para publicar reglas e índices de Firestore. Si este paso falla, la web nueva no se publica: así el botón de cierre no aparece con reglas antiguas que permitan editar después de confirmar. Para despliegue manual puedes seguir usando el comando `firebase deploy` de la sección Firebase.

El error `Deployment failed, try again later` de `actions/deploy-pages` ocurre después de crear el despliegue en GitHub Pages. El aviso deprecado de `punycode` no explica ese fallo remoto. El workflow reintenta esa publicación una vez tras 15 segundos; un segundo fallo mantiene el job en rojo. No se omiten compilación ni pruebas para conseguir un despliegue verde. Si vuelve a fallar ese paso, revisa la ejecución y el estado de GitHub Pages; la publicación real no se ha podido verificar desde esta máquina.

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


## Navegación compacta y frecuencia de actualización

`FilterPanel` concentra la presentación y el comportamiento de los filtros de Quiniela, Clasificación y Partidos. Se inicia cerrado, resume la selección activa y conserva sus controles montados: abrir o cerrar no reinicia listeners ni recarga datos. `CompetitionSwitch` se comparte entre las tres páginas. El grupo y la competición se siguen recordando por usuario; las tarjetas de Mis grupos se inician cerradas, salvo enlaces explícitos a los detalles de un grupo. El estilo común utiliza las variables `--panel`, `--border`, `--surface-header` y `--surface-border` de `src/styles.css`.

La tarea `Synchronize football and standings` se programa cada 2 horas, en el minuto 17 UTC (`17 */2 * * *`), y también permite ejecución manual. Football-Data.org y GitHub Actions pueden introducir retrasos. Durante la misma ejecución se recalculan puntos únicamente con partidos finalizados. La aplicación consulta el calendario público cada 5 minutos mientras está visible y al recuperar el foco, respetando la caché de 5 minutos. Los indicadores verde/gris/rojo se calculan localmente a partir de los cinco partidos finalizados anteriores al encuentro consultado; no realizan peticiones propias ni incluyen resultados posteriores a ese partido. Los huecos indican historial no disponible.

La clasificación se consulta al entrar, cambiar de grupo o recuperar el foco con la caché caducada. Su caché dura 30 segundos; ese plazo no es un intervalo de sondeo y la página no consulta puntos cada 30 segundos. Las entregas mantienen su listener acotado en tiempo real. Los pronósticos compartidos se consultan al abrir su primer desplegable y reutilizan un único listener de jornada, sin volver a suscribirse al cerrar y reabrir. Estos ajustes de navegación no modifican la programación del servidor ni añaden sondeos.


## Resultados finales y pronósticos compartidos

En Quiniela, los pronósticos de compañeros empiezan recogidos en cada partido. La apuesta propia y el resultado siempre quedan visibles. La primera apertura carga las entradas completas mediante una sola consulta por jornada; las siguientes aperturas reutilizan el listener hasta salir de esa jornada. La privacidad recíproca y las reglas de entrega no cambian.

`MatchResult` comparte el resumen final y las estadísticas entre Quiniela y la ficha de Partidos. Destaca ganador o empate y muestra el signo y el marcador reglamentario. Las estadísticas incluyen goles a 90 minutos, goles totales, porterías a cero y, si el proveedor informa el descanso, goles de primera y segunda parte. Los datos ausentes se indican como no disponibles, sin ceros ficticios ni goles negativos. Se conservan opcionalmente `halfTimeHomeScore`, `halfTimeAwayScore` y `winner` en el calendario público y en cada partido; se obtienen de las mismas respuestas programadas de Football-Data, sin llamadas nuevas. Los calendarios antiguos siguen siendo compatibles.

El ganador oficial tras prórroga o penaltis se obtiene del campo `score.winner` del proveedor. El resultado y los goles que puntúan la quiniela siguen siendo exclusivamente los de 90 minutos. Si falta el ganador oficial de una eliminatoria, se muestra pendiente; un empate reglamentario no se interpreta como ganador final. Los campos adicionales llegarán tras una sincronización correcta; el cambio del script activa automáticamente la tarea de sincronización de GitHub Actions en `master`, además de su ejecución programada o manual.


## Porra rápida: herramienta independiente

La ruta `#/porra` está disponible desde Inicio y el apartado Herramientas del menú lateral. Usa los próximos partidos reales ya cargados de LaLiga y Champions, sin consultas propias a Firestore ni peticiones a Football-Data. Permite anotar hasta 30 participantes con nombre y marcador exacto, fijar una aportación por persona en euros y calcular el bote con céntimos enteros. Las porras guardadas se pueden volver a editar, incluso después de iniciarse el partido: son una anotación independiente de las quinielas oficiales de los grupos y no modifican sus puntos ni sus cierres.

Se guardan hasta 20 porras en `localStorage`, separadas por cuenta y con un espacio de invitado. Solo están disponibles en ese navegador/dispositivo y no se sincronizan con Firebase. Cambiar de cuenta desmonta la herramienta y cambia su espacio local. Los registros incluyen una copia del partido, de modo que siguen siendo editables cuando ese calendario ya no está cargado. No se sobrescriben archivos incompatibles ni datos corruptos; si el almacenamiento está bloqueado o lleno, se indica que la vista no se ha guardado y sigue disponible para descargar o compartir. Borrar los datos del navegador elimina estas porras.

Al guardar se muestra una tarjeta compacta con diseño claro. `porraImage` genera un PNG completo, con todos los nombres, marcadores, importe por persona y bote total; usa Canvas y tipografía local, sin librerías, imágenes externas ni problemas de CORS. La vista para captura ajusta esa imagen a la pantalla. Compartir usa el menú nativo de archivos cuando está disponible, con alternativa de texto y copia al portapapeles; también se puede descargar el PNG. Las porras creadas en modo demo se identifican como ejemplos en la tarjeta, el texto y la imagen. Las aportaciones son anotaciones: no se procesan cobros ni pagos.

La página y sus estilos se cargan bajo demanda. No requiere credenciales, reglas ni índices nuevos. `tests/porra.test.ts` cubre importes, validación, aislamiento de cuentas, persistencia editable, límites, corrupción y fallos de almacenamiento. Se comprueban también el PNG, compartir, captura y las pantallas de 320, 390, 768 y 1440 píxeles mediante navegador local.

## Ficha ampliada de partidos

Al abrir un partido se pueden consultar **Goles**, **Alineaciones** y **Estadísticas**: minuto y autor del gol, asistente cuando esté disponible, titulares, suplentes, formación, posesión, remates, faltas, córners y tarjetas. También aparecen estadio, árbitro y asistencia si la fuente los publica. La ficha identifica la fuente y la fecha de actualización; no convierte datos ausentes en ceros ni presenta una plantilla como once confirmado.

Se añade **ESPN como fuente complementaria pública sin clave**, mediante `site.api.espn.com/apis/site/v2/sports/soccer/{esp.1|uefa.champions}/scoreboard` y `/summary?event=...`. Es un servicio público utilizado por ESPN, **sin contrato de API, cuota gratuita publicada ni garantía de disponibilidad/cobertura para esta aplicación**. Puede cambiar su formato o dejar de responder. No se ha podido verificar su respuesta real desde este entorno por su política de red; el adaptador se ha comprobado con respuestas simuladas. La primera sincronización en GitHub Actions permitirá comprobar la cobertura real. No se afirma que otros planes gratuitos como API-Football o TheSportsDB incluyan alineaciones de la temporada actual: hay que comprobar sus restricciones antes de sustituir el proveedor.

Football-Data.org continúa siendo la fuente de calendarios, estados, resultados a 90 minutos y puntuación. El complemento de ESPN se ejecuta **después** de calcular los puntos y escribe exclusivamente `matchInsights/{footballDataMatchId}`. Cada documento contiene `insight` (información pública normalizada), `checkedAt`, `kickoff` y `status`. El cliente puede obtener una ficha concreta, pero no listar la colección ni crear, modificar o borrar documentos. El campo `insight` no se indexa. No se cargan estas plantillas dentro de los calendarios agregados.

El emparejamiento exige competición, ambos equipos con la misma localía, nombres equivalentes mediante alias explícitos y horario a un máximo de 15 minutos, con un único candidato. La cabecera del detalle se valida de nuevo. Si hay ambigüedad o cambio de fecha, no se muestra un partido distinto. Los goles de tanda no se mezclan con los del partido. La prórroga puede aparecer en los eventos y estadísticas complementarios, pero nunca cambia los puntos reglamentarios. Los autogoles solo se atribuyen a un equipo cuando el proveedor identifica explícitamente al beneficiario.

La sincronización sigue programada **cada dos horas**. En cada ejecución considera partidos de las últimas 48 horas y las próximas 24, con un máximo de 80 lecturas de documentos, dos consultas de calendario ESPN y 24 fichas. Reutiliza la información existente: 12 horas para encuentros a más de dos horas del inicio, dos horas cerca del inicio/en juego y 24 horas para finalizados; un cambio de estado o fecha obliga a revisar. Prioriza las fichas nunca consultadas y las más antiguas. Conserva la información anterior ante errores o secciones omitidas y detiene consultas si el proveedor falla. No es un marcador minuto a minuto; una alineación publicada poco antes del inicio puede llegar en una ejecución posterior. Las fichas sincronizadas se conservan, pero no se hace una descarga inicial de alineaciones de toda la temporada.

La app no consulta ESPN directamente ni añade listeners: abre un documento de Firestore al entrar en la ficha. La caché pública dura 15 minutos, agrupa aperturas simultáneas y guarda también las ausencias. Persiste hasta 12 fichas y 180.000 caracteres por proyecto, separada de los datos privados. Reabrir o recargar dentro de ese plazo no repite la lectura; si el almacenamiento no está disponible, funciona en memoria. El modo demo no consulta detalles reales.

**Dónde verlo** abre una búsqueda del partido y su fecha para consultar canales oficiales disponibles en España. Es una consulta de disponibilidad, no un enlace directo a una emisión ni una promesa de acceso gratuito. **Más información** consulta el partido en Google y, cuando se ha identificado, se incluye la ficha de ESPN. No se insertan reproductores ni enlaces arbitrarios de respuestas externas.

Para activarlo, espera a que finalicen **Deploy frontend** (publica las reglas e índices) y **Synchronize football and standings**, o ejecuta manualmente esta última en `master`. No necesita secrets nuevos. Para desactivar el complemento, crea la **repository variable** `ESPN_MATCH_DETAILS` con valor `false`; eliminarla o dejarla vacía lo activa. Si faltan detalles, revisa el resumen `Detalles de partidos` del workflow: informa de lecturas, peticiones y documentos actualizados; una advertencia de ESPN no impide actualizar los puntos oficiales. Las pruebas usan datos simulados y el emulador aislado, sin escribir en producción.
