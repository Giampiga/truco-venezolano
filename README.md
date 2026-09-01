# Truco — la mesa venezolana en línea

MVP navegable y responsive de un juego social de Truco venezolano. Incluye
salón público, entrada privada por código, configuración de variantes, sala de
espera, mesa jugable, cantos confirmados por botones, voz opcional,
moderación, reanudación tras recarga y shell PWA.

## Ejecutar

    npm run dev
    npm test
    npm run build

## Qué es real en este MVP

- La navegación, los formularios y los estados de sala/mesa son interactivos.
- El motor puro en lib/truco-rules.ts resuelve piezas, jerarquía, Envido,
  Flor y la escalera venezolana de Truco; cuenta con pruebas deterministas.
- La reanudación guarda un snapshot local de demostración para validar el
  flujo de producto.
- El permiso de micrófono solo se solicita después de una confirmación
  explícita y la entrada conserva el micrófono apagado.

## Integraciones de producción deliberadamente separadas

La UI no finge que una simulación local es una partida multijugador. El
contrato en lib/protocol.ts define comandos versionados e idempotentes,
estado público y mano privada por asiento. Un servicio autoritativo debe
validar turnos, cantos y puntaje antes de emitir el siguiente snapshot.

La voz debe conectarse a **LiveKit Cloud** (audio-only SFU) mediante un token
de corta duración emitido por el servidor y ligado a tableId + seatId.
Nunca se deben mandar secretos de LiveKit al navegador, usar malla P2P, ni
convertir audio/transcripción en una jugada autoritativa. Si la voz falla, la
mesa y los botones siguen funcionando.

## Decisiones de producto

La configuración predeterminada se llama “Oriental clásico”, no “oficial”.
El Truco venezolano tiene variantes regionales legítimas; Flor, pardas y final
de juego se muestran como ajustes explícitos de la sala. Las fuentes y las
decisiones del MVP están en docs/RULES.md.
