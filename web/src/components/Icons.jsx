// Los mismos íconos que usaban las páginas HTML, como componentes.
const props = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconoObra() {
  return (
    <svg {...props}>
      <path d="M3 21h18" />
      <path d="M6 21V10l6-5 6 5v11" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

export function IconoDocumento() {
  return (
    <svg {...props}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconoTendencia() {
  return (
    <svg {...props}>
      <path d="M4 16l5-5 4 4 7-7" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

export function IconoCheck() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5" />
    </svg>
  );
}

export function IconoReloj() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
