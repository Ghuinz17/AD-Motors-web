// Galería y solicitud de visita

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
  // Título — compatibilidad con marca_modelo y con marca+modelo separados
  const nombreCompleto = vehiculo.marca && vehiculo.modelo
    ? `${vehiculo.marca} ${vehiculo.modelo}`
    : vehiculo.marca_modelo || 'Vehículo';

  document.title = `${nombreCompleto} — AD Motors`;

  const bc = document.getElementById('breadcrumbName');
  if (bc) bc.textContent = nombreCompleto;

  renderGallery();

  // Estado (vendido / reservado) visible para todos los usuarios
  const galleryMain = document.querySelector('.gallery-main');
  if (galleryMain) {
    galleryMain.querySelector('.status-ribbon-wrap')?.remove();
    galleryMain.insertAdjacentHTML('beforeend', estadoRibbonHTML(vehiculo));
  }

  // Vendido o reservado: sin botón de visita, con aviso en su lugar.
  const btnVisita = document.getElementById('btnSolicitarVisita');
  const aviso = document.getElementById('avisoNoDisponible');
  const avisoTexto = document.getElementById('avisoNoDisponibleTexto');
  if (!vehiculoDisponible(vehiculo)) {
    btnVisita?.classList.add('hidden');
    if (aviso) {
      if (avisoTexto) {
        avisoTexto.textContent = estadoVehiculo(vehiculo) === 'vendido'
          ? 'Este vehículo ya está vendido y no admite solicitudes de visita.'
          : 'Este vehículo está reservado y no admite solicitudes de visita.';
      }
      aviso.classList.remove('hidden');
    }
  } else {
    btnVisita?.classList.remove('hidden');
    aviso?.classList.add('hidden');
  }

  setValue('detailName', nombreCompleto);
  setValue('detailYear', vehiculo.ano_fabricacion);
  setValue('detailPrice', vehiculo.precio?.toLocaleString('es-ES') + ' €');
  setValue('detailDescripcion', vehiculo.descripcion || 'Sin descripción disponible.');

  // Specs
  const specs = [
    { icon: 'fa-calendar',    label: 'Año',          value: vehiculo.ano_fabricacion },
    { icon: 'fa-gauge-high',  label: 'Kilometraje',  value: vehiculo.kilometraje?.toLocaleString('es-ES') + ' km' },
    { icon: 'fa-gas-pump',    label: 'Combustible',  value: vehiculo.tipo_combustible },
    { icon: 'fa-gear',        label: 'Transmisión',  value: formatoTransmision(vehiculo.transmision) },
    { icon: 'fa-bolt',        label: 'Potencia',     value: formatoPotencia(vehiculo.potencia) },
    { icon: 'fa-palette',     label: 'Color',        value: vehiculo.color || '—' },
  ];
  const specsCont = document.getElementById('specsList');
  if (specsCont) specsCont.innerHTML = specs.map(s => `
    <div class="spec-row">
      <div class="spec-label"><i class="fa-solid fa-${s.icon}"></i>${s.label}</div>
      <div class="spec-value">${escapeHtml(s.value)}</div>
    </div>`).join('');

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

// ---- SOLICITUD VISITA ----
async function handleSolicitarVisita() {
  if (!vehiculo || !vehiculoDisponible(vehiculo)) {
    showToast('Este vehículo no admite solicitudes de visita', 'error');
    return;
  }
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

  // Fecha mínima: mañana en hora local (no UTC)
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const minDateStr = `${manana.getFullYear()}-${String(manana.getMonth()+1).padStart(2,'0')}-${String(manana.getDate()).padStart(2,'0')}`;
  const fechaInp = document.getElementById('visitaFecha');
  if (fechaInp) {
    fechaInp.min = minDateStr;
    // Si hay una fecha ya seleccionada y es anterior a mañana, limpiarla
    if (fechaInp.value && fechaInp.value < minDateStr) fechaInp.value = '';
  }

  openModal('modalVisita');
  clearAllFieldErrors();
}

// --- Helpers de validación para el modal de visita ---
function showFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  const icon  = input?.closest('.input-wrap')?.querySelector('.input-icon');
  if (input) {
    input.classList.remove('error');
    void input.offsetWidth;
    input.classList.add('error');
    input.style.setProperty('border-color', '#ef4444', 'important');
    input.style.setProperty('box-shadow',   '0 0 0 3px rgba(239,68,68,.18)', 'important');
    input.style.setProperty('background',   'rgba(239,68,68,.04)', 'important');
  }
  if (icon) icon.style.color = '#ef4444';
  // Añadir o actualizar mensaje de error debajo del campo
  let errEl = document.getElementById(inputId + 'VisitaError');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = inputId + 'VisitaError';
    errEl.style.cssText = 'font-size:.76rem;color:#ef4444;margin-top:.3rem';
    input?.parentElement?.insertAdjacentElement('afterend', errEl);
  }
  errEl.textContent = msg;
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const icon  = input?.closest('.input-wrap')?.querySelector('.input-icon');
  if (input) {
    input.classList.remove('error');
    input.style.removeProperty('border-color');
    input.style.removeProperty('box-shadow');
    input.style.removeProperty('background');
  }
  if (icon) icon.style.color = '';
  const errEl = document.getElementById(inputId + 'VisitaError');
  if (errEl) errEl.textContent = '';
}

function clearAllFieldErrors() {
  ['visitaNombre','visitaTelefono','visitaFecha','visitaHora'].forEach(clearFieldError);
}

async function handleSubmitVisita(e) {
  e.preventDefault();
  clearAllFieldErrors();

  const nombre = document.getElementById('visitaNombre')?.value.trim();
  const tel    = document.getElementById('visitaTelefono')?.value.trim();
  const fecha  = document.getElementById('visitaFecha')?.value;
  const hora   = document.getElementById('visitaHora')?.value;

  // Validar todos los campos y marcar en rojo los que fallen
  let ok = true;
  if (!nombre || nombre.length < 2) {
    showFieldError('visitaNombre', 'Introduce el nombre del asistente'); ok = false;
  }
  if (!tel || !/^[0-9+\s]{9,15}$/.test(tel)) {
    showFieldError('visitaTelefono', 'Introduce un teléfono válido'); ok = false;
  }
  if (!fecha) {
    showFieldError('visitaFecha', 'Selecciona una fecha'); ok = false;
  } else {
    const hoy = new Date();
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    const minStr = `${manana.getFullYear()}-${String(manana.getMonth()+1).padStart(2,'0')}-${String(manana.getDate()).padStart(2,'0')}`;
    if (fecha < minStr) {
      showFieldError('visitaFecha', 'La fecha debe ser a partir de mañana'); ok = false;
    }
  }
  if (!hora) {
    showFieldError('visitaHora', 'Selecciona una hora'); ok = false;
  }
  if (!ok) return;

  // Revalidar en BD por si el vehículo se vendió/reservó con el modal abierto.
  try {
    const { data: fresco, error: errorEstado } = await db
      .from('vehiculo')
      .select('*')
      .eq('id_vehiculo', vehiculoId)
      .single();
    if (errorEstado) throw errorEstado;
    if (!vehiculoDisponible(fresco)) {
      closeModal('modalVisita');
      showToast('Este vehículo ya no admite solicitudes de visita', 'error');
      return;
    }
    vehiculo = { ...vehiculo, ...fresco };
  } catch(err) {
    showToast('No se pudo comprobar la disponibilidad del vehículo', 'error');
    return;
  }

  // Limpiar errores si todo OK y lanzar inputs en verde
  ['visitaNombre','visitaTelefono','visitaFecha','visitaHora'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.style.setProperty('border-color', 'var(--success)', 'important');
      input.style.removeProperty('box-shadow');
      input.style.removeProperty('background');
    }
  });

  const btn = document.getElementById('btnSubmitVisita');
  setLoading(btn, true);
  try {
    // Guardar en BD con id_usuario
    const { error: insertError } = await db.from('solicitudes_revision').insert([{
      id_vehiculo:      vehiculoId,
      id_usuario:       currentUser?.id || null,
      marca_modelo:     `${vehiculo.marca} ${vehiculo.modelo}`,
      nombre_asistente: nombre,
      telefono:         tel,
      fecha_visita:     fecha,
      hora_visita:      hora,
      tipo:             'visita',
    }]);
    if (insertError) throw insertError;

    const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const now = new Date().toLocaleString('es-ES');

    // Enviar email (no bloquear si falla)
    try {
      const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_VISITA_CLIENTE, {
        to_email:       currentUser.email,
        admin_email:    ADMIN_EMAIL,
        nombre,
        vehiculo:       `${vehiculo.marca} ${vehiculo.modelo}`,
        icono:          'V',
        titulo:         'Solicitud de visita registrada',
        subtitulo:      'Te contactaremos para confirmar',
        mensaje:        'Hemos recibido tu solicitud para ver el vehículo en persona. Nos pondremos en contacto contigo a la mayor brevedad posible para confirmar los detalles.',
        campo1_label:   'Fecha solicitada',
        campo1_valor:   fechaFormateada,
        campo2_label:   'Hora solicitada',
        campo2_valor:   hora,
        nota_final:     'Telefono de contacto: ' + tel + '. Si necesitas modificar la visita responde a este correo.',
        fecha_solicitud: now,
      });
      console.log('Email visita enviado:', result);
    } catch(emailErr) {
      console.error('Error email visita:', emailErr);
      showToast('Solicitud guardada (email no enviado)', 'info');
    }

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
  document.getElementById('btnSolicitarVisita')?.addEventListener('click', handleSolicitarVisita);
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