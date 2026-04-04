// ============================================================
// js/detalle.js — Galería, compra, solicitud de visita
// ============================================================

let vehiculo   = null;
let imagenes   = [];
let currentImg = 0;
let currentUser = null;

const vehiculoId = new URLSearchParams(window.location.search).get('id');

async function init() {
  if (!vehiculoId) { window.location.href = '../index.html'; return; }

  const { data: { user } } = await db.auth.getUser();
  currentUser = user;

  await loadVehiculo();
}

async function loadVehiculo() {
  try {
    const { data, error } = await db
      .from('vehiculo')
      .select('*, vehiculo_imagenes(imagen)')
      .eq('id_vehiculo', vehiculoId)
      .single();

    if (error || !data) { showToast('Vehículo no encontrado', 'error'); setTimeout(() => window.location.href='../index.html', 1500); return; }

    vehiculo = data;
    imagenes = (data.vehiculo_imagenes || []).map(i => {
      const { data: u } = db.storage.from('ad-motors-images').getPublicUrl(i.imagen);
      return u.publicUrl;
    });

    renderPage();
  } catch(e) {
    showToast('Error al cargar el vehículo', 'error');
  }
}

function renderPage() {
  // Título
  document.title = `${vehiculo.marca_modelo} — AD Motors`;

  // Breadcrumb
  const bc = document.getElementById('breadcrumbName');
  if (bc) bc.textContent = vehiculo.marca_modelo;

  // Galería
  renderGallery();

  // Info
  setValue('detailName', vehiculo.marca_modelo);
  setValue('detailYear', vehiculo.ano_fabricacion);
  setValue('detailPrice', vehiculo.precio?.toLocaleString('es-ES') + ' €');
  setValue('detailDescripcion', vehiculo.descripcion || 'Sin descripción disponible.');

  // Specs
  const specs = [
    { icon: '📅', label: 'Año',         value: vehiculo.ano_fabricacion },
    { icon: '🏎️', label: 'Kilometraje', value: vehiculo.kilometraje?.toLocaleString('es-ES') + ' km' },
    { icon: '⛽', label: 'Combustible', value: vehiculo.tipo_combustible },
    { icon: '🎨', label: 'Color',       value: vehiculo.color || '—' },
  ];
  const specsCont = document.getElementById('specsList');
  if (specsCont) specsCont.innerHTML = specs.map(s => `
    <div class="spec-row">
      <div class="spec-label"><span>${s.icon}</span>${s.label}</div>
      <div class="spec-value">${s.value}</div>
    </div>`).join('');

  // Reservado
  if (vehiculo.reservado) {
    document.getElementById('btnComprar')?.setAttribute('disabled', true);
    document.getElementById('btnRealizarCompra')?.setAttribute('disabled', true);
    const badge = document.getElementById('reservadoBadge');
    if (badge) badge.classList.remove('hidden');
  }

  // Animaciones de entrada
  document.querySelectorAll('.anim-up').forEach((el, i) => {
    el.style.animationDelay = `${i * 0.08}s`;
  });
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ---- GALERÍA ----
function renderGallery() {
  const noImgPlaceholder = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><rect fill='%23242424' width='800' height='500'/><text fill='%23555' font-size='20' x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>Sin imagen</text></svg>`;

  if (imagenes.length === 0) imagenes = [noImgPlaceholder];

  const mainImg   = document.getElementById('galleryMainImg');
  const counter   = document.getElementById('galleryCounter');
  const thumbsCont = document.getElementById('galleryThumbs');

  if (mainImg) mainImg.src = imagenes[0];
  if (counter) counter.textContent = `1 / ${imagenes.length}`;

  if (thumbsCont) {
    thumbsCont.innerHTML = imagenes.map((url, i) => `
      <div class="gallery-thumb ${i===0?'active':''}" onclick="setImage(${i})">
        <img src="${url}" alt="Imagen ${i+1}" loading="lazy">
      </div>`).join('');
  }
}

function setImage(index) {
  currentImg = index;
  const mainImg = document.getElementById('galleryMainImg');
  const counter = document.getElementById('galleryCounter');
  if (mainImg) { mainImg.style.opacity='0'; setTimeout(() => { mainImg.src=imagenes[index]; mainImg.style.opacity='1'; }, 150); }
  if (counter) counter.textContent = `${index+1} / ${imagenes.length}`;
  document.querySelectorAll('.gallery-thumb').forEach((t,i) => t.classList.toggle('active', i===index));
}

function prevImage() { setImage((currentImg - 1 + imagenes.length) % imagenes.length); }
function nextImage() { setImage((currentImg + 1) % imagenes.length); }

function openLightbox() {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (lb && img) { img.src = imagenes[currentImg]; lb.classList.add('open'); }
}
function closeLightbox() { document.getElementById('lightbox')?.classList.remove('open'); }

// ---- COMPRA ----
async function handleComprar() {
  if (!currentUser) {
    showToast('Debes iniciar sesión para comprar', 'error');
    setTimeout(() => window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.href)}`, 1500);
    return;
  }
  window.location.href = `pago.html?id=${vehiculoId}`;
}

async function handleRealizarCompra() {
  if (!currentUser) {
    showToast('Debes iniciar sesión para comprar', 'error');
    setTimeout(() => window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.href)}`, 1500);
    return;
  }
  openModal('modalConfirmarCompra');
}

async function confirmarCompra() {
  const btn = document.getElementById('btnConfirmarCompra');
  setLoading(btn, true);
  try {
    // 1. Crear compra
    const { data: compraData, error: compraError } = await db.from('compra').insert([{
      fecha: new Date().toISOString(),
      total: vehiculo.precio,
      estado: 'COMPLETADA',
      id_usuario: currentUser.id,
    }]).select().single();
    if (compraError) throw compraError;

    // 2. Crear detalle
    await db.from('detallecompra').insert([{
      id_compra: compraData.id_compra,
      id_vehiculo: vehiculoId,
      cantidad: 1,
      precio_unitario: vehiculo.precio,
    }]);

    // 3. Marcar vehículo como reservado
    await db.from('vehiculo').update({ reservado: true, fecha_reserva: new Date().toISOString() }).eq('id_vehiculo', vehiculoId);

    // 4. Enviar email de confirmación
    const { data: userData } = await db.from('usuario').select('nombre, email').eq('id_usuario', currentUser.id).single();
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_COMPRA, {
      nombre:    userData?.nombre || currentUser.email,
      vehiculo:  vehiculo.marca_modelo,
      precio:    vehiculo.precio?.toLocaleString('es-ES') + ' €',
      id_compra: compraData.id_compra,
      to_email:  currentUser.email,
    });

    closeModal('modalConfirmarCompra');
    showToast('¡Compra realizada! Revisa tu correo 📧', 'success');
    setTimeout(() => window.location.href = '../index.html', 2500);
  } catch(err) {
    showToast('Error al procesar la compra: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ---- SOLICITUD VISITA ----
async function handleSolicitarVisita() {
  if (!currentUser) {
    showToast('Debes iniciar sesión para solicitar una visita', 'error');
    setTimeout(() => window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.href)}`, 1500);
    return;
  }
  // Pre-rellenar nombre y teléfono si existen
  const { data } = await db.from('usuario').select('nombre,phone').eq('id_usuario', currentUser.id).single();
  if (data) {
    const nameInp = document.getElementById('visitaNombre');
    const telInp  = document.getElementById('visitaTelefono');
    if (nameInp && data.nombre) nameInp.value = data.nombre;
    if (telInp  && data.phone)  telInp.value  = data.phone;
  }

  // Fecha mínima: mañana
  const minDate = new Date(); minDate.setDate(minDate.getDate() + 1);
  const fechaInp = document.getElementById('visitaFecha');
  if (fechaInp) fechaInp.min = minDate.toISOString().split('T')[0];

  openModal('modalVisita');
}

async function handleSubmitVisita(e) {
  e.preventDefault();
  const nombre = document.getElementById('visitaNombre')?.value.trim();
  const tel    = document.getElementById('visitaTelefono')?.value.trim();
  const fecha  = document.getElementById('visitaFecha')?.value;
  const hora   = document.getElementById('visitaHora')?.value;

  if (!nombre || !tel || !fecha || !hora) { showToast('Rellena todos los campos', 'error'); return; }

  const btn = document.getElementById('btnSubmitVisita');
  setLoading(btn, true);
  try {
    // Guardar en BD
    await db.from('solicitudes_revision').insert([{
      id_vehiculo: vehiculoId,
      marca_modelo: vehiculo.marca_modelo,
      nombre_asistente: nombre,
      telefono: tel,
      fecha_visita: fecha,
      hora_visita: hora,
    }]);

    const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const now = new Date().toLocaleString('es-ES');

    // Email al cliente
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_VISITA_CLIENTE, {
      nombre, vehiculo: vehiculo.marca_modelo,
      fecha: fechaFormateada, hora,
      telefono: tel, to_email: currentUser.email,
    });

    // Email al admin
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_VISITA_ADMIN, {
      nombre, telefono: tel,
      vehiculo: vehiculo.marca_modelo,
      fecha: fechaFormateada, hora,
      fecha_solicitud: now,
      to_email: ADMIN_EMAIL,
    });

    closeModal('modalVisita');
    openModal('modalVisitaConfirmada');
  } catch(err) {
    showToast('Error al enviar la solicitud: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('btnComprar')?.addEventListener('click', handleComprar);
  document.getElementById('btnRealizarCompra')?.addEventListener('click', handleRealizarCompra);
  document.getElementById('btnSolicitarVisita')?.addEventListener('click', handleSolicitarVisita);
  document.getElementById('btnConfirmarCompra')?.addEventListener('click', confirmarCompra);
  document.getElementById('formVisita')?.addEventListener('submit', handleSubmitVisita);
  document.getElementById('galleryMainImg')?.addEventListener('click', openLightbox);
  document.getElementById('lightbox')?.addEventListener('click', e => { if(e.target===e.currentTarget) closeLightbox(); });

  // Teclado galería
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  prevImage();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'Escape')     closeLightbox();
  });

  // Cerrar modales al hacer click fuera
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target===overlay) overlay.classList.remove('open'); });
  });
});