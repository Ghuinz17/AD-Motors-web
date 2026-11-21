# Seguridad — qué se puede ocultar y qué no

## 1. La regla más importante

Una web estática (HTML + CSS + JavaScript) **no puede ocultar su código al visitante**. El navegador necesita descargar el HTML, el CSS y el JavaScript para funcionar, y las herramientas de desarrollo (F12 → Sources / Network) siempre permiten verlos.

Lo que sí se puede hacer:

1. **Minificar y ofuscar** el JavaScript para que sea difícil de leer.
2. **No incluir secretos** en el cliente (contraseñas, `service_role`, emails personales, etc.).
3. **No enviar datos que el usuario no necesita** (consultas con columnas concretas, no `select('*')`).
4. **Impedir el acceso a datos ajenos en el servidor** con RLS. Esta es la única barrera real.
5. **Evitar XSS** para que un dato malicioso no robe la sesión del usuario.

> Si un dato llega al navegador, el usuario puede verlo. No hay forma de "ocultarlo" con CSS, JavaScript ni con un clic derecho bloqueado.

---

## 2. Qué es público por diseño

| Dato | ¿Es secreto? | Explicación |
|---|---|---|
| `SUPABASE_URL` | No | Es la dirección del proyecto. |
| `SUPABASE_ANON_KEY` | No | Clave pública. Su seguridad depende de RLS. |
| `EMAILJS_PUBLIC_KEY` | No | Clave pública del SDK. Se protege con dominios permitidos y límites. |
| IDs de servicio/plantilla de EmailJS | No | Identificadores, no credenciales. |
| `service_role` de Supabase | **SÍ** | Nunca debe estar en el frontend. Salta RLS. |
| Email del administrador | **SÍ** (dato personal) | Se configura en EmailJS, no en `config.js`. |
| Nombres, teléfonos, emails de clientes | **SÍ** | Solo el propio usuario y los administradores. |
| `device_id`, `created_at`, columnas internas | **SÍ** (interno) | No se envían al catálogo público. |

Si alguna vez se ha publicado la clave `service_role`, hay que **rotarla inmediatamente** en Supabase → Settings → API.

---

## 3. RLS: la barrera real

Ejecuta [`supabase/seguridad-rls.sql`](../supabase/seguridad-rls.sql) completo en el SQL Editor de Supabase.

El script:

- elimina las políticas antiguas permisivas;
- activa RLS en `usuario`, `vehiculo`, `vehiculo_imagenes`, `compra`, `detallecompra`, `solicitudes_revision` y `administradores`;
- crea `public.es_admin()`;
- permite al usuario leer/modificar solo sus filas;
- permite al administrador gestionar todo;
- restringe la escritura de Storage a administradores.

### Antes / después

| Tabla | Antes (peligroso) | Ahora |
|---|---|---|
| `solicitudes_revision` | `SELECT USING (true)` → cualquiera leía nombres y teléfonos de todos | Solo el dueño o un admin |
| `vehiculo` | `INSERT/UPDATE/DELETE USING (true)` → cualquiera modificaba el catálogo | Solo admin |
| `vehiculo_imagenes` | Escritura abierta | Solo admin |
| `compra` | Solo lectura propia | Lectura propia; admin ve todas |
| `detallecompra` | `INSERT WITH CHECK (true)` | Solo sobre una compra propia o admin |
| `administradores` | Sin políticas claras | Solo se puede consultar la fila propia |

### Cómo comprobarlo

1. Crea dos usuarios de prueba: A y B.
2. Inicia sesión como A.
3. En la consola del navegador ejecuta:

```js
await db.from('solicitudes_revision').select('*')
```

Solo deben aparecer las solicitudes de A. Si aparecen las de B, RLS no está aplicado.

4. Intenta modificar un vehículo como A:

```js
await db.from('vehiculo').update({ precio: 1 }).eq('id_vehiculo', 'ID')
```

Debe fallar o afectar a 0 filas.

5. Inicia sesión con un administrador y comprueba que el panel y la app móvil siguen funcionando.

---

## 4. Qué cambia en el frontend

- `config.js` ya **no contiene** el email del administrador.
- Las consultas usan **columnas concretas**, no `select('*')`:
  - el catálogo no recibe `device_id`, `created_at` ni `imagen`;
  - el perfil solo recibe `nombre`, `email` y `phone` del propio usuario;
  - las solicitudes solo reciben los campos que se muestran.
- Los datos de la base de datos se escapan antes de insertarse con `innerHTML` (`escapeHtml`), evitando XSS.
- Las redirecciones del login se validan con `safeRedirect` para evitar dominios externos.
- El panel de administración comprueba permisos con `db.rpc('es_admin')`, no leyendo la tabla `administradores`.
- Los `console.log` con datos se han eliminado; el build de producción elimina además todos los `console.*`.

---

## 5. Minificación y ofuscación

El proyecto incluye un build que:

- minifica todo el JavaScript y CSS;
- minifica los scripts inline del HTML;
- elimina `console.*` y `debugger`;
- **no genera source maps**;
- copia el resultado a `dist/`.

```bash
npm install
npm run build
```

El resultado queda en `dist/`. En Vercel, `vercel.json` ya configura `npm run build` y `dist` como salida.

Esto **no es seguridad**: solo hace que el código sea más difícil de leer. Un atacante con tiempo puede desminificarlo. La seguridad real está en RLS y en no enviar secretos.

---

## 6. Cabeceras de seguridad

`vercel.json` añade:

- `Content-Security-Policy` (limita scripts, estilos, imágenes y conexiones a los dominios necesarios);
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY` y `frame-ancestors 'none'` (evita clickjacking);
- `Referrer-Policy`;
- `Permissions-Policy`;
- `X-Robots-Tag: noindex` en las páginas privadas;
- `Cache-Control: no-store` en el panel de administración.

Si despliegas en otro hosting, configura esas mismas cabeceras en el servidor.

---

## 7. EmailJS

La clave pública de EmailJS se puede usar desde el navegador. Para reducir el abuso:

1. En EmailJS → **Account → Security → Allowed origins**, añade solo tu dominio de producción.
2. Activa los límites de envío.
3. En la plantilla de soporte, escribe el email del administrador directamente en **To email**. No lo envíes desde el cliente.
4. Si necesitas más seguridad, mueve el envío a una **Supabase Edge Function** que valide la sesión del usuario y guarde la clave privada en el servidor. El navegador nunca vería la clave ni el email del administrador.

---

## 8. Checklist antes de publicar

- [ ] Ejecutar `supabase/seguridad-rls.sql`.
- [ ] Probar con dos usuarios que no se ven datos ajenos.
- [ ] Comprobar que `solicitudes_revision` no devuelve filas de otros.
- [ ] Comprobar que un usuario normal no puede modificar `vehiculo`.
- [ ] Confirmar que no hay `service_role` en ningún archivo.
- [ ] Configurar dominios permitidos en EmailJS.
- [ ] Ejecutar `npm run build` y desplegar `dist/`.
- [ ] Revisar que `dist/js/config.js` no contiene el email del administrador.
- [ ] Si se publicó alguna clave privada, rotarla.
- [ ] Revisar las políticas de Storage del bucket `ad-motors-images`.

---

## 9. Lo que seguirá siendo visible

Aunque se aplique todo lo anterior, el visitante seguirá viendo:

- el catálogo público de vehículos;
- sus propios datos (nombre, email, reservas);
- la clave anon de Supabase y la clave pública de EmailJS;
- el código JavaScript minificado;
- las peticiones HTTP que hace su propio navegador.

Eso es normal. Lo que **no** debe poder ver es información de otros usuarios ni poder modificar datos que no le pertenecen. Eso se consigue con RLS, no ocultando el código.
