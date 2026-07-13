# Circular Saw TikTok Widget

Widget en React + TypeScript para visualizar una arena de sierras/circulos que responden a regalos, likes y comentarios de TikTok Live mediante un bridge local.

## Desarrollo

```bash
npm install
npm run dev
```

## Configuracion del bridge TikTok

El proyecto usa `tiktok-live-events` en el bridge local para conectarse con solo `@usuario`, sin API key y sin `sessionid`.

1. Crea un archivo `.env` en la raiz del proyecto.
2. Copia el contenido de `.env.example`.
3. Si quieres, cambia `TIKTOK_BRIDGE_PORT`.

Variables soportadas:

- `TIKTOK_BRIDGE_PORT`: puerto local del bridge. Por defecto `3189`.

Con esta integracion el flujo esperado vuelve a ser: escribir `@usuario`, pulsar conectar y empezar a recibir eventos del live.

## Live remoto con celular y PC

Si el frontend esta en Vercel y quieres abrir TikTok en el celular mientras la batalla se ve en la PC, el frontend por si solo no puede conectarse a TikTok Live. Necesitas dos piezas:

1. Frontend en Vercel con Supabase Realtime configurado.
2. Bridge de TikTok desplegado aparte como proceso persistente.

### Variables del frontend en Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Variables del bridge remoto

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_CHANNEL_ID=default-room`
- `TIKTOK_BRIDGE_PORT=3189`

El bridge remoto se suscribe al canal de Supabase y recibe los comandos `connect` y `disconnect` enviados por el panel. Luego publica regalos, likes y comentarios al mismo realtime para que la batalla y el panel los vean aunque esten en redes distintas.

### Desplegar bridge en Render

Este repo incluye un archivo `render.yaml` con una configuracion base. En Render:

1. Crea un nuevo `Blueprint` o `Web Service` desde este repo.
2. Configura las variables del bridge remoto.
3. Despliega el servicio.

Cuando el bridge este activo, el flujo sera:

1. Abres el panel en el celular.
2. Escribes la misma clave de sala que en la PC.
3. Pulsas `Conectar live` con tu `@usuario` de TikTok.
4. El bridge remoto se conecta al live real.
5. La batalla en la PC recibe los eventos por Supabase Realtime.
