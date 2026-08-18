import { useEffect } from 'react';

// Cada pantalla declara su título; en una SPA no lo hace el <head> del HTML.
export function useTitulo(titulo) {
  useEffect(() => {
    if (titulo) document.title = titulo;
  }, [titulo]);
}

export default useTitulo;
