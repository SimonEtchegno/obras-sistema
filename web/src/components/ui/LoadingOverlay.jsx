import cx from '../../lib/cx.js';

export function Spinner({ className }) {
  return (
    <span
      className={cx(
        'inline-block h-6 w-6 animate-spin rounded-full border-[2.5px] border-current border-t-transparent text-accent',
        className
      )}
    />
  );
}

// Se pone dentro de un contenedor con `relative` (una Card, un Container) y
// tapa lo que haya adentro con un tono gris mientras `activo` es true. Si ya
// hay datos viejos en pantalla (por un recargar()) quedan atenuados debajo en
// vez de desaparecer, así no parpadea.
export function LoadingOverlay({ activo, className }) {
  if (!activo) return null;
  return (
    <div
      className={cx(
        'absolute inset-0 z-10 flex items-center justify-center rounded-card bg-plane/70 backdrop-blur-[1px]',
        className
      )}
    >
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export default LoadingOverlay;
