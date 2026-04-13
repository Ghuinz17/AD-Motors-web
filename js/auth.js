// Registro, Login, OTP, validación contraseña

const PW_RULES = [
  { id: "req-len", test: (v) => v.length >= 8 },
  { id: "req-upper", test: (v) => /[A-Z]/.test(v) },
  { id: "req-lower", test: (v) => /[a-z]/.test(v) },
  { id: "req-num", test: (v) => /\d/.test(v) },
  { id: "req-spec", test: (v) => /[!@#$%^&*(),.?":{}|<>_\-]/.test(v) },
];

// Dominios comunes para detección de typos
const COMMON_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "protonmail.com",
  "tutanota.com",
  "hotmail.es",
  "outlook.es",
  "yahoo.es",
  "gmail.es",
];

function checkEmailTypo(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  // Si el dominio ya es correcto, no avisar
  if (COMMON_DOMAINS.includes(domain)) return null;
  // Buscar dominio parecido (distancia de Levenshtein <= 2)
  for (const known of COMMON_DOMAINS) {
    if (levenshtein(domain, known) <= 2) return known;
  }
  return null;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

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
  } else {
    const suggestion = checkEmailTypo(email);
    if (suggestion) {
      const user = email.split("@")[0];
      showError("regEmail", `¿Quisiste decir ${user}@${suggestion}?`);
      ok = false;
    }
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
  } else {
    const suggestion = checkEmailTypo(email);
    if (suggestion) {
      const user = email.split("@")[0];
      showError("loginEmail", `¿Quisiste decir ${user}@${suggestion}?`);
      ok = false;
    }
  }
  if (!pw) {
    showError("loginPassword", "Introduce tu contraseña");
    ok = false;
  }
  return ok;
}

let pendingNombre = "";
let pendingTel = "";

async function handleRegister(e) {
  e.preventDefault();
  if (!validateRegister()) return;
  const btn = document.getElementById("btnRegister");
  const nombre = document.getElementById("regNombre").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const tel = document.getElementById("regTelefono").value.trim();
  const pw = document.getElementById("regPassword").value;

  // Guardar para usar tras el OTP
  pendingNombre = nombre;
  pendingTel = tel;

  setLoading(btn, true);
  try {
    const { data, error } = await db.auth.signUp({
      email,
      password: pw,
      options: { data: { nombre, phone: tel } },
    });

    if (error) {
      // Email ya registrado y confirmado
      if (error.message?.includes("already registered")) {
        showError("regEmail", "Este email ya está registrado");
        return;
      }
      throw error;
    }

    pendingEmail = email;

    // Si el usuario ya existía sin confirmar, Supabase devuelve identities vacío
    // En ese caso reenviar el OTP manualmente
    if (data?.user && data.user.identities?.length === 0) {
      await db.auth.resend({ type: "signup", email });
    }

    showOtpStep();
    showToast("Código enviado a tu correo", "success");
  } catch (err) {
    showToast("Error: " + err.message, "error");
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
    showToast("¡Bienvenido de vuelta!", "success");
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
      if (btn) btn.disabled = full.length < 8;
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener("paste", (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 8);
      paste.split("").forEach((c, j) => {
        if (inputs[j]) {
          inputs[j].value = c;
          inputs[j].classList.add("filled");
        }
      });
      const nextIdx = Math.min(paste.length, inputs.length - 1);
      if (inputs[nextIdx]) inputs[nextIdx].focus();
      // Comprobar si ya están todos rellenos
      const full = [...inputs].map((i) => i.value).join("");
      const btn = document.getElementById("btnVerifyOtp");
      if (btn) btn.disabled = full.length < 8;
    });
  });
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const code = [...document.querySelectorAll(".otp-input")]
    .map((i) => i.value)
    .join("");
  if (code.length < 8) return;
  const btn = document.getElementById("btnVerifyOtp");
  setLoading(btn, true);
  try {
    const { data, error } = await db.auth.verifyOtp({
      email: pendingEmail,
      token: code,
      type: "email",
    });
    if (error) throw error;

    // Usuario confirmado — guardar en tabla usuario
    const user = data?.user;
    if (user) {
      const nombre = pendingNombre || user.user_metadata?.nombre || "";
      const tel = pendingTel || user.user_metadata?.phone || "";
      await db.from("usuario").upsert({
        id_usuario: user.id,
        nombre,
        email: user.email,
        phone: tel,
      });
    }

    showToast("¡Cuenta verificada! Bienvenido", "success");
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
    showToast("Código reenviado", "success");
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

  // Filtrar teléfono — solo dígitos, +, espacios
  document.querySelectorAll('input[type="tel"]').forEach((input) => {
    input.addEventListener("input", (e) => {
      const cursor = e.target.selectionStart;
      const clean = e.target.value.replace(/[^0-9+\s]/g, "");
      if (e.target.value !== clean) {
        e.target.value = clean;
        // Restaurar posición del cursor
        try {
          e.target.setSelectionRange(cursor - 1, cursor - 1);
        } catch {}
      }
    });
    input.addEventListener("keydown", (e) => {
      // Permitir: backspace, delete, tab, escape, enter, flechas, home, end
      const allowed = [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ];
      if (allowed.includes(e.key)) return;
      // Permitir ctrl+a, ctrl+c, ctrl+v, ctrl+x
      if (
        (e.ctrlKey || e.metaKey) &&
        ["a", "c", "v", "x"].includes(e.key.toLowerCase())
      )
        return;
      // Permitir dígitos (teclado normal y numérico)
      if (/^[0-9]$/.test(e.key)) return;
      // Permitir + solo al principio
      if (e.key === "+" && e.target.selectionStart === 0) return;
      // Permitir espacio
      if (e.key === " ") return;
      // Bloquear todo lo demás
      e.preventDefault();
    });
    input.setAttribute("inputmode", "tel");
    input.setAttribute("pattern", "[0-9+\\s]*");
  });
});
