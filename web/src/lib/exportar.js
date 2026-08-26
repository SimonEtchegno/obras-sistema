import * as XLSX from 'xlsx';
import { fmtFecha, fmtMoney, fmtPct, fmtTipoActualizacion } from './format.js';

function flattenNodos(nodos, nivel = 0) {
  const filas = [];
  for (const nodo of nodos) {
    filas.push({ nivel, nodo });
    if (nodo.hijos && nodo.hijos.length > 0) {
      filas.push(...flattenNodos(nodo.hijos, nivel + 1));
    }
  }
  return filas;
}

// La API devuelve una fila por ítem certificado (plana). Las agrupamos por
// certificacion_id para mostrar una cabecera por certificación y sus detalles.
function agruparCertificaciones(lista) {
  const mapa = new Map();
  for (const f of lista) {
    if (!mapa.has(f.certificacion_id)) {
      mapa.set(f.certificacion_id, {
        id: f.certificacion_id,
        fecha: f.fecha,
        titulo: f.titulo,
        detalles: [],
      });
    }
    mapa.get(f.certificacion_id).detalles.push({
      item_nombre: f.item_nombre,
      monto_certificado: f.monto_certificado,
    });
  }
  return [...mapa.values()];
}

export function exportarExcel(proyecto, arbol, certificacionesFlat, actualizaciones) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Ítems
  const itemsData = [
    ['Ítem', 'Monto vigente', 'Certificado', 'Saldo pendiente', 'Avance %'],
    ...flattenNodos(arbol).map(({ nivel, nodo }) => [
      '  '.repeat(nivel) + nodo.nombre,
      nodo.monto_vigente,
      nodo.certificado_acumulado,
      nodo.saldo_pendiente,
      nodo.porcentaje_avance,
    ]),
  ];
  const wsItems = XLSX.utils.aoa_to_sheet(itemsData);
  wsItems['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Ítems');

  // Hoja 2: Certificaciones
  const certs = agruparCertificaciones(certificacionesFlat);
  const certData = [['Fecha', 'Título / Descripción', '', 'Ítem', 'Monto certificado']];
  for (const c of certs) {
    const total = c.detalles.reduce((s, d) => s + d.monto_certificado, 0);
    certData.push([c.fecha, c.titulo || '—', `Total: ${total}`, '', '']);
    for (const d of c.detalles) {
      certData.push(['', '', '', d.item_nombre, d.monto_certificado]);
    }
  }
  const wsCert = XLSX.utils.aoa_to_sheet(certData);
  wsCert['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 36 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsCert, 'Certificaciones');

  // Hoja 3: Actualizaciones
  const actData = [
    ['Fecha', 'Tipo', 'Motivo', 'Porcentaje', 'Ajuste total', '', 'Ítem', 'Saldo antes', 'Ajuste', 'Vigente después'],
  ];
  for (const act of actualizaciones) {
    const totalAjuste = (act.efectos || []).reduce((s, e) => s + e.monto_ajuste, 0);
    actData.push([act.fecha, fmtTipoActualizacion(act.tipo), act.motivo || '', act.porcentaje, totalAjuste]);
    for (const ef of act.efectos || []) {
      actData.push(['', '', '', '', '', '', ef.item_nombre, ef.saldo_pendiente_antes, ef.monto_ajuste, ef.monto_vigente_despues]);
    }
  }
  const wsAct = XLSX.utils.aoa_to_sheet(actData);
  wsAct['!cols'] = [
    { wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 18 },
    { wch: 4 }, { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAct, 'Actualizaciones');

  const nombre = proyecto.nombre.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${nombre}_export.xlsx`);
}

export function exportarPDF(proyecto, arbol, certificacionesFlat, actualizaciones) {
  const flat = flattenNodos(arbol);
  const certs = agruparCertificaciones(certificacionesFlat);

  const filaItems = flat
    .map(
      ({ nivel, nodo }) =>
        `<tr class="nv${Math.min(nivel, 2)}">
          <td>${'&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(nivel)}${nodo.nombre}</td>
          <td class="r">${fmtMoney(nodo.monto_vigente)}</td>
          <td class="r">${fmtMoney(nodo.certificado_acumulado)}</td>
          <td class="r">${fmtMoney(nodo.saldo_pendiente)}</td>
          <td class="r">${fmtPct(nodo.porcentaje_avance)}</td>
        </tr>`
    )
    .join('');

  const filaCerts = certs.length === 0
    ? '<tr><td colspan="3" style="color:#888;text-align:center;padding:12px">Sin certificaciones registradas</td></tr>'
    : certs
        .map((c) => {
          const total = c.detalles.reduce((s, d) => s + d.monto_certificado, 0);
          const cabecera = `<tr class="cert-h">
            <td>${fmtFecha(c.fecha)}</td>
            <td>${c.titulo || '—'}</td>
            <td class="r">${fmtMoney(total)}</td>
          </tr>`;
          const detalles = c.detalles
            .map(
              (d) => `<tr class="cert-d">
                <td></td>
                <td>&nbsp;&nbsp;${d.item_nombre}</td>
                <td class="r">${fmtMoney(d.monto_certificado)}</td>
              </tr>`
            )
            .join('');
          return cabecera + detalles;
        })
        .join('');

  const filaActs = actualizaciones.length === 0
    ? '<tr><td colspan="5" style="color:#888;text-align:center;padding:12px">Sin actualizaciones registradas</td></tr>'
    : actualizaciones
        .map((act) => {
          const total = (act.efectos || []).reduce((s, e) => s + e.monto_ajuste, 0);
          const cabecera = `<tr class="act-h">
            <td>${fmtFecha(act.fecha)}</td>
            <td>${fmtTipoActualizacion(act.tipo)}</td>
            <td>${act.motivo || '—'}</td>
            <td class="r">${fmtPct(act.porcentaje)}</td>
            <td class="r">+${fmtMoney(total)}</td>
          </tr>`;
          const efectos = (act.efectos || [])
            .map(
              (ef) => `<tr class="act-e">
                <td colspan="2">&nbsp;&nbsp;${ef.item_nombre}</td>
                <td class="r">saldo: ${fmtMoney(ef.saldo_pendiente_antes)}</td>
                <td class="r">+${fmtMoney(ef.monto_ajuste)}</td>
                <td class="r">${fmtMoney(ef.monto_vigente_despues)}</td>
              </tr>`
            )
            .join('');
          return cabecera + efectos;
        })
        .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${proyecto.nombre} — Exportación</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 24px; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  h2 { font-size: 11px; margin: 24px 0 6px; color: #1a4a8a; border-bottom: 1.5px solid #c8d4e8; padding-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .meta { font-size: 10px; color: #666; margin-bottom: 22px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 4px; }
  thead th { background: #1a4a8a; color: #fff; padding: 5px 8px; text-align: left; font-weight: 600; }
  thead th.r { text-align: right; }
  tbody td { padding: 4px 8px; border-bottom: 1px solid #eaeaea; }
  tbody td.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nv0 td { font-weight: 700; background: #f3f4f6; }
  .nv1 td:first-child { padding-left: 20px; }
  .nv2 td:first-child { padding-left: 36px; }
  .cert-h td { background: #eef5ee; font-weight: 600; }
  .cert-d td { color: #444; }
  .act-h td { background: #eef2fa; font-weight: 600; }
  .act-e td { color: #444; }
  @media print { @page { margin: 15mm 12mm; size: A4; } body { padding: 0; } }
</style>
</head>
<body>
<h1>${proyecto.nombre}</h1>
<div class="meta">
  Presupuesto original: ${fmtMoney(proyecto.monto_presupuesto_original)} al ${fmtFecha(proyecto.fecha_presupuesto_original)}
  &nbsp;·&nbsp; Exportado el ${new Date().toLocaleDateString('es-AR')}
</div>

<h2>Ítems del presupuesto</h2>
<table>
  <thead>
    <tr>
      <th>Ítem</th>
      <th class="r">Monto vigente</th>
      <th class="r">Certificado</th>
      <th class="r">Saldo pendiente</th>
      <th class="r">Avance</th>
    </tr>
  </thead>
  <tbody>${filaItems}</tbody>
</table>

<h2>Historial de certificaciones</h2>
<table>
  <thead>
    <tr>
      <th>Fecha</th>
      <th>Título / Descripción</th>
      <th class="r">Total certificado</th>
    </tr>
  </thead>
  <tbody>${filaCerts}</tbody>
</table>

<h2>Historial de actualizaciones</h2>
<table>
  <thead>
    <tr>
      <th>Fecha</th>
      <th>Tipo</th>
      <th>Motivo</th>
      <th class="r">%</th>
      <th class="r">Ajuste total</th>
    </tr>
  </thead>
  <tbody>${filaActs}</tbody>
</table>

<script>window.onload = () => { window.focus(); window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Permitila para exportar a PDF.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
