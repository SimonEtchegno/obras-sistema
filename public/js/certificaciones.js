const proyectoId = qs('proyecto');
document.getElementById('crumb-proyecto').href = `/proyecto.html?id=${proyectoId}`;
document.getElementById('tab-resumen').href = `/proyecto.html?id=${proyectoId}`;
document.getElementById('tab-uocra').href = `/uocra-historial.html?proyecto=${proyectoId}`;
document.getElementById('btn-nueva').addEventListener('click', () => {
  location.href = `/certificacion-nueva.html?proyecto=${proyectoId}`;
});

async function cargar() {
  const proyecto = await api.get(`/proyectos/${proyectoId}`);
  document.getElementById('crumb-proyecto').textContent = proyecto.nombre;
  document.title = `Certificaciones — ${proyecto.nombre}`;

  const lista = await api.get(`/proyectos/${proyectoId}/certificaciones`);
  const tbody = document.getElementById('tabla');
  const vacio = document.getElementById('vacio');
  tbody.innerHTML = '';
  vacio.style.display = lista.length ? 'none' : '';

  for (const c of lista) {
    const fila = el(`
      <tr data-id="${c.id}">
        <td data-label="N°">${c.numero ?? ''}</td>
        <td data-label="Fecha">${fmtFecha(c.fecha)}</td>
        <td data-label="Descripción">${escapeHtml(c.descripcion || '')}</td>
        <td class="num" data-label="Total certificado">${fmtMoney(c.total_certificado)}</td>
        <td class="right" data-label="Acciones">
          <button class="small" data-accion="ver">Ver</button>
          <button class="small danger" data-accion="borrar">Borrar</button>
        </td>
      </tr>`);
    const detalleFila = el(`<tr class="detalle" data-detalle-de="${c.id}" style="display:none"><td colspan="5"></td></tr>`);

    fila.querySelector('[data-accion="ver"]').addEventListener('click', async () => {
      const abierto = detalleFila.style.display !== 'none';
      detalleFila.style.display = abierto ? 'none' : '';
      if (!abierto && !detalleFila.dataset.cargado) {
        const detalle = await api.get(`/certificaciones/${c.id}`);
        detalleFila.querySelector('td').innerHTML = `
          <div class="table-scroll">
          <table style="margin:6px 0">
            <thead><tr><th>Ítem</th><th class="num">Monto vigente (al certificar)</th><th class="num">% certificado</th><th class="num">Monto certificado</th></tr></thead>
            <tbody>
              ${detalle.detalles.map((d) => `
                <tr>
                  <td>${escapeHtml(d.item_nombre)}</td>
                  <td class="num">${fmtMoney(d.monto_vigente_snapshot)}</td>
                  <td class="num">${d.porcentaje_certificado != null ? fmtPct(d.porcentaje_certificado) : '—'}</td>
                  <td class="num">${fmtMoney(d.monto_certificado)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          </div>`;
        detalleFila.dataset.cargado = '1';
      }
    });

    fila.querySelector('[data-accion="borrar"]').addEventListener('click', async () => {
      if (!confirm(`¿Borrar la certificación N° ${c.numero ?? c.id}? Esta acción no se puede deshacer.`)) return;
      await api.del(`/certificaciones/${c.id}`);
      cargar();
    });

    tbody.appendChild(fila);
    tbody.appendChild(detalleFila);
  }
}

cargar();
