const proyectoId = qs('proyecto');
document.getElementById('crumb-proyecto').href = `/proyecto.html?id=${proyectoId}`;
document.getElementById('btn-cancelar').addEventListener('click', () => {
  location.href = `/uocra-historial.html?proyecto=${proyectoId}`;
});

let hojas = [];

async function init() {
  const [proyecto, arbol] = await Promise.all([
    api.get(`/proyectos/${proyectoId}`),
    api.get(`/proyectos/${proyectoId}/items`),
  ]);
  document.getElementById('crumb-proyecto').textContent = proyecto.nombre;
  document.title = `Nueva actualización UOCRA — ${proyecto.nombre}`;
  document.getElementById('f-fecha').valueAsDate = new Date();

  hojas = flattenHojas(arbol);

  const cont = document.getElementById('seleccion-items');
  cont.innerHTML = hojas.map((h) => `
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0">
      <input type="checkbox" value="${h.id}" class="chk-item">
      ${escapeHtml(h.ruta)} <span class="muted">(saldo ${fmtMoney(h.saldo_pendiente)})</span>
    </label>`).join('') || '<p class="empty">Este proyecto no tiene ítems finales todavía.</p>';

  document.querySelectorAll('input[name="alcance"]').forEach((r) => r.addEventListener('change', onCambio));
  document.querySelectorAll('.chk-item').forEach((c) => c.addEventListener('change', actualizarPreview));
  document.getElementById('f-porcentaje').addEventListener('input', actualizarPreview);
}

function onCambio() {
  const seleccion = document.getElementById('alcance-seleccion').checked;
  document.getElementById('seleccion-items').style.display = seleccion ? '' : 'none';
  actualizarPreview();
}

function alcanceActual() {
  const alcance = document.querySelector('input[name="alcance"]:checked').value;
  const item_ids = alcance === 'seleccion'
    ? Array.from(document.querySelectorAll('.chk-item:checked')).map((c) => Number(c.value))
    : undefined;
  return { alcance, item_ids };
}

async function actualizarPreview() {
  const porcentaje = parseFloat(document.getElementById('f-porcentaje').value);
  const tbody = document.getElementById('tabla-preview');
  const vacio = document.getElementById('preview-vacio');
  if (isNaN(porcentaje)) {
    tbody.innerHTML = '';
    vacio.style.display = '';
    return;
  }
  const { alcance, item_ids } = alcanceActual();
  if (alcance === 'seleccion' && (!item_ids || !item_ids.length)) {
    tbody.innerHTML = '';
    vacio.textContent = 'Elegí al menos un ítem.';
    vacio.style.display = '';
    return;
  }
  try {
    const preview = await api.post(`/proyectos/${proyectoId}/actualizaciones-uocra/preview`, { alcance, item_ids, porcentaje });
    vacio.style.display = preview.length ? 'none' : '';
    tbody.innerHTML = preview.map((p) => `
      <tr>
        <td data-label="Ítem">${escapeHtml(p.item_nombre)}</td>
        <td class="num" data-label="Saldo pendiente antes">${fmtMoney(p.saldo_pendiente_antes)}</td>
        <td class="num" data-label="Ajuste">+${fmtMoney(p.monto_ajuste)}</td>
        <td class="num" data-label="Vigente después">${fmtMoney(p.monto_vigente_despues)}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = '';
    vacio.textContent = err.message;
    vacio.style.display = '';
  }
}

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errorBox = document.getElementById('error');
  errorBox.innerHTML = '';

  const fecha = document.getElementById('f-fecha').value;
  const porcentaje = parseFloat(document.getElementById('f-porcentaje').value);
  const motivo = document.getElementById('f-motivo').value.trim();
  const { alcance, item_ids } = alcanceActual();

  if (!fecha || isNaN(porcentaje)) {
    errorBox.innerHTML = '<div class="alert error">Completá fecha y % de aumento.</div>';
    return;
  }
  if (alcance === 'seleccion' && (!item_ids || !item_ids.length)) {
    errorBox.innerHTML = '<div class="alert error">Elegí al menos un ítem, o cambiá el alcance a "Todo el proyecto".</div>';
    return;
  }
  if (!confirm(`¿Confirmás aplicar ${porcentaje}% de aumento? Esta actualización queda registrada en el historial.`)) return;

  try {
    await api.post(`/proyectos/${proyectoId}/actualizaciones-uocra`, { fecha, porcentaje, alcance, item_ids, motivo });
    location.href = `/uocra-historial.html?proyecto=${proyectoId}`;
  } catch (err) {
    mostrarError(errorBox, err);
  }
});

init();
