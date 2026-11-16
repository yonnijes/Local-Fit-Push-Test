# Local Fit Push Test

PWA de pruebas para validar notificaciones **Web Push** enviadas desde un backend **NestJS** propio, sin Firebase ni OneSignal. El objetivo es comprobar el flujo completo en un iPhone: instalación de la PWA, permiso, suscripción Push, envío manual y envío periódico cada 30 segundos.

> **Entorno de prueba.** Este proyecto no forma parte de Local Fit. No tiene autenticación de usuarios, base de datos ni lógica de negocio. El estado vive en memoria y se pierde al reiniciar el backend.

---

## Stack

| Componente | Tecnología |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite 7 |
| PWA | `vite-plugin-pwa` (estrategia `injectManifest`) + Service Worker propio |
| Backend | NestJS 11 |
| Push | Web Push API + `web-push` + VAPID |
| Persistencia | Memoria del proceso |
| Gestor de paquetes | pnpm |
| HTTPS | Cloudflare Tunnel |

---

## Estructura

```text
local-fit-push-test/
├── apps/
│   ├── web/                  # React + Vite + PWA
│   │   ├── public/icons/     # iconos 192/512/maskable/apple-touch
│   │   ├── src/
│   │   │   ├── components/   # UI
│   │   │   ├── hooks/        # usePushTest
│   │   │   ├── services/     # api.ts + push.service.ts
│   │   │   ├── sw.ts         # Service Worker (push + notificationclick)
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   └── api/                  # NestJS
│       └── src/
│           ├── push/
│           │   ├── dto/
│           │   ├── guards/
│           │   ├── push.controller.ts
│           │   ├── push.service.ts
│           │   ├── push-timer.service.ts
│           │   └── push.module.ts
│           ├── app.module.ts
│           └── main.ts
├── scripts/generate-icons.mjs
├── .env.example
└── README.md
```

NestJS sirve también el build del frontend, de modo que la PWA y la API comparten un único origen HTTPS.

---

## Requisitos

- Node.js **20.19 o superior** (probado con Node 24).
- pnpm 12 (el repositorio fija `packageManager: pnpm@12.21.0`).
- Para probar en iPhone: iOS/iPadOS **16.4+**, Safari y HTTPS (Cloudflare Tunnel).
- `cloudflared` instalado para exponer el backend.

---

## Puesta en marcha

```bash
# 1. Dependencias
pnpm install

# 2. Claves VAPID (una sola vez)
pnpm vapid:keys

# 3. Configuración
cp .env.example .env
#    Pega VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env
#    Define PUSH_TEST_ADMIN_TOKEN con un valor largo y aleatorio

# 4. Build del frontend y del backend
pnpm build

# 5. Arranque (sirve la PWA en http://localhost:3000)
pnpm start
```

Los iconos ya están generados en `apps/web/public/icons`. Si quieres regenerarlos:

```bash
pnpm icons
```

> Si usas `nvm` y el shell no encuentra `node`/`pnpm`, ejecuta antes `nvm use 24`.

### Desarrollo

```bash
pnpm dev
```

- Vite en `http://localhost:5173` con proxy `/api` hacia `http://localhost:3000`.
- NestJS en modo watch.
- El Service Worker y Push **solo deben probarse con el build de producción** (`pnpm build && pnpm start`), porque en iOS requieren el origen HTTPS definitivo y el SW compilado.

---

## Variables de entorno

Archivo `.env` en la raíz (ignorado por git):

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `PORT` | No | Puerto del backend. Por defecto `3000`. |
| `PUBLIC_APP_URL` | Recomendada | Origen HTTPS de la PWA. Si se define, los POST de administración validan el header `Origin`. |
| `VAPID_SUBJECT` | Sí | Contacto VAPID, por ejemplo `mailto:dev@example.com`. |
| `VAPID_PUBLIC_KEY` | Sí | Clave pública VAPID. Puede exponerse al frontend. |
| `VAPID_PRIVATE_KEY` | Sí | Clave privada VAPID. **Solo backend**. |
| `PUSH_TEST_ADMIN_TOKEN` | No | Token de administración. Si está vacío, el backend genera uno aleatorio al arrancar y lo imprime una vez. |
| `WEB_DIST_PATH` | No | Ruta alternativa al build del frontend. |

Reglas:

- La clave privada VAPID nunca sale del backend ni se registra en logs.
- Los datos de suscripción (`endpoint`, `p256dh`, `auth`) no se registran en logs.
- Las claves VAPID deben mantenerse estables: si se regeneran, todas las suscripciones dejan de ser válidas.
- El token de administración nunca se incluye en el bundle de React. La PWA lo pide al usuario y lo guarda en `localStorage` de ese dispositivo.

Generar claves nuevas:

```bash
pnpm vapid:keys
```

---

## Cloudflare Tunnel

### Opción rápida (URL aleatoria)

```bash
cloudflared tunnel --url http://localhost:3000
```

Abre en Safari la URL `https://...trycloudflare.com` que imprime el comando.

> **Importante:** los quick tunnels cambian de hostname en cada arranque. El origen forma parte de la identidad de la PWA y de la suscripción push, así que si cambia la URL tendrás que abrir la nueva, volver a añadirla a la pantalla de inicio y suscribirte otra vez. Para pruebas repetidas, usa un túnel con dominio estable.

### Opción recomendada (dominio estable)

```bash
cloudflared tunnel login
cloudflared tunnel create push-test
cloudflared tunnel route dns push-test push-test.tudominio.com
cloudflared tunnel run --url http://localhost:3000 push-test
```

Configura `PUBLIC_APP_URL=https://push-test.tudominio.com` y reinicia el backend.

Cloudflare Tunnel solo aporta conectividad HTTPS: no interviene en el envío de notificaciones. Apple sigue participando en la entrega a través de su infraestructura push.

---

## Uso en iPhone

1. Mantén el Mac encendido con `pnpm start` y `cloudflared` activos.
2. Abre la URL HTTPS en **Safari** (no dentro de otra app).
3. Toca **Compartir → Añadir a pantalla de inicio**.
4. Abre **Local Fit Push Test** desde el icono nuevo (modo standalone).
5. Copia el token que el backend imprime en consola (`PUSH_TEST_ADMIN_TOKEN` si lo definiste, o el token generado).
6. En la PWA abre **Avanzado · Token de administración** y pégalo. Se guarda solo en el teléfono.
7. Pulsa **Activar notificaciones** y acepta el permiso del sistema.
8. Pulsa **Enviar prueba ahora**.
9. Pulsa **Iniciar prueba** para enviar cada 30 segundos.
10. Comprueba con la app en primer plano, en segundo plano y cerrada.
11. Pulsa **Detener prueba** para cortar el ciclo.

> El permiso solo se puede solicitar desde la PWA instalada. Si lo rechazas, iOS no vuelve a mostrar el diálogo: ve a **Ajustes → Notificaciones → Local Fit Push Test**.

---

## API

Prefijo: `/api/push`.

| Método | Ruta | Token | Descripción |
| --- | --- | --- | --- |
| `GET` | `/status` | No | Estado actual del servicio. |
| `GET` | `/config` | No | Clave pública VAPID y parámetros de la UI. |
| `POST` | `/subscribe` | Sí | Registra/actualiza la suscripción (una activa). |
| `POST` | `/send-test` | Sí | Envía una notificación inmediata. |
| `POST` | `/start` | Sí | Inicia el ciclo periódico (primer envío inmediato). |
| `POST` | `/stop` | Sí | Detiene el ciclo y conserva la suscripción. |

Los POST se protegen con el header `x-push-admin-token`. Las peticiones directas desde `127.0.0.1`/`::1` (por ejemplo `curl` local) no necesitan token; las que llegan por el túnel sí.

Ejemplos:

```bash
curl http://localhost:3000/api/push/status
curl http://localhost:3000/api/push/config

curl -X POST http://localhost:3000/api/push/subscribe \
  -H 'Content-Type: application/json' \
  --data-binary @subscription.json

curl -X POST http://localhost:3000/api/push/send-test \
  -H 'x-push-admin-token: TU_TOKEN'

curl -X POST http://localhost:3000/api/push/start \
  -H 'Content-Type: application/json' \
  -H 'x-push-admin-token: TU_TOKEN' \
  -d '{"intervalSeconds":30}'

curl -X POST http://localhost:3000/api/push/stop \
  -H 'x-push-admin-token: TU_TOKEN'
```

Respuesta de `/status`:

```json
{
  "subscriptionRegistered": true,
  "timerRunning": false,
  "intervalSeconds": 30,
  "sentCount": 0,
  "sequence": 0,
  "lastAttemptAt": null,
  "lastError": null
}
```

Notas:

- `sentCount` cuenta notificaciones **aceptadas por el servicio push**, no necesariamente mostradas por iOS.
- `sequence` se incrementa en cada intento y se usa como identificador único de la notificación.
- El intervalo aceptado está entre **10 y 300 segundos** (30 por defecto). Es una protección del MVP; no está pensado para uso en producción.
- El temporizador es un ciclo asíncrono que espera al envío anterior: nunca se solapan peticiones ni se crean timers duplicados.
- Si el servicio push responde `404` o `410`, la suscripción se invalida y el temporizador se detiene.
- Un `401`/`403` de VAPID, un error de red o un `5xx` se registran en `lastError` sin invalidar la suscripción.

---

## Seguridad

- HTTPS obligatorio en el iPhone; `localhost` se acepta solo para pruebas locales.
- La clave privada VAPID vive únicamente en `.env` (ignorado por git).
- El token de administración no está en el bundle: se guarda en `localStorage` del dispositivo.
- Si `PUSH_TEST_ADMIN_TOKEN` no está definido, se genera uno aleatorio al arrancar para que el túnel no quede abierto por olvido.
- `subscribe`, `send-test`, `start` y `stop` exigen token fuera de loopback.
- Si defines `PUBLIC_APP_URL`, se valida el header `Origin` de los POST (las peticiones sin `Origin`, como `curl`, pasan con token).
- Hay un límite de 3 segundos entre envíos manuales.
- Los logs no incluyen endpoints de suscripción, claves ni payloads cifrados.

---

## Manejo de errores

| Escenario | Comportamiento |
| --- | --- |
| Push API no soportada | La UI muestra incompatibilidad y desactiva el botón. |
| PWA no instalada | Se muestran instrucciones de instalación y no se permite activar. |
| Permiso denegado | Se muestran instrucciones de Ajustes y no se permite activar. |
| Service Worker fallido | Estado en rojo, mensaje y reintento al recargar. |
| Suscripción push lenta o colgada | Tras 45 s se muestra un error y se libera el botón. |
| Sin suscripción | `409` al iniciar/enviar y aviso en la UI. |
| Backend desconectado | La UI muestra «Desconectado» y bloquea los controles. |
| VAPID mal configurado | El backend arranca igualmente y `/config` informa del error. |
| `404`/`410` del push service | Se invalida la suscripción y se detiene el temporizador. |
| Error temporal de red/5xx | Se registra `lastError` y se reintenta en el siguiente ciclo. |
| Timer duplicado | `start` es idempotente: mantiene un único ciclo. |
| Backend reiniciado | Estado vacío y detenido; al abrir la PWA se re-sincroniza la suscripción si hay token. |

---

## Pruebas realizadas

- `pnpm typecheck` sin errores en web y API.
- `pnpm build` genera `dist/index.html`, `manifest.webmanifest` y `sw.js`.
- Service Worker compilado con handlers `push`, `notificationclick`, `install`, `activate` y `fetch`.
- PWA servida desde NestJS con fallback SPA y cabeceras `no-store` para `index.html`/`sw.js`.
- `/status`, `/config`, validación de DTOs, guard por token y bypass de loopback verificados con `curl`.
- Timer verificado: envío inmediato, repetición con intervalo, `start` idempotente y `stop` sin envíos posteriores.
- Suscripción `410` verificada: invalida la suscripción y detiene el timer.
- Render de la UI verificado en Chromium con viewport de iPhone (390 px) sin overflow ni errores de consola.
- Flujo real de Push API verificado en Chrome (FCM): la PWA crea la suscripción, el backend la registra, y las notificaciones llegan al Service Worker con `body: "Notificación de prueba #N"`, `tag: push-test-N` y `data.sequence` correctos.
- Verificado que «Enviar prueba ahora» produce una notificación nueva y que «Iniciar prueba»/«Detener prueba» alternan `timerRunning` sin duplicar envíos.
- La re-sincronización automática no duplica el `POST /subscribe` al activar manualmente.

La entrega real en el iPhone depende de APNs y de las políticas de iOS; debe validarse con el dispositivo siguiendo el checklist del spec.

---

## Limitaciones conocidas

1. El temporizador vive en el backend, no en el teléfono.
2. El intervalo de 30 s es el intento de envío, no una garantía de visualización.
3. iOS puede retrasar, limitar o agrupar notificaciones (Modo Concentración, Bajo Consumo, etc.).
4. APNs participa en la entrega y no se controla desde este proyecto.
5. Si el Mac se apaga o el túnel cae, se interrumpen los envíos.
6. Al reiniciar NestJS se pierde la suscripción en memoria.
7. Reinstalar la PWA o cambiar de origen puede requerir una nueva suscripción.
8. El envío periódico debe usarse solo en pruebas controladas.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `Token de administración requerido` | Falta el token o no coincide | Cópialo de la consola del backend y pégalo en **Avanzado**. |
| `Origen no permitido` | `PUBLIC_APP_URL` no coincide con la URL actual | Actualiza `PUBLIC_APP_URL` o déjalo vacío en pruebas. |
| `No hay ninguna suscripción registrada` | Se reinició el backend | Pulsa **Activar notificaciones** otra vez (o reabre la PWA con token). |
| `Suscripción inválida (HTTP 404/410)` | La suscripción caducó o se reinstaló la PWA | Pulsa **Renovar suscripción** y vuelve a activar. |
| No llega ninguna notificación | Permiso, Concentración, Bajo Consumo o limitación de iOS | Revisa Ajustes, prueba con la app abierta y luego en segundo plano. |
| `Service Worker` en error | Build antiguo o SW bloqueado | Recarga, borra datos del sitio en Safari y vuelve a instalar. |
| «Activando…» durante mucho tiempo | El navegador no completa la suscripción (red o servicio push lento) | Espera o vuelve a intentarlo; tras 45 s la app muestra un error en lugar de quedarse bloqueada. |
| `No se encontró el build del frontend` | Falta `apps/web/dist` | Ejecuta `pnpm build`. |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm bloqueó el postinstall de esbuild | `pnpm approve-builds esbuild` (ya configurado en `pnpm-workspace.yaml`). |
| El iPhone no abre `localhost:3000` | `localhost` apunta al propio iPhone | Usa la URL HTTPS de Cloudflare Tunnel. |

---

## Scripts

```bash
pnpm dev         # Vite + NestJS en modo desarrollo
pnpm build       # Build de web y API
pnpm start       # Sirve la PWA y la API desde NestJS
pnpm typecheck   # TypeScript en ambos proyectos
pnpm icons       # Regenera los iconos PNG
pnpm vapid:keys  # Genera un par de claves VAPID
```

---

## Checklist de aceptación

- [x] PWA instalable con manifest, iconos y Service Worker.
- [x] Apertura en modo standalone.
- [x] Permiso solicitado solo desde la app instalada y por gesto del usuario.
- [x] Service Worker registrado y activo.
- [x] Suscripción Push creada con `userVisibleOnly: true` y clave VAPID.
- [x] Suscripción enviada y almacenada en memoria del backend.
- [x] Envío manual de notificación.
- [x] Temporizador de 30 s con envío inmediato y contador.
- [x] Detención del temporizador sin perder la suscripción.
- [x] Sin timers duplicados.
- [x] Invalidación de suscripciones `404`/`410`.
- [x] Sin Firebase, OneSignal ni proveedores comerciales.
- [ ] Recepción real en iPhone (requiere despliegue con túnel y prueba en dispositivo).
