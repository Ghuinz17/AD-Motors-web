-- ============================================================
-- AD Motor's — bloquear solicitudes de visita
-- en vehículos reservados o vendidos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION public.rechazar_visita_no_disponible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_encontrado boolean := false;
  v_estado     text;
  v_reservado  boolean := false;
  v_tiene_flag boolean := false;
BEGIN
  -- El flag antiguo "reservado" puede existir o no según la versión del esquema.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehiculo'
      AND column_name  = 'reservado'
  ) INTO v_tiene_flag;

  IF v_tiene_flag THEN
    EXECUTE 'SELECT true, lower(coalesce(estado, '''')), coalesce(reservado, false)
               FROM public.vehiculo
              WHERE id_vehiculo = $1'
      INTO v_encontrado, v_estado, v_reservado
      USING NEW.id_vehiculo;
  ELSE
    SELECT true, lower(coalesce(estado, '')), false
      INTO v_encontrado, v_estado, v_reservado
      FROM public.vehiculo
     WHERE id_vehiculo = NEW.id_vehiculo;
  END IF;

  IF NOT coalesce(v_encontrado, false) THEN
    RAISE EXCEPTION 'Vehículo no encontrado'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_reservado OR v_estado IN ('reservado', 'vendido') THEN
    RAISE EXCEPTION 'Este vehículo no admite solicitudes de visita'
      USING ERRCODE = 'check_violation',
            DETAIL  = format('Estado actual: %s', coalesce(v_estado, 'reservado'));
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rechazar_visita_no_disponible() TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_rechazar_visita_no_disponible
  ON public.solicitudes_revision;

CREATE TRIGGER trg_rechazar_visita_no_disponible
BEFORE INSERT OR UPDATE OF id_vehiculo ON public.solicitudes_revision
FOR EACH ROW
EXECUTE FUNCTION public.rechazar_visita_no_disponible();

-- Prueba (sustituye el id por uno reservado/vendido):
-- INSERT INTO public.solicitudes_revision
--   (id_vehiculo, nombre_asistente, telefono, fecha_visita, hora_visita)
-- VALUES ('ID_DEL_VEHICULO', 'Prueba', '600000000', current_date + 1, '10:00');
-- Debe fallar: "Este vehículo no admite solicitudes de visita"
