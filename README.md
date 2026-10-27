# Plan Coach

Aplicación mobile-first de entrenamiento y nutrición que integra el plan Upper/Lower de `plan-app` con cuentas, sincronización, GIFs y un coach conversacional capaz de actualizar el plan.

## Qué conserva de `plan-app`

- Bloques A/B con todos los ejercicios y alternativas
- Semana Upper/Lower de 4 días, cardio y descanso
- Progreso por tanda completada
- Timer con cálculo por timestamp y controles de 60/90/120/180 s
- Registro diario de proteína y calorías
- Apertura automática de la actividad de hoy

El estado se sincroniza por usuario en PostgreSQL. Los GIFs usan como fuente principal el catálogo comunitario ExerciseGymGifsDB v1.1.0 servido por jsDelivr, con fallback opcional a AscendAPI mediante RapidAPI.

> **Uso de GIFs:** el catálogo comunitario declara que los GIFs pertenecen a sus autores y no concede derechos sobre ellos. Esta integración se usa para el proyecto personal/no comercial. Antes de convertir la aplicación en un producto comercial, sustituye esta fuente por contenido con una licencia comercial explícita.

## Coach con IA

El chat puede mover días y ejercicios, sustituir alternativas y actualizar cardio o nutrición. No entrega el plan completo generado directamente al cliente: propone operaciones limitadas, el servidor las valida, aplica y registra.

El coach recibe en cada mensaje la fecha/hora en la zona IANA del navegador y las actividades exactas de ayer, hoy y mañana. Su agente dispone de herramientas validadas para analizar el plan, editar bloques/días/ejercicios/semana/cardio/nutrición, buscar ejercicios y guardar u olvidar preferencias. Los IDs nuevos se generan en el servidor y cada cambio del plan se puede deshacer.

PostgreSQL guarda:

- `ai_memories`: preferencias durables del usuario
- `chat_messages`: historial del chat
- `plan_changes`: auditoría antes/después y soporte para deshacer
- `ai_usage_logs`: uso, tokens y coste reportado por el proveedor

## Ejecutar con Docker

```bash
cp .env.example .env
# Cambia al menos POSTGRES_PASSWORD, JWT_SECRET y OPENROUTER_API_KEY
docker compose up -d --build
```

Abre `http://localhost:8080`. En producción usa HTTPS mediante un proxy inverso
(este servidor usa Traefik) y configura `PUBLIC_URL` con la URL pública. Si
existe exactamente un proxy delante del contenedor, usa `TRUST_PROXY_HOPS=1`;
déjalo en `0` cuando se acceda directamente.

Las migraciones son idempotentes y se ejecutan al arrancar, incluso si el volumen de PostgreSQL ya existía.

## Variables principales

| Variable | Uso |
| --- | --- |
| `OPENROUTER_API_KEY` | Solo servidor; nunca se incluye en el bundle web |
| `OPENROUTER_MODEL` | Modelo de OpenRouter con soporte para function/tool calling |
| `AI_DAILY_LIMIT` | Máximo diario por cuenta |
| `AI_GLOBAL_DAILY_LIMIT` | Cortacircuito diario total |
| `AI_GLOBAL_DAILY_USD` | Pausa al alcanzar el coste reportado |
| `AI_MAX_OUTPUT_TOKENS` | Techo de salida por llamada |
| `AI_MAX_TOOL_ROUNDS` | Máximo de rondas de herramientas por respuesta |
| `APP_TIME_ZONE` | Zona horaria IANA de respaldo si el navegador no envía una válida |
| `RAPIDAPI_KEY` | Opcional; ExerciseDB desde servidor |
| `JWT_SECRET` | Firma de la sesión HttpOnly |
| `RESEND_API_KEY` | Envío de email por HTTPS; recomendado en producción |
| `EMAIL_FROM` | Remitente verificado, por ejemplo `Gym AI <noreply@notifications.adamdev.me>` |
| `SMTP_*` | Alternativa SMTP; se usa solo si no existe `RESEND_API_KEY` |

Para la protección económica más fuerte, configura además un límite de gasto directamente en OpenRouter: el límite del proveedor sigue funcionando aunque tu servidor sea comprometido.

## API relevante

| Método | Ruta | Función |
| --- | --- | --- |
| `GET/PUT` | `/api/plan` | Leer o guardar el plan completo |
| `GET/PUT` | `/api/progress` | Progreso, alternativas y comida |
| `GET/POST` | `/api/chat` | Historial / conversar y actualizar |
| `POST` | `/api/plan/undo` | Deshacer el último cambio del coach |
| `GET` | `/api/exercises/gif` | Buscar GIF a través del servidor |

Consulta [SECURITY.md](SECURITY.md) antes de publicar.

## Despliegue en adamdev.me

Producción usa el Traefik existente y publica la app bajo
`https://adamdev.me/gym-ai-web/`. El primer despliegue necesita un `.env` en
`/root/docker/gym-ai-web`; los siguientes conservan ese archivo y se hacen con:

```bash
./scripts/deploy.sh
```

El script sincroniza el árbol de trabajo actual (incluidos cambios sin commit),
reconstruye los contenedores y comprueba `/gym-ai-web/api/health`. La base de
datos vive en un volumen Docker y no se borra en los despliegues. Con la
configuración SSH actual pide la contraseña una vez y reutiliza esa conexión
durante todo el despliegue.

Variables requeridas en el `.env` de producción:

```dotenv
APP_PORT=127.0.0.1:8081
PUBLIC_URL=https://adamdev.me/gym-ai-web
TRUST_PROXY_HOPS=1
SESSION_COOKIE_PATH=/gym-ai-web
EMAIL_FROM=Gym AI <noreply@notifications.adamdev.me>
RESEND_API_KEY=re_...
```

Se pueden cambiar el host, ruta o clave sin editar el script, por ejemplo:

```bash
SSH_KEY="$HOME/.ssh/otra-clave" DEPLOY_HOST=root@servidor ./scripts/deploy.sh
```

Después de modificar únicamente el `.env` directamente en el servidor, aplica
los cambios sin reconstruir la imagen con:

```bash
./scripts/prod-compose.sh up -d
```

Para ver estado o logs:

```bash
./scripts/prod-compose.sh ps
./scripts/prod-compose.sh logs -f app
```

El wrapper siempre incluye `compose.production.yml` y rechaza `-v`/`--volumes`.
No uses `docker compose down -v` en producción: ese flag elimina PostgreSQL.
