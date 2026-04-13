// Tema, Header, Toast (compartido en todas las páginas)

/* ---- TEMA ---- */
function initTheme() {
  const saved = localStorage.getItem('adm-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('adm-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btnTheme');
  if (btn) btn.innerHTML = theme === 'dark'
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

/* ---- TOAST ---- */
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>',
    error:   '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>',
    info:    '<i class="fa-solid fa-circle-info"  style="color:var(--primary)"></i>'
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(100%)'; toast.style.transition='all .3s ease'; setTimeout(()=>toast.remove(),300); }, duration);
}

/* ---- DRAWER / MENÚ ---- */
function initHeader() {
  const btnMenu    = document.getElementById('btnMenu');
  const overlay    = document.getElementById('drawerOverlay');
  const drawer     = document.getElementById('drawer');
  const btnClose   = document.getElementById('btnCloseDrawer');
  const btnLogout  = document.getElementById('btnLogout');
  const loginBtn   = document.getElementById('headerLoginBtn');
  const userAvatar = document.getElementById('userAvatar');

  function openDrawer()  { overlay?.classList.add('open'); drawer?.classList.add('open'); }
  function closeDrawer() { overlay?.classList.remove('open'); drawer?.classList.remove('open'); }

  btnMenu?.addEventListener('click', openDrawer);
  overlay?.addEventListener('click', closeDrawer);
  btnClose?.addEventListener('click', closeDrawer);

  // Rellenar datos usuario en drawer
  db.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      // Ocultar botón login, mostrar avatar
      loginBtn?.classList.add('hidden');
      userAvatar?.classList.remove('hidden');

      const initials = (user.email || 'U').substring(0, 2).toUpperCase();
      if (userAvatar) userAvatar.textContent = initials;

      const drawerEmail = document.getElementById('drawerEmail');
      const drawerName  = document.getElementById('drawerName');
      const drawerInit  = document.getElementById('drawerInitials');

      if (drawerEmail) drawerEmail.textContent = user.email;
      if (drawerInit)  drawerInit.textContent  = initials;

      // Cargar nombre desde tabla usuario
      db.from('usuario').select('nombre').eq('id_usuario', user.id).single()
        .then(({ data }) => { if (data && drawerName) drawerName.textContent = data.nombre || 'Usuario'; });
    } else {
      loginBtn?.classList.remove('hidden');
      userAvatar?.classList.add('hidden');
      // Mostrar estado no autenticado en el drawer
      const drawerName  = document.getElementById('drawerName');
      const drawerEmail = document.getElementById('drawerEmail');
      const drawerInit  = document.getElementById('drawerInitials');
      if (drawerName)  drawerName.textContent  = 'No has iniciado sesión';
      if (drawerEmail) drawerEmail.innerHTML   = `<a href="${getBasePath()}pages/auth.html" style="color:var(--primary);font-weight:700;font-size:.8rem">Iniciar sesión →</a>`;
      if (drawerInit)  drawerInit.style.background = 'var(--bg3)';
      if (drawerInit)  drawerInit.innerHTML = '<i class="fa-regular fa-user" style="color:var(--text3);font-size:1rem"></i>';
    }
  });

  btnLogout?.addEventListener('click', async () => {
    await db.auth.signOut();
    showToast('Sesión cerrada', 'info');
    setTimeout(() => window.location.href = getBasePath() + 'index.html', 1000);
  });
}

/* Devuelve el path base según si estamos en /pages/ o en raíz */
function getBasePath() {
  return window.location.pathname.includes('/pages/') ? '../' : './';
}

/* ---- MODAL helpers ---- */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ---- Spinner en botón ---- */
function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn._originalHTML = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Cargando...`;
  } else {
    btn.disabled = false;
    if (btn._originalHTML) btn.innerHTML = btn._originalHTML;
  }
}

/* ---- Inicializar al cargar ---- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initHeader();
  document.getElementById('btnTheme')?.addEventListener('click', toggleTheme);

  // Marcar ítem activo del drawer según página
  const path = window.location.pathname;
  document.querySelectorAll('.drawer-nav-item[data-page]').forEach(item => {
    if (path.includes(item.dataset.page)) item.classList.add('active');
  });

  // Navegación desde drawer
  document.querySelectorAll('.drawer-nav-item[data-href]').forEach(item => {
    item.addEventListener('click', () => {
      window.location.href = getBasePath() + item.dataset.href;
    });
  });
});