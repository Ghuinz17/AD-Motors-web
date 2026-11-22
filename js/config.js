// Configuración global AD Motors

// --- Supabase ---
// Valores codificados para que no aparezcan en claro al ver el código fuente.
// Esto no es seguridad: el acceso real lo controlan las políticas RLS.
const decodeConfig = (value) => atob(value);
const SUPABASE_URL      = decodeConfig('aHR0cHM6Ly9tZ2JmdHZ4bHFpbnhydGhzd3FpaC5zdXBhYmFzZS5jbw==');
const SUPABASE_ANON_KEY = decodeConfig('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW0xblltWjBkbmhzY1dsdWVISjBhSE4zY1dsb0lpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTmprd01qUXlORFFzSW1WNGNDSTZNakE0TkRZd01ESTBOSDAuZjZjOC1fWWM1OVkyRDNKTms1UFY2cnhZRkJIeGcwblQ5bmc2SUVsYnVCVQ==');

// --- EmailJS — Cuenta principal (visitas) ---
const EMAILJS_PUBLIC_KEY              = 'UM986XzXpgyzXW_vs';
const EMAILJS_SERVICE_ID              = 'service_58ve2lo';
const EMAILJS_TEMPLATE_VISITA_CLIENTE = 'template_du605di';

// --- EmailJS — Segunda cuenta (soporte y ayuda) ---
const EMAILJS_PUBLIC_KEY_SOPORTE  = 'MpbGWXxdeYPPzWhXy';
const EMAILJS_SERVICE_ID_SOPORTE  = 'service_31fvthj';
const EMAILJS_TEMPLATE_SOPORTE    = 'template_gpx18w5';

// --- Email del administrador ---
const ADMIN_EMAIL = 'moleroprogramador@gmail.com';

// --- Inicializar clientes ---
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);