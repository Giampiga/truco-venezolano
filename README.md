# Truco — la mesa venezolana

Truco venezolano en línea: mesas 1v1 y 2v2, partidas entre panas, competitivo con Elo, perfiles y amigos, historial, chat global y de mesa, voz y cámara opcionales, y práctica local contra Truquito.

Esta rama prepara la migración a **Vercel + Supabase**. El despliegue anterior en Sites no se actualiza con estos cambios. La configuración de proyectos y proveedores está en [docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md).

## Desarrollo

Node 22.13 o superior:

```sh
npm ci
TRUCO_LOCAL_DATABASE=/tmp/truco-local-db TRUCO_LOCAL_TEST_AUTH=1 npm run dev -- --port 3013
```

PGlite ejecuta el esquema Postgres localmente. El acceso de prueba usa una cookie HttpOnly y solo funciona con el indicador explícito **fuera de producción**. Para probar la autenticación real, copia `.env.example` a `.env.local`, configura Supabase y omite ambos indicadores de prueba.

```sh
npm test
npm run typecheck
TRUCO_TEST_URL=http://localhost:3013 npm run test:integration
TRUCO_TEST_URL=http://localhost:3013 npm run test:ranked
TRUCO_TEST_URL=http://localhost:3013 npm run test:matchmaking
npm run build
```

## Cuentas y datos

- Google, Facebook, Apple y correo/contraseña mediante Supabase Auth; confirmación de correo y recuperación de contraseña.
- Los invitados pueden jugar entre panas. El servidor exige una cuenta confirmada para competir, guardar un perfil y agregar amigos.
- Nombre visible y usuario único editables, biografía, amigos, Elo actual/máximo por formato e historial de partidas terminadas con resultados y rivales.
- El historial y el Elo se calculan en el servidor. Las manos privadas nunca se entregan a otros jugadores.
- Las tablas Postgres tienen RLS habilitado sin acceso público directo; solo las rutas del servidor acceden a los datos.
- La práctica contra IA se guarda en este navegador, separada del historial de partidas en línea.

## Juego y servicios

`lib/truco-engine.ts` contiene el motor puro; `lib/room-model.ts` controla asientos y acciones. Las rutas API guardan revisiones con compare-and-swap. Ranking y matchmaking usan transacciones para evitar resultados duplicados. Las salas y el chat se actualizan mediante polling; una acción remota suele verse en 1,5 segundos. Las salas caducan tras 48 horas sin actividad; el historial permanece.

[Reglas venezolanas](docs/RULES.md) · [Competitivo](docs/COMPETITIVE.md) · [Activar voz y cámara con LiveKit](docs/VOICE_SETUP.md)

La voz/cámara necesita credenciales de LiveKit. La autenticación social necesita configurar cada proveedor en Supabase. Los ID de cuentas de Sites no se pueden convertir en cuentas nuevas por nombre: la importación de datos anteriores necesita una verificación de propiedad explícita.
