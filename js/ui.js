// Tema, Header, Toast

/* ---- TEMA ---- */
function initTheme() {
  const saved = localStorage.getItem("adm-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("adm-theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("btnTheme");
  if (btn)
    btn.innerHTML =
      theme === "dark"
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
}

/* ---- Helpers compartidos ---- */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function safeId(value) {
  return String(value ?? "").replace(/[^\w\-:.]/g, "");
}

// SHA-256 en hexadecimal. Se usa para no guardar el token de cambio de email
// en claro: la BD guarda solo el hash y la web calcula el mismo hash al confirmar.
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---- Teléfono ---- */
// Quita espacios/formatos y el prefijo de España (+34 / 0034 / 34).
// Para otros países conserva el "+" delante del prefijo internacional.
function normalizarTelefono(value) {
  let tel = String(value ?? "").replace(/[\s\-().]/g, "");
  if (tel.startsWith("+34")) return tel.slice(3).replace(/\D/g, "");
  if (tel.startsWith("0034")) return tel.slice(4).replace(/\D/g, "");
  if (/^34\d{9}$/.test(tel)) return tel.slice(2);
  if (tel.startsWith("+")) return "+" + tel.slice(1).replace(/\D/g, "");
  return tel.replace(/\D/g, "");
}

// Compone el valor que se guarda: España se almacena sin prefijo;
// otros países se almacenan como +<prefijo><número>.
function telefonoConPrefijo(prefijo, numero) {
  const codigo = String(prefijo ?? "").replace(/\D/g, "");
  const tel = normalizarTelefono(numero).replace(/^\+/, "");
  if (!codigo || codigo === "34") return tel;
  return `+${codigo}${tel}`;
}

/* ---- Transmisión y potencia ---- */
function formatoTransmision(valor) {
  if (valor === "AUTOMATICA") return "Automática";
  if (valor === "MANUAL") return "Manual";
  return valor || "—";
}

function formatoPotencia(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? `${numero.toLocaleString("es-ES")} CV` : "—";
}

/* ---- Estado del vehículo: visible para todos los usuarios ---- */
// Criterio único para contadores, cintas y bloqueo de visitas.
// El flag antiguo `reservado = true` también cuenta como reservado.
function estadoVehiculo(vehiculo) {
  const estado = String(vehiculo?.estado || "").toLowerCase();
  if (estado === "vendido") return "vendido";
  if (estado === "reservado" || vehiculo?.reservado === true) return "reservado";
  return "disponible";
}

function vehiculoDisponible(vehiculo) {
  return estadoVehiculo(vehiculo) === "disponible";
}

function estadoRibbonHTML(vehiculo) {
  const estado = estadoVehiculo(vehiculo);
  const labels = { reservado: "Reservado", vendido: "Vendido" };
  const label = labels[estado];
  if (!label) return "";
  return `<div class="status-ribbon-wrap"><span class="status-ribbon status-${estado}">${label}</span></div>`;
}

/* ---- TOAST ---- */
function showToast(msg, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icons = {
    success:
      '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>',
    error:
      '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>',
    info: '<i class="fa-solid fa-circle-info"  style="color:var(--primary)"></i>',
  };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all .3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ---- DRAWER / MENÚ ---- */
function initHeader() {
  const btnMenu = document.getElementById("btnMenu");
  const overlay = document.getElementById("drawerOverlay");
  const drawer = document.getElementById("drawer");
  const btnClose = document.getElementById("btnCloseDrawer");
  const btnLogout = document.getElementById("btnLogout");
  const loginBtn = document.getElementById("headerLoginBtn");
  const userAvatar = document.getElementById("userAvatar");

  function openDrawer() {
    overlay?.classList.add("open");
    drawer?.classList.add("open");
  }
  function closeDrawer() {
    overlay?.classList.remove("open");
    drawer?.classList.remove("open");
  }

  btnMenu?.addEventListener("click", openDrawer);
  overlay?.addEventListener("click", closeDrawer);
  btnClose?.addEventListener("click", closeDrawer);

  // Rellenar datos usuario en drawer
  db.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      // Ocultar botón login, mostrar avatar
      loginBtn?.classList.add("hidden");
      userAvatar?.classList.remove("hidden");

      // Icono de administración solo para las cuentas autorizadas en la BD
      const btnAdmin = document.getElementById("btnAdmin");
      if (btnAdmin) {
        db.rpc("es_admin").then(({ data, error }) => {
          if (!error && data === true) btnAdmin.classList.remove("hidden");
        });
      }

      // Iniciales del avatar: usar nombre si está disponible
      const metaNombre = user.user_metadata?.nombre || user.email || "U";
      const initials = metaNombre.substring(0, 2).toUpperCase();
      if (userAvatar) userAvatar.textContent = initials;

      const drawerEmail = document.getElementById("drawerEmail");
      const drawerName = document.getElementById("drawerName");
      const drawerInit = document.getElementById("drawerInitials");

      if (drawerEmail) drawerEmail.textContent = user.email;
      if (drawerInit) drawerInit.textContent = initials;

      // Cargar nombre: tabla usuario → user_metadata → email prefix
      db.from("usuario")
        .select("nombre")
        .eq("id_usuario", user.id)
        .single()
        .then(({ data }) => {
          const nombre =
            data?.nombre ||
            user.user_metadata?.nombre ||
            user.email?.split("@")[0] ||
            "Usuario";
          if (drawerName) drawerName.textContent = nombre;
        });
    } else {
      loginBtn?.classList.remove("hidden");
      userAvatar?.classList.add("hidden");
      document.getElementById("btnAdmin")?.classList.add("hidden");
      // Mostrar estado no autenticado en el drawer
      const drawerName = document.getElementById("drawerName");
      const drawerEmail = document.getElementById("drawerEmail");
      const drawerInit = document.getElementById("drawerInitials");
      if (drawerName) drawerName.textContent = "No has iniciado sesión";
      if (drawerEmail)
        drawerEmail.innerHTML = `<a href="${getBasePath()}pages/auth.html" style="color:var(--primary);font-weight:700;font-size:.8rem">Iniciar sesión →</a>`;
      if (drawerInit) drawerInit.style.background = "var(--bg3)";
      if (drawerInit)
        drawerInit.innerHTML =
          '<i class="fa-regular fa-user" style="color:var(--text3);font-size:1rem"></i>';
    }
  });

  btnLogout?.addEventListener("click", async () => {
    await db.auth.signOut();
    showToast("Sesión cerrada", "info");
    setTimeout(
      () => (window.location.href = getBasePath() + "index.html"),
      1000,
    );
  });
}

/* Devuelve el path base según si estamos en /pages/ o en raíz */
function getBasePath() {
  return window.location.pathname.includes("/pages/") ? "../" : "./";
}

/* ---- MODAL helpers ---- */
function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

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
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initHeader();
  document.getElementById("btnTheme")?.addEventListener("click", toggleTheme);

  // Marcar ítem activo del drawer según página
  const path = window.location.pathname;
  document.querySelectorAll(".drawer-nav-item[data-page]").forEach((item) => {
    if (path.includes(item.dataset.page)) item.classList.add("active");
  });

  // Navegación desde drawer
  document.querySelectorAll(".drawer-nav-item[data-href]").forEach((item) => {
    item.addEventListener("click", () => {
      window.location.href = getBasePath() + item.dataset.href;
    });
  });
});

/* ---- Validación de email en tiempo real ---- */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('input[type="email"]').forEach((input) => {
    input.addEventListener("blur", () => {
      const val = input.value.trim();
      if (val && !val.includes("@")) {
        input.style.setProperty("border-color", "#ef4444", "important");
        input.style.setProperty(
          "box-shadow",
          "0 0 0 3px rgba(239,68,68,.18)",
          "important",
        );
        // Mostrar tooltip si existe el contenedor de error
        const err = document.getElementById(input.id + "Error");
        if (err) {
          err.textContent = "El email debe contener @";
          err.classList.add("show");
        }
      } else {
        input.style.removeProperty("border-color");
        input.style.removeProperty("box-shadow");
        const err = document.getElementById(input.id + "Error");
        if (err && err.textContent === "El email debe contener @")
          err.classList.remove("show");
      }
    });

    // Limpiar al volver a escribir
    input.addEventListener("input", () => {
      if (input.value.includes("@")) {
        input.style.removeProperty("border-color");
        input.style.removeProperty("box-shadow");
      }
    });
  });
});
