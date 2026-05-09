# Documentación Técnica — AD Motor's

## 1. Descripción de la arquitectura

AD Motor's es una plataforma de dos capas:

- **Frontend web** — aplicación estática (HTML, CSS, JavaScript vanilla) servida desde Vercel. No existe servidor propio: toda la lógica se ejecuta en el navegador del cliente y se comunica directamente con Supabase mediante su SDK de JavaScript.
- **App móvil de administración** — aplicación Android desarrollada con React Native y Expo. Comparte el mismo backend de Supabase.
- **Backend** — Supabase actúa como backend completo: base de datos PostgreSQL, sistema de autenticación por OTP, almacenamiento de imágenes (Storage) y canal de eventos en tiempo real (Realtime).
- **Email** — dos cuentas de EmailJS gestionan el envío de correos transaccionales desde el navegador sin servidor propio.

```
┌─────────────────────┐     ┌──────────────────────┐
│   Cliente Web       │     │   App Android        │
│   (Vercel)          │     │   (React Native)     │
│   HTML/CSS/JS       │     │   TypeScript/Expo    │
└────────┬────────────┘     └──────────┬───────────┘
         │                             │
         │     HTTPS / WebSocket       │
         ▼                             ▼
┌─────────────────────────────────────────────────┐
│                  SUPABASE                        │
│                                                  │
│  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  PostgreSQL  │  │   Auth   │  │  Storage  │  │
│  │  (tablas)    │  │  (OTP)   │  │ (imágenes)│  │
│  └──────────────┘  └──────────┘  └───────────┘  │
│  ┌──────────────┐                                │
│  │   Realtime   │  (notificaciones móvil)        │
│  └──────────────┘                                │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│      EmailJS        │
│  (correos automát.) │
└─────────────────────┘
```

---

## 2. Diagrama de la base de datos

```
┌──────────────────────────────────────────────────────────────────────┐
│  auth.users (Supabase Auth)                                          │
│  id | email | created_at | user_metadata                            │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ 1:1
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  usuario                                                            │
│  id_usuario (uuid, PK, FK → auth.users) | nombre | email | phone   │
└─────────────────────────────────────────────────────────────────────┘
          │ 1:N                            │ 1:N
          ▼                                ▼
┌──────────────────────┐      ┌────────────────────────────────────────┐
│  compra              │      │  solicitudes_revision                  │
│  id_compra (uuid,PK) │      │  id (uuid, PK)                        │
│  id_usuario (FK)     │      │  id_vehiculo (FK)                     │
│  total               │      │  id_usuario (FK)                      │
│  estado              │      │  nombre_asistente                     │
│  fecha               │      │  telefono                             │
│  id_metodo_pago      │      │  fecha_visita | hora_visita           │
└────────┬─────────────┘      │  estado | tipo (visita/pago)         │
         │ 1:N                │  marca_modelo                         │
         ▼                    └────────────────────────────────────────┘
┌──────────────────────┐
│  detallecompra       │
│  id_detalle (PK)     │
│  id_compra (FK)      │
│  id_vehiculo (FK)    │
│  cantidad            │
│  precio_unitario     │
└──────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  vehiculo                                                           │
│  id_vehiculo (text, PK) | marca | modelo | precio                  │
│  ano_fabricacion | tipo_combustible | kilometraje | color           │
│  descripcion | reservado (bool) | fecha_reserva                    │
│  fecha_creacion | fecha_actualizacion                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 1:N
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  vehiculo_imagenes                                                  │
│  id_imagen (uuid, PK) | id_vehiculo (FK) | imagen | created_at     │
└─────────────────────────────────────────────────────────────────────┘
```

Todas las tablas tienen **Row Level Security (RLS)** activado. Los usuarios solo pueden leer y modificar sus propios registros. Las imágenes se almacenan en el bucket `ad-motors-images` de Supabase Storage.

---

## 3. Tecnologías utilizadas

### Web
| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ | — |
| Backend | Supabase JS Client | 2.x |
| Autenticación | Supabase Auth (OTP) | — |
| Base de datos | PostgreSQL (via Supabase) | 15 |
| Almacenamiento | Supabase Storage | — |
| Email | EmailJS | 3.x |
| Iconos | Font Awesome | 6.5 |
| Tipografía | Google Fonts (Barlow) | — |
| Despliegue | Vercel | — |

### App móvil
| Capa | Tecnología | Versión |
|---|---|---|
| Framework | React Native | 0.74.5 |
| Plataforma | Expo | 51.0.39 |
| Lenguaje | TypeScript | 5.3.3 |
| Navegación | React Navigation Native Stack | — |
| Backend | Supabase JS Client | 2.45.1 |
| Imágenes | expo-image-picker | 15.1.0 |
| Notificaciones | expo-notifications | — |
| Iconos | @expo/vector-icons (Ionicons) | 14.0.3 |
| Build | EAS Build | — |

---

## 4. Estructura del proyecto

### Web
```
web/
├── index.html                   # Catálogo principal
├── confirm.html                 # Verificación de email
├── assets/
│   └── admotors.png
├── css/
│   ├── base.css                 # Variables, reset, componentes globales
│   ├── header.css               # Cabecera, drawer, footer
│   ├── index.css                # Catálogo y tarjetas de vehículos
│   ├── auth.css                 # Formularios de autenticación
│   ├── detalle.css              # Página de detalle de vehículo
│   ├── perfil.css               # Perfil de usuario
│   └── pago.css                 # Pasarela de pago
├── js/
│   ├── config.js                # Credenciales Supabase y EmailJS
│   ├── ui.js                    # Utilidades UI compartidas
│   ├── main.js                  # Catálogo, filtros y búsqueda
│   ├── auth.js                  # Login, registro y OTP
│   ├── detalle.js               # Detalle, reserva y solicitudes
│   ├── perfil.js                # Perfil, reservas y configuración
│   └── soporte.js               # Formulario de soporte
├── pages/
│   ├── auth.html
│   ├── detalle.html
│   ├── perfil.html
│   ├── pago.html
│   ├── reset-password.html
│   └── terminos.html
└── email-templates/
    ├── emailjs-unificada.html
    ├── emailjs-soporte.html
    ├── supabase-confirmar-registro.html
    ├── supabase-reset-password.html
    ├── supabase-cambiar-email.html
    ├── supabase-contrasena-cambiada.html
    ├── supabase-email-cambiado.html
    └── supabase-telefono-cambiado.html
```

### App móvil
```
ADMotors/
├── App.tsx                      # Punto de entrada y navegación
├── app.json                     # Configuración Expo
├── eas.json                     # Perfiles de build EAS
├── tsconfig.json
└── src/
    ├── config/
    │   └── supabase.ts          # Cliente Supabase
    ├── types/
    │   └── index.ts             # Interfaces y tipos TypeScript
    ├── services/
    │   ├── imageService.ts      # Cámara y galería
    │   ├── supabaseVehiculoService.ts
    │   ├── vehiculoService.ts
    │   └── notificationService.ts
    ├── screens/
    │   ├── homeScreen.tsx
    │   ├── listVehiculosScreen.tsx
    │   ├── anadirVehiculoScreen.tsx
    │   ├── editarVehiculoScreen.tsx
    │   ├── detalleVehiculoScreen.tsx
    │   ├── solicitudesScreen.tsx
    │   └── citaReservaScreen.tsx
    ├── components/
    │   ├── header.tsx
    │   ├── input.tsx
    │   ├── button.tsx
    │   └── radioButton.tsx
    ├── constants/
    │   └── colors.ts
    └── styles/
        └── global.ts
```

---

## 5. Explicación de los CRUD

### Vehículos (administración — app móvil)

| Operación | Descripción | Pantalla |
|---|---|---|
| **CREATE** | El administrador rellena el formulario con marca, modelo, precio, año, combustible, kilometraje, color y fotos. Se inserta en la tabla `vehiculo` y las imágenes en `vehiculo_imagenes` vía Supabase Storage. | `anadirVehiculoScreen` |
| **READ** | Se obtienen todos los vehículos ordenados por fecha de creación. En el detalle se cargan también las imágenes asociadas. | `listVehiculosScreen`, `detalleVehiculoScreen` |
| **UPDATE** | El administrador modifica los campos del vehículo. También puede republicar un vehículo reservado (cambia `reservado = false`). | `editarVehiculoScreen`, `detalleVehiculoScreen` |
| **DELETE** | Se eliminan primero las imágenes del Storage y luego la fila de la base de datos. | `detalleVehiculoScreen` |

### Usuarios (web)

| Operación | Descripción |
|---|---|
| **CREATE** | Registro con email, nombre, teléfono y contraseña. Supabase Auth envía un OTP de 8 dígitos. Tras verificarlo, se crea la fila en la tabla `usuario`. |
| **READ** | El perfil carga los datos del usuario desde la tabla `usuario` con fallback a `user_metadata`. |
| **UPDATE** | El usuario puede cambiar nombre, teléfono, email y contraseña desde la sección "Mi cuenta". |
| **DELETE** | Al eliminar la cuenta se borra la fila de `usuario`, lo que activa un trigger que borra también el registro en `auth.users`. |

### Reservas / Compras (web)

| Operación | Descripción |
|---|---|
| **CREATE** | Al reservar se inserta en `compra` y `detallecompra`. El vehículo se marca como `reservado = true`. Se envía email de confirmación. |
| **READ** | El usuario ve sus reservas en la sección "Mis reservas" del perfil. |
| **UPDATE** | El administrador puede republicar el vehículo (cambia `reservado = false`) si la reserva no se completa. |

### Solicitudes de visita (web + app)

| Operación | Descripción |
|---|---|
| **CREATE** | El cliente rellena el formulario de visita o cita de pago. Se inserta en `solicitudes_revision` con campo `tipo` (visita/pago). |
| **READ** | El administrador ve todas las solicitudes en la app móvil con filtros por estado. |
| **UPDATE** | El administrador acepta o rechaza cada solicitud cambiando el campo `estado`. |

---

## 6. Capturas de pruebas

Las capturas de pantalla del funcionamiento real de la aplicación se encuentran en la carpeta `docs/capturas/` del repositorio e incluyen:

- Catálogo de vehículos (escritorio y móvil)
- Proceso de registro y verificación OTP
- Detalle de vehículo y modal de reserva
- Modal de información sobre la bonificación (350 €)
- Formulario de solicitud de visita
- Perfil de usuario con reservas
- Panel de solicitudes en la app Android
- Notificación push al recibir una nueva solicitud
- Formularios de soporte

---

## 7. Explicación del despliegue

### Web — Vercel

1. Conectar el repositorio de GitHub a Vercel desde [vercel.com](https://vercel.com).
2. Configurar el directorio raíz como `web/` (o la carpeta que contenga `index.html`).
3. No se requiere paso de build — es un sitio estático.
4. Tras el despliegue, copiar la URL generada (p. ej. `https://admotors.vercel.app`).
5. En Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://admotors.vercel.app`
   - **Redirect URLs**: `https://admotors.vercel.app/**`

### App Android — EAS Build

1. Instalar EAS CLI: `npm install -g eas-cli`
2. Autenticarse: `eas login`
3. Generar APK de prueba: `eas build --platform android --profile preview`
4. Generar AAB para Play Store: `eas build --platform android --profile production`
5. Descargar el APK desde el panel de [expo.dev](https://expo.dev) e instalarlo en el dispositivo.