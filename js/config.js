// Configuración global AD Motors

// --- Supabase ---
const SUPABASE_URL = "https://mgbftvxlqinxrthswqih.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nYmZ0dnhscWlueHJ0aHN3cWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjQyNDQsImV4cCI6MjA4NDYwMDI0NH0.f6c8-_Yc59Y2D3JNk5PV6rxYFBHxg0nT9ng6IElbuBU";

// --- EmailJS — Cuenta principal (reservas y visitas) ---
const EMAILJS_PUBLIC_KEY = "UM986XzXpgyzXW_vs";
const EMAILJS_SERVICE_ID = "service_58ve2lo";
const EMAILJS_TEMPLATE_COMPRA = "template_ge0ovyp"; // Confirmación de reserva
const EMAILJS_TEMPLATE_VISITA_CLIENTE = "template_du605di"; // Solicitud de visita

// --- EmailJS — Segunda cuenta (soporte y ayuda) ---
const EMAILJS_PUBLIC_KEY_SOPORTE = "MpbGWXxdeYPPzWhXy";
const EMAILJS_SERVICE_ID_SOPORTE = "service_31fvthj";
const EMAILJS_TEMPLATE_SOPORTE = "template_gpx18w5"; // Soporte o ayuda

// --- Email del administrador ---
const ADMIN_EMAIL = "moleroprogramador@gmail.com";

// --- Inicializar clientes ---
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);
