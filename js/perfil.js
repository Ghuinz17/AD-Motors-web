// Solicitudes y ajustes de cuenta

async function initPerfil() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) { window.location.href = 'auth.html?redirect=perfil.html'; return; }

  // Nombre desde user_metadata como fallback inmediato (no depende de la BD)
  const metaNombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario';

  // Mostrar datos inmediatamente con metadata mientras carga la BD
  setValue('profileName',    metaNombre);
  setValue('profileEmail',   user.email);
  setValue('profileInitial', metaNombre.charAt(0).toUpperCase());

  // Intentar cargar datos de la tabla usuario (puede fallar por RLS)
  let userData = null;
  try {
    const { data } = await db.from('usuario').select('*').eq('id_usuario', user.id).single();
    userData = data;
  } catch { /* RLS o tabla vacía — usar metadata */ }

  // Si no existe fila, intentar crearla (sin bloquear si falla por RLS)
  if (!userData) {
    try {
      await db.from('usuario').upsert({
        id_usuario: user.id,
        nombre:     metaNombre,
        email:      user.email,
        phone:      normalizarTelefono(user.user_metadata?.phone || ''),
      });
      const { data } = await db.from('usuario').select('*').eq('id_usuario', user.id).single();
      userData = data;
    } catch { /* continuar con metadata */ }
  }

  // Actualizar UI con datos reales si los tenemos
  const nombre = userData?.nombre || metaNombre;
  setValue('profileName',    nombre);
  setValue('profileInitial', nombre.charAt(0).toUpperCase());

  // Rellenar campos de edición
  setVal('settingNombre',   userData?.nombre   || metaNombre);
  setVal('settingTelefono', normalizarTelefono(userData?.phone || user.user_metadata?.phone || ''));
  setVal('settingEmail',    user.email);

  // Activar tab según query param
  const tab = new URLSearchParams(window.location.search).get('tab') || 'solicitudes';
  switchTab(tab);

  // Cargar contenido (siempre, aunque falle la BD)
  await loadSolicitudes(user.id);
}

function setValue(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function setVal(id, val)   { const el=document.getElementById(id); if(el) el.value=val; }

function switchTab(tab) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab===tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id===`tab-${tab}`));
}

// ---- SOLICITUDES ----
async function loadSolicitudes(userId) {
  const cont = document.getElementById('solicitudesList');
  if (!cont) return;
  cont.innerHTML = `<div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:.75rem"></div>`.repeat(2);

  const { data, error } = await db
    .from('solicitudes_revision')
    .select('*')
    .eq('id_usuario', userId)
    .gte('fecha_visita', new Date().toISOString().split('T')[0])
    .order('fecha_creacion', { ascending: false });

  if (error || !data?.length) {
    cont.innerHTML = emptyState('<i class="fa-regular fa-calendar-days"></i>', 'No se ha realizado ninguna solicitud', 'Cuando solicites ver un vehículo en persona aparecerá aquí'); return;
  }

  cont.innerHTML = data.map(s => {
    const estadoBadge = getEstadoBadge(s.estado);
    return `
      <div class="pedido-card">
        <div class="pedido-icon"><i class="fa-solid fa-calendar-days"></i></div>
        <div style="flex:1">
          <div class="pedido-title">${
            s.marca && s.modelo ? `${s.marca} ${s.modelo}` :
            s.marca_modelo || 'Vehículo'
          }</div>
          <div class="pedido-sub"><i class="fa-regular fa-user"></i> ${s.nombre_asistente} &nbsp;·&nbsp; <i class="fa-solid fa-mobile-screen-button"></i> ${s.telefono}</div>
          <div class="pedido-date"><i class="fa-regular fa-calendar"></i> ${formatFecha(s.fecha_visita)} a las ${s.hora_visita?.slice(0,5) || '—'}</div>
        </div>
        <div>
          <span class="badge ${estadoBadge.cls}">${estadoBadge.label}</span>
        </div>
      </div>`;
  }).join('');
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'long' });
}

function getEstadoBadge(estado) {
  const map = {
    PENDIENTE:       { cls:'badge-warning', label:'Pendiente' },
    CONFIRMADA:      { cls:'badge-success', label:'Confirmada' },
    COMPLETADA:      { cls:'badge-success', label:'Completada' },
    CANCELADA:       { cls:'badge-danger',  label:'Cancelada' },
  };
  return map[estado] || { cls:'badge-neutral', label: estado };
}

function emptyState(icon, title, sub) {
  return `<div class="no-results" style="padding:2.5rem 1rem">
    <div class="no-results-icon" style="font-size:2.5rem;color:var(--primary)">${icon}</div>
    <div class="no-results-title">${title}</div>
    <div class="no-results-sub">${sub}</div>
  </div>`;
}

// ---- ACTUALIZAR PERFIL ----
async function handleUpdatePerfil(e) {
  e.preventDefault();
  const btn    = document.getElementById('btnUpdatePerfil');
  const nombre = document.getElementById('settingNombre')?.value.trim();
  const tel    = normalizarTelefono(document.getElementById('settingTelefono')?.value.trim());

  if (!nombre) { showToast('Introduce tu nombre', 'error'); return; }

  setLoading(btn, true);
  try {
    const { data: { user } } = await db.auth.getUser();

    // upsert por si la fila no existe todavía
    const { error } = await db.from('usuario').upsert({
      id_usuario: user.id,
      nombre,
      email: user.email,
      phone: tel || '',
    });
    if (error) throw error;

    // Actualizar también user_metadata para que el drawer lo muestre sin recargar
    const { error: metaError } = await db.auth.updateUser({ data: { nombre, phone: tel } });
    if (metaError) showToast('Datos guardados, pero no se pudo refrescar la sesión: ' + metaError.message, 'info');

    setValue('profileName', nombre);
    const initial = document.getElementById('profileInitial');
    if (initial) initial.textContent = nombre.charAt(0).toUpperCase();
    showToast('Perfil actualizado', 'success');
  } catch(err) { showToast('Error al actualizar: ' + err.message, 'error'); }
  finally      { setLoading(btn, false); }
}

// ---- CAMBIAR EMAIL ----
// El envío lo hace EmailJS (ya configurado para las visitas), no el SMTP de
// Supabase. En la BD se guarda solo el hash del token; el token en claro va
// únicamente dentro del enlace que recibe el nuevo correo.
async function handleUpdateEmail(e) {
  e.preventDefault();
  const btn      = document.getElementById('btnUpdateEmail');
  const newEmail = document.getElementById('settingEmail')?.value.trim();
  document.getElementById('emailEnviadoAviso')?.classList.add('hidden');

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    showToast('Introduce un email válido', 'error'); return;
  }

  const { data: { user } } = await db.auth.getUser();
  if (!user) { showToast('Sesión caducada. Vuelve a iniciar sesión.', 'error'); return; }
  if (newEmail === user.email) {
    showToast('El email es el mismo que el actual', 'error'); return;
  }

  setLoading(btn, true);
  try {
    // Token aleatorio de 64 hexadecimales y su hash SHA-256.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const hash  = await sha256Hex(token);
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from('usuario').update({
      email_cambio_nuevo: newEmail,
      email_cambio_hash:  hash,
      email_cambio_expira: expira,
    }).eq('id_usuario', user.id);
    if (error) throw error;

    const enlace = `${window.location.origin}/confirm.html?emailjs_token=${encodeURIComponent(token)}`;
    const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario';

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CAMBIO_EMAIL, {
        to_email:        newEmail,
        admin_email:     ADMIN_EMAIL,
        nombre,
        vehiculo:        'AD Motor\'s',
        icono:           '✉',
        titulo:          'Confirma tu nuevo correo',
        subtitulo:       'Verificación de cambio',
        mensaje:         'Hemos recibido una solicitud para cambiar el correo de tu cuenta en AD Motor\'s. Confirma el enlace siguiente para completar el cambio.',
        campo1_label:    'Nuevo correo',
        campo1_valor:    newEmail,
        campo2_label:    'Enlace de confirmación',
        campo2_valor:    enlace,
        nota_final:      'Confirma pulsando este enlace: ' + enlace + '. Si no fuiste tú, ignora este correo.',
        fecha_solicitud: new Date().toLocaleString('es-ES'),
      });
    } catch (emailErr) {
      throw new Error('El cambio se ha guardado, pero no se pudo enviar el correo con EmailJS. Vuelve a intentarlo.');
    }

    document.getElementById('emailEnviadoAviso')?.classList.remove('hidden');
    showToast('Revisa tu bandeja de entrada — se ha enviado un enlace de confirmación al nuevo correo', 'success');
  } catch(err) {
    showToast('Error: ' + (err?.message || 'No se pudo solicitar el cambio'), 'error');
  } finally { setLoading(btn, false); }
}

// ---- CAMBIAR CONTRASEÑA ----
async function handleUpdatePassword(e) {
  e.preventDefault();
  const btn  = document.getElementById('btnUpdatePassword');
  const pw   = document.getElementById('settingPassword')?.value;
  const pw2  = document.getElementById('settingPassword2')?.value;

  if (!pw || pw.length < 8)                   { showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) {
    showToast('La contraseña debe tener mayúsculas, minúsculas y números', 'error'); return;
  }
  if (pw !== pw2)                             { showToast('Las contraseñas no coinciden', 'error'); return; }

  setLoading(btn, true);
  try {
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) throw error;
    document.getElementById('settingPassword').value  = '';
    document.getElementById('settingPassword2').value = '';
    showToast('Contraseña actualizada', 'success');
  } catch(err) { showToast('Error: ' + err.message, 'error'); }
  finally      { setLoading(btn, false); }
}

// ---- ELIMINAR CUENTA ----
async function handleDeleteAccount() {
  const confirmText = document.getElementById('deleteConfirmInput')?.value.trim();
  if (confirmText !== 'ELIMINAR') { showToast('Escribe ELIMINAR para confirmar', 'error'); return; }

  const btn = document.getElementById('btnDeleteConfirm');
  setLoading(btn, true);
  try {
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');

    // 1. La RPC borra auth.users y, por CASCADE, la fila de usuario.
    //    Si todavía no se ha aplicado la migración, se intenta la vía antigua:
    //    borrar de usuario y dejar que el trigger elimine el usuario de Auth.
    const { error: rpcError } = await db.rpc('eliminar_mi_cuenta');
    if (rpcError) {
      const { error } = await db.from('usuario').delete().eq('id_usuario', user.id);
      if (error) throw error;
    }

    // 2. Cerrar sesión localmente
    await db.auth.signOut();
    showToast('Cuenta eliminada correctamente', 'info');
    setTimeout(() => window.location.href = '../index.html', 1500);
  } catch(err) {
    showToast('Error al eliminar: ' + (err.message || 'sin permisos para borrar la cuenta'), 'error');
  } finally {
    setLoading(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPerfil();

  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('formUpdatePerfil')?.addEventListener('submit', handleUpdatePerfil);
  document.getElementById('formUpdateEmail')?.addEventListener('submit', handleUpdateEmail);
  document.getElementById('formUpdatePassword')?.addEventListener('submit', handleUpdatePassword);
  document.getElementById('btnDeleteAccount')?.addEventListener('click', () => openModal('modalDeleteAccount'));
  document.getElementById('btnDeleteConfirm')?.addEventListener('click', handleDeleteAccount);
  document.getElementById('btnCancelDelete')?.addEventListener('click', () => closeModal('modalDeleteAccount'));
});