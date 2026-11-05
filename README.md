# Trello Focus

Extensión personal de Chrome para registrar tiempo en Trello, creada con TypeScript, React, CSS, Vite y Manifest V3. Proyecto independiente, sin afiliación con Trello, Atlassian ni Pomello.

## Instalación

1. Descargar `trello-focus-v0.2.0.zip` desde Releases y descomprimirlo en una carpeta permanente.
2. Abrir `chrome://extensions`, activar **Modo desarrollador** y elegir **Cargar descomprimida**. Seleccionar la carpeta que contiene `manifest.json`.
3. Abrir el icono de Trello Focus y pulsar **Abrir mi panel** → **Configuración**.
4. Crear una aplicación propia en <https://trello.com/apps/admin>, obtener su API key, ingresarla y pulsar **Abrir autorización de Trello**. Autorizar lectura y escritura durante 30 días, copiar el token mostrado por Trello e ingresarlo en la extensión. El token de Pomello no funciona en esta integración.
5. Pulsar **Conectar cuenta** y abrir una tarjeta en Trello. Si ya estaba abierta al instalar, recargarla.

El usuario final no necesita Node.js ni `node_modules`. Para actualizar una instalación manual, reemplazar los archivos en la misma carpeta y pulsar **Recargar** en Chrome. No desinstalar: Chrome elimina el historial local al hacerlo.

## Funciones

- Panel flotante en las tarjetas de Trello: sumar horas/minutos e iniciar una sesión.
- El panel flotante muestra la cuenta regresiva, pausa, continuación, finalización y errores exclusivos de la tarjeta abierta. Iniciar una sesión publica su estado en el comentario; solo se suma el tiempo al terminar.
- Permite descartar sincronizaciones fallidas conservando el historial local. No vuelve a enviarlas automáticamente; una nueva carga manual o sesión en esa tarjeta inicia una nueva búsqueda de comentario.
- Configuración con estado de conexión visible y marcadores ocultos de credenciales guardadas; sus valores no se devuelven a la interfaz.
- Popup con temporizador y acceso al panel completo.
- Panel con tarjetas asignadas, tableros, listas, búsqueda y favoritas. Seleccionar un tablero permite cargar sus tarjetas no asignadas.
- Filtro **Activas / Archivadas / Todas**, con **Activas** como valor inicial. Se recuerda la última opción elegida en este perfil de Chrome. Incluye tarjetas dentro de listas o tableros archivados. El filtro se combina con búsqueda, tablero, lista, asignación y favoritas; no desarchiva tarjetas ni importa tiempo previo.
- Orden por tiempo acumulado (mayor/menor) o fecha del último trabajo registrado (reciente/antiguo), con elección persistente. Los órdenes de fecha dejan al final las tarjetas sin registros. Se utiliza el historial local de Trello Focus, no la actividad general de Trello ni el tiempo pendiente de una sesión activa.
- Una sola sesión activa, pausa, continuación, finalización anticipada y descarte.
- Duración configurable entre 1 y 180 minutos y notificación de finalización.
- Un comentario propio por tarjeta y cuenta. Las cargas siguientes editan ese comentario; Pomello permanece independiente.
- Historial local y resumen diario/semanal, exportable a JSON sin credenciales.

## Persistencia y límites de la primera versión

El perfil de Chrome es la fuente del historial. Usar una sola computadora/perfil para registrar tiempo. No hay sincronización entre equipos ni importación de respaldos en esta versión. Se conserva el usuario asociado para evitar mezclar registros al conectar otra cuenta.

Las cargas sobre tarjetas ya conocidas se guardan localmente antes de sincronizar. Sin conexión, se muestran pendientes y se reintentan desde el panel. Resolver una tarjeta nueva requiere conexión. Una creación de comentario con resultado incierto se busca antes de reintentar; si no puede confirmarse, queda bloqueada para evitar duplicados. No se sobrescriben comentarios editados manualmente ni se reemplazan silenciosamente comentarios eliminados. La recuperación de esos conflictos es manual; conservar el perfil y exportar los datos.

El comentario muestra el total completo y los últimos 60 registros. El historial completo permanece local. La búsqueda de un comentario incierto inspecciona hasta 1000 comentarios recientes: ante dudas se detiene. Al reinstalar o usar otro perfil, detectar un registro existente bloquea su sobrescritura si no coincide con el historial local.

Si el navegador se cierra o una alarma llega más de 90 segundos tarde, una sesión vencida requiere confirmación. Una suspensión corta puede contabilizarse como tiempo de sesión. La sesión nunca suma más que su duración prevista. Las notificaciones dependen de Chrome y de los permisos del sistema operativo.

## Privacidad

La extensión se comunica únicamente con la API de Trello para sus funciones. No tiene servidor propio ni telemetría. Credenciales e historial se almacenan en `chrome.storage.local`, con acceso restringido a contextos confiables de la extensión. No se usa sincronización de Chrome para credenciales. Este almacenamiento no es una bóveda cifrada independiente: proteger el perfil de Windows/Chrome.

El script de la tarjeta recibe solamente la configuración mínima y envía acciones al proceso de fondo. No recibe el token. Los permisos son `storage`, `alarms`, `notifications`, acceso a la API y al dominio `trello.com` para comprobar la URL actual de la pestaña, y un script en `trello.com`. **Desconectar autorización** elimina la credencial local; para revocar el acceso en Trello usar la administración de aplicaciones de la cuenta.

## Desarrollo

Requiere Node.js 24 o superior.

```powershell
npm ci
npm run build
npm test
npm run dev
```

`npm run dev` muestra el diseño sin credenciales ni acciones contra Trello. Para probar la integración real cargar `dist` como extensión. La compilación produce el panel React, un service worker y un script de contenido independientes. Todas las dependencias de ejecución quedan empaquetadas; no se carga código remoto.

## Verificaciones

Las pruebas automatizadas cubren duración, pausa, validación, deduplicación, actualización del mismo comentario, reintentos de red, creación incierta, conflictos de edición, sesión única y control de mensajes desde Trello. Usan la lógica real y el worker compilado con API/Chrome simulados; no sustituyen una prueba con cuenta real autorizada.

El flujo de GitHub Actions compila, ejecuta pruebas y adjunta la carpeta instalable en cada push. El panel es una página interna de la extensión, por lo que no requiere despliegue en Cloudflare.

## Historial y navegación

Cada registro permite editar horas, minutos, segundos y nota, o eliminarlo con confirmación. Se conservan fecha y tipo al editar; los totales y el comentario propio se actualizan al sincronizar. Si la sincronización fue descartada, los cambios permanecen locales.

El título de una tarjeta abre su detalle dentro del panel, con historial y enlace a Trello. Cada sección tiene su URL (`?view=cards`, `?view=history`, `?view=settings` y `?view=card&card=ID`), compatible con recarga y Atrás/Adelante.

En el panel flotante de Trello, **Ver historial de esta tarjeta** abre directamente su detalle en Trello Focus. El botón general del panel sigue disponible.

El formulario flotante usa un documento aislado para evitar activar atajos de Trello al escribir. Los filtros de búsqueda, tablero, lista, asignación y favoritas se recuerdan en el mismo perfil, además del estado y orden existentes.

## Comentarios, notas y edición de tarjetas

- **Comentario en Trello:** publicación normal e independiente del contador de horas. Permite editar comentarios propios desde un modal.
- **Nota de Trello Focus:** texto independiente, sin duración, dentro del mismo comentario que registra el total. Se puede editar sin sumar minutos.
- **Mensaje de sesión o carga manual:** nota opcional junto al registro de tiempo. La nota de sesión se conserva al terminar y puede cambiarse desde el temporizador.

El editor permite escribir texto normal, enlaces, negritas y bloques de código opcionales con selector de lenguaje. Envía Markdown a Trello; su representación exacta depende del editor de Trello. La vista previa local muestra enlaces, imágenes y código sin interpretar HTML.

Las fotos y documentos se adjuntan inmediatamente a la tarjeta y se insertan en el borrador del comentario. Cancelar el borrador no elimina un archivo ya adjuntado. Límite de esta versión: 10 MB por archivo, sujeto a permisos y límites de Trello. Las imágenes privadas pueden requerir iniciar sesión en Trello para visualizarse.

Desde el detalle se pueden editar título, descripción, lista y miembros existentes del tablero; ver y subir adjuntos; usar una imagen como portada o elegir color; agregar Taco cool o stickers personales ya disponibles en la cuenta, y quitar stickers. Trello ofrece rosa y violeta, pero no un valor de portada llamado magenta. Color e imagen son alternativas de portada. No se crean miembros ni se invita a personas al tablero.

Los envíos de comentarios, adjuntos y stickers no se reintentan automáticamente. Si una respuesta se pierde, se conserva un comprobante local para impedir repetir esa misma operación; revisar la tarjeta antes de iniciar otra publicación. El historial de tiempo conserva su sincronización independiente.

Referencia: [API oficial de tarjetas](https://developer.atlassian.com/cloud/trello/rest/api-group-cards/) y [formato de texto de Trello](https://support.atlassian.com/trello/docs/how-to-format-your-text-in-trello/).

## Filtros y creación de tarjetas

Los filtros de persona, etiqueta, vencimiento y finalización se combinan con tablero, lista, búsqueda, estado y orden. Se recuerdan al recargar en el mismo perfil. Elegir una persona desactiva «Asignadas a mí». Actualizar todos los tableros carga también tarjetas de otros miembros; puede tardar más en cuentas con muchos tableros.

«Crear tarjeta» permite elegir tablero y lista activa, título, descripción Markdown, miembros, etiquetas y vencimiento opcional. Al crearla abre su detalle. Valida que la lista y las selecciones pertenezcan al tablero y protege el mismo envío contra duplicados.

## Estadísticas

La sección Estadísticas muestra cuatro gráficos: tiempo diario de la semana, cinco tarjetas con más dedicación, distribución por tablero y sesiones frente a cargas manuales. Incluye tiempo total, promedio diario, días activos, sesiones guardadas y comparación con la semana anterior completa. Permite recorrer semanas y abrir el historial desde el ranking.

Se calcula a partir del historial local, sin servicios externos ni dependencias nuevas. Incluye tarjetas archivadas y registros de tarjetas que ya no están cargadas. Usa la fecha local de cada registro; las sesiones en curso y las fechas futuras no se contabilizan. El promedio actual incluye los días transcurridos, incluido hoy; en semanas anteriores divide por siete. Editar o eliminar registros actualiza las cifras.

## Portadas y prioridad visual

En Mis tarjetas, «Mostrar portada» permite ver una mini portada de color o imagen arriba, a todo el ancho. Está desactivado inicialmente y recuerda la preferencia. «Prioridad: rojo → rosa → verde» ordena primero esos colores; los demás colores, imágenes y tarjetas sin portada quedan después, conservando su orden relativo. El orden se guarda y funciona aunque las portadas estén ocultas. Usá Actualizar tarjetas para cargar los cambios de portada realizados en Trello.
