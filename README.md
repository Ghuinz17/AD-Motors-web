# 🌐 AD Motor's — Plataforma Web

**Plataforma web para la gestión y venta de vehículos de segunda mano, desarrollada con HTML, CSS y JavaScript vanilla con un servicio de base de datos en la nube como backend.**

![Backend](https://img.shields.io/badge/Backend-PostgreSQL-green)
![Correo](https://img.shields.io/badge/Correo-transaccional-blue)
[![Font%20Awesome](https://img.shields.io/badge/Font%20Awesome-6.5-purple)](https://fontawesome.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📱 Descripción

**AD Motor's Web** es la plataforma pública del concesionario. Permite a los clientes explorar el catálogo de vehículos disponibles, solicitar visitas personales y gestionar su cuenta. Incluye un sistema de autenticación por OTP y un formulario de soporte.

---

## ✅ Características principales

- 🔍 Catálogo con búsqueda y filtros avanzados (combustible, transmisión, color, año y precio)
- 🚗 Detalle de vehículo con galería de imágenes y lightbox
- ⚙️ Transmisión (manual/automática) y potencia en CV en cada vehículo
- 🔀 Orden destacado del catálogo, ajustable arrastrando en el modo administrador
- 📅 Solicitud de visita con selección de fecha y hora
- 🔐 Autenticación por email con código OTP de 8 dígitos
- 👤 Perfil de usuario con historial de solicitudes
- ✉️ Notificaciones por email automáticas (servicio de correo + backend)
- 🌙 Tema claro y oscuro
- 📞 Formulario de soporte y ayuda
- 📱 Diseño completamente responsive

---

## 🛠️ Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Servicio de base de datos en la nube (PostgreSQL, Auth, Storage) |
| Email | Servicio de correo transaccional |
| Iconos | Font Awesome 6 |
| Tipografía | Google Fonts — Barlow, Barlow Condensed |
| Despliegue | Vercel |

---

## 💻 Uso

### Para el cliente
1. Navega por el catálogo de vehículos
2. Regístrate o inicia sesión con tu email
3. Confirma tu cuenta con el código de 8 dígitos que recibirás por correo
4. Solicita una visita personal
5. Gestiona tus solicitudes desde tu perfil

### Para el administrador
- Los vehículos se gestionan desde la **app móvil de administración**
- Las solicitudes de visita se aceptan o rechazan desde la app

---

## 📧 Notificaciones por email

La plataforma envía emails automáticos para los siguientes eventos:

- ✅ Confirmación de cuenta (OTP)
- 📅 Solicitud de visita registrada
- 🔑 Restablecimiento de contraseña
- ✉️ Cambio de dirección de correo

---

## 🌍 Despliegue

La web está desplegada como sitio estático en **Vercel**.

Tras el despliegue, configura en el panel de tu backend:
- **Authentication > URL Configuration** — establece la URL del sitio
- **Redirect URLs** — añade el dominio de Vercel

---

## 📚 Documentación

- 📋 [Documentación técnica](docs/documentacion-tecnica.md)
- 👤 [Manual de usuario](docs/manual-usuario.md)
- ⚙️ [Manual de instalación](docs/manual-instalacion.md)

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

---

## 👨‍💻 Autor

**Antonio José Molero Pérez**

- GitHub: [@Ghuinz17](https://github.com/Ghuinz17)
- Email: ajmolero797@gmail.com

---

## 🤝 Desarrollado para AD Motor's

Este proyecto ha sido desarrollado en colaboración con **AD Motor's**.

📸 **Instagram** — [vehiculosadmotors](https://www.instagram.com/vehiculosadmotors)  
👥 **Facebook** — [AD Motors](https://www.facebook.com/people/AD-Motors/61584583105868/)  
🎵 **TikTok** — Próximamente