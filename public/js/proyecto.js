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
  renderPieGeneral(arbol, proyecto.resumen);
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

// Torta de composición del presupuesto: cada porción es un ítem raíz, con
// tamaño proporcional a su monto vigente (así siempre cierra en 360°, aunque
// los % nominales cargados no sumen exactamente 100). Al pasar el mouse la
// porción crece 30% y se revela, en un anillo interno, el reparto entre sus
// sub-ítems — en tonos de la misma gama de color que la porción padre.
const PIE_SIZE = 340;
const PIE_CENTER = PIE_SIZE / 2;
const PIE_OUTER_R = 125;
const PIE_OUTER_R_INNER = 65; // anillo de hover 50% más ancho (era 40 de espesor, ahora 60)
const PIE_INNER_R = 61;
const PIE_INNER_R_INNER = 32;

function hslStr(h, s, l) {
  return `hsl(${h.toFixed(1)}deg ${s}% ${l}%)`;
}

function pieHues(n) {
  const start = 208; // mismo tono que --accent, para que la primera porción quede "de la casa"
  const golden = 137.508;
  return Array.from({ length: n }, (_, i) => (start + i * golden) % 360);
}

function polarPoint(r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [PIE_CENTER + r * Math.cos(a), PIE_CENTER + r * Math.sin(a)];
}

function donutSlicePath(rOuter, rInner, startAngle, endAngle) {
  // Si una porción cubre (casi) los 360°, el punto de inicio y de fin del
  // arco caen tan cerca que, redondeados, quedan idénticos — y el navegador
  // omite el trazo entero (arco "degenerado"). Dejamos un huequito de 0.5°
  // (imperceptible) para que los extremos del path siempre queden distintos.
  const span = Math.min(endAngle - startAngle, 359.5);
  endAngle = startAngle + span;
  const largeArc = span > 180 ? 1 : 0;
  const [x1, y1] = polarPoint(rOuter, startAngle);
  const [x2, y2] = polarPoint(rOuter, endAngle);
  const [x3, y3] = polarPoint(rInner, endAngle);
  const [x4, y4] = polarPoint(rInner, startAngle);
  return [
    `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function renderPieGeneral(raices, resumen) {
  const cont = document.getElementById('pie-general');
  cont.innerHTML = '';

  const nodos = raices.filter((n) => n.monto_vigente > 0);
  if (!nodos.length) {
    cont.innerHTML = '<div class="empty">Todavía no hay ítems con monto para graficar.</div>';
    return;
  }

  const total = nodos.reduce((acc, n) => acc + n.monto_vigente, 0) || 1;
  const hues = pieHues(nodos.length);

  let acumulado = 0;
  const slices = nodos.map((n, i) => {
    const share = n.monto_vigente / total;
    const startAngle = acumulado * 360;
    acumulado += share;
    const endAngle = acumulado * 360;
    return { nodo: n, hue: hues[i], startAngle, endAngle, share };
  });

  // Cada porción se dibuja dos veces: una "visual" (la que se ve y se anima
  // al 1.3x con CSS transform) y otra "hit" invisible y del mismo tamaño de
  // reposo, encima, que es la única que escucha mouseenter/mouseleave. Si el
  // hover se detectara sobre la porción visual, al agrandarse su borde
  // interno se corre hacia afuera y en algún punto "se come" al cursor —
  // dispara mouseleave, se achica, el cursor vuelve a quedar adentro, dispara
  // mouseenter de nuevo... y la porción titila creciendo y achicándose sola.
  // Con una zona de hover que nunca cambia de tamaño, ese parpadeo desaparece
  // sin importar cuán chico sea el gráfico.
  const svgSlices = slices
    .map((s, i) => {
      const d = donutSlicePath(PIE_OUTER_R, PIE_OUTER_R_INNER, s.startAngle, s.endAngle);
      return `<path class="pie-slice-visual" d="${d}" fill="${hslStr(s.hue, 62, 56)}" style="transform-origin:${PIE_CENTER}px ${PIE_CENTER}px" data-idx="${i}"></path>`;
    })
    .join('');

  const svgHitAreas = slices
    .map((s, i) => {
      const d = donutSlicePath(PIE_OUTER_R, PIE_OUTER_R_INNER, s.startAngle, s.endAngle);
      return `<path class="pie-slice-hit" d="${d}" data-idx="${i}"><title>${escapeHtml(s.nodo.nombre)} — ${fmtPct(s.share * 100)}</title></path>`;
    })
    .join('');

  const svgChildren = slices
    .map((s, i) => {
      const hijosConMonto = (s.nodo.hijos || []).filter((h) => h.monto_vigente > 0);
      if (!hijosConMonto.length) return '';
      const totalHijos = hijosConMonto.reduce((acc, h) => acc + h.monto_vigente, 0) || 1;
      let acc2 = s.startAngle;
      const arcos = hijosConMonto
        .map((h, j) => {
          const shareH = h.monto_vigente / totalHijos;
          const a1 = acc2;
          acc2 += shareH * (s.endAngle - s.startAngle);
          const a2 = acc2;
          const lightness = 38 + (j % 4) * 11; // variaciones de la misma gama del padre
          const d = donutSlicePath(PIE_INNER_R, PIE_INNER_R_INNER, a1, a2);
          return `<path class="pie-subslice" d="${d}" fill="${hslStr(s.hue, 55, lightness)}"></path>`;
        })
        .join('');
      return `<g class="pie-children" data-idx="${i}">${arcos}</g>`;
    })
    .join('');

  cont.innerHTML = `
    <div class="pie-wrap">
      <svg class="pie-svg" viewBox="0 0 ${PIE_SIZE} ${PIE_SIZE}">
        <g id="pie-outer">${svgSlices}</g>
        <g id="pie-inner">${svgChildren}</g>
        <g id="pie-hit">${svgHitAreas}</g>
        <text class="pie-center-value" id="pie-center-value" x="${PIE_CENTER}" y="${PIE_CENTER - 6}" text-anchor="middle">${fmtMoney(resumen.monto_vigente)}</text>
        <text class="pie-center-label" id="pie-center-label" x="${PIE_CENTER}" y="${PIE_CENTER + 16}" text-anchor="middle">Monto vigente total</text>
      </svg>
      <div class="pie-legend" id="pie-legend"></div>
    </div>`;

  const legendCont = document.getElementById('pie-legend');
  const centerValue = document.getElementById('pie-center-value');
  const centerLabel = document.getElementById('pie-center-label');

  function pintarLeyendaDefault() {
    legendCont.innerHTML = `
      <div class="pie-legend-title">Ítems del presupuesto</div>
      <div class="pie-legend-list">
        ${slices
          .map(
            (s) => `
          <div class="pie-legend-row">
            <span class="pie-swatch" style="background:${hslStr(s.hue, 62, 56)}"></span>
            <span class="pie-legend-nombre">${escapeHtml(s.nodo.nombre)}</span>
            <span class="pie-legend-pct">${fmtPct(s.share * 100)}</span>
          </div>`
          )
          .join('')}
      </div>
      <p class="pie-hint muted">Pasá el mouse sobre una porción para ver el detalle de sus sub-ítems.</p>`;
  }

  function pintarLeyendaHover(s) {
    const hijosConMonto = (s.nodo.hijos || []).filter((h) => h.monto_vigente > 0);
    if (!hijosConMonto.length) {
      legendCont.innerHTML = `
        <div class="pie-legend-title">${escapeHtml(s.nodo.nombre)}</div>
        <div class="pie-legend-row destacada">
          <span class="pie-swatch" style="background:${hslStr(s.hue, 62, 56)}"></span>
          <span class="pie-legend-nombre">${s.nodo.esHoja ? 'Ítem final, sin sub-ítems' : 'Sin sub-ítems con monto'}</span>
          <span class="pie-legend-pct">${fmtPct(s.share * 100)}</span>
        </div>
        <div class="pie-legend-detalle">
          <div><span class="muted">Monto vigente</span><b>${fmtMoney(s.nodo.monto_vigente)}</b></div>
          <div><span class="muted">Certificado</span><b>${fmtMoney(s.nodo.certificado_acumulado)}</b></div>
          <div><span class="muted">Avance</span><b>${fmtPct(s.nodo.porcentaje_avance)}</b></div>
        </div>`;
      return;
    }
    const totalHijos = hijosConMonto.reduce((acc, h) => acc + h.monto_vigente, 0) || 1;
    legendCont.innerHTML = `
      <div class="pie-legend-title">${escapeHtml(s.nodo.nombre)} <span class="muted">— ${fmtPct(s.share * 100)} del total</span></div>
      <div class="pie-legend-list">
        ${hijosConMonto
          .map((h, j) => {
            const lightness = 38 + (j % 4) * 11;
            const pctDelPadre = (h.monto_vigente / totalHijos) * 100;
            return `
          <div class="pie-legend-row">
            <span class="pie-swatch" style="background:${hslStr(s.hue, 55, lightness)}"></span>
            <span class="pie-legend-nombre">${escapeHtml(h.nombre)}</span>
            <span class="pie-legend-pct">${fmtPct(pctDelPadre)}</span>
            <span class="pie-legend-monto">${fmtMoney(h.monto_vigente)}</span>
          </div>`;
          })
          .join('')}
      </div>`;
  }

  pintarLeyendaDefault();

  slices.forEach((s, i) => {
    const hitPath = cont.querySelector(`.pie-slice-hit[data-idx="${i}"]`);
    const visualPath = cont.querySelector(`.pie-slice-visual[data-idx="${i}"]`);
    const gHijos = cont.querySelector(`.pie-children[data-idx="${i}"]`);
    hitPath.addEventListener('mouseenter', () => {
      visualPath.classList.add('hover');
      if (gHijos) gHijos.classList.add('visible');
      centerValue.textContent = fmtMoney(s.nodo.monto_vigente);
      centerLabel.textContent = s.nodo.nombre;
      pintarLeyendaHover(s);
    });
    hitPath.addEventListener('mouseleave', () => {
      visualPath.classList.remove('hover');
      if (gHijos) gHijos.classList.remove('visible');
      centerValue.textContent = fmtMoney(resumen.monto_vigente);
      centerLabel.textContent = 'Monto vigente total';
      pintarLeyendaDefault();
    });
  });
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
