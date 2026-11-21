-- ============================================================
-- AD Motors — Endurecimiento de seguridad (RLS)
-- ------------------------------------------------------------
-- Ejecutar completo en Supabase → SQL Editor.
--
-- Qué hace este script:
--   1. Elimina las políticas antiguas y permisivas.
--   2. Activa Row Level Security en todas las tablas.
--   3. Crea la función es_admin().
--   4. Cada usuario solo puede leer y modificar SUS datos.
--   5. Solo los administradores pueden escribir en el catálogo,
--      ver todas las compras y gestionar las solicitudes.
--   6. Restringe la escritura del bucket de imágenes a administradores.
--   7. Oculta columnas internas del catálogo al rol anónimo.
--
-- Requisitos:
--   - La tabla public.administradores(id_usuario uuid) debe existir
--     y contener el UUID de los administradores.
--   - Ejecutar como owner del proyecto (SQL Editor de Supabase).
--
-- IMPORTANTE:
--   Este script es idempotente: se puede volver a ejecutar.
--   Si alguna tabla no existe, créala antes de ejecutarlo.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Función de comprobación de administrador
-- ------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.administradores a
    where a.id_usuario = auth.uid()
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

comment on function public.es_admin() is
  'Devuelve true si el usuario autenticado está en public.administradores.';

-- ------------------------------------------------------------
-- 0.b Reserva atómica (la usa la web desde el navegador)
-- ------------------------------------------------------------
-- El navegador NO puede escribir directamente en vehiculo, compra ni
-- detallecompra. Esta función hace las tres operaciones en una sola
-- transacción y decide el precio en el servidor, no con lo que envíe
-- el cliente.
create or replace function public.crear_reserva(
  p_id_vehiculo text,
  p_estado text default 'PENDIENTE'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehiculo public.vehiculo%rowtype;
  v_id_compra public.compra.id_compra%type;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_estado is null or p_estado not in ('PENDIENTE', 'COMPLETADA') then
    raise exception 'Estado no válido';
  end if;

  -- Bloquea la fila para evitar dos reservas simultáneas.
  select *
    into v_vehiculo
    from public.vehiculo
   where id_vehiculo::text = p_id_vehiculo
     for update;

  if not found then
    raise exception 'Vehículo no encontrado';
  end if;

  if coalesce(v_vehiculo.reservado, false) then
    raise exception 'El vehículo ya está reservado';
  end if;

  insert into public.compra (fecha, total, estado, id_usuario)
  values (now(), v_vehiculo.precio, p_estado, auth.uid())
  returning id_compra into v_id_compra;

  insert into public.detallecompra
    (id_compra, id_vehiculo, cantidad, precio_unitario)
  values
    (v_id_compra, v_vehiculo.id_vehiculo, 1, v_vehiculo.precio);

  update public.vehiculo
     set reservado = true,
         fecha_reserva = now()
   where id_vehiculo = v_vehiculo.id_vehiculo;

  return v_id_compra::text;
end;
$$;

revoke all on function public.crear_reserva(text, text) from public;
grant execute on function public.crear_reserva(text, text) to authenticated;

comment on function public.crear_reserva(text, text) is
  'Crea una compra y su detalle, y reserva el vehículo de forma atómica.';

-- ------------------------------------------------------------
-- 1. Eliminar políticas antiguas de las tablas gestionadas
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'usuario',
        'vehiculo',
        'vehiculo_imagenes',
        'compra',
        'detallecompra',
        'solicitudes_revision',
        'administradores'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. Activar RLS
-- ------------------------------------------------------------
alter table public.usuario             enable row level security;
alter table public.vehiculo            enable row level security;
alter table public.vehiculo_imagenes   enable row level security;
alter table public.compra              enable row level security;
alter table public.detallecompra       enable row level security;
alter table public.solicitudes_revision enable row level security;
alter table public.administradores     enable row level security;

-- ------------------------------------------------------------
-- 3. administradores
--    Un usuario solo puede comprobar si SU propia fila existe.
--    La escritura queda reservada al service_role / SQL Editor.
-- ------------------------------------------------------------
create policy "administradores_select_own"
on public.administradores
for select
to authenticated
using (id_usuario = auth.uid());

-- ------------------------------------------------------------
-- 4. usuario
-- ------------------------------------------------------------
create policy "usuario_select_own"
on public.usuario
for select
to authenticated
using (id_usuario = auth.uid());

create policy "usuario_select_admin"
on public.usuario
for select
to authenticated
using (public.es_admin());

create policy "usuario_insert_own"
on public.usuario
for insert
to authenticated
with check (id_usuario = auth.uid());

create policy "usuario_update_own"
on public.usuario
for update
to authenticated
using (id_usuario = auth.uid())
with check (id_usuario = auth.uid());

create policy "usuario_update_admin"
on public.usuario
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "usuario_delete_own"
on public.usuario
for delete
to authenticated
using (id_usuario = auth.uid());

create policy "usuario_delete_admin"
on public.usuario
for delete
to authenticated
using (public.es_admin());

-- ------------------------------------------------------------
-- 5. vehiculo
--    Lectura pública del catálogo; escritura solo administradores.
-- ------------------------------------------------------------
create policy "vehiculo_select_public"
on public.vehiculo
for select
to anon, authenticated
using (true);

create policy "vehiculo_insert_admin"
on public.vehiculo
for insert
to authenticated
with check (public.es_admin());

create policy "vehiculo_update_admin"
on public.vehiculo
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "vehiculo_delete_admin"
on public.vehiculo
for delete
to authenticated
using (public.es_admin());

-- ------------------------------------------------------------
-- 6. vehiculo_imagenes
-- ------------------------------------------------------------
create policy "vehiculo_imagenes_select_public"
on public.vehiculo_imagenes
for select
to anon, authenticated
using (true);

create policy "vehiculo_imagenes_insert_admin"
on public.vehiculo_imagenes
for insert
to authenticated
with check (public.es_admin());

create policy "vehiculo_imagenes_update_admin"
on public.vehiculo_imagenes
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "vehiculo_imagenes_delete_admin"
on public.vehiculo_imagenes
for delete
to authenticated
using (public.es_admin());

-- ------------------------------------------------------------
-- 7. compra
-- ------------------------------------------------------------
create policy "compra_select_own"
on public.compra
for select
to authenticated
using (id_usuario = auth.uid());

create policy "compra_select_admin"
on public.compra
for select
to authenticated
using (public.es_admin());

create policy "compra_insert_own"
on public.compra
for insert
to authenticated
with check (id_usuario = auth.uid());

create policy "compra_update_admin"
on public.compra
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "compra_delete_admin"
on public.compra
for delete
to authenticated
using (public.es_admin());

-- ------------------------------------------------------------
-- 8. detallecompra
-- ------------------------------------------------------------
create policy "detallecompra_select_own"
on public.detallecompra
for select
to authenticated
using (
  public.es_admin()
  or exists (
    select 1
    from public.compra c
    where c.id_compra = detallecompra.id_compra
      and c.id_usuario = auth.uid()
  )
);

create policy "detallecompra_insert_own"
on public.detallecompra
for insert
to authenticated
with check (
  public.es_admin()
  or exists (
    select 1
    from public.compra c
    where c.id_compra = detallecompra.id_compra
      and c.id_usuario = auth.uid()
  )
);

create policy "detallecompra_update_admin"
on public.detallecompra
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "detallecompra_delete_admin"
on public.detallecompra
for delete
to authenticated
using (public.es_admin());

-- ------------------------------------------------------------
-- 9. solicitudes_revision
--    ANTES: SELECT USING (true) permitía a cualquiera leer
--    nombres, teléfonos y fechas de todos los clientes.
--    AHORA: cada usuario solo ve sus solicitudes; el admin ve todas.
-- ------------------------------------------------------------
create policy "solicitudes_select_own"
on public.solicitudes_revision
for select
to authenticated
using (id_usuario = auth.uid());

create policy "solicitudes_select_admin"
on public.solicitudes_revision
for select
to authenticated
using (public.es_admin());

create policy "solicitudes_insert_own"
on public.solicitudes_revision
for insert
to authenticated
with check (id_usuario = auth.uid());

create policy "solicitudes_insert_admin"
on public.solicitudes_revision
for insert
to authenticated
with check (public.es_admin());

create policy "solicitudes_update_admin"
on public.solicitudes_revision
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "solicitudes_delete_admin"
on public.solicitudes_revision
for delete
to authenticated
using (public.es_admin());

-- ------------------------------------------------------------
-- 10. Tabla pago (si existe)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.pago') is not null then
    execute 'alter table public.pago enable row level security';
    execute 'revoke all on public.pago from anon';
    execute 'revoke all on public.pago from authenticated';
    execute 'grant select, insert, update, delete on public.pago to authenticated';

    -- Eliminar políticas antiguas de pago
    declare
      r record;
    begin
      for r in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'pago'
      loop
        execute format('drop policy if exists %I on public.pago', r.policyname);
      end loop;
    end;

    execute $policy$
      create policy "pago_select_own"
      on public.pago
      for select
      to authenticated
      using (
        public.es_admin()
        or exists (
          select 1 from public.compra c
          where c.id_compra = pago.id_compra
            and c.id_usuario = auth.uid()
        )
      )
    $policy$;

    execute $policy$
      create policy "pago_insert_own"
      on public.pago
      for insert
      to authenticated
      with check (
        public.es_admin()
        or exists (
          select 1 from public.compra c
          where c.id_compra = pago.id_compra
            and c.id_usuario = auth.uid()
        )
      )
    $policy$;

    execute $policy$
      create policy "pago_update_admin"
      on public.pago
      for update
      to authenticated
      using (public.es_admin())
      with check (public.es_admin())
    $policy$;

    execute $policy$
      create policy "pago_delete_admin"
      on public.pago
      for delete
      to authenticated
      using (public.es_admin())
    $policy$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 11. Permisos de tablas
-- ------------------------------------------------------------
-- Supabase concede permisos amplios por defecto. Los quitamos y
-- concedemos solo lo que necesita cada rol.

-- anon: solo puede leer el catálogo y las imágenes.
revoke all on public.usuario              from anon;
revoke all on public.vehiculo             from anon;
revoke all on public.vehiculo_imagenes    from anon;
revoke all on public.compra               from anon;
revoke all on public.detallecompra        from anon;
revoke all on public.solicitudes_revision from anon;
revoke all on public.administradores      from anon;

grant select on public.vehiculo_imagenes to anon;
grant select (
  id_vehiculo,
  marca,
  modelo,
  descripcion,
  precio,
  ano_fabricacion,
  tipo_combustible,
  kilometraje,
  color,
  reservado,
  fecha_reserva,
  fecha_creacion,
  fecha_actualizacion,
  estado
) on public.vehiculo to anon;

-- authenticated: primero quitamos los permisos por defecto.
revoke all on public.usuario              from authenticated;
revoke all on public.vehiculo             from authenticated;
revoke all on public.vehiculo_imagenes    from authenticated;
revoke all on public.compra               from authenticated;
revoke all on public.detallecompra        from authenticated;
revoke all on public.solicitudes_revision from authenticated;
revoke all on public.administradores      from authenticated;

-- Datos propios: RLS limita las filas.
grant select, insert, update, delete on public.usuario              to authenticated;
grant select, insert, update, delete on public.vehiculo_imagenes    to authenticated;
grant select, insert, update, delete on public.solicitudes_revision to authenticated;

-- Compras: el usuario solo puede leer las suyas. La creación pasa
-- siempre por public.crear_reserva(); el admin puede actualizar/borrar.
grant select, update, delete on public.compra        to authenticated;
grant select, update, delete on public.detallecompra to authenticated;

-- La tabla de administradores solo permite leer la fila propia.
grant select on public.administradores to authenticated;

-- vehiculo: solo columnas públicas para usuarios normales.
-- Así `select('*')` desde el navegador no puede leer device_id,
-- created_at ni la columna legacy imagen. El panel admin usa estas
-- mismas columnas, por lo que sigue funcionando.
grant select (
  id_vehiculo,
  marca,
  modelo,
  descripcion,
  precio,
  ano_fabricacion,
  tipo_combustible,
  kilometraje,
  color,
  reservado,
  fecha_reserva,
  fecha_creacion,
  fecha_actualizacion,
  estado
) on public.vehiculo to authenticated;

-- Escritura del catálogo: la permite RLS solo a administradores.
grant insert (
  marca,
  modelo,
  descripcion,
  precio,
  ano_fabricacion,
  tipo_combustible,
  kilometraje,
  color,
  estado,
  fecha_actualizacion,
  reservado,
  fecha_reserva
) on public.vehiculo to authenticated;

grant update (
  marca,
  modelo,
  descripcion,
  precio,
  ano_fabricacion,
  tipo_combustible,
  kilometraje,
  color,
  estado,
  fecha_actualizacion,
  reservado,
  fecha_reserva
) on public.vehiculo to authenticated;

grant delete on public.vehiculo to authenticated;

-- NOTA: las reservas se crean con public.crear_reserva(), no escribiendo
-- directamente en vehiculo/compra/detallecompra desde el navegador.
-- El rol anon no tiene permiso sobre device_id, created_at ni imagen.

-- ------------------------------------------------------------
-- 12. Storage: bucket ad-motors-images
--     Lectura pública; escritura solo administradores.
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') like '%ad-motors-images%'
        or coalesce(with_check, '') like '%ad-motors-images%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "admotors_images_select_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'ad-motors-images');

create policy "admotors_images_insert_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ad-motors-images'
  and public.es_admin()
);

create policy "admotors_images_update_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ad-motors-images'
  and public.es_admin()
)
with check (
  bucket_id = 'ad-motors-images'
  and public.es_admin()
);

create policy "admotors_images_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ad-motors-images'
  and public.es_admin()
);

-- ------------------------------------------------------------
-- 13. Recargar la caché de PostgREST
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- VERIFICACIÓN (ejecutar por separado, con una sesión normal)
-- ============================================================
-- 1) Un usuario normal NO debe ver solicitudes de otros:
--    select * from public.solicitudes_revision;
--    (solo deben aparecer las filas con id_usuario = auth.uid())
--
-- 2) Un usuario normal NO debe poder modificar vehículos:
--    update public.vehiculo set precio = 1 where id_vehiculo = '...';
--    (debe fallar o afectar a 0 filas)
--
-- 3) Un usuario normal NO debe poder leer administradores ajenos:
--    select * from public.administradores;
--    (solo su propia fila, si es admin)
--
-- 4) El catálogo público debe seguir funcionando:
--    select id_vehiculo, marca, modelo, precio from public.vehiculo;
--
-- 5) La app móvil y el panel admin deben seguir funcionando con
--    un usuario presente en public.administradores.
-- ============================================================
