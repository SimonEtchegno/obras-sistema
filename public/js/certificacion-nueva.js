const proyectoId = qs('proyecto');
document.getElementById('crumb-proyecto').href = `/proyecto.html?id=${proyectoId}`;
document.getElementById('btn-cancelar').addEventListener('click', () => {
  location.href = `/certificaciones.html?proyecto=${proyectoId}`;
});

let hojas = [];

async function init() {
  const [proyecto, arbol, certificaciones] = await Promise.all([
    api.get(`/proyectos/${proyectoId}`),
    api.get(`/proyectos/${proyectoId}/items`),
    api.get(`/proyectos/${proyectoId}/certificaciones`),
  ]);
  document.getElementById('crumb-proyecto').textContent = proyecto.nombre;
  document.title = `Nueva certificación — ${proyecto.nombre}`;

  document.getElementById('f-numero').value = certificaciones.length + 1;
  document.getElementById('f-fecha').valueAsDate = new Date();

  hojas = flattenHojas(arbol);
  const tbody = document.getElementById('tabla-items');
  tbody.innerHTML = '';

  if (!hojas.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Este proyecto no tiene ítems finales todavía. Agregalos desde la página del proyecto.</td></tr>';
    return;
  }

  for (const h of hojas) {
    const fila = el(`
      <tr data-item="${h.id}" data-vigente="${h.monto_vigente}">
        <td data-label="Ítem">${escapeHtml(h.ruta)}</td>
        <td class="num" data-label="Monto vigente">${fmtMoney(h.monto_vigente)}</td>
        <td class="num" data-label="Saldo pendiente">${fmtMoney(h.saldo_pendiente)}</td>
        <td class="num" data-label="% este período"><input type="number" step="0.01" data-campo="pct" style="width:80px"></td>
        <td class="num" data-label="Monto este período"><input type="number" step="1" data-campo="monto" style="width:140px"></td>
      </tr>`);
    const pctInput = fila.querySelector('[data-campo="pct"]');
    const montoInput = fila.querySelector('[data-campo="monto"]');
    const vigente = h.monto_vigente;

    pctInput.addEventListener('input', () => {
      if (pctInput.value === '' || vigente <= 0) return;
      montoInput.value = Math.round(vigente * (parseFloat(pctInput.value) / 100));
    });
    montoInput.addEventListener('input', () => {
      if (montoInput.value === '' || vigente <= 0) return;
      pctInput.value = ((parseFloat(montoInput.value) / vigente) * 100).toFixed(2);
    });

    tbody.appendChild(fila);
  }
}

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errorBox = document.getElementById('error');
  const avisosBox = document.getElementById('avisos');
  errorBox.innerHTML = '';
  avisosBox.innerHTML = '';

  const numero = parseInt(document.getElementById('f-numero').value, 10) || null;
  const fecha = document.getElementById('f-fecha').value;
  const descripcion = document.getElementById('f-descripcion').value.trim();

  if (!fecha) {
    errorBox.innerHTML = '<div class="alert error">Falta la fecha de la certificación.</div>';
    return;
  }

  const detalles = [];
  document.querySelectorAll('#tabla-items tr[data-item]').forEach((fila) => {
    const pct = fila.querySelector('[data-campo="pct"]').value;
    const monto = fila.querySelector('[data-campo="monto"]').value;
    if (pct === '' && monto === '') return;
    detalles.push({
      item_id: Number(fila.dataset.item),
      porcentaje_certificado: pct === '' ? null : parseFloat(pct),
      monto_certificado: monto === '' ? null : parseFloat(monto),
    });
  });

  if (!detalles.length) {
    errorBox.innerHTML = '<div class="alert error">Cargá al menos un ítem con % o monto.</div>';
    return;
  }

  try {
    const resultado = await api.post(`/proyectos/${proyectoId}/certificaciones`, { numero, fecha, descripcion, detalles });
    if (resultado.avisos && resultado.avisos.length) {
      avisosBox.innerHTML = resultado.avisos.map((a) => `<div class="alert warning">⚠ ${escapeHtml(a)}</div>`).join('');
    }
    location.href = `/certificaciones.html?proyecto=${proyectoId}`;
  } catch (err) {
    mostrarError(errorBox, err);
  }
});

init();
