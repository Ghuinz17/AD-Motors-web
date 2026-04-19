//Configuración global AD Motors

// --- Supabase ---
const SUPABASE_URL      = 'https://mgbftvxlqinxrthswqih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nYmZ0dnhscWlueHJ0aHN3cWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjQyNDQsImV4cCI6MjA4NDYwMDI0NH0.f6c8-_Yc59Y2D3JNk5PV6rxYFBHxg0nT9ng6IElbuBU';

// --- EmailJS ---
const EMAILJS_PUBLIC_KEY            = 'UM986XzXpgyzXW_vs';
const EMAILJS_SERVICE_ID            = 'service_afa48tb ';

// Confirmación de reserva (se envía al cliente al reservar)
const EMAILJS_TEMPLATE_COMPRA     = 'template_ge0ovyp';

//Solicitud de visita (se envía al cliente + CC al admin)
const EMAILJS_TEMPLATE_VISITA_CLIENTE = 'template_du605di';

// Email del administrador (recibe copia de las solicitudes de visita)
const ADMIN_EMAIL = 'moleroprogramador@gmail.com';

// --- Inicializar clientes ---
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);