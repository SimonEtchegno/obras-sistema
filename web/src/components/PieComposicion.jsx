import { useMemo, useState } from 'react';
import cx from '../lib/cx.js';
import { fmtMoney, fmtPct } from '../lib/format.js';
import { hslStr, huesDeRaices, lightnessHijo } from '../lib/colores.js';
import { Empty } from './ui/index.js';

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
  const fin = startAngle + span;
  const largeArc = span > 180 ? 1 : 0;
  const [x1, y1] = polarPoint(rOuter, startAngle);
  const [x2, y2] = polarPoint(rOuter, fin);
  const [x3, y3] = polarPoint(rInner, fin);
  const [x4, y4] = polarPoint(rInner, startAngle);
  return [
    `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function hijosConMontoDe(nodo) {
  return (nodo.hijos || []).filter((h) => h.monto_vigente > 0);
}

function Swatch({ color }) {
  return <span className="h-[11px] w-[11px] shrink-0 rounded-[3px]" style={{ background: color }} />;
}

function FilaLeyenda({ color, nombre, pct, monto }) {
  return (
    <div className="flex items-center gap-2.5 text-[13.5px]">
      <Swatch color={color} />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink">{nombre}</span>
      <span className="min-w-[46px] text-right font-semibold tabular-nums text-ink-soft">{pct}</span>
      {monto && <span className="min-w-[92px] text-right text-[12.5px] tabular-nums text-ink-muted">{monto}</span>}
    </div>
  );
}

function LeyendaGeneral({ slices }) {
  return (
    <>
      <div className="mb-2.5 text-[14.5px] font-semibold">Ítems del presupuesto</div>
      <div className="flex flex-col gap-[9px]">
        {slices.map((s) => (
          <FilaLeyenda
            key={s.nodo.id}
            color={hslStr(s.hue, 62, 56)}
            nombre={s.nodo.nombre}
            pct={fmtPct(s.share * 100)}
          />
        ))}
      </div>
      <p className="mt-2.5 text-[12.5px] text-ink-muted">
        Pasá el mouse sobre una porción para ver el detalle de sus sub-ítems.
      </p>
    </>
  );
}

function LeyendaPorcion({ slice }) {
  const hijos = hijosConMontoDe(slice.nodo);

  if (!hijos.length) {
    return (
      <>
        <div className="mb-2.5 text-[14.5px] font-semibold">{slice.nodo.nombre}</div>
        <div className="flex items-center gap-2.5 py-1 text-[13.5px]">
          <Swatch color={hslStr(slice.hue, 62, 56)} />
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink">
            {slice.nodo.esHoja ? 'Ítem final, sin sub-ítems' : 'Sin sub-ítems con monto'}
          </span>
          <span className="min-w-[46px] text-right font-semibold tabular-nums text-ink-soft">
            {fmtPct(slice.share * 100)}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-1.5 text-[13.5px]">
          <div className="flex justify-between gap-3">
            <span className="text-ink-muted">Monto vigente</span>
            <b>{fmtMoney(slice.nodo.monto_vigente)}</b>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink-muted">Certificado</span>
            <b>{fmtMoney(slice.nodo.certificado_acumulado)}</b>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink-muted">Avance</span>
            <b>{fmtPct(slice.nodo.porcentaje_avance)}</b>
          </div>
        </div>
      </>
    );
  }

  const totalHijos = hijos.reduce((acc, h) => acc + h.monto_vigente, 0) || 1;
  return (
    <>
      <div className="mb-2.5 text-[14.5px] font-semibold">
        {slice.nodo.nombre} <span className="font-normal text-ink-muted">— {fmtPct(slice.share * 100)} del total</span>
      </div>
      <div className="flex flex-col gap-[9px]">
        {hijos.map((h, j) => (
          <FilaLeyenda
            key={h.id}
            color={hslStr(slice.hue, 55, lightnessHijo(j))}
            nombre={h.nombre}
            pct={fmtPct((h.monto_vigente / totalHijos) * 100)}
            monto={fmtMoney(h.monto_vigente)}
          />
        ))}
      </div>
    </>
  );
}

export function PieComposicion({ raices, resumen }) {
  const [activa, setActiva] = useState(null);

  const slices = useMemo(() => {
    // El tono se toma del lugar que ocupa el ítem en el árbol completo, no
    // entre los que entran al gráfico: así un ítem en cero no le corre el
    // color a los demás, y su tarjeta en el árbol coincide con su porción.
    const hues = huesDeRaices(raices.length);
    const nodos = raices
      .map((nodo, i) => ({ nodo, hue: hues[i] }))
      .filter(({ nodo }) => nodo.monto_vigente > 0);
    const total = nodos.reduce((acc, { nodo }) => acc + nodo.monto_vigente, 0) || 1;
    let acumulado = 0;
    return nodos.map(({ nodo, hue }) => {
      const share = nodo.monto_vigente / total;
      const startAngle = acumulado * 360;
      acumulado += share;
      return { nodo, hue, startAngle, endAngle: acumulado * 360, share };
    });
  }, [raices]);

  if (!slices.length) {
    return <Empty>Todavía no hay ítems con monto para graficar.</Empty>;
  }

  const slice = activa != null ? slices[activa] : null;

  return (
    <div className="flex flex-wrap items-center gap-8 max-sm:flex-col max-sm:items-stretch">
      <svg
        className="h-[375px] w-[375px] shrink-0 overflow-visible max-sm:h-auto max-sm:w-full max-sm:self-center"
        viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
      >
        <g>
          {slices.map((s, i) => (
            <path
              key={s.nodo.id}
              className="pointer-events-none stroke-surface stroke-2 transition-[transform,filter] duration-[220ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              d={donutSlicePath(PIE_OUTER_R, PIE_OUTER_R_INNER, s.startAngle, s.endAngle)}
              fill={hslStr(s.hue, 62, 56)}
              style={{
                transformOrigin: `${PIE_CENTER}px ${PIE_CENTER}px`,
                transform: activa === i ? 'scale(1.3)' : 'none',
                filter: activa === i ? 'brightness(1.06)' : 'none',
              }}
            />
          ))}
        </g>

        <g>
          {slices.map((s, i) => {
            const hijos = hijosConMontoDe(s.nodo);
            if (!hijos.length) return null;
            const totalHijos = hijos.reduce((acc, h) => acc + h.monto_vigente, 0) || 1;
            let angulo = s.startAngle;
            return (
              <g
                key={s.nodo.id}
                className={cx(
                  'pointer-events-none transition-opacity duration-[180ms]',
                  activa === i ? 'opacity-100' : 'opacity-0'
                )}
              >
                {hijos.map((h, j) => {
                  const desde = angulo;
                  angulo += (h.monto_vigente / totalHijos) * (s.endAngle - s.startAngle);
                  return (
                    <path
                      key={h.id}
                      className="stroke-surface stroke-[1.5]"
                      d={donutSlicePath(PIE_INNER_R, PIE_INNER_R_INNER, desde, angulo)}
                      fill={hslStr(s.hue, 55, lightnessHijo(j))}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>

        {/* Zona de hover invisible, del tamaño de reposo de la porción — no cambia
            de tamaño cuando la visual se agranda, así el hover nunca titila. Si
            el hover se detectara sobre la porción visual, al agrandarse su borde
            interno se corre hacia afuera y en algún punto "se come" al cursor:
            dispara mouseleave, se achica, el cursor vuelve a quedar adentro,
            dispara mouseenter de nuevo… y la porción parpadea sola. */}
        <g>
          {slices.map((s, i) => (
            <path
              key={s.nodo.id}
              className="cursor-pointer fill-transparent"
              d={donutSlicePath(PIE_OUTER_R, PIE_OUTER_R_INNER, s.startAngle, s.endAngle)}
              onMouseEnter={() => setActiva(i)}
              onMouseLeave={() => setActiva((previa) => (previa === i ? null : previa))}
            >
              <title>{`${s.nodo.nombre} — ${fmtPct(s.share * 100)}`}</title>
            </path>
          ))}
        </g>

        <text
          className="fill-ink text-[19px] font-bold"
          x={PIE_CENTER}
          y={PIE_CENTER - 6}
          textAnchor="middle"
        >
          {fmtMoney(slice ? slice.nodo.monto_vigente : resumen.monto_vigente)}
        </text>
        <text
          className="fill-ink-soft text-[9.5px] uppercase tracking-[0.04em]"
          x={PIE_CENTER}
          y={PIE_CENTER + 16}
          textAnchor="middle"
        >
          {slice ? slice.nodo.nombre : 'Monto vigente total'}
        </text>
      </svg>

      <div className="min-w-[220px] flex-1">
        {slice ? <LeyendaPorcion slice={slice} /> : <LeyendaGeneral slices={slices} />}
      </div>
    </div>
  );
}

export default PieComposicion;
