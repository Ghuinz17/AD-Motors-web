// Pedidos, solicitudes y ajustes de cuenta

async function initPerfil() {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    window.location.href = "auth.html?redirect=perfil.html";
    return;
  }

  // Cargar datos usuario
  const { data: userData } = await db
    .from("usuario")
    .select("*")
    .eq("id_usuario", user.id)
    .single();

  // Rellenar cabecera perfil
  const nombre = userData?.nombre || user.email?.split("@")[0] || "Usuario";
  setValue("profileName", nombre);
  setValue("profileEmail", user.email);
  setValue("profileInitial", nombre.charAt(0).toUpperCase());

  // Rellenar campos de edición
  setVal("settingNombre", userData?.nombre || "");
  setVal("settingTelefono", userData?.phone || "");
  setVal("settingEmail", user.email);

  // Activar tab según query param
  const tab =
    new URLSearchParams(window.location.search).get("tab") || "pedidos";
  switchTab(tab);

  // Cargar contenido de cada tab
  await loadPedidos(user.id);
  await loadSolicitudes(user.id);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function switchTab(tab) {
  document
    .querySelectorAll(".profile-tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.toggle("active", c.id === `tab-${tab}`));
}

// ---- PEDIDOS ----
async function loadPedidos(userId) {
  const cont = document.getElementById("pedidosList");
  if (!cont) return;
  cont.innerHTML =
    `<div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:.75rem"></div>`.repeat(
      2,
    );

  const { data, error } = await db
    .from("compra")
    .select("*, detallecompra(id_vehiculo, precio_unitario)")
    .eq("id_usuario", userId)
    .order("fecha", { ascending: false });

  if (error || !data?.length) {
    cont.innerHTML = emptyState(
      '<i class="fa-solid fa-box"></i>',
      "Sin pedidos",
      "Aquí aparecerán tus compras realizadas",
    );
    return;
  }

  cont.innerHTML = data
    .map((p) => {
      const detalle = p.detallecompra?.[0];
      const estadoBadge = getEstadoBadge(p.estado);
      return `
      <div class="pedido-card">
        <div class="pedido-icon"><i class="fa-solid fa-car"></i></div>
        <div style="flex:1">
          <div class="pedido-title">Pedido #${p.id_compra?.slice(0, 8).toUpperCase()}</div>
          <div class="pedido-sub">Vehículo: ${detalle?.id_vehiculo || "—"}</div>
          <div class="pedido-date"><i class="fa-regular fa-calendar"></i> ${new Date(p.fecha).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div style="text-align:right">
          <span class="badge ${estadoBadge.cls}">${estadoBadge.label}</span>
          <div style="font-weight:800;color:var(--primary);font-size:1rem;margin-top:.5rem">${p.total?.toLocaleString("es-ES")} €</div>
        </div>
      </div>`;
    })
    .join("");
}

// ---- SOLICITUDES ----
async function loadSolicitudes(userId) {
  const cont = document.getElementById("solicitudesList");
  if (!cont) return;
  cont.innerHTML =
    `<div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:.75rem"></div>`.repeat(
      2,
    );

  const { data, error } = await db
    .from("solicitudes_revision")
    .select("*")
    .order("fecha_creacion", { ascending: false });

  if (error || !data?.length) {
    cont.innerHTML = emptyState(
      '<i class="fa-regular fa-calendar-days"></i>',
      "Sin solicitudes",
      "Aquí aparecerán tus solicitudes de visita",
    );
    return;
  }

  cont.innerHTML = data
    .map((s) => {
      const estadoBadge = getEstadoBadge(s.estado);
      return `
      <div class="pedido-card">
        <div class="pedido-icon"><i class="fa-solid fa-calendar-days"></i></div>
        <div style="flex:1">
          <div class="pedido-title">${`${s.marca || ""} ${s.modelo || ""}`.trim() || "Vehículo" || "Vehículo"}</div>
          <div class="pedido-sub"><i class="fa-regular fa-user"></i> ${s.nombre_asistente} &nbsp;·&nbsp; <i class="fa-solid fa-mobile-screen-button"></i> ${s.telefono}</div>
          <div class="pedido-date"><i class="fa-regular fa-calendar"></i> ${formatFecha(s.fecha_visita)} a las ${s.hora_visita?.slice(0, 5) || "—"}</div>
        </div>
        <div>
          <span class="badge ${estadoBadge.cls}">${estadoBadge.label}</span>
        </div>
      </div>`;
    })
    .join("");
}

function formatFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function getEstadoBadge(estado) {
  const map = {
    PENDIENTE: { cls: "badge-warning", label: "Pendiente" },
    PENDIENTE_PAGO: { cls: "badge-warning", label: "Pend. pago" },
    CONFIRMADA: { cls: "badge-success", label: "Confirmada" },
    COMPLETADA: { cls: "badge-success", label: "Completada" },
    CANCELADA: { cls: "badge-danger", label: "Cancelada" },
  };
  return map[estado] || { cls: "badge-neutral", label: estado };
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
  const btn = document.getElementById("btnUpdatePerfil");
  const nombre = document.getElementById("settingNombre")?.value.trim();
  const tel = document.getElementById("settingTelefono")?.value.trim();

  if (!nombre) {
    showToast("Introduce tu nombre", "error");
    return;
  }

  setLoading(btn, true);
  try {
    const {
      data: { user },
    } = await db.auth.getUser();
    await db
      .from("usuario")
      .update({ nombre, phone: tel })
      .eq("id_usuario", user.id);
    setValue("profileName", nombre);
    showToast("Perfil actualizado", "success");
  } catch {
    showToast("Error al actualizar", "error");
  } finally {
    setLoading(btn, false);
  }
}
