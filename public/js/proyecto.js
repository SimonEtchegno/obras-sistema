const proyectoId = qs('id');
document.getElementById('tab-certificaciones').href = `/certificaciones.html?proyecto=${proyectoId}`;
document.getElementById('tab-uocra').href = `/uocra-historial.html?proyecto=${proyectoId}`;
document.getElementById('btn-nueva-cert').addEventListener('click', () => {
  location.href = `/certificacion-nueva.html?proyecto=${proyectoId}`;
});
document.getElementById('btn-nueva-uocra').addEventListener('click', () => {
  location.href = `/uocra-nueva.html?proyecto=${proyectoId}`;
});

async function cargarTodo() {
  const [proyecto, arbol] = await Promise.all([
    api.get(`/proyectos/${proyectoId}`),
    api.get(`/proyectos/${proyectoId}/items`),
  ]);
  renderCabecera(proyecto);
  renderArbol(arbol);
}

function renderCabecera(p) {
  document.title = `${p.nombre} — Sistema de Obras`;
  document.getElementById('crumb-nombre').textContent = p.nombre;
  document.getElementById('titulo').textContent = p.nombre;
  document.getElementById('subtitulo').textContent =
    `Presupuesto original: ${fmtMoney(p.monto_presupuesto_original)} al ${fmtFecha(p.fecha_presupuesto_original)}`;

  const r = p.resumen;
  const ICONS = {
    documento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    tendencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l5-5 4 4 7-7"/><path d="M15 8h5v5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 5-5"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  };
  document.getElementById('kpis').innerHTML = `
    <div class="kpi-tile"><span class="icon-chip neutral">${ICONS.documento}</span><div><div class="label">Presupuesto original</div><div class="value">${fmtMoney(p.monto_presupuesto_original)}</div></div></div>
    <div class="kpi-tile"><span class="icon-chip blue">${ICONS.tendencia}</span><div><div class="label">Monto vigente</div><div class="value accent">${fmtMoney(r.monto_vigente)}</div></div></div>
    <div class="kpi-tile"><span class="icon-chip neutral">${ICONS.check}</span><div><div class="label">Certificado acumulado</div><div class="value">${fmtMoney(r.certificado_acumulado)}</div></div></div>
    <div class="kpi-tile"><span class="icon-chip neutral">${ICONS.reloj}</span><div><div class="label">Saldo pendiente</div><div class="value">${fmtMoney(r.saldo_pendiente)}</div></div></div>`;

  document.getElementById('meter-general').innerHTML = `
    ${meterHtml(r.porcentaje_avance)}
    <p class="muted" style="margin:10px 0 0">Certificado ${fmtMoney(r.certificado_acumulado)} sobre ${fmtMoney(r.monto_vigente)} vigentes.</p>`;

  renderComparacionPresupuesto(p.monto_presupuesto_original, r.monto_vigente);
}

// Compara el presupuesto original contra el vigente (que ya incluye los
// aumentos UOCRA aplicados). Dos barras sobre el mismo eje: la original en
// gris de base, la vigente en el acento — así se ve de un vistazo cuánto
// infló el proyecto, sin tener que restar dos números de cabeza.
function renderComparacionPresupuesto(original, vigente) {
  const max = Math.max(original, vigente, 1);
  const pctOriginal = (original / max) * 100;
  const pctVigente = (vigente / max) * 100;
  const delta = vigente - original;
  const deltaPct = original > 0 ? (delta / original) * 100 : 0;

  let mensaje;
  if (Math.abs(delta) < 0.5) {
    mensaje = '<p class="compare-delta sin-cambios">Sin actualizaciones UOCRA todavía — el monto vigente es igual al presupuesto original.</p>';
  } else if (delta > 0) {
    mensaje = `<p class="compare-delta">Aumentó <b>${fmtMoney(delta)}</b> (+${deltaPct.toFixed(1)}%) sobre el presupuesto original, por actualizaciones UOCRA.</p>`;
  } else {
    mensaje = `<p class="compare-delta">El monto vigente quedó <b>${fmtMoney(Math.abs(delta))}</b> por debajo del presupuesto original.</p>`;
  }

  document.getElementById('compare-presupuesto').innerHTML = `
    <div class="compare-bars">
      <div class="compare-row" title="Presupuesto original: ${fmtMoney(original)}">
        <div class="compare-label">Original</div>
        <div class="compare-track"><div class="compare-fill base" style="width:${pctOriginal}%"></div></div>
        <div class="compare-value">${fmtMoney(original)}</div>
      </div>
      <div class="compare-row" title="Monto vigente: ${fmtMoney(vigente)}">
        <div class="compare-label">Vigente</div>
        <div class="compare-track"><div class="compare-fill actual" style="width:${pctVigente}%"></div></div>
        <div class="compare-value">${fmtMoney(vigente)}</div>
      </div>
    </div>
    ${mensaje}`;
}

function sumaPorcentajeHijos(nodo) {
  return nodo.hijos.reduce((acc, h) => acc + (Number(h.porcentaje) || 0), 0);
}

function renderArbol(raices) {
  const cont = document.getElementById('arbol');
  cont.innerHTML = '';
  if (!raices.length) {
    cont.innerHTML = '<div class="empty">No hay ítems todavía. Agregá el primero con "+ Nuevo ítem raíz".</div>';
    return;
  }
  raices.forEach((n) => cont.appendChild(renderNodo(n, true)));
}

function construirAvisos(item) {
  const avisos = [];
  if (!item.esHoja) {
    const suma = sumaPorcentajeHijos(item);
    if (Math.abs(suma - 100) > 0.5) {
      avisos.push(`<span class="badge warning" title="La suma de % de los sub-ítems no da 100%">⚠ ${suma.toFixed(1)}% repartido</span>`);
    }
    avisos.push('<span class="badge organizativo">organizativo</span>');
  } else {
    if (item.porcentaje_avance > 100.5) {
      avisos.push(`<span class="badge warning" title="Este ítem tiene más certificado que su monto vigente">⚠ ${fmtPct(item.porcentaje_avance)} certificado</span>`);
    }
  }
  return avisos;
}

function renderNodo(item, esRaiz) {
  const nodo = el(`<div class="tree-node ${esRaiz ? 'raiz' : ''}"></div>`);
  const card = el(`<div class="tree-card ${item.esHoja ? '' : 'organizativo'}"></div>`);
  pintarCard(card, item, 'ver');
  nodo.appendChild(card);

  if (item.hijos && item.hijos.length) {
    const hijosCont = el('<div class="tree-children"></div>');
    item.hijos.forEach((h) => hijosCont.appendChild(renderNodo(h, false)));
    nodo.appendChild(hijosCont);
  }

  return nodo;
}

function pintarCard(card, item, modo) {
  if (modo === 'ver') {
    const manualTag = item.monto_base_manual ? ' <span class="badge manual">manual</span>' : '';
    card.innerHTML = `
      <div class="tree-header">
        <span class="nombre-view">${escapeHtml(item.nombre)}</span>
        ${construirAvisos(item).join(' ')}
        <div class="acciones">
          <button class="small" data-accion="subitem">+ Subítem</button>
          <button class="small" data-accion="editar">Editar</button>
          <button class="small danger" data-accion="archivar">Archivar</button>
        </div>
      </div>
      <div class="tree-stats">
        <div class="tree-stat"><span class="stat-label">%</span><span class="stat-value">${item.porcentaje}%</span></div>
        <div class="tree-stat"><span class="stat-label">Monto</span><span class="stat-value">${fmtMoney(item.monto_base)}${manualTag}</span></div>
        <div class="tree-stat"><span class="stat-label">Vigente</span><span class="stat-value">${fmtMoney(item.monto_vigente)}</span></div>
        <div class="tree-stat"><span class="stat-label">Certificado</span><span class="stat-value">${fmtMoney(item.certificado_acumulado)}</span></div>
        <div class="tree-stat"><span class="stat-label">Saldo</span><span class="stat-value">${fmtMoney(item.saldo_pendiente)}</span></div>
        <div class="tree-stat avance"><span class="stat-label">Avance</span>${meterHtml(item.porcentaje_avance)}</div>
      </div>
      <div class="tree-add-form" style="display:none"></div>
    `;
    card.querySelector('[data-accion="editar"]').addEventListener('click', () => pintarCard(card, item, 'editar'));
    card.querySelector('[data-accion="archivar"]').addEventListener('click', () => archivarItem(item.id, item.nombre));
    card.querySelector('[data-accion="subitem"]').addEventListener('click', () => toggleFormSubitem(card, item.id));
  } else {
    card.innerHTML = `
      <div class="tree-header">
        <input class="nombre-input" type="text" value="${escapeHtml(item.nombre)}" data-f="nombre">
        <div class="acciones">
          <button class="small primary" data-accion="guardar">Guardar</button>
          <button class="small" data-accion="cancelar">Cancelar</button>
        </div>
      </div>
      <div class="tree-stats">
        <div class="tree-stat">
          <span class="stat-label">%</span>
          <input type="number" step="0.01" value="${item.porcentaje}" data-f="porcentaje">
        </div>
        <div class="tree-stat">
          <span class="stat-label">Monto
            <span class="toggle-manual"><input type="checkbox" data-f="manual" ${item.monto_base_manual ? 'checked' : ''}> manual</span>
          </span>
          <input type="number" step="1" value="${Math.round(item.monto_base)}" data-f="monto_base" ${item.monto_base_manual ? '' : 'disabled'}>
        </div>
        <div class="tree-stat"><span class="stat-label">Vigente</span><span class="stat-value">${fmtMoney(item.monto_vigente)}</span></div>
        <div class="tree-stat"><span class="stat-label">Certificado</span><span class="stat-value">${fmtMoney(item.certificado_acumulado)}</span></div>
        <div class="tree-stat"><span class="stat-label">Saldo</span><span class="stat-value">${fmtMoney(item.saldo_pendiente)}</span></div>
        <div class="tree-stat avance"><span class="stat-label">Avance</span>${meterHtml(item.porcentaje_avance)}</div>
      </div>
      <div class="tree-add-form" style="display:none"></div>
    `;
    const manualCheckbox = card.querySelector('[data-f="manual"]');
    const montoInput = card.querySelector('[data-f="monto_base"]');
    manualCheckbox.addEventListener('change', () => {
      montoInput.disabled = !manualCheckbox.checked;
    });
    card.querySelector('[data-accion="guardar"]').addEventListener('click', () => guardarItem(item.id, card));
    card.querySelector('[data-accion="cancelar"]').addEventListener('click', () => pintarCard(card, item, 'ver'));
  }
}

async function guardarItem(id, card) {
  const nombre = card.querySelector('[data-f="nombre"]').value.trim();
  const porcentaje = parseFloat(card.querySelector('[data-f="porcentaje"]').value) || 0;
  const manual = card.querySelector('[data-f="manual"]').checked;
  const montoInput = card.querySelector('[data-f="monto_base"]');
  if (!nombre) { alert('El ítem necesita un nombre.'); return; }
  const cambios = { nombre, porcentaje, monto_base_manual: manual };
  if (manual) cambios.monto_base = parseFloat(montoInput.value) || 0;
  try {
    await api.put(`/items/${id}`, cambios);
    await cargarTodo();
  } catch (err) {
    alert('No se pudo guardar: ' + err.message);
  }
}

async function archivarItem(id, nombre) {
  if (!confirm(`¿Archivar "${nombre}"? Se oculta de la lista pero no se borra su historial.`)) return;
  await api.patch(`/items/${id}/archivar`);
  await cargarTodo();
}

function toggleFormSubitem(card, parentId) {
  const formDiv = card.querySelector('.tree-add-form');
  if (formDiv.style.display !== 'none') {
    formDiv.style.display = 'none';
    formDiv.innerHTML = '';
    return;
  }
  formDiv.style.display = '';
  formDiv.innerHTML = `
    <div class="field-row" style="align-items:flex-end">
      <div class="field" style="flex:2"><label>Nombre del sub-ítem</label><input type="text" data-nuevo="nombre"></div>
      <div class="field" style="flex:1"><label>% del monto de este ítem</label><input type="number" step="0.01" data-nuevo="porcentaje"></div>
      <div class="field" style="flex:0"><button class="primary" data-nuevo="confirmar">Agregar</button></div>
    </div>`;
  formDiv.querySelector('[data-nuevo="confirmar"]').addEventListener('click', async () => {
    const nombre = formDiv.querySelector('[data-nuevo="nombre"]').value.trim();
    const porcentaje = parseFloat(formDiv.querySelector('[data-nuevo="porcentaje"]').value) || 0;
    if (!nombre) return;
    try {
      await api.post(`/proyectos/${proyectoId}/items`, { nombre, porcentaje, parent_id: parentId });
      await cargarTodo();
    } catch (err) {
      alert('No se pudo agregar: ' + err.message);
    }
  });
}

document.getElementById('btn-nuevo-item').addEventListener('click', () => {
  const div = document.getElementById('form-nuevo-item');
  if (div.style.display !== 'none') {
    div.style.display = 'none';
    div.innerHTML = '';
    return;
  }
  div.style.display = '';
  div.innerHTML = `
    <div class="field-row" style="align-items:flex-end">
      <div class="field" style="flex:2"><label>Nombre del ítem</label><input type="text" id="raiz-nombre"></div>
      <div class="field" style="flex:1"><label>% del presupuesto total</label><input type="number" step="0.01" id="raiz-porcentaje"></div>
      <div class="field" style="flex:0"><button class="primary" id="raiz-confirmar">Agregar</button></div>
    </div>`;
  document.getElementById('raiz-confirmar').addEventListener('click', async () => {
    const nombre = document.getElementById('raiz-nombre').value.trim();
    const porcentaje = parseFloat(document.getElementById('raiz-porcentaje').value) || 0;
    if (!nombre) return;
    try {
      await api.post(`/proyectos/${proyectoId}/items`, { nombre, porcentaje, parent_id: null });
      div.style.display = 'none';
      div.innerHTML = '';
      await cargarTodo();
    } catch (err) {
      alert('No se pudo agregar: ' + err.message);
    }
  });
});

cargarTodo();
