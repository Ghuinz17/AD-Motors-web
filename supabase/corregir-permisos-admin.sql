-- ============================================================
-- AD Motor's — corregir "permission denied for table administradores"
-- Ejecutar en el SQL Editor de Supabase (idempotente)
-- ============================================================

-- La función debe evaluarse con los permisos del propietario:
-- si se evalúa como el usuario, las políticas RLS que la llaman
-- (p. ej. usuario_update_admin) fallan al leer administradores.
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.administradores a
    WHERE a.id_usuario = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

-- Permiso de lectura necesario para la comprobación anterior y para el panel admin.
GRANT SELECT ON public.administradores TO authenticated;

-- Asegurar que el usuario pueda actualizar SIEMPRE su propia fila,
-- con independencia de la rama de administrador.
DROP POLICY IF EXISTS "usuario_update_own" ON public.usuario;
CREATE POLICY "usuario_update_own"
ON public.usuario
FOR UPDATE
TO authenticated
USING (auth.uid() = id_usuario)
WITH CHECK (auth.uid() = id_usuario);

-- ------------------------------------------------------------
-- Verificación (ambas deben dar true):
-- select has_table_privilege('authenticated', 'public.administradores', 'SELECT');
-- select prosecdef from pg_proc where proname = 'es_admin';
-- ------------------------------------------------------------
