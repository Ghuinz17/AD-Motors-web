// ============================================================
// js/admin.js — Modo administrador
// Crear, editar y eliminar vehículos, cambiar su estado y gestionar imágenes.
//
// IMPORTANTE: la comprobación de este archivo solo decide qué se MUESTRA.
// La seguridad real la imponen las políticas RLS de Supabase (función es_admin()):
// aunque alguien manipule este código, la base de datos rechaza sus escrituras.
// ============================================================

const BUCKET = 'ad-motors-images';
const MAX_IMG_BYTES = 5 * 1024 * 1024;
const TIPOS_IMG = ['image/jpeg', 'image/png', 'image/webp'];
const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'HIBRIDO', 'ELECTRICO'];

// Alias local del helper global definido en ui.js
const esc = (value) => escapeHtml(value);

function statusRibbonHTML(estado) {
  const labels = { reservado: 'Reservado', vendido: 'Vendido' };
  const label = labels[estado];
  if (!label) return '';
  return `<div class="status-ribbon-wrap"><span class="status-ribbon status-${safeId(estado)}">${esc(label)}</span></div>`;
}

let vehiculos     = [];   // lista cargada desde la BD
let editandoId    = null; // id del vehículo en edición (null = nuevo)
let imgExistentes = [];   // [{ id, imagen, url }] ya guardadas del vehículo en edición
let imgABorrar    = [];   // ids de imagen marcadas para borrar al guardar
let imgNuevas     = [];   // [File] seleccionadas y pendientes de subir
let eliminarId    = null; // id pendiente de confirmar eliminación

// ─── Acceso: solo usuarios presentes en la tabla administradores ────────────
async function comprobarAdmin() {
  const check = document.getElementById('adminCheck');
  try {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return denegar('Inicia sesión para continuar');

    // La comprobación se hace en el servidor (función es_admin()).
    // La tabla administradores no es legible libremente desde el cliente.
    const { data: esAdmin, error } = await db.rpc('es_admin');
    if (error || !esAdmin) return denegar('No tienes permisos de administrador');

    check.classList.add('hidden');
    document.getElementById('adminContent').classList.remove('hidden');
    await cargarVehiculos();
  } catch (_) {
    denegar('No se pudo comprobar el acceso');
  }
}

function denegar(msg) {
  showToast(msg, 'error');
  setTimeout(() => { window.location.href = '../index.html'; }, 1600);
}

// ─── Lista de vehículos ─────────────────────────────────────────────────────
async function cargarVehiculos() {
  const { data, error } = await db
    .from('vehiculo')
    .select('id_vehiculo,marca,modelo,descripcion,precio,ano_fabricacion,tipo_combustible,kilometraje,color,estado,reservado,fecha_creacion,fecha_actualizacion,vehiculo_imagenes(id,imagen)')
    .order('fecha_creacion', { ascending: false });

  if (error) { showToast('No se pudieron cargar los vehículos', 'error'); return; }
  vehiculos = data || [];
  renderLista();
}

function urlImagen(path) {
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function renderLista() {
  const cont = document.getElementById('adminList');
  document.getElementById('adminCount').textContent =
    `${vehiculos.length} vehículo${vehiculos.length !== 1 ? 's' : ''} en el catálogo`;

  if (!vehiculos.length) {
    cont.innerHTML = '<div class="admin-check">Todavía no hay vehículos. Pulsa «Nuevo vehículo».</div>';
    return;
  }

  cont.innerHTML = vehiculos.map(v => {
    const img = v.vehiculo_imagenes?.[0] ? urlImagen(v.vehiculo_imagenes[0].imagen) : '';
    const nombre = esc(`${v.marca || ''} ${v.modelo || ''}`.trim() || 'Vehículo');
    const id = safeId(v.id_vehiculo);
    return `
      <div class="admin-row">
        <div class="admin-thumb">
          ${statusRibbonHTML(v.estado)}
          ${img ? `<img src="${esc(img)}" alt="${nombre}" loading="lazy">` : ''}
        </div>
        <div class="admin-info">
          <div class="admin-name">${nombre}</div>
          <div class="admin-meta">
            ${esc(v.ano_fabricacion)} · ${Number(v.kilometraje || 0).toLocaleString('es-ES')} km · ${esc(v.tipo_combustible)}${v.color ? ' · ' + esc(v.color) : ''}
          </div>
          <div class="admin-price">${Number(v.precio || 0).toLocaleString('es-ES')} €</div>
        </div>
        <div class="admin-actions">
          <button class="btn btn-secondary btn-estado ${v.estado === 'reservado' ? 'on-reservado' : ''}" onclick="alternarEstado('${id}','reservado')">
            <i class="fa-solid fa-bookmark"></i> Reservado
          </button>
          <button class="btn btn-secondary btn-estado ${v.estado === 'vendido' ? 'on-vendido' : ''}" onclick="alternarEstado('${id}','vendido')">
            <i class="fa-solid fa-circle-check"></i> Vendido
          </button>
          <button class="btn btn-outline" onclick="abrirFormulario('${id}')"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn btn-danger" onclick="pedirEliminar('${id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

// ─── Estado rápido: pulsar de nuevo el estado activo lo quita ──────────────
async function alternarEstado(id, estado) {
  const v = vehiculos.find(x => x.id_vehiculo === id);
  if (!v) return;
  const nuevo = v.estado === estado ? null : estado;
  const { error } = await db.from('vehiculo')
    .update({ estado: nuevo, fecha_actualizacion: new Date().toISOString() })
    .eq('id_vehiculo', id);
  if (error) { showToast('No se pudo cambiar el estado', 'error'); return; }
  v.estado = nuevo;
  renderLista();
  showToast(nuevo ? `Marcado como ${nuevo}` : 'Estado eliminado', 'success');
}

// ─── Formulario crear / editar ──────────────────────────────────────────────
function abrirFormulario(id) {
  limpiarErrores();
  editandoId = id || null;
  imgABorrar = [];
  imgNuevas  = [];
  imgExistentes = [];

  const v = id ? vehiculos.find(x => x.id_vehiculo === id) : null;
  document.getElementById('modalVehiculoTitulo').textContent = v ? 'Editar vehículo' : 'Nuevo vehículo';

  setVal('vMarca',        v?.marca || '');
  setVal('vModelo',       v?.modelo || '');
  setVal('vDescripcion',  v?.descripcion || '');
  setVal('vAno',          v?.ano_fabricacion ?? new Date().getFullYear());
  setVal('vPrecio',       v?.precio ?? '');
  setVal('vKm',           v?.kilometraje ?? '');
  setVal('vColor',        v?.color || '');
  setVal('vCombustible',  v?.tipo_combustible || 'GASOLINA');
  setVal('vEstado',       v?.estado || '');

  imgExistentes = (v?.vehiculo_imagenes || []).map(i => ({ id: i.id, imagen: i.imagen, url: urlImagen(i.imagen) }));
  renderMiniaturas();
  openModal('modalVehiculo');
}

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function getVal(id)      { return (document.getElementById(id)?.value || '').trim(); }

function renderMiniaturas() {
  document.getElementById('imgExistentes').innerHTML = imgExistentes
    .filter(i => !imgABorrar.includes(i.id))
    .map(i => `
      <div class="thumb-item">
        <img src="${esc(i.url)}" alt="">
        <button type="button" class="thumb-del" onclick="quitarExistente('${safeId(i.id)}')" title="Quitar"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');

  const nuevas = document.getElementById('imgNuevas');
  nuevas.innerHTML = '';
  imgNuevas.forEach((file, idx) => {
    const div = document.createElement('div');
    div.className = 'thumb-item nueva';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'thumb-del'; btn.title = 'Quitar';
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    btn.onclick = () => { imgNuevas.splice(idx, 1); renderMiniaturas(); };
    div.append(img, btn);
    nuevas.appendChild(div);
  });
}

function quitarExistente(id) { imgABorrar.push(id); renderMiniaturas(); }

function onSeleccionImagenes(e) {
  for (const file of e.target.files) {
    if (!TIPOS_IMG.includes(file.type)) { showToast(`«${file.name}»: formato no permitido`, 'error'); continue; }
    if (file.size > MAX_IMG_BYTES)      { showToast(`«${file.name}» supera los 5 MB`, 'error'); continue; }
    imgNuevas.push(file);
  }
  e.target.value = '';
  renderMiniaturas();
}

// ─── Validación ─────────────────────────────────────────────────────────────
function marcarError(id, msg) {
  document.getElementById(id)?.classList.add('error');
  const err = document.getElementById(id + 'Error');
  if (err) { err.textContent = msg; err.classList.add('show'); }
}
function limpiarErrores() {
  document.querySelectorAll('#formVehiculo .form-input').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('#formVehiculo .form-error').forEach(el => el.classList.remove('show'));
}

function validar() {
  limpiarErrores();
  let ok = true;
  const anoMax = new Date().getFullYear() + 1;

  if (!getVal('vMarca'))  { marcarError('vMarca',  'Introduce la marca');  ok = false; }
  if (!getVal('vModelo')) { marcarError('vModelo', 'Introduce el modelo'); ok = false; }

  const ano = parseInt(getVal('vAno'), 10);
  if (!/^\d{4}$/.test(getVal('vAno')) || ano < 1900 || ano > anoMax) { marcarError('vAno', `Año entre 1900 y ${anoMax}`); ok = false; }

  const precio = parseFloat(getVal('vPrecio').replace(',', '.'));
  if (!(precio > 0) || precio > 99999999) { marcarError('vPrecio', 'Precio mayor que 0'); ok = false; }

  const km = parseInt(getVal('vKm'), 10);
  if (!/^\d+$/.test(getVal('vKm')) || km < 0) { marcarError('vKm', 'Kilometraje válido (solo números)'); ok = false; }

  if (!COMBUSTIBLES.includes(getVal('vCombustible'))) ok = false;
  return ok;
}

// ─── Guardar ────────────────────────────────────────────────────────────────
async function guardarVehiculo(e) {
  e.preventDefault();
  if (!validar()) return;

  const btn = document.getElementById('btnGuardarVehiculo');
  setLoading(btn, true);

  const fila = {
    marca:               getVal('vMarca'),
    modelo:              getVal('vModelo'),
    descripcion:         getVal('vDescripcion') || null,
    ano_fabricacion:     parseInt(getVal('vAno'), 10),
    precio:              parseFloat(getVal('vPrecio').replace(',', '.')),
    kilometraje:         parseInt(getVal('vKm'), 10),
    color:               getVal('vColor') || null,
    tipo_combustible:    getVal('vCombustible'),
    estado:              getVal('vEstado') || null,
    fecha_actualizacion: new Date().toISOString(),
  };

  try {
    let id = editandoId;

    if (id) {
      const { error } = await db.from('vehiculo').update(fila).eq('id_vehiculo', id);
      if (error) throw error;
    } else {
      const { data, error } = await db.from('vehiculo').insert([fila]).select('id_vehiculo').single();
      if (error) throw error;
      id = data.id_vehiculo;
    }

    await borrarImagenesMarcadas();
    const fallos = await subirImagenesNuevas(id);

    closeModal('modalVehiculo');
    await cargarVehiculos();
    showToast(fallos ? `Guardado, pero ${fallos} imagen(es) no se pudieron subir` : 'Vehículo guardado', fallos ? 'info' : 'success');
  } catch (_) {
    showToast('No se pudo guardar el vehículo', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function borrarImagenesMarcadas() {
  if (!imgABorrar.length) return;
  const rutas = imgExistentes.filter(i => imgABorrar.includes(i.id)).map(i => i.imagen);
  if (rutas.length) await db.storage.from(BUCKET).remove(rutas);
  await db.from('vehiculo_imagenes').delete().in('id', imgABorrar);
}

// Devuelve cuántas imágenes fallaron
async function subirImagenesNuevas(vehiculoId) {
  let fallos = 0;
  for (let i = 0; i < imgNuevas.length; i++) {
    const file = imgNuevas[i];
    const ext  = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const ruta = `${vehiculoId}-${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(ruta, file, { contentType: file.type });
    if (upErr) { fallos++; continue; }
    const { error: dbErr } = await db.from('vehiculo_imagenes').insert([{ id_vehiculo: vehiculoId, imagen: ruta }]);
    if (dbErr) { fallos++; await db.storage.from(BUCKET).remove([ruta]); }
  }
  return fallos;
}

// ─── Eliminar ───────────────────────────────────────────────────────────────
function pedirEliminar(id) {
  const v = vehiculos.find(x => x.id_vehiculo === id);
  if (!v) return;
  eliminarId = id;
  document.getElementById('eliminarNombre').textContent = `${v.marca || ''} ${v.modelo || ''}`.trim();
  openModal('modalEliminar');
}

async function confirmarEliminar() {
  if (!eliminarId) return;
  const btn = document.getElementById('btnConfirmarEliminar');
  setLoading(btn, true);
  try {
    const v = vehiculos.find(x => x.id_vehiculo === eliminarId);
    const rutas = (v?.vehiculo_imagenes || []).map(i => i.imagen);
    if (rutas.length) await db.storage.from(BUCKET).remove(rutas);

    // Las filas de vehiculo_imagenes se borran solas (ON DELETE CASCADE)
    const { error } = await db.from('vehiculo').delete().eq('id_vehiculo', eliminarId);
    if (error) throw error;

    closeModal('modalEliminar');
    eliminarId = null;
    await cargarVehiculos();
    showToast('Vehículo eliminado', 'success');
  } catch (_) {
    showToast('No se pudo eliminar el vehículo', 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ─── Arranque ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  comprobarAdmin();
  document.getElementById('btnNuevo')?.addEventListener('click', () => abrirFormulario(null));
  document.getElementById('formVehiculo')?.addEventListener('submit', guardarVehiculo);
  document.getElementById('vImagenes')?.addEventListener('change', onSeleccionImagenes);
  document.getElementById('btnConfirmarEliminar')?.addEventListener('click', confirmarEliminar);

  // Solo dígitos en año, kilometraje y precio
  [['vAno', /[^0-9]/g], ['vKm', /[^0-9]/g], ['vPrecio', /[^0-9.,]/g]].forEach(([id, re]) => {
    document.getElementById(id)?.addEventListener('input', e => { e.target.value = e.target.value.replace(re, ''); });
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));
});