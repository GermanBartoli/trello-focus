# Guía de trello-focus

La web y la extensión comparten el modelo de tarjetas y sesiones. Revisá `src/background.ts` para la extensión, `src/webRuntime.ts` para la web y `src/siteBridge.ts` para la comunicación entre ambas.

Corré `pnpm test`, `pnpm run build` y `pnpm run build:web`. Para cambios en la comunicación, probá la web con la extensión cargada y también sin ella.

Consultá los pasos de publicación en [el flujo de GitHub Actions](.github/workflows/verificar.yml).
