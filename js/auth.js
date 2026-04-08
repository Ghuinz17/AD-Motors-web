// Registro, Login, OTP, validación contraseña

const PW_RULES = [
  { id: "req-len", test: (v) => v.length >= 8 },
  { id: "req-upper", test: (v) => /[A-Z]/.test(v) },
  { id: "req-lower", test: (v) => /[a-z]/.test(v) },
  { id: "req-num", test: (v) => /\d/.test(v) },
  { id: "req-spec", test: (v) => /[!@#$%^&*(),.?":{}|<>_\-]/.test(v) },
];

function checkPassword(val) {
  const met = PW_RULES.filter((r) => r.test(val)).length;
  return { score: met, allMet: met === PW_RULES.length };
}

function renderPwStrength(val) {
  const { score } = checkPassword(val);
  const bar = document.getElementById("pwBar");
  const lbl = document.getElementById("pwLabel");
  if (!bar) return;
  const levels = ["", "weak", "fair", "good", "strong", "strong"];
  const names = ["", "Muy débil", "Débil", "Media", "Fuerte", "Muy fuerte"];
  bar.className = `pw-bar-fill ${levels[score] || ""}`;
  lbl.className = `pw-label ${levels[score] || ""}`;
  lbl.textContent = score > 0 ? names[score] : "";
  PW_RULES.forEach((rule) => {
    document.getElementById(rule.id)?.classList.toggle("met", rule.test(val));
  });
}

function applyErrorStyle(input) {
  if (!input) return;
  input.classList.remove("error");
  void input.offsetWidth;
  input.classList.add("error");
  // Inline styles ganan sobre :focus siempre
  input.style.setProperty("border-color", "#ef4444", "important");
  input.style.setProperty(
    "box-shadow",
    "0 0 0 3px rgba(239,68,68,.18)",
    "important",
  );
  input.style.setProperty("background", "rgba(239,68,68,.04)", "important");
}

function removeErrorStyle(input) {
  if (!input) return;
  input.classList.remove("error");
  input.style.removeProperty("border-color");
  input.style.removeProperty("box-shadow");
  input.style.removeProperty("background");
}

function showError(id, msg) {
  const input = document.getElementById(id);
  const err = document.getElementById(id + "Error");
  const icon = input?.closest(".input-wrap")?.querySelector(".input-icon");
  applyErrorStyle(input);
  if (icon) icon.style.color = "#ef4444";
  if (err) {
    err.textContent = msg;
    err.classList.add("show");
  }
}

function clearError(id) {
  const input = document.getElementById(id);
  const err = document.getElementById(id + "Error");
  const icon = input?.closest(".input-wrap")?.querySelector(".input-icon");
  removeErrorStyle(input);
  if (icon) icon.style.color = "";
  err?.classList.remove("show");
}

function clearAllErrors() {
  document.querySelectorAll(".form-input").forEach((input) => {
    removeErrorStyle(input);
    const icon = input.closest?.(".input-wrap")?.querySelector(".input-icon");
    if (icon) icon.style.color = "";
  });
  document
    .querySelectorAll(".form-error")
    .forEach((e) => e.classList.remove("show"));
}

let currentMode = "login";
let pendingEmail = "";

function setMode(mode) {
  currentMode = mode;
  clearAllErrors();
  document
    .getElementById("tabLogin")
    ?.classList.toggle("active", mode === "login");
  document
    .getElementById("tabRegister")
    ?.classList.toggle("active", mode === "register");
  document
    .getElementById("formLogin")
    ?.classList.toggle("hidden", mode !== "login");
  document
    .getElementById("formRegister")
    ?.classList.toggle("hidden", mode !== "register");
  document.getElementById("stepOtp")?.classList.add("hidden");
}

function validateRegister() {
  let ok = true;
  clearAllErrors();
  const nombre = document.getElementById("regNombre")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim();
  const telefono = document.getElementById("regTelefono")?.value.trim();
  const pw = document.getElementById("regPassword")?.value;
  const pw2 = document.getElementById("regPassword2")?.value;
  const terms = document.getElementById("regTerms")?.checked;
  if (!nombre || nombre.length < 2) {
    showError("regNombre", "Introduce tu nombre completo");
    ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("regEmail", "Email no válido");
    ok = false;
  }
  if (!telefono || !/^[0-9+\s]{9,15}$/.test(telefono)) {
    showError("regTelefono", "Teléfono no válido (mín. 9 dígitos)");
    ok = false;
  }
  if (!pw) {
    showError("regPassword", "Introduce una contraseña");
    ok = false;
  } else if (!checkPassword(pw).allMet) {
    showError("regPassword", "La contraseña no cumple todos los requisitos");
    ok = false;
  }
  if (pw !== pw2) {
    showError("regPassword2", "Las contraseñas no coinciden");
    ok = false;
  }
  if (!terms) {
    showToast("Debes aceptar los términos y condiciones", "error");
    ok = false;
  }
  return ok;
}

function validateLogin() {
  let ok = true;
  clearAllErrors();
  const email = document.getElementById("loginEmail")?.value.trim();
  const pw = document.getElementById("loginPassword")?.value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("loginEmail", "Email no válido");
    ok = false;
  }
  if (!pw) {
    showError("loginPassword", "Introduce tu contraseña");
    ok = false;
  }
  return ok;
}

async function handleRegister(e) {
  e.preventDefault();
  if (!validateRegister()) return;
  const btn = document.getElementById("btnRegister");
  const nombre = document.getElementById("regNombre").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const tel = document.getElementById("regTelefono").value.trim();
  const pw = document.getElementById("regPassword").value;
  setLoading(btn, true);
  try {
    const { data, error } = await db.auth.signUp({ email, password: pw });
    if (error) throw error;
    pendingEmail = email;
    if (data.user) {
      await db
        .from("usuario")
        .upsert({ id_usuario: data.user.id, nombre, email, phone: tel });
    }
    showOtpStep();
    showToast("Código enviado a tu correo 📧", "success");
  } catch (err) {
    if (err.message?.includes("already registered"))
      showError("regEmail", "Este email ya está registrado");
    else showToast("Error: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  if (!validateLogin()) return;
  const btn = document.getElementById("btnLogin");
  const email = document.getElementById("loginEmail").value.trim();
  const pw = document.getElementById("loginPassword").value;
  setLoading(btn, true);
  try {
    const { error } = await db.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    showToast("¡Bienvenido de vuelta! ✅", "success");
    setTimeout(() => {
      const r = new URLSearchParams(window.location.search).get("redirect");
      window.location.href = r || "../index.html";
    }, 1200);
  } catch (err) {
    if (err.message?.includes("Invalid") || err.message?.includes("invalid"))
      showError("loginPassword", "Email o contraseña incorrectos");
    else if (err.message?.includes("Email not confirmed")) {
      pendingEmail = email;
      showOtpStep();
      showToast("Confirma tu email primero", "info");
    } else showToast("Error: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
}

function showOtpStep() {
  document.getElementById("formLogin")?.classList.add("hidden");
  document.getElementById("formRegister")?.classList.add("hidden");
  const step = document.getElementById("stepOtp");
  step?.classList.remove("hidden");
  const span = document.getElementById("otpEmailDisplay");
  if (span) span.textContent = pendingEmail;
  document.querySelector(".otp-input")?.focus();
}

function initOtpInputs() {
  const inputs = document.querySelectorAll(".otp-input");
  inputs.forEach((inp, i) => {
    inp.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val.slice(-1);
      if (val && i < inputs.length - 1) inputs[i + 1].focus();
      e.target.classList.toggle("filled", !!val);
      const full = [...inputs].map((x) => x.value).join("");
      const btn = document.getElementById("btnVerifyOtp");
      if (btn) btn.disabled = full.length < 6;
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener("paste", (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);
      paste.split("").forEach((c, j) => {
        if (inputs[j]) {
          inputs[j].value = c;
          inputs[j].classList.add("filled");
        }
      });
      if (inputs[paste.length]) inputs[paste.length].focus();
    });
  });
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const code = [...document.querySelectorAll(".otp-input")]
    .map((i) => i.value)
    .join("");
  if (code.length < 6) return;
  const btn = document.getElementById("btnVerifyOtp");
  setLoading(btn, true);
  try {
    const { error } = await db.auth.verifyOtp({
      email: pendingEmail,
      token: code,
      type: "email",
    });
    if (error) throw error;
    showToast("¡Verificación completada! ✅", "success");
    setTimeout(() => {
      const r = new URLSearchParams(window.location.search).get("redirect");
      window.location.href = r || "../index.html";
    }, 1200);
  } catch {
    showToast("Código incorrecto o expirado", "error");
    document.querySelectorAll(".otp-input").forEach((i) => {
      i.value = "";
      i.classList.remove("filled");
    });
    document.querySelector(".otp-input")?.focus();
  } finally {
    setLoading(btn, false);
  }
}

async function handleResendOtp() {
  const btn = document.getElementById("btnResendOtp");
  btn.disabled = true;
  try {
    await db.auth.resend({ type: "signup", email: pendingEmail });
    showToast("Código reenviado 📧", "success");
    let s = 60;
    btn.textContent = `Reenviar (${s}s)`;
    const iv = setInterval(() => {
      s--;
      btn.textContent = `Reenviar (${s}s)`;
      if (s <= 0) {
        clearInterval(iv);
        btn.textContent = "Reenviar código";
        btn.disabled = false;
      }
    }, 1000);
  } catch {
    showToast("Error al reenviar", "error");
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  db.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      const r = new URLSearchParams(window.location.search).get("redirect");
      window.location.href = r || "../index.html";
    }
  });

  document
    .getElementById("tabLogin")
    ?.addEventListener("click", () => setMode("login"));
  document
    .getElementById("tabRegister")
    ?.addEventListener("click", () => setMode("register"));
  setMode("login");

  document.getElementById("formLogin")?.addEventListener("submit", handleLogin);
  document
    .getElementById("formRegister")
    ?.addEventListener("submit", handleRegister);
  document
    .getElementById("formOtp")
    ?.addEventListener("submit", handleVerifyOtp);
  document
    .getElementById("btnResendOtp")
    ?.addEventListener("click", handleResendOtp);
  document.getElementById("btnBackFromOtp")?.addEventListener("click", () => {
    document.getElementById("stepOtp")?.classList.add("hidden");
    setMode(currentMode);
  });

  document.getElementById("regPassword")?.addEventListener("input", (e) => {
    renderPwStrength(e.target.value);
    clearError("regPassword");
  });

  document
    .querySelectorAll(".form-input")
    .forEach((inp) => inp.addEventListener("input", () => clearError(inp.id)));

  // Toggles de contraseña
  document.querySelectorAll("[data-toggle-pw]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = document.getElementById(btn.dataset.togglePw);
      if (!t) return;
      t.type = t.type === "text" ? "password" : "text";
      btn.innerHTML =
        t.type === "text"
          ? '<i class="fa-regular fa-eye-slash"></i>'
          : '<i class="fa-regular fa-eye"></i>';
    });
  });

  initOtpInputs();
});
