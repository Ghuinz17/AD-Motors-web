// Configuración global AD Motors
//
// IMPORTANTE:
// - La URL y la clave anon/publishable de Supabase son públicas por diseño.
//   Se pueden ver en el navegador; NO son un secreto.
// - La seguridad real de los datos la imponen las políticas RLS de Supabase.
//   Ejecuta `supabase/seguridad-rls.sql` en el SQL Editor del proyecto.
// - NUNCA pongas aquí la clave `service_role`, contraseñas, datos personales
//   ni información que no deba ser pública. Todo lo que hay en este archivo
//   se descarga en el navegador del visitante.

// --- Supabase ---
const SUPABASE_URL      = 'https://mgbftvxlqinxrthswqih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nYmZ0dnhscWlueHJ0aHN3cWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjQyNDQsImV4cCI6MjA4NDYwMDI0NH0.f6c8-_Yc59Y2D3JNk5PV6rxYFBHxg0nT9ng6IElbuBU';

// --- EmailJS — Cuenta principal (reservas y visitas) ---
const EMAILJS_PUBLIC_KEY              = 'UM986XzXpgyzXW_vs';
const EMAILJS_SERVICE_ID              = 'service_58ve2lo';
const EMAILJS_TEMPLATE_COMPRA         = 'template_ge0ovyp';
const EMAILJS_TEMPLATE_VISITA_CLIENTE = 'template_du605di';

// --- EmailJS — Segunda cuenta (soporte y ayuda) ---
const EMAILJS_PUBLIC_KEY_SOPORTE  = 'MpbGWXxdeYPPzWhXy';
const EMAILJS_SERVICE_ID_SOPORTE  = 'service_31fvthj';
const EMAILJS_TEMPLATE_SOPORTE    = 'template_gpx18w5';

// El email del administrador NO se guarda en el cliente.
// Se configura directamente en la plantilla de EmailJS (campo "To email")
// para que no aparezca en el código fuente ni en el modo inspección.

// --- Inicializar clientes ---
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// EmailJS solo está cargado en las páginas que lo necesitan.
if (typeof emailjs !== 'undefined') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}