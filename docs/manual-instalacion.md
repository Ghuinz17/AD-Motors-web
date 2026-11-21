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
| Cuenta Supabase | Gratuita | [supabase.com](https://supabase.com) |
| Cuenta EmailJS | Gratuita | [emailjs.com](https://emailjs.com) |

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

## 2. Configurar Supabase

### 2.1 Crear el proyecto

1. Ve a [supabase.com](https://supabase.com) e inicia sesión.
2. Crea un nuevo proyecto. Anota la **URL** y la **clave anónima** (anon key).

### 2.2 Crear las tablas

Ve a **SQL Editor** en Supabase y ejecuta el siguiente SQL:

```sql
-- Tabla de usuarios
CREATE TABLE usuario (
  id_usuario uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     varchar,
  email      varchar,
  phone      varchar
);

-- Administradores (el UUID debe coincidir con auth.users.id)
CREATE TABLE administradores (
  id_usuario uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
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
  reservado           boolean DEFAULT false,
  fecha_reserva       timestamptz,
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

-- Compras / reservas
CREATE TABLE compra (
  id_compra       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario      uuid REFERENCES usuario(id_usuario),
  id_metodo_pago  uuid,
  total           numeric,
  estado          varchar DEFAULT 'PENDIENTE',
  fecha           timestamptz DEFAULT now()
);

ALTER TABLE compra ALTER COLUMN id_metodo_pago DROP NOT NULL;

-- Detalle de compra
CREATE TABLE detallecompra (
  id_detalle      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_compra       uuid REFERENCES compra(id_compra),
  id_vehiculo     text REFERENCES vehiculo(id_vehiculo),
  cantidad        integer DEFAULT 1,
  precio_unitario numeric
);

-- Solicitudes de visita y citas
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

Ejecuta el script completo [`supabase/seguridad-rls.sql`](../supabase/seguridad-rls.sql) en el **SQL Editor** de Supabase.

Ese script:

- elimina las políticas antiguas y permisivas;
- activa RLS en todas las tablas;
- crea la función `es_admin()`;
- permite a cada usuario leer y modificar **solo sus propios datos**;
- mantiene el catálogo de vehículos como lectura pública;
- reserva la escritura de vehículos, imágenes y solicitudes a los administradores;
- restringe la escritura del bucket `ad-motors-images` a los administradores.

> ⚠️ **No uses políticas `USING (true)`** en `usuario`, `compra`, `detallecompra`, `solicitudes_revision` ni en las escrituras de `vehiculo`.
> Eso permitiría a cualquier visitante leer nombres, teléfonos y fechas de otros clientes, o modificar el catálogo.
>
> El script es idempotente: puedes volver a ejecutarlo después de cambiar políticas.

Para dar permisos de administrador, inserta el UUID del usuario en la tabla:

```sql
INSERT INTO administradores (id_usuario)
VALUES ('UUID-DEL-USUARIO-ADMIN');
```

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

1. Ve a **Storage** en Supabase.
2. Crea un bucket llamado `ad-motors-images`.
3. Marca la opción **Public bucket**.

### 2.6 Configurar SMTP para emails de Supabase

1. Ve a **Authentication → Settings → SMTP**.
2. Activa el SMTP personalizado y rellena:
   - Host: `smtp.gmail.com`
   - Puerto: `587`
   - Usuario: tu email de Gmail
   - Contraseña: contraseña de aplicación de Google
   - Nombre del remitente: `AD Motors`

### 2.7 Configurar plantillas de email en Supabase

Ve a **Authentication → Email Templates** y pega el HTML de los archivos de la carpeta `web/email-templates/`:
- **Confirm signup** → `supabase-confirmar-registro.html`
- **Reset password** → `supabase-reset-password.html`
- **Change email** → `supabase-cambiar-email.html`
- **Email changed** → `supabase-email-cambiado.html`
- **Password changed** → `supabase-contrasena-cambiada.html`

---

## 3. Configurar EmailJS

1. Crea una cuenta en [emailjs.com](https://emailjs.com).
2. Ve a **Email Services** y conecta tu cuenta de Gmail.
3. Crea dos plantillas con el HTML de `web/email-templates/emailjs-unificada.html`.
4. En las plantillas de reserva/visita, configura el campo **To email** como `{{to_email}}` (el email del cliente).
5. Crea una segunda cuenta de EmailJS para el formulario de soporte.
6. En la plantilla de soporte, escribe **directamente** el email del administrador en el campo **To email**. No lo envíes como variable desde el navegador.
7. Anota los IDs de servicio, plantillas y clave pública de ambas cuentas.
8. En **Account → Security**, limita los dominios permitidos (Allowed origins) al dominio real de la web y activa los límites de envío.

---

## 4. Variables de entorno y configuración

### Web — editar `web/js/config.js`

```js
const SUPABASE_URL      = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_CLAVE_ANONIMA';

const EMAILJS_PUBLIC_KEY              = 'TU_PUBLIC_KEY';
const EMAILJS_SERVICE_ID              = 'service_xxxxxxx';
const EMAILJS_TEMPLATE_COMPRA         = 'template_xxxxxxx';
const EMAILJS_TEMPLATE_VISITA_CLIENTE = 'template_xxxxxxx';

const EMAILJS_PUBLIC_KEY_SOPORTE  = 'TU_SEGUNDA_PUBLIC_KEY';
const EMAILJS_SERVICE_ID_SOPORTE  = 'service_xxxxxxx';
const EMAILJS_TEMPLATE_SOPORTE    = 'template_xxxxxxx';
```

> **No guardes el email del administrador en `config.js`.** Se configura en la plantilla de EmailJS y así no aparece en el código fuente ni en el navegador.
>
> La clave pública de EmailJS y la clave anon de Supabase son públicas por diseño. No son secretos: la seguridad depende de las restricciones de dominio de EmailJS y de las políticas RLS de Supabase.

### App móvil — crear `.env.local` en la raíz de `ADMotors/`

```env
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=TU_CLAVE_ANONIMA
```

---

## 5. Ejecutar la web en local

La web es estática — no necesita servidor. Abre `web/index.html` directamente en el navegador o usa una extensión como **Live Server** en VS Code.

Para probar la versión de producción (minificada):

```bash
npm install
npm run build
npx serve dist
```

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
4. Vercel leerá `vercel.json` y ejecutará `npm run build`; la salida es `dist/`.
5. Pulsa **Deploy**.
6. Copia la URL generada y configúrala en Supabase → **Authentication → URL Configuration**.

---

## 9. Configurar URL en Supabase tras el despliegue

1. Ve a **Supabase → Authentication → URL Configuration**.
2. **Site URL**: `https://tu-proyecto.vercel.app`
3. **Redirect URLs**: `https://tu-proyecto.vercel.app/**`
4. Guarda los cambios.