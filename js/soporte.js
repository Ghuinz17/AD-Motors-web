// Formulario de soporte y ayuda

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formSoporte");
  if (!form) return;

  form.addEventListener("submit", handleSoporte);
});

function showSoporteError(id, msg) {
  const input = document.getElementById(id);
  const err = document.getElementById(id + "Error");
  if (input) {
    input.classList.remove("error");
    void input.offsetWidth;
    input.classList.add("error");
    input.style.setProperty("border-color", "#ef4444", "important");
    input.style.setProperty(
      "box-shadow",
      "0 0 0 3px rgba(239,68,68,.18)",
      "important",
    );
  }
  if (err) {
    err.textContent = msg;
    err.classList.add("show");
  }
}

function clearSoporteErrors() {
  ["soporteAsunto", "soporteDescripcion", "soporteEmail"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.classList.remove("error");
      input.style.removeProperty("border-color");
      input.style.removeProperty("box-shadow");
    }
    const err = document.getElementById(id + "Error");
    if (err) err.classList.remove("show");
  });
}

async function handleSoporte(e) {
  e.preventDefault();
  clearSoporteErrors();

  const tipo = document.getElementById("soporteTipo")?.value;
  const asunto = document.getElementById("soporteAsunto")?.value.trim();
  const descripcion = document
    .getElementById("soporteDescripcion")
    ?.value.trim();
  const email = document.getElementById("soporteEmail")?.value.trim();

  let ok = true;
  if (!asunto) {
    showSoporteError("soporteAsunto", "Introduce un asunto");
    ok = false;
  }
  if (!descripcion || descripcion.length < 10) {
    showSoporteError(
      "soporteDescripcion",
      "Describe el problema (mín. 10 caracteres)",
    );
    ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSoporteError("soporteEmail", "Introduce un email válido");
    ok = false;
  }
  if (!ok) return;

  const btn = document.getElementById("btnEnviarSoporte");
  setLoading(btn, true);

  const tipoLabels = {
    error: "Error detectado",
    ayuda: "Solicitud de ayuda",
    sugerencia: "Sugerencia",
    otro: "Otro",
  };

  try {
    // Inicializar segunda cuenta de EmailJS para soporte
    emailjs.init(EMAILJS_PUBLIC_KEY_SOPORTE);

    await emailjs.send(EMAILJS_SERVICE_ID_SOPORTE, EMAILJS_TEMPLATE_SOPORTE, {
      to_email: ADMIN_EMAIL,
      admin_email: ADMIN_EMAIL,
      nombre: email,
      vehiculo: tipoLabels[tipo] || tipo,
      icono: "!",
      titulo: "Nueva consulta de soporte",
      subtitulo: tipoLabels[tipo] || tipo,
      mensaje: descripcion,
      campo1_label: "Asunto",
      campo1_valor: asunto,
      campo2_label: "Email del usuario",
      campo2_valor: email,
      fecha: new Date().toLocaleString("es-ES"),
      nota_final: `Este mensaje fue enviado desde el formulario de soporte de AD Motor's.`,
    });

    // Restaurar la cuenta principal para el resto de la app
    emailjs.init(EMAILJS_PUBLIC_KEY);

    closeModal("modalSoporte");
    document.getElementById("formSoporte")?.reset();
    showToast("Mensaje enviado. Te responderemos pronto", "success");
  } catch (err) {
    console.error("Error soporte:", err);
    showToast("Error al enviar. Inténtalo de nuevo", "error");
  } finally {
    setLoading(btn, false);
  }
}
