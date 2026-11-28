# Manual de Instalación — AD Motor's

## Requisitos previos

Antes de comenzar asegúrate de tener instalado:

| Herramienta | Versión mínima | Enlace |
|---|---|---|
| Node.js | 18.x o superior | [nodejs.org](https://nodejs.org) |
| npm | 9.x o superior | Incluido con Node.js |
| Git | Cualquiera | [git-scm.com](https://git-scm.com) |
| Expo CLI | Última versión | `npm install -g expo-cli` |
| EAS CLI | Última versión | `npm install -g eas-cli` |
| Cuenta de base de datos | Gratuita | Alta en el proveedor elegido |
| Cuenta de correo transaccional | Gratuita | Alta en el proveedor elegido |

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/Ghuinz17/ad-motors.git
cd ad-motors
```

El repositorio contiene dos proyectos:
- `web/` — plataforma web estática
- `ADMotors/` — app móvil React Native

---

## 2. Configurar el backend

### 2.1 Crear el proyecto

1. Accede al panel de tu proveedor de base de datos e inicia sesión.
2. Crea un nuevo proyecto. Anota la **URL** y la **clave anónima** (anon key).

### 2.2 Crear las tablas

Ve al **editor SQL** de tu proveedor y ejecuta el siguiente SQL:

```sql
-- Tabla de usuarios
CREATE TABLE usuario (
  id_usuario uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     varchar,
  email      varchar,
  phone      varchar
);

-- Tabla de vehículos
CREATE TABLE vehiculo (
  id_vehiculo         text PRIMARY KEY,
  marca               varchar,
  modelo              varchar,
  descripcion         text,
  precio              numeric,
  ano_fabricacion     integer,
  tipo_combustible    varchar,
  kilometraje         integer,
  color               varchar,
  transmision         varchar,      -- MANUAL | AUTOMATICA
  potencia            integer,      -- CV
  orden               integer DEFAULT 0,
  estado              varchar DEFAULT 'activo',
  fecha_creacion      timestamptz DEFAULT now(),
  fecha_actualizacion timestamptz DEFAULT now()
);

-- Imágenes de vehículos
CREATE TABLE vehiculo_imagenes (
  id_imagen   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vehiculo text REFERENCES vehiculo(id_vehiculo) ON DELETE CASCADE,
  imagen      text,
  created_at  timestamptz DEFAULT now()
);

-- Solicitudes de visita
CREATE TABLE solicitudes_revision (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vehiculo      text REFERENCES vehiculo(id_vehiculo),
  id_usuario       uuid REFERENCES auth.users(id),
  marca_modelo     varchar,
  marca            varchar,
  modelo           varchar,
  nombre_asistente varchar,
  telefono         varchar,
  fecha_visita     date,
  hora_visita      time,
  estado           varchar DEFAULT 'PENDIENTE',
  tipo             varchar DEFAULT 'visita',
  fecha_creacion   timestamptz DEFAULT now()
);
```

### 2.3 Activar Row Level Security (RLS)

```sql
-- RLS en todas las tablas
ALTER TABLE usuario           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculo_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_revision ENABLE ROW LEVEL SECURITY;

-- Políticas de usuario
CREATE POLICY "usuario_select" ON usuario FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "usuario_insert" ON usuario FOR INSERT WITH CHECK (auth.uid() = id_usuario);
CREATE POLICY "usuario_update" ON usuario FOR UPDATE USING (auth.uid() = id_usuario);
CREATE POLICY "usuario_delete" ON usuario FOR DELETE USING (auth.uid() = id_usuario);

-- Vehículos públicos
CREATE POLICY "vehiculo_public_select" ON vehiculo FOR SELECT USING (true);
CREATE POLICY "vehiculo_insert" ON vehiculo FOR INSERT WITH CHECK (true);
CREATE POLICY "vehiculo_update" ON vehiculo FOR UPDATE USING (true);
CREATE POLICY "vehiculo_delete" ON vehiculo FOR DELETE USING (true);

-- Imágenes públicas
CREATE POLICY "imagenes_public" ON vehiculo_imagenes FOR SELECT USING (true);
CREATE POLICY "imagenes_insert" ON vehiculo_imagenes FOR INSERT WITH CHECK (true);
CREATE POLICY "imagenes_delete" ON vehiculo_imagenes FOR DELETE USING (true);

-- Solicitudes
CREATE POLICY "solicitudes_select" ON solicitudes_revision FOR SELECT USING (true);
CREATE POLICY "solicitudes_insert" ON solicitudes_revision FOR INSERT WITH CHECK (true);
CREATE POLICY "solicitudes_update" ON solicitudes_revision FOR UPDATE USING (true) WITH CHECK (true);
```

### 2.3.1 Cuenta de usuario, nuevos campos y orden

Después de las policies anteriores, ejecuta también [`supabase/cuenta-y-catalogo.sql`](../supabase/cuenta-y-catalogo.sql). Este script:

- restaura las policies `usuario_update_own` y `usuario_delete_own` (junto con las de inserción/lectura y sus versiones de administrador) para que el usuario pueda cambiar sus datos y eliminar su cuenta;
- crea la RPC `eliminar_mi_cuenta()` que borra el usuario de Auth;
- añade `transmision`, `potencia` y `orden` si no existen, y concede permisos sobre las columnas nuevas (importante si se usaron `grant` columna por columna);
- crea la RPC `reordenar_vehiculos(p_ids text[])`, que guarda de una sola vez el orden que el administrador ajusta arrastrando en el panel.

Es idempotente: se puede volver a ejecutar sin perder datos.

#### Si sale `permission denied for table administradores`

Significa que la función `es_admin()` se evalúa con los permisos del usuario en lugar de los del propietario, o que `authenticated` no puede leer `administradores`. Vuelve a ejecutar el script completo y comprueba:

```sql
select has_table_privilege('authenticated', 'public.administradores', 'SELECT');
-- debe devolver true

select proname, prosecdef from pg_proc where proname = 'es_admin';
-- prosecdef debe ser true (SECURITY DEFINER)
```

Tras corregirlo, prueba a cambiar el teléfono desde **Mi cuenta**; el error debería desaparecer. Si usas un panel de administración, recuerda que `js/ui.js` también llama a `es_admin()` para mostrar el botón de administrador.

### 2.4 Trigger para eliminar usuario de auth al borrar de la tabla

```sql
CREATE OR REPLACE FUNCTION delete_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id_usuario;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_usuario_deleted
  AFTER DELETE ON usuario
  FOR EACH ROW
  EXECUTE FUNCTION delete_user_from_auth();
```

### 2.5 Crear el bucket de Storage

1. Ve a **Storage** en el panel de tu proveedor.
2. Crea un bucket llamado `ad-motors-images`.
3. Marca la opción **Public bucket**.

### 2.6 Configurar SMTP para emails del backend

1. Ve a **Authentication → Settings → SMTP**.
2. Activa el SMTP personalizado y rellena:
   - Host: `smtp.gmail.com`
   - Puerto: `587`
   - Usuario: tu email de Gmail
   - Contraseña: contraseña de aplicación de Google
   - Nombre del remitente: `AD Motors`

#### Si sale `Error sending email change email` (500)

Supabase oculta el motivo real y solo devuelve ese mensaje genérico. Para ver la causa:

1. Ve a **Logs** en el panel de Supabase.
2. Filtra **Log Type: Auth** y **Level: error** (importante: no **Edge**).
3. Abre la línea del `PUT /auth/v1/user` y mira el campo `error` del **Raw JSON**.

Causas habituales según ese campo:

- `535 …` → usuario/contraseña SMTP incorrectos (genera una contraseña de aplicación nueva en Gmail).
- `550 …` → el remitente no está verificado o el proveedor rechaza el destino.
- `4xx` → límite temporal de envío; espera y vuelve a intentarlo.
- `unencrypted connection` o errores TLS → usa el puerto `587` con STARTTLS o `465`.

Tras corregirlo, solicita un enlace nuevo desde **Mi cuenta**: el intento anterior que falló ya no sirve.

### 2.7 Configurar plantillas de email en el backend

Ve a **Authentication → Email Templates** y pega el HTML de estos archivos:
- **Confirm signup** → `confirm-supabase.html`
- **Password changed** → `cambiopass-supabase.html`
- **Email changed** → `cambiocorreo-supabase.html` si la usas como notificación, o una plantilla propia

El cambio de correo desde **Mi cuenta** **ya no usa** la plantilla **Change email** de Supabase: el enlace lo envía **EmailJS** con la plantilla unificada, así que no depende del SMTP de Gmail. Para activarlo:

1. Ejecuta [`supabase/cambio-email-emailjs.sql`](../supabase/cambio-email-emailjs.sql) en el SQL Editor. Crea las columnas de solicitud pendiente, repara `es_admin()` y añade las RPC `solicitar_cambio_email()` y `confirmar_cambio_email()`. Ambas se ejecutan como propietario, por lo que no dependen de las políticas RLS que daban `permission denied for table administradores`.
2. En `js/config.js`, `EMAILJS_TEMPLATE_CAMBIO_EMAIL` usa inicialmente la misma plantilla que las visitas (`template_du605di`). Si creas una plantilla específica en EmailJS, cambia solo ese ID.
3. El enlace enviado apunta a `/confirm.html?emailjs_token=...`. Esa página calcula el SHA-256 del token y llama a la RPC; la BD guarda solo el hash y el enlace caduca en 24 horas y es de un solo uso.

Los enlaces de **Confirm signup** y **Reset password** siguen pasando por `confirm.html`, que acepta `token_hash` + `type`, `code` (PKCE) y `access_token` + `refresh_token`. Añade a **Redirect URLs**:

```text
https://<tu-dominio>/confirm.html
https://<tu-dominio>/pages/confirm.html
https://<tu-dominio>/pages/perfil.html
```

---

## 3. Configurar el envío de correos

1. Crea una cuenta en tu proveedor de correo transaccional.
2. Ve a **Email Services** y conecta tu cuenta de Gmail.
3. Crea una plantilla con el HTML de `web/email-templates/emailjs-unificada.html`.
4. En cada plantilla, configura el campo **To email** como `{{to_email}}`.
5. Crea una segunda cuenta en el proveedor de correo para el formulario de soporte.
6. En la segunda cuenta, crea una plantilla con el HTML de `emailjs-soporte.html`.
7. Anota los IDs de servicio, plantillas y clave pública de ambas cuentas.

---

## 4. Variables de entorno y configuración

### Web — editar `js/config.js`

```js
const decodeConfig      = (value) => atob(value);
const SUPABASE_URL      = decodeConfig('URL_CODIFICADA_EN_BASE64');
const SUPABASE_ANON_KEY = decodeConfig('CLAVE_CODIFICADA_EN_BASE64');

const EMAILJS_PUBLIC_KEY              = 'TU_PUBLIC_KEY';
const EMAILJS_SERVICE_ID              = 'service_xxxxxxx';
const EMAILJS_TEMPLATE_VISITA_CLIENTE = 'template_xxxxxxx';

const EMAILJS_PUBLIC_KEY_SOPORTE  = 'TU_SEGUNDA_PUBLIC_KEY';
const EMAILJS_SERVICE_ID_SOPORTE  = 'service_xxxxxxx';
const EMAILJS_TEMPLATE_SOPORTE    = 'template_xxxxxxx';

const ADMIN_EMAIL = 'tuemail@gmail.com';
```

### App móvil — crear `.env.local` en la raíz de `ADMotors/`

```env
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.DOMINIO
EXPO_PUBLIC_SUPABASE_KEY=TU_CLAVE_ANONIMA
```

---

## 5. Ejecutar la web en local

La web es estática — no necesita servidor. Abre `web/index.html` directamente en el navegador o usa una extensión como **Live Server** en VS Code.

---

## 6. Ejecutar la app móvil en desarrollo

```bash
cd ADMotors

# Instalar dependencias
npm install --legacy-peer-deps

# Instalar módulos de notificaciones
npx expo install expo-notifications expo-device

# Iniciar el servidor de desarrollo
npx expo start
```

Escanea el código QR con la app **Expo Go** en tu dispositivo Android para probar en tiempo real.

---

## 7. Generar el APK de Android

```bash
# Iniciar sesión en Expo
eas login

# Build de prueba (APK directo)
eas build --platform android --profile preview

# Build de producción (AAB para Play Store)
eas build --platform android --profile production
```

Una vez completado el build, descarga el APK desde [expo.dev](https://expo.dev) e instálalo en tu dispositivo habilitando la opción **Instalar de fuentes desconocidas** en los ajustes de Android.

---

## 8. Desplegar la web en Vercel

1. Sube el proyecto a un repositorio de GitHub.
2. Ve a [vercel.com](https://vercel.com) e importa el repositorio.
3. Configura el directorio raíz como la carpeta `web/`.
4. Pulsa **Deploy**.
5. Copia la URL generada y configúrala en el panel de autenticación de tu backend → **URL Configuration**.

---

## 9. Configurar URL en el backend tras el despliegue

1. Ve a **Authentication → URL Configuration** en el panel de tu backend.
2. **Site URL**: `https://tu-proyecto.vercel.app`
3. **Redirect URLs**: `https://tu-proyecto.vercel.app/**`
4. Guarda los cambios.