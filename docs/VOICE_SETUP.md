# Activar voz y cámaras de las mesas

1. Crea o abre un proyecto en [LiveKit Cloud](https://cloud.livekit.io/).
2. En los ajustes de LiveKit, obtén su URL `wss://…`, API key y API secret.
3. Añade estas variables al entorno de producción del proyecto en Vercel:
   - `LIVEKIT_URL`: URL del servidor LiveKit (debe usar `wss:`).
   - `LIVEKIT_API_KEY`: clave de API.
   - `LIVEKIT_API_SECRET`: secreto; guárdalo como **secret**.
4. Despliega una nueva versión para aplicar el entorno.
5. Los jugadores deben entrar con su cuenta o como invitados.
6. Abre la misma mesa desde dos cuentas/perfiles autorizados. Pulsa **Entrar a la voz** en ambos. Se conectarán para escuchar con el micrófono apagado.
7. Activa cada micrófono y verifica audio en ambas direcciones, silencio, dejar de escuchar, indicador de hablante y salida de la sala. Si aparece **Activar sonido del navegador**, púlsalo.

Para pruebas locales, copia `.env.example` a `.env.local`, introduce los valores y reinicia el servidor. Estos archivos están excluidos de Git. Nunca pongas credenciales en variables `NEXT_PUBLIC_*`, componentes, capturas ni mensajes de chat.

## Comportamiento de acceso

El token se emite exclusivamente a un miembro activo de una sala abierta con voz habilitada. El servidor deriva la sala, la identidad y el nombre; el cliente no los puede elegir. La firma expira a los cinco minutos para la conexión inicial, limita publicación al micrófono y, solo si la sala permite cámaras, a la cámara. Excluye compartir pantalla, datos y administración.

Cada membresía tiene una identidad de voz aleatoria. Reutilizar un asiento no reutiliza la identidad de voz. Salir de una mesa o cerrarla encola la desconexión del participante mediante la API de LiveKit; si el servicio está temporalmente caído, la cola se reintenta al consultar o actualizar la sala. Las sesiones existentes pueden permanecer hasta que esa revocación termine. LiveKit Cloud revoca el token al eliminar el participante. Un servidor autohospedado tiene semántica distinta: la caducidad limita reutilización, pero no equivale a revocación.

El botón **Salir de la voz** desconecta micrófono y cámara y conserva el asiento. El botón **Salir al salón** abandona la mesa y cierra el audio. No se graba ni transcribe la conversación.

Para video, activa **Permitir cámaras** al crear la sala. Cada participante entra con su cámara apagada y puede activarla independientemente del micrófono. Prueba permisos denegados, cámara encendida/apagada, previsualización local, video remoto y apagado de dispositivos al salir. Salas sin permiso de cámara reciben tokens que prohíben publicarla.

## Verificación realizada y pendiente

Se verificaron la firma, el alcance, la caducidad y los permisos del token; la API rechaza no miembros y salas sin configuración. No había credenciales de LiveKit disponibles durante el overhaul, por lo que el transporte real entre micrófonos queda pendiente de la prueba de dos participantes descrita arriba.

Referencias: [SDK de navegador](https://docs.livekit.io/reference/client-sdk-js/), [tokens y permisos](https://docs.livekit.io/frontends/reference/tokens-grants/).
