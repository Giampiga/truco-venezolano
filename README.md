# Truco — la mesa venezolana en línea

MVP navegable y responsive de un juego social de Truco venezolano. Incluye
salón público, entrada privada por código, configuración de variantes, sala de
espera, mesa jugable, cantos confirmados por botones, voz opcional,
moderación, reanudación tras recarga, formatos 1v1/2v2, práctica contra IA y
shell PWA.

## Ejecutar

    npm run dev
    npm test
    npm run build

## Qué es real en este MVP

- La navegación, los formularios y los estados de sala/mesa son interactivos.
- Los motores puros en `lib/truco-rules.ts` y `lib/truco-engine.ts` reparten,
  rotan Mano/Pie, resuelven piezas, vueltas, pardas, Envite, Flor, Truco,
  chicos y series; cuentan con pruebas deterministas.
- La sala de práctica ofrece Aprendiz, Criollo y Maestro, modo guiado,
  pausa, deshacer/rehacer, reinicio de base, nuevo reparto y reanudación.
- La IA recibe solo su mano, la Vira, cartas públicas, conteos y acciones
  legales. No recibe la mano rival ni cartas sin repartir y usa la misma API
  de transición que los demás asientos.
- La reanudación guarda el snapshot versionado completo de la mesa: formato,
  reglas firmadas, Vira, reparto, turno, cantos, marcador y serie.
- El permiso de micrófono solo se solicita después de una confirmación
  explícita y la entrada conserva el micrófono apagado.

## Integraciones de producción deliberadamente separadas

La demo multijugador automatiza los demás asientos en el navegador. El motor
sí valida turnos, acciones legales e idempotencia, y expone proyecciones
pública/privada; una publicación con red real todavía debe ejecutar ese mismo
reductor en un servicio autoritativo antes de emitir el siguiente snapshot.

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
