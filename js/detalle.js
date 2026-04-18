// Galería, compra, solicitud de visita


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

  setValue('detailName', nombreCompleto);
  setValue('detailYear', vehiculo.ano_fabricacion);
  setValue('detailPrice', vehiculo.precio?.toLocaleString('es-ES') + ' €');
  setValue('detailDescripcion', vehiculo.descripcion || 'Sin descripción disponible.');

  // Specs
  const specs = [
    { icon: 'fa-calendar',    label: 'Año',         value: vehiculo.ano_fabricacion },
    { icon: 'fa-gauge-high',  label: 'Kilometraje', value: vehiculo.kilometraje?.toLocaleString('es-ES') + ' km' },
    { icon: 'fa-gas-pump',    label: 'Combustible', value: vehiculo.tipo_combustible },
    { icon: 'fa-palette',     label: 'Color',       value: vehiculo.color || '—' },
  ];
  const specsCont = document.getElementById('specsList');
  if (specsCont) specsCont.innerHTML = specs.map(s => `
    <div class="spec-row">
      <div class="spec-label"><i class="fa-solid fa-${s.icon}"></i>${s.label}</div>
      <div class="spec-value">${s.value}</div>
    </div>`).join('');

  // Rellenar modal de reserva
  const modalNombre = document.getElementById('modalVehiculoNombre');
  const modalPrecio = document.getElementById('modalPrecioVehiculo');
  if (modalNombre) modalNombre.textContent = nombreCompleto;
  if (modalPrecio) modalPrecio.textContent = vehiculo.precio?.toLocaleString('es-ES') + ' €';

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

// ---- SELECTOR MÉTODO PAGO ----
function selectPayMethod(method) {
  ['card','paypal','bizum'].forEach(m => {
    document.getElementById(`method-${m}`)?.classList.toggle('active', m === method);
    const panel = document.getElementById(`panel-${m}`);
    if (panel) panel.style.display = m === method ? 'block' : 'none';
  });
}

// ---- PAGO SEÑAL (SIMULADO) ----
async function handlePagarSenal() {
  const btn = document.getElementById('btnPagarSenal');
  setLoading(btn, true);
  try {
    // Simular procesamiento 2s
    await new Promise(r => setTimeout(r, 2000));
    // Procesar reserva
    await confirmarCompra();
    closeModal('modalPasarela');
  } catch(err) {
    showToast('Error al procesar el pago: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

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
    // 1. Crear compra (id_metodo_pago = null para reserva sin pago online)
    const { data: compraData, error: compraError } = await db.from('compra').insert([{
      fecha:          new Date().toISOString(),
      total:          vehiculo.precio,
      estado:         'PENDIENTE',
      id_usuario:     currentUser.id,
      id_metodo_pago: null,
    }]).select().single();
    if (compraError) throw compraError;

    // 2. Crear detalle
    const { error: detalleError } = await db.from('detallecompra').insert([{
      id_compra:       compraData.id_compra,
      id_vehiculo:     vehiculoId,
      cantidad:        1,
      precio_unitario: vehiculo.precio,
    }]);
    if (detalleError) throw detalleError;

    // 3. Marcar vehículo como reservado (desaparece del catálogo)
    await db.from('vehiculo').update({
      reservado:     true,
      fecha_reserva: new Date().toISOString(),
    }).eq('id_vehiculo', vehiculoId);

    // 4. Intentar enviar email (no bloquear si falla)
    try {
      const { data: userData } = await db.from('usuario').select('nombre,email').eq('id_usuario', currentUser.id).single();
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_COMPRA, {
        to_email:      currentUser.email,
        nombre:        userData?.nombre || currentUser.email,
        vehiculo:      `${vehiculo.marca} ${vehiculo.modelo}`,
        icono:         '✓',
        titulo:        '¡Reserva confirmada!',
        subtitulo:     'Gracias por confiar en AD Motor\'s',
        mensaje:       'Hemos registrado tu reserva correctamente. En breve nos pondremos en contacto contigo para coordinar todos los detalles.',
        campo1_label:  'Nº de Pedido',
        campo1_valor:  compraData.id_compra?.slice(0,8).toUpperCase(),
        campo2_label:  'Precio vehículo',
        campo2_valor:  vehiculo.precio?.toLocaleString('es-ES') + ' €',
        fecha:         new Date().toLocaleDateString('es-ES', { year:'numeric', month:'long', day:'numeric' }),
        nota_final:    'Si tienes cualquier duda no dudes en contactarnos.',
      });
    } catch(emailErr) {
      console.warn('Email no enviado:', emailErr);
    }

    closeModal('modalConfirmarCompra');
    closeModal('modalPasarela');
    showToast('¡Reserva realizada! Recibirás un email de confirmación', 'success');
    setTimeout(() => window.location.href = '../index.html', 2500);
  } catch(err) {
    showToast('Error al procesar la reserva: ' + err.message, 'error');
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
  }
  if (!hora) {
    showFieldError('visitaHora', 'Selecciona una hora'); ok = false;
  }
  if (!ok) return;

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
      nombre_asistente: nombre,
      telefono:         tel,
      fecha_visita:     fecha,
      hora_visita:      hora,
    }]);
    if (insertError) throw insertError;

    const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const now = new Date().toLocaleString('es-ES');

    // Enviar email (no bloquear si falla)
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_VISITA_CLIENTE, {
        to_email:       currentUser.email,
        admin_email:    ADMIN_EMAIL,
        nombre,
        vehiculo:       `${vehiculo.marca} ${vehiculo.modelo}`,
        icono:          '📅',
        titulo:         'Solicitud de visita registrada',
        subtitulo:      'Te contactaremos para confirmar',
        mensaje:        'Hemos recibido tu solicitud para ver el vehículo en persona. Nos pondremos en contacto contigo a la mayor brevedad posible para confirmar los detalles.',
        campo1_label:   'Fecha solicitada',
        campo1_valor:   fechaFormateada,
        campo2_label:   'Hora solicitada',
        campo2_valor:   hora,
        nota_final:     `Teléfono de contacto: ${tel}. Si necesitas modificar la visita responde a este correo.`,
        fecha_solicitud: now,
      });
    } catch(emailErr) {
      console.warn('Email no enviado:', emailErr);
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
  document.getElementById('btnRealizarCompra')?.addEventListener('click', handleRealizarCompra);
  document.getElementById('btnIrPasarela')?.addEventListener('click', () => {
    closeModal('modalConfirmarCompra');
    openModal('modalPasarela');
    selectPayMethod('card');
  });
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