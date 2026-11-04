# Trello Focus

Extensión personal de Chrome para registrar tiempo en Trello, creada con TypeScript, React, CSS, Vite y Manifest V3. Proyecto independiente, sin afiliación con Trello, Atlassian ni Pomello.

## Instalación

1. Descargar `trello-focus-v0.1.0.zip` desde Releases y descomprimirlo en una carpeta permanente.
2. Abrir `chrome://extensions`, activar **Modo desarrollador** y elegir **Cargar descomprimida**. Seleccionar la carpeta que contiene `manifest.json`.
3. Abrir el icono de Trello Focus y pulsar **Abrir mi panel** → **Configuración**.
4. Crear una aplicación propia en <https://trello.com/apps/admin>, obtener su API key, ingresarla y pulsar **Abrir autorización de Trello**. Autorizar lectura y escritura durante 30 días, copiar el token mostrado por Trello e ingresarlo en la extensión. El token de Pomello no funciona en esta integración.
5. Pulsar **Conectar cuenta** y abrir una tarjeta en Trello. Si ya estaba abierta al instalar, recargarla.

El usuario final no necesita Node.js ni `node_modules`. Para actualizar una instalación manual, reemplazar los archivos en la misma carpeta y pulsar **Recargar** en Chrome. No desinstalar: Chrome elimina el historial local al hacerlo.

## Funciones

- Panel flotante en las tarjetas de Trello: sumar horas/minutos e iniciar una sesión.
- Popup con temporizador y acceso al panel completo.
- Panel con tarjetas asignadas, tableros, listas, búsqueda y favoritas. Seleccionar un tablero permite cargar sus tarjetas no asignadas.
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

El script de la tarjeta recibe solamente la configuración mínima y envía acciones al proceso de fondo. No recibe el token. Los permisos son `storage`, `alarms`, `notifications`, acceso a la API de Trello y un script en `trello.com`. **Desconectar autorización** elimina la credencial local; para revocar el acceso en Trello usar la administración de aplicaciones de la cuenta.

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
