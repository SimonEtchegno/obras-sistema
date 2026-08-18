// Capa de datos 100% en el navegador (localStorage). Reemplaza temporalmente
// al backend con base de datos: mismo comportamiento, mismas reglas de
// negocio, pero sin servidor de por medio. Cuando se arme "el sistema
// entero" con una base de datos real, esta es la pieza que se reemplaza —
// las páginas no deberían necesitar cambios porque hablan con
// `api.get/post/put/patch/del`, no directamente con esto.
const LocalDB = (function () {
  const CLAVE = 'obras-sistema-datos-v1';

  function estructuraVacia() {
    return {
      proyectos: [],
      items: [],
      certificaciones: [],
      certificacionDetalles: [],
      actualizacionesUocra: [],
      actualizacionUocraEfectos: [],
      seq: {
        proyectos: 1, items: 1, certificaciones: 1,
        certificacionDetalles: 1, actualizacionesUocra: 1, actualizacionUocraEfectos: 1,
      },
    };
  }

  let data;
  let esPrimeraVez = false;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      data = JSON.parse(crudo);
    } else {
      data = estructuraVacia();
      esPrimeraVez = true;
    }
  } catch (e) {
    console.error('No se pudo leer localStorage, arranco de cero:', e);
    data = estructuraVacia();
  }
  // Completa campos por si vienen de una versión vieja de la estructura.
  data.seq = Object.assign(estructuraVacia().seq, data.seq);

  function guardar() {
    localStorage.setItem(CLAVE, JSON.stringify(data));
  }

  function nuevoId(tabla) {
    const id = data.seq[tabla]++;
    return id;
  }

  function ahora() {
    return new Date().toISOString();
  }

  // ---------- helpers de ítems / árbol (equivalente a services/rollups.js e itemsTree.js) ----------

  function getItem(id) {
    return data.items.find((i) => i.id === Number(id));
  }
  function getProyectoRaw(id) {
    return data.proyectos.find((p) => p.id === Number(id));
  }
  function requireProyecto(id) {
    const p = getProyectoRaw(id);
    if (!p) throw new Error('Ese proyecto ya no existe (puede que se haya reiniciado el almacenamiento). Volvé a la lista de proyectos.');
    return p;
  }
  function requireItem(id) {
    const i = getItem(id);
    if (!i) throw new Error('Ítem no encontrado.');
    return i;
  }

  function baseDelPadre(item) {
    if (item.parent_id) {
      const padre = getItem(item.parent_id);
      return padre ? padre.monto_base : 0;
    }
    const proyecto = getProyectoRaw(item.proyecto_id);
    return proyecto ? proyecto.monto_presupuesto_original : 0;
  }

  function recomputeSubtree(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    if (!item.monto_base_manual) {
      const base = baseDelPadre(item);
      item.monto_base = base * (Number(item.porcentaje) / 100);
    }
    data.items
      .filter((i) => i.parent_id === item.id && i.activo)
      .forEach((hijo) => recomputeSubtree(hijo.id));
  }

  function recomputeProyecto(proyectoId) {
    data.items
      .filter((i) => i.proyecto_id === Number(proyectoId) && i.parent_id == null && i.activo)
      .forEach((raiz) => recomputeSubtree(raiz.id));
  }

  function getAjustesUocraPorItem(proyectoId) {
    const idsActualizaciones = new Set(
      data.actualizacionesUocra.filter((a) => a.proyecto_id === Number(proyectoId)).map((a) => a.id)
    );
    const mapa = new Map();
    data.actualizacionUocraEfectos
      .filter((e) => idsActualizaciones.has(e.actualizacion_id))
      .forEach((e) => mapa.set(e.item_id, (mapa.get(e.item_id) || 0) + e.monto_ajuste));
    return mapa;
  }

  function getCertificadoPorItem(proyectoId) {
    const idsCert = new Set(
      data.certificaciones.filter((c) => c.proyecto_id === Number(proyectoId)).map((c) => c.id)
    );
    const mapa = new Map();
    data.certificacionDetalles
      .filter((d) => idsCert.has(d.certificacion_id))
      .forEach((d) => mapa.set(d.item_id, (mapa.get(d.item_id) || 0) + d.monto_certificado));
    return mapa;
  }

  // Árbol con montos calculados. Los ítems padre son organizativos: su total
  // es la suma de sus hijos, para no contar el presupuesto dos veces.
  function getArbolConRollups(proyectoId) {
    const items = data.items
      .filter((i) => i.proyecto_id === Number(proyectoId) && i.activo)
      .map((i) => Object.assign({}, i, { hijos: [], esHoja: true }));

    const ajustes = getAjustesUocraPorItem(proyectoId);
    const certificado = getCertificadoPorItem(proyectoId);

    const porId = new Map(items.map((i) => [i.id, i]));
    const raices = [];
    for (const it of items) {
      if (it.parent_id && porId.has(it.parent_id)) {
        const padre = porId.get(it.parent_id);
        padre.hijos.push(it);
        padre.esHoja = false;
      } else {
        raices.push(it);
      }
    }

    function calcular(nodo) {
      if (nodo.esHoja) {
        nodo.monto_vigente = nodo.monto_base + (ajustes.get(nodo.id) || 0);
        nodo.certificado_acumulado = certificado.get(nodo.id) || 0;
      } else {
        let vigente = 0;
        let cert = 0;
        for (const hijo of nodo.hijos) {
          calcular(hijo);
          vigente += hijo.monto_vigente;
          cert += hijo.certificado_acumulado;
        }
        nodo.monto_vigente = vigente;
        nodo.certificado_acumulado = cert;
      }
      nodo.saldo_pendiente = nodo.monto_vigente - nodo.certificado_acumulado;
      nodo.porcentaje_avance = nodo.monto_vigente > 0 ? (nodo.certificado_acumulado / nodo.monto_vigente) * 100 : 0;
      return nodo;
    }

    raices.forEach(calcular);
    return raices;
  }

  function listarHojas(proyectoId) {
    const hojas = [];
    function recorrer(nodo) {
      if (nodo.esHoja) hojas.push(nodo);
      else nodo.hijos.forEach(recorrer);
    }
    getArbolConRollups(proyectoId).forEach(recorrer);
    return hojas;
  }

  function resumenProyecto(proyectoId) {
    const raices = getArbolConRollups(proyectoId);
    let monto_vigente = 0;
    let certificado_acumulado = 0;
    raices.forEach((r) => { monto_vigente += r.monto_vigente; certificado_acumulado += r.certificado_acumulado; });
    const saldo_pendiente = monto_vigente - certificado_acumulado;
    const porcentaje_avance = monto_vigente > 0 ? (certificado_acumulado / monto_vigente) * 100 : 0;
    return { monto_vigente, certificado_acumulado, saldo_pendiente, porcentaje_avance };
  }

  // ---------- acciones: proyectos ----------

  function accionListarProyectos() {
    return data.proyectos
      .filter((p) => p.activo)
      .sort((a, b) => (a.fecha_creacion < b.fecha_creacion ? 1 : -1))
      .map((p) => Object.assign({}, p, { resumen: resumenProyecto(p.id) }));
  }

  function accionCrearProyecto(body) {
    const { nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original } = body || {};
    if (!nombre || !fecha_presupuesto_original || monto_presupuesto_original == null) {
      throw new Error('Faltan campos requeridos: nombre, fecha_presupuesto_original, monto_presupuesto_original.');
    }
    const proyecto = {
      id: nuevoId('proyectos'),
      nombre,
      descripcion: descripcion ?? null,
      fecha_presupuesto_original,
      monto_presupuesto_original: Number(monto_presupuesto_original),
      activo: 1,
      fecha_creacion: ahora(),
    };
    data.proyectos.push(proyecto);
    guardar();
    return proyecto;
  }

  function accionDetalleProyecto(id) {
    const p = getProyectoRaw(id);
    if (!p) throw new Error('Proyecto no encontrado.');
    return Object.assign({}, p, { resumen: resumenProyecto(p.id) });
  }

  function accionEditarProyecto(id, body) {
    const p = requireProyecto(id);
    p.nombre = body.nombre ?? p.nombre;
    p.descripcion = body.descripcion ?? p.descripcion;
    p.fecha_presupuesto_original = body.fecha_presupuesto_original ?? p.fecha_presupuesto_original;
    if (body.monto_presupuesto_original != null) p.monto_presupuesto_original = Number(body.monto_presupuesto_original);
    recomputeProyecto(p.id);
    guardar();
    return p;
  }

  function accionArchivarProyecto(id) {
    const p = getProyectoRaw(id);
    if (p) { p.activo = 0; guardar(); }
    return { ok: true };
  }

  function accionResumenProyecto(id) {
    return resumenProyecto(id);
  }

  // ---------- acciones: ítems ----------

  function accionArbolItems(proyectoId) {
    return getArbolConRollups(proyectoId);
  }

  function accionCrearItem(proyectoId, body) {
    requireProyecto(proyectoId);
    const { nombre, parent_id, orden, porcentaje, monto_base, monto_base_manual } = body || {};
    if (!nombre) throw new Error('El ítem necesita un nombre.');
    if (parent_id) {
      const padre = getItem(parent_id);
      if (!padre || padre.proyecto_id !== Number(proyectoId)) {
        throw new Error('El ítem padre indicado no existe en este proyecto.');
      }
    }
    const esManual = !!monto_base_manual;
    const item = {
      id: nuevoId('items'),
      proyecto_id: Number(proyectoId),
      parent_id: parent_id ? Number(parent_id) : null,
      nombre,
      orden: orden || 0,
      porcentaje: Number(porcentaje) || 0,
      monto_base: esManual && monto_base != null ? Number(monto_base) : 0,
      monto_base_manual: esManual ? 1 : 0,
      activo: 1,
    };
    data.items.push(item);
    recomputeSubtree(item.id);
    guardar();
    return item;
  }

  function accionEditarItem(id, cambios) {
    const item = requireItem(id);
    cambios = cambios || {};
    if (cambios.nombre !== undefined) item.nombre = cambios.nombre;
    if (cambios.orden !== undefined) item.orden = cambios.orden;
    if (cambios.porcentaje !== undefined) item.porcentaje = Number(cambios.porcentaje);
    if (cambios.parent_id !== undefined) {
      const nuevoPadre = cambios.parent_id;
      if (nuevoPadre) {
        let cursor = Number(nuevoPadre);
        while (cursor) {
          if (cursor === item.id) throw new Error('No se puede mover un ítem dentro de sí mismo.');
          const padre = getItem(cursor);
          cursor = padre ? padre.parent_id : null;
        }
      }
      item.parent_id = nuevoPadre ? Number(nuevoPadre) : null;
    }
    if (cambios.monto_base !== undefined && cambios.monto_base !== null) {
      item.monto_base = Number(cambios.monto_base);
      item.monto_base_manual = 1;
    }
    if (cambios.monto_base_manual !== undefined) {
      item.monto_base_manual = cambios.monto_base_manual ? 1 : 0;
    }
    recomputeSubtree(item.id);
    guardar();
    return item;
  }

  function accionArchivarItem(id) {
    const item = getItem(id);
    if (item) { item.activo = 0; guardar(); }
    return { ok: true };
  }

  // ---------- acciones: certificaciones ----------

  function accionListarCertificaciones(proyectoId) {
    return data.certificaciones
      .filter((c) => c.proyecto_id === Number(proyectoId))
      .map((c) => Object.assign({}, c, {
        total_certificado: data.certificacionDetalles
          .filter((d) => d.certificacion_id === c.id)
          .reduce((acc, d) => acc + d.monto_certificado, 0),
      }))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
  }

  function accionCrearCertificacion(proyectoId, datos) {
    requireProyecto(proyectoId);
    datos = datos || {};
    const hojas = new Map(listarHojas(proyectoId).map((h) => [h.id, h]));
    const avisos = [];

    const certificacion = {
      id: nuevoId('certificaciones'),
      proyecto_id: Number(proyectoId),
      numero: datos.numero ?? null,
      fecha: datos.fecha,
      descripcion: datos.descripcion ?? null,
      fecha_creacion: ahora(),
    };
    if (!certificacion.fecha) throw new Error('Falta la fecha de la certificación.');
    data.certificaciones.push(certificacion);

    for (const d of datos.detalles || []) {
      const item = hojas.get(Number(d.item_id));
      if (!item) {
        throw new Error(`El ítem ${d.item_id} no existe, está archivado, o tiene subdivisiones (solo se certifica sobre ítems finales).`);
      }
      const vigenteSnapshot = item.monto_vigente;
      let monto = d.monto_certificado;
      let porcentaje = d.porcentaje_certificado;
      if ((monto === undefined || monto === null) && porcentaje != null) {
        monto = vigenteSnapshot * (porcentaje / 100);
      } else if (monto != null && (porcentaje === undefined || porcentaje === null) && vigenteSnapshot > 0) {
        porcentaje = (monto / vigenteSnapshot) * 100;
      }
      if (monto == null) monto = 0;

      data.certificacionDetalles.push({
        id: nuevoId('certificacionDetalles'),
        certificacion_id: certificacion.id,
        item_id: item.id,
        monto_vigente_snapshot: vigenteSnapshot,
        porcentaje_certificado: porcentaje ?? null,
        monto_certificado: monto,
        observaciones: d.observaciones ?? null,
      });

      const nuevoAcumulado = (item.certificado_acumulado || 0) + monto;
      if (vigenteSnapshot > 0 && nuevoAcumulado > vigenteSnapshot + 0.01) {
        avisos.push(`El ítem "${item.nombre}" queda certificado en ${((nuevoAcumulado / vigenteSnapshot) * 100).toFixed(1)}% (supera el 100%).`);
      }
    }

    guardar();
    return { certificacionId: certificacion.id, avisos };
  }

  function accionDetalleCertificacion(id) {
    const cert = data.certificaciones.find((c) => c.id === Number(id));
    if (!cert) throw new Error('Certificación no encontrada.');
    const detalles = data.certificacionDetalles
      .filter((d) => d.certificacion_id === cert.id)
      .map((d) => Object.assign({}, d, { item_nombre: (getItem(d.item_id) || {}).nombre || '(ítem borrado)' }));
    return Object.assign({}, cert, { detalles });
  }

  function accionEditarCertificacion(id, cambios) {
    const cert = data.certificaciones.find((c) => c.id === Number(id));
    if (!cert) throw new Error('Certificación no encontrada.');
    cambios = cambios || {};
    cert.numero = cambios.numero ?? cert.numero;
    cert.fecha = cambios.fecha ?? cert.fecha;
    cert.descripcion = cambios.descripcion ?? cert.descripcion;
    guardar();
    return accionDetalleCertificacion(id);
  }

  function accionEliminarCertificacion(id) {
    data.certificacionDetalles = data.certificacionDetalles.filter((d) => d.certificacion_id !== Number(id));
    data.certificaciones = data.certificaciones.filter((c) => c.id !== Number(id));
    guardar();
    return { ok: true };
  }

  // ---------- acciones: actualizaciones UOCRA ----------

  function elegirItemsObjetivo(proyectoId, alcance, itemIds) {
    const hojas = listarHojas(proyectoId);
    if (alcance === 'seleccion') {
      const set = new Set((itemIds || []).map(Number));
      const objetivo = hojas.filter((h) => set.has(h.id));
      if (!objetivo.length) throw new Error('No se seleccionó ningún ítem para la actualización.');
      return objetivo;
    }
    return hojas;
  }

  function accionPreviewUocra(proyectoId, body) {
    requireProyecto(proyectoId);
    body = body || {};
    const objetivo = elegirItemsObjetivo(proyectoId, body.alcance, body.item_ids);
    return objetivo.map((item) => {
      const ajuste = item.saldo_pendiente * (body.porcentaje / 100);
      return {
        item_id: item.id,
        item_nombre: item.nombre,
        saldo_pendiente_antes: item.saldo_pendiente,
        monto_ajuste: ajuste,
        monto_vigente_despues: item.monto_vigente + ajuste,
      };
    });
  }

  function accionCrearUocra(proyectoId, datos) {
    requireProyecto(proyectoId);
    datos = datos || {};
    const objetivo = elegirItemsObjetivo(proyectoId, datos.alcance, datos.item_ids);

    const actualizacion = {
      id: nuevoId('actualizacionesUocra'),
      proyecto_id: Number(proyectoId),
      fecha: datos.fecha,
      porcentaje: Number(datos.porcentaje),
      alcance: datos.alcance,
      motivo: datos.motivo ?? null,
      fecha_creacion: ahora(),
    };
    data.actualizacionesUocra.push(actualizacion);

    const efectos = [];
    for (const item of objetivo) {
      const saldoAntes = item.saldo_pendiente;
      const ajuste = saldoAntes * (actualizacion.porcentaje / 100);
      const vigenteDespues = item.monto_vigente + ajuste;
      data.actualizacionUocraEfectos.push({
        id: nuevoId('actualizacionUocraEfectos'),
        actualizacion_id: actualizacion.id,
        item_id: item.id,
        saldo_pendiente_antes: saldoAntes,
        monto_ajuste: ajuste,
        monto_vigente_despues: vigenteDespues,
      });
      efectos.push({ item_id: item.id, item_nombre: item.nombre, saldo_pendiente_antes: saldoAntes, monto_ajuste: ajuste, monto_vigente_despues: vigenteDespues });
    }

    guardar();
    return { actualizacionId: actualizacion.id, efectos };
  }

  function accionListarUocra(proyectoId) {
    return data.actualizacionesUocra
      .filter((a) => a.proyecto_id === Number(proyectoId))
      .map((a) => Object.assign({}, a, {
        total_ajuste: data.actualizacionUocraEfectos
          .filter((e) => e.actualizacion_id === a.id)
          .reduce((acc, e) => acc + e.monto_ajuste, 0),
      }))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
  }

  function esLaMasReciente(proyectoId, actualizacionId) {
    const delProyecto = data.actualizacionesUocra
      .filter((a) => a.proyecto_id === Number(proyectoId))
      .sort((a, b) => (a.fecha_creacion < b.fecha_creacion ? 1 : -1));
    return !!delProyecto.length && delProyecto[0].id === Number(actualizacionId);
  }

  function accionDetalleUocra(id) {
    const act = data.actualizacionesUocra.find((a) => a.id === Number(id));
    if (!act) throw new Error('Actualización no encontrada.');
    const efectos = data.actualizacionUocraEfectos
      .filter((e) => e.actualizacion_id === act.id)
      .map((e) => Object.assign({}, e, { item_nombre: (getItem(e.item_id) || {}).nombre || '(ítem borrado)' }));
    return Object.assign({}, act, { efectos, es_la_mas_reciente: esLaMasReciente(act.proyecto_id, act.id) });
  }

  function accionEliminarUocra(id) {
    const act = data.actualizacionesUocra.find((a) => a.id === Number(id));
    if (!act) throw new Error('Actualización no encontrada.');
    const advertencia = !esLaMasReciente(act.proyecto_id, act.id)
      ? 'Ojo: esta no era la actualización UOCRA más reciente del proyecto. Borrarla puede dejar inconsistentes los ajustes calculados después de ella.'
      : null;
    data.actualizacionUocraEfectos = data.actualizacionUocraEfectos.filter((e) => e.actualizacion_id !== act.id);
    data.actualizacionesUocra = data.actualizacionesUocra.filter((a) => a.id !== act.id);
    guardar();
    return { ok: true, advertencia };
  }

  // ---------- ejemplo inicial (solo la primera vez que se abre en un navegador) ----------

  function sembrarEjemplo() {
    const proyecto = accionCrearProyecto({
      nombre: 'ALEM',
      fecha_presupuesto_original: '2025-06-05',
      monto_presupuesto_original: 53000000,
      descripcion: 'Ejemplo cargado a partir de la hoja de presupuesto original.',
    });
    const caner = accionCrearItem(proyecto.id, { nombre: 'Cañerías', porcentaje: 44 });
    accionCrearItem(proyecto.id, { nombre: 'Losas', porcentaje: 65, parent_id: caner.id });
    accionCrearItem(proyecto.id, { nombre: 'Paredes', porcentaje: 35, parent_id: caner.id });
    accionCrearItem(proyecto.id, { nombre: 'Cableado y col. llaves', porcentaje: 30 });
    const gabinetes = accionCrearItem(proyecto.id, { nombre: 'Gabinetes y tableros', porcentaje: 10 });
    accionCrearItem(proyecto.id, { nombre: 'TG y TGM', porcentaje: 60, parent_id: gabinetes.id });
    accionCrearItem(proyecto.id, { nombre: 'Resto de tableros', porcentaje: 40, parent_id: gabinetes.id });
    accionCrearItem(proyecto.id, { nombre: 'Montantes', porcentaje: 10 });
    accionCrearItem(proyecto.id, { nombre: 'Baterías porteros', porcentaje: 2 });
    accionCrearItem(proyecto.id, { nombre: 'Conex. bombas', porcentaje: 1 });
    accionCrearItem(proyecto.id, { nombre: 'Zanjeos varios', porcentaje: 1 });
    accionCrearItem(proyecto.id, { nombre: 'Tab. AA', porcentaje: 2 });
  }

  if (esPrimeraVez) {
    sembrarEjemplo();
  }

  // ---------- router ----------

  function dispatch(method, path, body) {
    const seg = path.split('?')[0].split('/').filter(Boolean);

    if (seg[0] === 'proyectos') {
      if (seg.length === 1 && method === 'GET') return accionListarProyectos();
      if (seg.length === 1 && method === 'POST') return accionCrearProyecto(body);
      if (seg.length === 2 && method === 'GET') return accionDetalleProyecto(seg[1]);
      if (seg.length === 2 && method === 'PUT') return accionEditarProyecto(seg[1], body);
      if (seg.length === 3 && seg[2] === 'archivar' && method === 'PATCH') return accionArchivarProyecto(seg[1]);
      if (seg.length === 3 && seg[2] === 'resumen' && method === 'GET') return accionResumenProyecto(seg[1]);
      if (seg.length === 3 && seg[2] === 'items' && method === 'GET') return accionArbolItems(seg[1]);
      if (seg.length === 3 && seg[2] === 'items' && method === 'POST') return accionCrearItem(seg[1], body);
      if (seg.length === 3 && seg[2] === 'certificaciones' && method === 'GET') return accionListarCertificaciones(seg[1]);
      if (seg.length === 3 && seg[2] === 'certificaciones' && method === 'POST') return accionCrearCertificacion(seg[1], body);
      if (seg.length === 3 && seg[2] === 'actualizaciones-uocra' && method === 'GET') return accionListarUocra(seg[1]);
      if (seg.length === 3 && seg[2] === 'actualizaciones-uocra' && method === 'POST') return accionCrearUocra(seg[1], body);
      if (seg.length === 4 && seg[2] === 'actualizaciones-uocra' && seg[3] === 'preview' && method === 'POST') return accionPreviewUocra(seg[1], body);
    }
    if (seg[0] === 'items') {
      if (seg.length === 2 && method === 'PUT') return accionEditarItem(seg[1], body);
      if (seg.length === 3 && seg[2] === 'archivar' && method === 'PATCH') return accionArchivarItem(seg[1]);
    }
    if (seg[0] === 'certificaciones' && seg.length === 2) {
      if (method === 'GET') return accionDetalleCertificacion(seg[1]);
      if (method === 'PUT') return accionEditarCertificacion(seg[1], body);
      if (method === 'DELETE') return accionEliminarCertificacion(seg[1]);
    }
    if (seg[0] === 'actualizaciones-uocra' && seg.length === 2) {
      if (method === 'GET') return accionDetalleUocra(seg[1]);
      if (method === 'DELETE') return accionEliminarUocra(seg[1]);
    }
    throw new Error(`Ruta local no reconocida: ${method} ${path}`);
  }

  return { dispatch };
})();

export default LocalDB;
