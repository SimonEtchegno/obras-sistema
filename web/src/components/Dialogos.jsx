import { useEffect, useState } from 'react';
import { Alert, Button, Card } from './ui/index.js';

// Reemplazo de confirm()/alert() nativos: rompían el tema (siempre blancos,
// sin blur) y no se pueden estilar. Este módulo expone dos funciones
// imperativas que se pueden llamar desde cualquier lado —componentes,
// handlers, hasta lib/exportar.js que no es un componente— y un único
// <DialogosHost /> montado en App que dibuja lo que haga falta.
let estado = { confirmacion: null, toasts: [] };
let idToast = 0;
const listeners = new Set();

function emitir() {
  listeners.forEach((fn) => fn(estado));
}

// Devuelve una promesa que resuelve true/false según lo que elija el
// usuario, así los call sites quedan igual que con confirm(): `if (!(await
// confirmar(mensaje))) return;`.
export function confirmar(mensaje, opciones = {}) {
  return new Promise((resolve) => {
    estado = { ...estado, confirmacion: { mensaje, opciones, resolve } };
    emitir();
  });
}

function resolverConfirmacion(resultado) {
  const pendiente = estado.confirmacion;
  estado = { ...estado, confirmacion: null };
  emitir();
  pendiente?.resolve(resultado);
}

export function notificar(mensaje, variante = 'error') {
  const id = ++idToast;
  estado = { ...estado, toasts: [...estado.toasts, { id, mensaje, variante }] };
  emitir();
  setTimeout(() => quitarToast(id), 5000);
}

function quitarToast(id) {
  estado = { ...estado, toasts: estado.toasts.filter((t) => t.id !== id) };
  emitir();
}

export function DialogosHost() {
  const [snapshot, setSnapshot] = useState(estado);

  useEffect(() => {
    listeners.add(setSnapshot);
    return () => listeners.delete(setSnapshot);
  }, []);

  const { confirmacion, toasts } = snapshot;

  useEffect(() => {
    if (!confirmacion) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') resolverConfirmacion(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmacion]);

  return (
    <>
      {confirmacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => resolverConfirmacion(false)}
        >
          <Card className="w-full max-w-[420px] shadow-card-md" onClick={(e) => e.stopPropagation()}>
            <p className="mb-5 text-[14.5px] leading-relaxed whitespace-pre-line text-ink">{confirmacion.mensaje}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => resolverConfirmacion(false)}>
                {confirmacion.opciones.textoCancelar ?? 'Cancelar'}
              </Button>
              <Button
                variante={confirmacion.opciones.variante ?? 'danger'}
                onClick={() => resolverConfirmacion(true)}
              >
                {confirmacion.opciones.textoConfirmar ?? 'Confirmar'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 max-sm:inset-x-4 max-sm:w-auto">
          {toasts.map((t) => (
            <Alert key={t.id} variante={t.variante} className="mb-0 shadow-card-md whitespace-pre-line">
              {t.mensaje}
            </Alert>
          ))}
        </div>
      )}
    </>
  );
}

export default DialogosHost;
