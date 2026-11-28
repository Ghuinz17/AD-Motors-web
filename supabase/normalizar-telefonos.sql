-- ============================================================
-- AD Motor's — normalizar teléfonos en la base de datos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1) Función de normalización.
--    +34 600 000 000 / 0034 600000000 / 34600000000 -> 600000000
--    +1 202 555 0100                               -> +12025550100
--    Si no hay prefijo internacional, deja solo los dígitos.
CREATE OR REPLACE FUNCTION public.normalizar_telefono(p_telefono text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  WITH limpio AS (
    SELECT regexp_replace(p_telefono, '[^0-9+]', '', 'g') AS t
  )
  SELECT CASE
    WHEN t ~ '^\+34' THEN substring(t from 4)
    WHEN t ~ '^0034' THEN substring(t from 5)
    WHEN t ~ '^34\d{9}$' THEN substring(t from 3)
    WHEN t ~ '^\+' THEN t
    ELSE t
  END
  FROM limpio;
$$;

GRANT EXECUTE ON FUNCTION public.normalizar_telefono(text) TO anon, authenticated;

-- 2) Trigger para que todo teléfono nuevo o modificado se guarde normalizado.
CREATE OR REPLACE FUNCTION public.normalizar_telefono_usuario()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone := NULLIF(public.normalizar_telefono(NEW.phone), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_telefono_usuario ON public.usuario;
CREATE TRIGGER trg_normalizar_telefono_usuario
BEFORE INSERT OR UPDATE OF phone ON public.usuario
FOR EACH ROW
EXECUTE FUNCTION public.normalizar_telefono_usuario();

-- 3) Migración de los teléfonos que ya existen.
UPDATE public.usuario
SET phone = NULLIF(public.normalizar_telefono(phone), '')
WHERE phone IS NOT NULL
  AND phone <> public.normalizar_telefono(phone);

-- 4) Lo mismo para los teléfonos de contacto de las solicitudes de visita.
--    (Puedes omitir este bloque si no quieres tocar esa tabla.)
CREATE OR REPLACE FUNCTION public.normalizar_telefono_solicitud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.telefono := NULLIF(public.normalizar_telefono(NEW.telefono), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_telefono_solicitud ON public.solicitudes_revision;
CREATE TRIGGER trg_normalizar_telefono_solicitud
BEFORE INSERT OR UPDATE OF telefono ON public.solicitudes_revision
FOR EACH ROW
EXECUTE FUNCTION public.normalizar_telefono_solicitud();

UPDATE public.solicitudes_revision
SET telefono = NULLIF(public.normalizar_telefono(telefono), '')
WHERE telefono IS NOT NULL
  AND telefono <> public.normalizar_telefono(telefono);

-- 5) Opcional: restricción de formato para el teléfono de usuario.
--    Solo añadirla después de comprobar que no queden valores raros:
--    SELECT phone FROM public.usuario WHERE phone IS NOT NULL
--      AND phone !~ '^\d{9}$' AND phone !~ '^\+\d{1,15}$';
--
-- ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_phone_formato;
-- ALTER TABLE public.usuario ADD CONSTRAINT usuario_phone_formato
--   CHECK (phone IS NULL OR phone ~ '^\d{9}$' OR phone ~ '^\+\d{1,15}$');
