// Listado de vehículos, filtros y búsqueda

let allVehiculos = [];

async function loadVehiculos() {
  try {
    const { data, error } = await db
      .from('vehiculo')
      .select('*, vehiculo_imagenes(imagen)')
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;
    allVehiculos = data || [];

    const stat = document.getElementById('statTotal');
    if (stat) stat.textContent = allVehiculos.filter(v => !v.reservado).length;

    applyFilters();
  } catch (err) {
    console.error(err);
    showToast('Error al cargar vehículos', 'error');
    document.getElementById('vehiculosGrid').innerHTML = `
      <div class="no-results" style="grid-column:1/-1">
        <div class="no-results-icon">⚠️</div>
        <div class="no-results-title">Error al cargar</div>
        <div class="no-results-sub">Comprueba tu conexión e inténtalo de nuevo</div>
      </div>`;
  }
}

function applyFilters() {
  const search     = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const combustible = document.getElementById('filterCombustible')?.value || '';
  const color      = document.getElementById('filterColor')?.value.toLowerCase().trim() || '';
  const anoMin     = parseInt(document.getElementById('filterAnoMin')?.value) || 0;
  const precioMax  = parseFloat(document.getElementById('filterPrecioMax')?.value) || Infinity;
  const orden      = document.getElementById('filterOrden')?.value || 'fecha_desc';

  let filtered = allVehiculos.filter(v => {
    if (v.reservado) return false;
    if (search && !v.marca_modelo?.toLowerCase().includes(search)) return false;
    if (combustible && v.tipo_combustible !== combustible) return false;
    if (color && !v.color?.toLowerCase().includes(color)) return false;
    if (anoMin && v.ano_fabricacion < anoMin) return false;
    if (v.precio > precioMax) return false;
    return true;
  });

  // Ordenar
  filtered.sort((a, b) => {
    switch (orden) {
      case 'precio_asc':  return a.precio - b.precio;
      case 'precio_desc': return b.precio - a.precio;
      case 'ano_desc':    return b.ano_fabricacion - a.ano_fabricacion;
      case 'ano_asc':     return a.ano_fabricacion - b.ano_fabricacion;
      default:            return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
    }
  });

  const count = document.getElementById('filterCount');
  if (count) count.textContent = `Mostrando ${filtered.length} vehículo${filtered.length !== 1 ? 's' : ''}`;

  renderVehiculos(filtered);
}

function clearFilters() {
  document.getElementById('searchInput').value        = '';
  document.getElementById('filterCombustible').value  = '';
  document.getElementById('filterColor').value        = '';
  document.getElementById('filterAnoMin').value       = '';
  document.getElementById('filterPrecioMax').value    = '';
  document.getElementById('filterOrden').value        = 'fecha_desc';
  applyFilters();
}

function renderVehiculos(list) {
  const grid = document.getElementById('vehiculosGrid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-title">Sin resultados</div>
        <div class="no-results-sub">Prueba con otros filtros de búsqueda</div>
        <button class="btn btn-outline btn-sm" style="margin-top:1rem" onclick="clearFilters()">Limpiar filtros</button>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((v, i) => {
    const img = getImageUrl(v);
    const badge = getCombustibleBadge(v.tipo_combustible);
    return `
      <article class="vehicle-card" style="animation-delay:${i * 0.06}s" onclick="goToDetail('${v.id_vehiculo}')">
        <div class="vehicle-img-wrap">
          <img src="${img}" alt="${v.marca_modelo}" loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'200\\'><rect fill=\\'%23242424\\' width=\\'300\\' height=\\'200\\'/><text fill=\\'%23555\\' font-size=\\'14\\' x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\'>Sin imagen</text></svg>'">
          <div class="vehicle-badge">
            <span class="badge ${badge.cls}">${badge.label}</span>
          </div>
        </div>
        <div class="vehicle-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div class="vehicle-name">${v.marca_modelo}</div>
              <div class="vehicle-year">${v.ano_fabricacion}</div>
            </div>
            ${v.color ? `<span style="font-size:.76rem;background:var(--bg3);padding:2px 8px;border-radius:20px;color:var(--text2)">${v.color}</span>` : ''}
          </div>
          <div class="vehicle-specs">
            <div class="vehicle-spec"><i class="fa-solid fa-gauge-high"></i> ${v.kilometraje?.toLocaleString()} km</div>
            <div class="vehicle-spec"><i class="fa-solid fa-gas-pump"></i> ${v.tipo_combustible}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div class="vehicle-price">${v.precio?.toLocaleString('es-ES')} €</div>
              <div class="vehicle-price-sub">IVA incluido</div>
            </div>
            <span style="color:var(--primary);font-size:.85rem;font-weight:700">Ver más <i class="fa-solid fa-chevron-right"></i></span>
          </div>
        </div>
      </article>`;
  }).join('');
}

function goToDetail(id) {
  window.location.href = `pages/detalle.html?id=${id}`;
}

function getImageUrl(v) {
  const imgs = v.vehiculo_imagenes;
  if (imgs && imgs.length > 0) {
    const { data } = db.storage.from('ad-motors-images').getPublicUrl(imgs[0].imagen);
    return data.publicUrl;
  }
  return 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'200\'><rect fill=\'%23242424\' width=\'300\' height=\'200\'/><text fill=\'%23555\' font-size=\'14\' x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\'>Sin imagen</text></svg>';
}

function getCombustibleBadge(tipo) {
  const map = {
    GASOLINA:  { cls: 'badge-warning', label: 'Gasolina' },
    DIESEL:    { cls: 'badge-neutral', label: 'Diésel' },
    ELECTRICO: { cls: 'badge-success', label: 'Eléctrico' },
    HIBRIDO:   { cls: 'badge-primary', label: 'Híbrido' },
  };
  return map[tipo] || { cls: 'badge-neutral', label: tipo };
}

// Enter en búsqueda
document.getElementById('searchInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') applyFilters();
});

document.addEventListener('DOMContentLoaded', loadVehiculos);