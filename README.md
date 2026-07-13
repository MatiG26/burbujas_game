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
