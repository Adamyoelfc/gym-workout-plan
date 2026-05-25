# 🔒 Security Features

Este proyecto ahora incluye un sistema completo de seguridad para proteger tus API keys de OpenRouter y prevenir abuso.

## ✅ Implementado

### 1. **Verificación de Email**
- Los usuarios deben verificar su email antes de usar funciones de AI
- Token de verificación único (24 horas de validez)
- Sistema de reenvío de email de verificación
- En desarrollo: logs en consola (no se envían emails reales)
- En producción: configura SMTP para envío real de emails

**Flujo:**
1. Usuario se registra → recibe email con link de verificación
2. Click en link → email verificado
3. Ahora puede usar AI para generar planes

### 2. **Sistema de Cuotas AI (Créditos)**
- **10 generaciones gratis por día** por usuario
- Reset automático cada 24 horas
- Indicador visual de créditos restantes en UI
- Bloqueo automático cuando se agotan los créditos
- Mensaje claro de cuánto falta para el reset

**Base de datos:**
```sql
ai_credits INT DEFAULT 10       -- Créditos disponibles
ai_credits_reset TIMESTAMPTZ    -- Última vez que se reseteó
```

### 3. **Rate Limiting (Límites de Peticiones)**

#### Por IP (previene spam):
- **Registro:** 5 cuentas por hora
- **Login:** 10 intentos por 15 minutos
- **AI General:** 20 requests por hora

#### Por Usuario:
- **Cuotas AI:** 10 generaciones/día

### 4. **Logs de Uso AI**
Tabla `ai_usage_logs` registra:
- Quién usó AI
- Cuándo
- Qué acción (generar plan)

Útil para:
- Detectar patrones de abuso
- Análisis de uso
- Debugging

### 5. **Endpoints de Seguridad**

#### Nuevos endpoints:
```
GET  /api/auth/verify-email?token=xxx   - Verificar email
POST /api/auth/resend-verification      - Reenviar email
GET  /api/auth/ai-stats                 - Ver historial de uso AI
```

#### Protección en endpoints existentes:
```
POST /api/plan/generate
  ✓ Rate limit por IP
  ✓ Requiere autenticación
  ✓ Requiere email verificado
  ✓ Requiere créditos AI disponibles
```

## 🚀 Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
# Auth
JWT_SECRET=tu-secret-super-largo-aqui

# Email (Desarrollo: deja vacío para logs en consola)
EMAIL_FROM=noreply@tuapp.com
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=587
SMTP_USER=tu-usuario
SMTP_PASS=tu-password

# App
PUBLIC_URL=https://tudominio.com  # Para links en emails
```

### Proveedores SMTP Recomendados

**Gratis/Starter:**
- [SendGrid](https://sendgrid.com) - 100 emails/día gratis
- [Mailgun](https://mailgun.com) - 5,000 emails/mes gratis (3 meses)
- [Brevo](https://brevo.com) - 300 emails/día gratis

**Configuración SendGrid ejemplo:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=TU_API_KEY_AQUI
```

## 🛡️ Cómo Protege tu OpenRouter API Key

### Antes (vulnerable):
```
Cualquiera → Registra cuenta → Usa AI ilimitado → $$$
```

### Ahora (protegido):
```
Usuario → Registra
       → Verifica email (barrier 1)
       → 10 usos/día máx (barrier 2)
       → Rate limit por IP (barrier 3)
       → Logs monitoreados (barrier 4)
```

**Barreras de protección:**
1. ✉️ Email real requerido (filtra bots)
2. 🎟️ Límite diario (máx $2-3/día por usuario)
3. ⏱️ Rate limiting (previene scripts)
4. 📊 Logs auditoría (detectas patrones)

## 📊 Monitoreo

### Ver uso de un usuario:
```sql
SELECT * FROM ai_usage_logs 
WHERE user_id = 123 
ORDER BY created_at DESC 
LIMIT 20;
```

### Usuarios más activos:
```sql
SELECT user_id, COUNT(*) as uses
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY uses DESC
LIMIT 10;
```

### Detectar abuso (>10 usos/día):
```sql
SELECT user_id, DATE(created_at) as date, COUNT(*) as uses
FROM ai_usage_logs
GROUP BY user_id, DATE(created_at)
HAVING COUNT(*) > 10
ORDER BY uses DESC;
```

## 🔧 Ajustar Límites

En `server/src/ratelimit.js`:

```javascript
// Cambiar cuota diaria
const DAILY_LIMIT = 10;  // ← Ajusta aquí

// Cambiar rate limits
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // ventana de tiempo
  max: 5,                    // requests máximos
  // ...
});
```

## 🚨 Plan de Respuesta a Abuso

Si detectas abuso:

1. **Identificar usuario:**
   ```sql
   SELECT * FROM users WHERE id = XXX;
   ```

2. **Ver su historial:**
   ```sql
   SELECT * FROM ai_usage_logs WHERE user_id = XXX;
   ```

3. **Desactivar temporalmente:**
   ```sql
   UPDATE users SET ai_credits = 0 WHERE id = XXX;
   ```

4. **Bannear permanentemente:**
   ```sql
   -- Opción 1: quitar créditos
   UPDATE users SET ai_credits = 0, ai_credits_reset = '2099-12-31';
   
   -- Opción 2: eliminar cuenta
   DELETE FROM users WHERE id = XXX;
   ```

## 💰 Costos Estimados

Con estas protecciones:

- **Usuario normal:** 5-10 generaciones/semana = ~$1-2/mes
- **Usuario heavy:** 10 generaciones/día = ~$6-10/mes
- **Abusador bloqueado:** $0 (no puede pasar las barreras)

**Sin protección:** $∞ (cualquiera puede gastar infinito)

## 🔐 Mejoras Futuras (Opcionales)

Para más seguridad:
- [ ] Captcha en registro (reCAPTCHA v3)
- [ ] 2FA (autenticación dos factores)
- [ ] Admin panel para ver stats
- [ ] Webhooks para alertas de abuso
- [ ] IP blacklist automática
- [ ] Planes de pago (créditos ilimitados)

## 🧪 Testing en Desarrollo

Sin configurar SMTP, los emails se muestran en consola:

```bash
[email] DEV MODE - Verification email:
To: usuario@example.com
Link: http://localhost:8080/verify-email?token=abc123...
```

Copia el link y ábrelo en el navegador para verificar.

## ✅ Checklist Pre-Deploy

Antes de publicar en tu VPS:

- [ ] `.env` configurado con JWT_SECRET fuerte
- [ ] SMTP configurado (o dejado vacío para logs)
- [ ] `PUBLIC_URL` apunta a tu dominio real
- [ ] PostgreSQL con contraseña segura
- [ ] Rate limits ajustados para tu uso
- [ ] Backups automáticos configurados
- [ ] Monitoreo de logs activado

---

**¿Preguntas?** Lee el código en:
- `server/src/auth.js` - Autenticación y verificación
- `server/src/email.js` - Sistema de emails
- `server/src/ratelimit.js` - Rate limiting y cuotas
- `server/src/routes.js` - Endpoints protegidos
