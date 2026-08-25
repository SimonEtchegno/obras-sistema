// Paleta de los ítems del presupuesto. Vive acá y no en cada componente para
// que la torta de composición y las tarjetas del árbol le den el mismo color
// al mismo ítem: si se desincronizaran, el color dejaría de querer decir algo.

const HUE_INICIAL = 208; // mismo tono que --color-accent, para que el primer ítem quede "de la casa"
const ANGULO_DORADO = 137.508; // separa los tonos lo más posible entre sí

export function hslStr(h, s, l, a) {
  const base = `${h.toFixed(1)}deg ${s}% ${l}%`;
  return a == null ? `hsl(${base})` : `hsl(${base} / ${a})`;
}

// Un tono por ítem raíz, repartidos por el ángulo dorado.
export function huesDeRaices(n) {
  return Array.from({ length: n }, (_, i) => (HUE_INICIAL + i * ANGULO_DORADO) % 360);
}

// Los sub-ítems no estrenan tono: usan el del padre en distintas luminosidades,
// así se lee que pertenecen al mismo grupo.
export function lightnessHijo(indice) {
  return 38 + (indice % 4) * 11;
}

// Acento de color de la tarjeta de un ítem: solo el borde izquierdo, para
// diferenciar sin ensuciar la superficie "glass". Con alpha en vez de un color
// opaco, se mezcla con el fondo y funciona igual en tema claro y oscuro.
export function estiloTarjetaItem(hue, esRaiz) {
  if (hue == null) return undefined;
  return {
    borderLeftWidth: esRaiz ? '3px' : '2px',
    borderLeftColor: hslStr(hue, 55, 55, esRaiz ? 0.55 : 0.35),
  };
}

// La línea de indentación de los hijos, teñida con el tono del padre: ya
// existía en gris, solo toma color.
export function estiloRamaItem(hue) {
  if (hue == null) return undefined;
  return { borderLeftColor: hslStr(hue, 45, 55, 0.4) };
}
