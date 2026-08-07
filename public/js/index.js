async function cargar() {
  const proyectos = await api.get('/proyectos');
  const tbody = document.getElementById('tabla-proyectos');
  const vacio = document.getElementById('vacio');
  tbody.innerHTML = '';
  vacio.style.display = proyectos.length ? 'none' : '';

  for (const p of proyectos) {
    const r = p.resumen;
    const fila = el(`
      <tr style="cursor:pointer">
        <td data-label="Obra"><a href="/proyecto.html?id=${p.id}">${escapeHtml(p.nombre)}</a></td>
        <td data-label="Presupuesto original">${fmtMoney(p.monto_presupuesto_original)} <span class="muted">(${fmtFecha(p.fecha_presupuesto_original)})</span></td>
        <td class="num" data-label="Monto vigente">${fmtMoney(r.monto_vigente)}</td>
        <td class="num" data-label="Certificado">${fmtMoney(r.certificado_acumulado)}</td>
        <td class="num" data-label="Saldo pendiente">${fmtMoney(r.saldo_pendiente)}</td>
        <td data-label="Avance">${meterHtml(r.porcentaje_avance)}</td>
      </tr>`);
    fila.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') location.href = `/proyecto.html?id=${p.id}`;
    });
    tbody.appendChild(fila);
  }
}

document.getElementById('btn-nuevo').addEventListener('click', () => {
  document.getElementById('form-nuevo').style.display = '';
});
document.getElementById('btn-cancelar').addEventListener('click', () => {
  document.getElementById('form-nuevo').style.display = 'none';
});

document.getElementById('btn-crear').addEventListener('click', async () => {
  const nombre = document.getElementById('f-nombre').value.trim();
  const fecha = document.getElementById('f-fecha').value;
  const monto = parseFloat(document.getElementById('f-monto').value);
  const descripcion = document.getElementById('f-descripcion').value.trim();
  const errorBox = document.getElementById('form-error');
  errorBox.innerHTML = '';

  if (!nombre || !fecha || !monto) {
    errorBox.innerHTML = '<div class="alert error">Completá nombre, fecha y monto.</div>';
    return;
  }
  try {
    const p = await api.post('/proyectos', {
      nombre, fecha_presupuesto_original: fecha, monto_presupuesto_original: monto, descripcion,
    });
    location.href = `/proyecto.html?id=${p.id}`;
  } catch (err) {
    mostrarError(errorBox, err);
  }
});

cargar();
