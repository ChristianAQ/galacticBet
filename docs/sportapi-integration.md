# SportAPI: preparación e integración pendiente

Estado: **no está conectada ni activa**. El entorno devuelve un 403 de su proxy al intentar abrir https://sportapi.ai/. Falta verificar documentación, host de API, autenticación, cobertura de PD/CL/PL, esquema de alineaciones y estadísticas, límites por minuto, reinicio de cuota y condiciones de uso. Las 2.000 peticiones/día proceden de la información del usuario; no se han confirmado en el plan del proveedor. No se han inventado URLs, cabeceras ni respuestas.

Se ha preparado `scripts/sportApiBudget.ts`, todavía sin invocación desde los workflows:

- Reserva transaccional en `providerBudgets/sportapi`, privada por las reglas de denegación existentes.
- Tope interno conservador de 1.800 intentos en una ventana móvil de 24 horas y 40 por ejecución. Una reserva por trabajo, sin lecturas/escrituras por cada petición HTTP.
- Los intentos fallidos y reintentos consumen cuota. La capacidad reservada no utilizada tampoco se devuelve: un cierre inesperado no permite gastar dos veces. El identificador del trabajo debe incluir workflow, run ID e intento de GitHub.
- La ventana móvil evita depender de una zona horaria aún desconocida. El contador solo puede controlar nuestras ejecuciones; no conoce peticiones de otras aplicaciones con la misma cuenta. Unidades de facturación y costes por endpoint deben verificarse antes de utilizarlo.
- La función de bloqueo debe detener la ejecución ante 401/403/429, sin bucles de reintento; el adaptador HTTP implementará esa clasificación tras verificar el contrato.

## Orden de integración una vez disponible la documentación

1. Validar el contrato real, crear el cliente con host fijo y guardar su clave solo como secret del backend (nunca `VITE_`). No enviar claves a destinos inferidos o no verificados.
2. Asociar partidos por competición, ambos equipos, localía y hora. Rechazar coincidencias ambiguas. Conservar los identificadores de cada proveedor por separado.
3. Normalizar alineaciones confirmadas, suplentes y estadísticas publicadas. Distinguir el periodo estadístico: total, primera parte, segunda parte y prórroga. No inventar ceros ni tratar una plantilla como once confirmado.
4. Completar la ficha existente identificando la fuente por sección. Los resultados y la puntuación de Football-Data permanecen independientes de estos detalles complementarios.
5. Priorizar partidos finalizados recientemente con estadísticas incompletas y alineaciones cerca del inicio. Mantener datos anteriores ante errores; no consultar desde el navegador.
6. Después de medir el consumo, valorar un workflow ligero más frecuente para encuentros en juego. GitHub Actions puede retrasar o saltarse ejecuciones; no garantiza tiempo real. El cron actual de sincronización sigue siendo cada dos horas y no se ha acelerado.
7. Probar con respuestas reales y después desplegar reglas/índices que correspondan. El documento de presupuesto necesita exclusión de índices del array de reservas al activar el proceso; no necesita permisos de cliente.

La configuración de red se ha guardado como borrador con `sportapi.ai` y `www.sportapi.ai`, conservando los dominios existentes. Guardar el borrador no aplica ni publica la configuración: es necesario revisarlo, guardarlo y publicar el entorno desde sus ajustes para poder consultar el sitio.
