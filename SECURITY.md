# Seguridad

## Controles implementados

- La clave de OpenRouter y la clave opcional de ExerciseDB existen solo en el contenedor del servidor.
- La sesión usa una cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción; el JWT ya no vive en `localStorage`.
- La IA requiere cuenta autenticada y email verificado mediante consulta actual a PostgreSQL.
- Registro, login, GIFs e IA tienen rate limits separados.
- La cuota de IA se consume con bloqueo de fila (`SELECT … FOR UPDATE`) para evitar carreras por usuario.
- Hay límites diarios por cuenta y globales, techo de tokens, longitud máxima de mensajes y log de coste/tokens.
- Los cambios del coach son operaciones allowlist sobre secciones concretas. El servidor bloquea rutas peligrosas, tamaños excesivos, estructuras rotas y cambios de IDs.
- Cada modificación conserva una copia antes/después y se puede deshacer.
- Express oculta `X-Powered-By` y envía CSP, HSTS en producción, anti-frame, `nosniff`, política de referrer y Permissions Policy.
- PostgreSQL no publica ningún puerto en `docker-compose`.

## Antes de publicar

1. Genera secretos reales:

   ```bash
   openssl rand -hex 32
   openssl rand -base64 32
   ```

2. Usa una contraseña única para PostgreSQL y un `JWT_SECRET` distinto.
3. Activa HTTPS y configura `PUBLIC_URL=https://tu-dominio`.
4. Configura SMTP; sin él, los links de verificación solo aparecen en logs.
5. Configura en OpenRouter un límite monetario independiente y, si es posible, una key dedicada a esta app.
6. Ajusta `AI_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`, `AI_GLOBAL_DAILY_USD` y `AI_MAX_OUTPUT_TOKENS` a tu presupuesto.
7. Restringe firewall a 80/443; no expongas PostgreSQL ni el puerto 8080 directamente a Internet.
8. Automatiza backups cifrados del volumen `db_data` y prueba su restauración.
9. Mantén Docker, Node y dependencias actualizados y revisa `ai_usage_logs`/`plan_changes`.

## Límites conocidos

- No hay 2FA, passkeys, recuperación de contraseña terminada ni panel administrativo.
- Los rate limits viven en memoria del proceso; si replicas el servidor, usa un store compartido como Redis.
- La verificación de email reduce abuso, pero no sustituye CAPTCHA/Turnstile para un registro público.
- El contador global de la app es un cortacircuito operativo; el límite de gasto del proveedor es la última defensa económica.

Para una app personal, una opción todavía más segura es desactivar registro público tras crear tu cuenta o proteger el sitio completo con Cloudflare Access/Tailscale.
