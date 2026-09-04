# Truco — la mesa venezolana

Juego social de Truco venezolano con salas reales para 1v1 y 2v2, chat compartido, voz opcional y práctica individual contra IA. Interfaz responsive con salón, invitaciones, asientos, reglas visibles y mesa de juego.

## Desarrollo

Requiere Node 22.13 o superior.

```sh
npm ci
npm run db:local
npm run dev -- --port 3012
```

El entorno local usa una cookie HttpOnly por navegador para permitir varias identidades de prueba. En producción, las salas requieren la identidad autenticada que entrega Sites; no existe acceso de invitado a la API. Para probar varios jugadores localmente, usa perfiles de navegador independientes.

```sh
npm test                 # motor, IA, salas, autorización y tokens de voz
npm run test:integration # servidor local en localhost:3012
npm run typecheck
npm run build
```

`TRUCO_TEST_URL` permite cambiar el origen local de las pruebas. La suite HTTP rechaza orígenes externos y crea/cierra mesas de prueba. Las migraciones se generan con `npm run db:generate`; Sites aplica las de `drizzle/` durante la publicación.

## Funcionalidad

- Mesas públicas o privadas, códigos únicos, enlaces de invitación, búsqueda y filtros 1v1/2v2.
- Asientos reales, anfitrión transferible, todos listos antes de repartir y detección de desconexiones.
- Motor ejecutado en el servidor: solo cada jugador recibe sus cartas. El cliente no decide turnos, reparto ni puntajes.
- Estado persistido en D1 con actualización atómica por revisión, verificación de versión de juego e idempotencia.
- Chat de mesa compartido, mensajes acotados y límite de frecuencia.
- Escalera de Truco, Envite/Falta, Flor, pardas y series con variantes realmente soportadas.
- IA Aprendiz/Criollo/Maestro con guía, pausa, deshacer/rehacer, nuevo reparto y reanudación local.
- Instalación PWA. El service worker nunca almacena respuestas de la API, tokens o páginas autenticadas.

## Voz

La integración con LiveKit está implementada: entrada para escuchar sin permiso de micrófono, activación explícita, silenciar, dejar de escuchar, participantes, hablantes activos, selector de micrófono, recuperación de autoplay y reconexión. Al cambiar de sala o salir se cierran las pistas. El audio no determina jugadas.

**La voz requiere configurar un proyecto LiveKit; no viene con credenciales ni un servidor de medios incorporado.** Consulta [docs/VOICE_SETUP.md](docs/VOICE_SETUP.md). Sin configuración, el chat y el juego siguen funcionando y la interfaz informa que la voz no está disponible.

## Arquitectura

- `lib/truco-engine.ts` y `lib/truco-rules.ts`: motor puro y reglas venezolanas.
- `lib/room-model.ts`: reglas de pertenencia, lista de jugadores, chat y transiciones de sala.
- `lib/server/rooms.ts`: persistencia con compare-and-swap; `app/api/rooms/`: API autenticada.
- `lib/command-validation.ts`: validación de comandos en tiempo de ejecución.
- `hooks/use-room.ts`: transporte HTTP (1,5 s visible; 5 s en segundo plano), heartbeat, reconexión y rechazo de respuestas antiguas.
- `components/online-table.tsx`: mesa de red basada únicamente en proyecciones públicas/privadas.
- `components/game-table.tsx`: práctica local con IA; su snapshot nunca se usa para partidas de red.
- `lib/voice-token.ts`: tokens HS256 breves, ligados a una identidad de membresía y una sola sala, con permiso exclusivo de micrófono.
- `lib/server/voice.ts`: revocaciones de voz persistidas y reintentadas después de salir o cerrar una mesa.

## Límites conocidos

Las salas usan polling HTTP, no WebSockets; una acción remota suele aparecer dentro de 1,5 segundos. Las mesas dejan de resolverse tras 48 horas sin actividad. Los abandonos durante la partida conservan el asiento y pausan las jugadas hasta que vuelva esa persona; el anfitrión puede cerrar la mesa. No hay reemplazo de jugadores durante una partida, clasificación competitiva ni moderación humana.

El sitio conserva su acceso privado. Compartir el código de mesa no otorga acceso al sitio: sus jugadores también necesitan estar autorizados en Sites. Cambiar la audiencia se hace desde la configuración de acceso del sitio.

Las variantes que antes eran solo controles de demostración (carta del compañero visible, Matar tapado y Privando integrado) ya no se ofrecen como ajustes jugables. Las variantes regionales documentadas están en [docs/RULES.md](docs/RULES.md).

La revisión de dependencias actualizó React/RSC a 19.2.8, Vite a 8.2.2 y Undici a 7.29.0. El parser `image-size` heredado de Vinext sigue teniendo avisos; en esta app procesa archivos locales de metadatos durante la compilación, sin endpoint de carga de imágenes. Actualizar Vinext beta.9 no resuelve ese parser: lo incorpora al bundle. No se presenta la auditoría de dependencias como libre de avisos.
