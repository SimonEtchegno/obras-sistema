const proyectoId = qs('proyecto');
document.getElementById('crumb-proyecto').href = `/proyecto.html?id=${proyectoId}`;
document.getElementById('tab-resumen').href = `/proyecto.html?id=${proyectoId}`;
document.getElementById('tab-certificaciones').href = `/certificaciones.html?proyecto=${proyectoId}`;
document.getElementById('btn-nueva').addEventListener('click', () => {
  location.href = `/uocra-nueva.html?proyecto=${proyectoId}`;
});

async function cargar() {
  const proyecto = await api.get(`/proyectos/${proyectoId}`);
  document.getElementById('crumb-proyecto').textContent = proyecto.nombre;
  document.title = `Actualizaciones UOCRA — ${proyecto.nombre}`;

  const lista = await api.get(`/proyectos/${proyectoId}/actualizaciones-uocra`);
  const tbody = document.getElementById('tabla');
  const vacio = document.getElementById('vacio');
  tbody.innerHTML = '';
  vacio.style.display = lista.length ? 'none' : '';

  for (const a of lista) {
    const fila = el(`
      <tr data-id="${a.id}">
        <td data-label="Fecha">${fmtFecha(a.fecha)}</td>
        <td data-label="Motivo">${escapeHtml(a.motivo || '')}</td>
        <td data-label="Alcance">${a.alcance === 'todos' ? 'Todo el proyecto' : 'Selección de ítems'}</td>
        <td class="num" data-label="%">${fmtPct(a.porcentaje)}</td>
        <td class="num" data-label="Ajuste total">+${fmtMoney(a.total_ajuste)}</td>
        <td class="right" data-label="Acciones">
          <button class="small" data-accion="ver">Ver</button>
          <button class="small danger" data-accion="borrar">Borrar</button>
        </td>
      </tr>`);
    const detalleFila = el(`<tr class="detalle" data-detalle-de="${a.id}" style="display:none"><td colspan="6"></td></tr>`);

    fila.querySelector('[data-accion="ver"]').addEventListener('click', async () => {
      const abierto = detalleFila.style.display !== 'none';
      detalleFila.style.display = abierto ? 'none' : '';
      if (!abierto && !detalleFila.dataset.cargado) {
        const detalle = await api.get(`/actualizaciones-uocra/${a.id}`);
        detalleFila.querySelector('td').innerHTML = `
          <div class="table-scroll">
          <table style="margin:6px 0">
            <thead><tr><th>Ítem</th><th class="num">Saldo antes</th><th class="num">Ajuste</th><th class="num">Vigente después</th></tr></thead>
            <tbody>
              ${detalle.efectos.map((e) => `
                <tr>
                  <td>${escapeHtml(e.item_nombre)}</td>
                  <td class="num">${fmtMoney(e.saldo_pendiente_antes)}</td>
                  <td class="num">+${fmtMoney(e.monto_ajuste)}</td>
                  <td class="num">${fmtMoney(e.monto_vigente_despues)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          </div>`;
        detalleFila.dataset.cargado = '1';
      }
    });

    fila.querySelector('[data-accion="borrar"]').addEventListener('click', async () => {
      if (!confirm(`¿Borrar esta actualización UOCRA del ${fmtFecha(a.fecha)}? Esta acción no se puede deshacer.`)) return;
      const r = await api.del(`/actualizaciones-uocra/${a.id}`);
      if (r.advertencia) alert(r.advertencia);
      cargar();
    });

    tbody.appendChild(fila);
    tbody.appendChild(detalleFila);
  }
}

cargar();
