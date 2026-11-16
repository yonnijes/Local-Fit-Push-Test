# SPEC.md — Local Fit Push Test **Versión:** 1.0 **Estado:** Especificación inicial **Tipo:** PWA de pruebas de notificaciones Push **Plataforma inicial:** iPhone (iOS 16.4+) 
**Objetivo:** Validar el envío y recepción de notificaciones Web Push desde un backend NestJS, con una frecuencia de 30 segundos. --- # 1. Descripción del proyecto Desarrollar una 
aplicación web instalable (PWA) llamada **Local Fit Push Test**, cuyo único propósito sea probar el funcionamiento de notificaciones Push en dispositivos móviles. La aplicación 
permitirá: 1. Instalar la PWA en el teléfono. 2. Solicitar permisos para recibir notificaciones. 3. Registrar el dispositivo mediante Push API. 4. Enviar la suscripción al backend. 
5. Almacenar temporalmente la suscripción. 6. Iniciar un temporizador en el backend. 7. Enviar una notificación cada 30 segundos. 8. Detener el envío desde la interfaz. 9. 
Visualizar el estado de la suscripción y del servicio. El proyecto debe ser independiente de la aplicación Local Fit real. No requiere autenticación de usuarios, base de datos ni 
lógica de negocio. # 2. Objetivos técnicos - Validar la instalación de una PWA en iOS. - Validar el funcionamiento de Service Workers. - Validar el proceso de suscripción a Push 
API. - Validar el envío de notificaciones desde NestJS. - Comprobar la recepción de notificaciones con la aplicación en segundo plano o cerrada. - Comprobar el comportamiento del 
sistema operativo frente a notificaciones periódicas. - Evitar dependencias de proveedores comerciales de notificaciones. # 3. Stack tecnológico | Componente | Tecnología | 
|---|---| | Frontend | React | | Lenguaje | TypeScript | | Build | Vite | | PWA | vite-plugin-pwa | | Service Worker | Workbox / Service Worker | | Backend | NestJS | | Comunicación 
Push | Web Push API | | Librería backend | web-push | | Autenticación Push | VAPID | | Persistencia | Memoria del proceso | | HTTPS | Cloudflare Tunnel | | Package Manager | pnpm | 
No utilizar Firebase, OneSignal ni otros proveedores comerciales. **Nota:** Apple y los navegadores siguen participando en la infraestructura de entrega de notificaciones. No se 
contrata un proveedor adicional, pero la entrega en iOS depende de APNs y de las políticas de Apple. # 4. Arquitectura La solución estará compuesta por dos aplicaciones: ## 4.1 
Frontend Aplicación React instalable como PWA. Responsabilidades: - Mostrar el estado de compatibilidad. - Detectar si se ejecuta como aplicación instalada. - Solicitar permisos de 
notificación. - Registrar el Service Worker. - Crear la suscripción Push. - Enviar la suscripción al backend. - Iniciar y detener las pruebas. - Mostrar estadísticas de los envíos. 
## 4.2 Backend Aplicación NestJS. Responsabilidades: - Recibir las suscripciones Push. - Almacenar la suscripción en memoria. - Administrar las claves VAPID. - Enviar notificaciones 
mediante Web Push. - Administrar el temporizador de 30 segundos. - Permitir iniciar y detener los envíos. - Exponer el estado actual del servicio. - Gestionar errores y 
suscripciones inválidas. ## 4.3 Comunicación La comunicación será HTTPS. El backend se ejecutará localmente en el Mac y será expuesto mediante Cloudflare Tunnel para permitir que el 
iPhone acceda a la PWA. Cloudflare Tunnel solamente proporciona conectividad HTTPS. No es responsable del envío de notificaciones. # 5. Requisitos de instalación PWA La aplicación 
debe cumplir con los requisitos de una PWA instalable. Implementar: - Web App Manifest. - Nombre: Local Fit Push Test. - Short name: Push Test. - Display: standalone. - Iconos para 
dispositivos móviles. - Start URL. - Theme color. - Background color. - Service Worker. En iOS: - Soportar iOS/iPadOS 16.4 o superior. - Permitir instalación mediante Safari. - 
Mostrar instrucciones para añadir la aplicación a la pantalla de inicio. - Solicitar permisos solamente desde la aplicación instalada. - No solicitar permisos automáticamente al 
cargar la página. # 6. Flujo de suscripción Push ## 6.1 Registro del Service Worker Al iniciar la aplicación, registrar el Service Worker. El Service Worker será responsable de 
recibir los eventos Push y mostrar las notificaciones. ## 6.2 Solicitud de permisos El usuario debe pulsar un botón llamado: **Activar notificaciones** Al pulsarlo: 1. Verificar 
compatibilidad del navegador. 2. Verificar que la PWA esté instalada. 3. Registrar o recuperar el Service Worker. 4. Solicitar permisos mediante Notification.requestPermission(). 5. 
Validar que el permiso sea granted. Si el usuario rechaza el permiso, mostrar el estado correspondiente y explicar cómo habilitarlo desde los ajustes. ## 6.3 Crear suscripción 
Utilizar: PushManager.subscribe() Configuración: - userVisibleOnly: true. - applicationServerKey: clave pública VAPID. La suscripción generada tendrá una estructura similar a: 
```json {
  "endpoint": "https://push-service.example/...", "expirationTime": null, "keys": {
    "p256dh": "...", "auth": "..."
  } } ``` ## 6.4 Enviar suscripción al backend Enviar el objeto completo al endpoint: POST /api/push/subscribe El backend almacenará la suscripción en memoria. Para este MVP solo se 
necesita una suscripción activa. # 7. Modelo de datos No se requiere MongoDB para la primera versión. Utilizar almacenamiento en memoria mediante un servicio singleton de NestJS. 
Estructura conceptual: ```typescript interface PushTestState {
  subscription: PushSubscription | null; timerRunning: boolean; intervalSeconds: number; sentCount: number; lastAttemptAt: Date | null; lastError: string | null; } ``` La 
suscripción debe conservar: - endpoint. - keys.p256dh. - keys.auth. - expirationTime. El estado se perderá cuando el backend se reinicie. Esto es aceptable para la primera versión. 
# 8. Backend NestJS Crear un módulo denominado: PushModule Servicios: ## 8.1 PushService Responsabilidades: - Registrar suscripciones. - Actualizar suscripciones. - Validar los 
datos recibidos. - Enviar notificaciones. - Gestionar errores de Web Push. - Desactivar suscripciones inválidas. Utilizar la librería: ```bash pnpm add web-push ``` ## 8.2 
PushTimerService Responsabilidades: - Iniciar el temporizador. - Detener el temporizador. - Evitar intervalos duplicados. - Ejecutar el envío inmediato al iniciar. - Programar 
envíos cada 30 segundos. - Mantener el contador de intentos exitosos. - Registrar errores. El temporizador debe ejecutarse exclusivamente en el backend. No utilizar setInterval en 
React ni en el Service Worker para administrar los envíos. Se recomienda utilizar un ciclo asíncrono que espere a que termine cada envío antes de programar el siguiente, evitando 
solapamientos. El intervalo predeterminado será de 30.000 milisegundos. ## 8.3 PushController Exponer los endpoints necesarios para controlar el sistema. # 9. API REST Prefijo: 
/api/push ## 9.1 GET /status Consultar el estado actual. Respuesta: ```json {
  "subscriptionRegistered": true, "timerRunning": false, "intervalSeconds": 30, "sentCount": 0, "lastAttemptAt": null, "lastError": null } ``` ## 9.2 POST /subscribe Registrar o 
actualizar una suscripción. Body: objeto PushSubscription. Respuesta: ```json {
  "registered": true } ``` ## 9.3 POST /send-test Enviar una notificación inmediata. Respuesta: ```json { "accepted": true, "message": "Test push submitted" } ``` ## 9.4 POST /start 
Iniciar el temporizador. Body: ```json {
  "intervalSeconds": 30 } ``` Comportamiento: - Validar que exista una suscripción. - Validar el intervalo. - Evitar iniciar otro timer si ya existe uno. - Enviar la primera 
notificación inmediatamente. - Continuar enviando cada 30 segundos. Respuesta: ```json {
  "running": true, "intervalSeconds": 30 } ``` ## 9.5 POST /stop Detener el temporizador. Comportamiento: - Cancelar el ciclo de envíos. - Evitar nuevos envíos periódicos. - 
Mantener la suscripción registrada. Respuesta: ```json {
  "running": false } ``` # 10. Configuración VAPID Generar un par de claves VAPID. Ejecutar: ```bash pnpm exec web-push generate-vapid-keys ``` Configurar las variables de entorno: 
```dotenv PORT=3000 PUBLIC_APP_URL=https://push-test.example.com VAPID_SUBJECT=mailto:dev@example.com VAPID_PUBLIC_KEY= VAPID_PRIVATE_KEY= PUSH_TEST_ADMIN_TOKEN= ``` Reglas: - La 
clave privada VAPID solo debe existir en el backend. - La clave pública VAPID puede exponerse al frontend. - No almacenar claves en el repositorio. - Utilizar archivos .env 
protegidos. - No registrar las claves de las suscripciones en logs. Los endpoints de administración deben estar protegidos mediante un token de prueba. El token administrativo nunca 
debe incluirse directamente en el bundle público de React. # 11. Service Worker Implementar los siguientes eventos: ## 11.1 push Escuchar el evento push. Obtener el payload y 
mostrar la notificación mediante: ```javascript self.registration.showNotification() ``` La notificación debe incluir: - Título. - Mensaje. - Icono. - Timestamp. - Identificador de 
secuencia. ## 11.2 notificationclick Cuando el usuario pulse la notificación: - Abrir la PWA si no está abierta. - Enfocar una ventana existente si ya está abierta. # 12. Formato de 
las notificaciones Título: Local Fit Push Test Mensaje: Notificación de prueba #12 Payload de ejemplo: ```json {
  "type": "push-test", "sequence": 12, "sentAt": "2026-11-15T14:30:00.000Z" } ``` Cada notificación debe tener un identificador diferente para facilitar las pruebas. Evitar utilizar 
un mismo tag si se desea comprobar la aparición individual de todas las notificaciones. # 13. Interfaz de usuario La interfaz debe ser minimalista, responsive y orientada 
exclusivamente a pruebas técnicas. ## 13.1 Encabezado Nombre: Local Fit Push Test Descripción: Aplicación de prueba de notificaciones Push. Mostrar un indicador visual: TEST 
ENVIRONMENT ## 13.2 Estado del dispositivo Mostrar: - Compatibilidad del navegador. - Estado de instalación PWA. - Estado del permiso. - Estado del Service Worker. - Estado de 
suscripción. - Estado de conexión con backend. ## 13.3 Controles Botón: Activar notificaciones. Registra el Service Worker, solicita permiso y crea la suscripción. Botón: Enviar 
prueba ahora. Solicita al backend enviar una notificación individual. Botón: Iniciar prueba. Inicia el temporizador de 30 segundos. Botón: Detener prueba. Detiene el temporizador. 
## 13.4 Información de ejecución Mostrar: - Intervalo configurado. - Estado del temporizador. - Número de envíos aceptados por el servicio Push. - Fecha del último intento. - Último 
error registrado. Es importante diferenciar entre una notificación aceptada por el servicio Push y una notificación efectivamente recibida o visualizada en el teléfono. El backend 
no puede garantizar que el sistema operativo haya mostrado cada notificación. # 14. Estructura del proyecto ```text local-fit-push-test/ │ ├── apps/ │ │ │ ├── web/ │ │ 
├── public/ │ │ │ └── icons/ │ │ │ │ │ ├── src/ │ │ │ ├── components/ │ │ │ ├── hooks/ │ │ │ ├── services/ │ │ │ │ └── push.service.ts │ 
│ │ ├── App.tsx │ │ │ └── main.tsx │ │ │ │ │ ├── vite.config.ts │ │ └── package.json │ │ │ └── api/ │ ├── src/ │ │ ├── push/ │ │ │ ├── 
dto/ │ │ │ ├── push.controller.ts │ │ │ ├── push.service.ts │ │ │ ├── push-timer.service.ts │ │ │ └── push.module.ts │ │ │ │ │ ├── app.module.ts │ 
│ └── main.ts │ │ │ └── package.json │ ├── .env.example ├── .gitignore ├── package.json └── README.md ``` # 15. Ejecución local y Cloudflare Tunnel El backend 
se ejecutará localmente en el Mac. Pasos: 1. Instalar dependencias. 2. Generar claves VAPID. 3. Configurar variables de entorno. 4. Construir el frontend. 5. Iniciar NestJS. 6. 
Configurar Cloudflare Tunnel. 7. Exponer el puerto del backend mediante HTTPS. 8. Abrir la URL HTTPS desde Safari en el iPhone. 9. Instalar la PWA. 10. Activar notificaciones. 
Preferiblemente, NestJS debe servir también los archivos estáticos del frontend para mantener un único origen HTTPS y simplificar la configuración. El Mac debe permanecer encendido, 
con NestJS y Cloudflare Tunnel activos durante las pruebas. # 16. Manejo de errores | Escenario | Comportamiento | |---|---| | Push API no soportada | Mostrar incompatibilidad | | 
PWA no instalada | Mostrar instrucciones | | Permiso denegado | Mostrar instrucciones para habilitarlo | | Service Worker fallido | Mostrar error y permitir reintento | | 
Suscripción inexistente | Bloquear inicio | | Backend desconectado | Mostrar estado de desconexión | | Error VAPID | Registrar error técnico | | Endpoint 404 o 410 | Invalidar 
suscripción | | Error temporal de red | Registrar error y permitir reintento | | Timer duplicado | Mantener una sola ejecución | | Backend reiniciado | Reiniciar en estado detenido 
y solicitar nuevo registro de suscripción | No invalidar la suscripción por errores transitorios. # 17. Seguridad - Utilizar HTTPS obligatorio. - Mantener la clave privada VAPID en 
el backend. - Proteger los endpoints administrativos. - Validar las suscripciones recibidas. - Limitar el origen permitido. - No exponer secretos en el frontend. - No almacenar 
información personal. - No registrar datos criptográficos sensibles. - Limitar el intervalo mínimo permitido. - Evitar que cualquier visitante pueda iniciar envíos arbitrarios. # 
18. Criterios de aceptación El MVP estará terminado cuando: - [ ] La aplicación pueda instalarse como PWA en un iPhone compatible. - [ ] Se pueda abrir desde la pantalla de inicio. 
- [ ] Se pueda solicitar y conceder permiso de notificaciones. - [ ] Se registre correctamente el Service Worker. - [ ] Se genere una suscripción Push. - [ ] La suscripción llegue 
al backend. - [ ] El backend almacene la suscripción en memoria. - [ ] Se pueda enviar una notificación manual. - [ ] La notificación se muestre en el iPhone. - [ ] Se pueda iniciar 
el temporizador desde la interfaz. - [ ] El backend intente enviar una notificación cada 30 segundos. - [ ] Se pueda detener el temporizador desde la interfaz. - [ ] No se creen 
temporizadores duplicados. - [ ] Se pueda visualizar el contador de envíos. - [ ] Se gestionen correctamente las suscripciones inválidas. - [ ] La prueba funcione con la PWA en 
segundo plano o cerrada, sujeto a las políticas de iOS. - [ ] No se requiera Firebase ni un proveedor comercial de notificaciones. # 19. Limitaciones conocidas 1. El temporizador se 
ejecuta en el backend, no en el teléfono. 2. La frecuencia de 30 segundos representa el intento de envío, no una garantía de visualización exacta. 3. iOS puede retrasar, limitar o 
agrupar notificaciones. 4. El servicio push de Apple participa en la entrega. 5. Si el Mac se apaga, se interrumpen los envíos. 6. Si Cloudflare Tunnel se desconecta, el iPhone no 
podrá comunicarse con el backend. 7. Si NestJS se reinicia, se pierde la suscripción almacenada en memoria. 8. Una reinstalación de la PWA puede requerir una nueva suscripción. 9. 
El envío periódico debe utilizarse solo durante pruebas controladas. # 20. Plan de implementación ## Fase 1: Base del proyecto - Crear monorepo o estructura de dos aplicaciones. - 
Configurar React, TypeScript y Vite. - Configurar NestJS. - Configurar PWA y manifest. - Crear interfaz inicial. ## Fase 2: Suscripción Push - Generar VAPID. - Registrar Service 
Worker. - Implementar solicitud de permisos. - Implementar PushManager.subscribe(). - Enviar suscripción al backend. - Guardar suscripción en memoria. ## Fase 3: Recepción - 
Implementar evento push. - Implementar showNotification(). - Implementar notificationclick. - Implementar endpoint de envío manual. - Validar recepción en iPhone. ## Fase 4: 
Temporizador - Implementar PushTimerService. - Implementar ciclo de 30 segundos. - Enviar notificación inmediata al iniciar. - Implementar detención. - Evitar ejecuciones 
duplicadas. - Mostrar contador y estado. ## Fase 5: Pruebas reales - Exponer backend mediante Cloudflare Tunnel. - Abrir PWA en Safari. - Instalar en pantalla de inicio. - Conceder 
permisos. - Probar notificación manual. - Probar notificaciones periódicas. - Probar con aplicación en segundo plano. - Probar con aplicación cerrada. - Verificar detención y 
reconexión. --- # 21. Definición final El resultado esperado es una aplicación PWA independiente que permita instalar un dispositivo móvil, registrar su suscripción Push y recibir 
notificaciones de prueba enviadas desde un backend NestJS cada 30 segundos. **Configuración final del MVP:** - Nombre: Local Fit Push Test. - Frontend: React + TypeScript + Vite. - 
Backend: NestJS. - Push: Web Push API. - Seguridad Push: VAPID. - Librería: web-push. - Persistencia: memoria. - Infraestructura: Mac local. - HTTPS: Cloudflare Tunnel. - Intervalo: 
30 segundos. - Control: iniciar y detener desde la PWA. - Base de datos: ninguna. - Firebase: no. - OneSignal: no. - Proveedor comercial: ninguno. - Entrega en iOS: infraestructura 
push de Apple.
**Principio de diseño:** mantener el MVP lo más pequeño posible. El único objetivo es comprobar que una PWA instalada en un iPhone puede recibir notificaciones Push enviadas desde un backend propio.
