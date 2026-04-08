const SUPABASE_URL      = 'https://mgbftvxlqinxrthswqih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nYmZ0dnhscWlueHJ0aHN3cWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjQyNDQsImV4cCI6MjA4NDYwMDI0NH0.f6c8-_Yc59Y2D3JNk5PV6rxYFBHxg0nT9ng6IElbuBU';
 
const EMAILJS_PUBLIC_KEY            = 'UM986XzXpgyzXW_vs';
const EMAILJS_SERVICE_ID            = 'service\_afa48tb ';
const EMAILJS_TEMPLATE_VISITA_ADMIN = 'template_du605di';
const ADMIN_EMAIL                   = 'moleroprogramador@gmail.com';
 
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);
