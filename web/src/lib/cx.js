// Une clases salteando lo que sea falsy: cx('base', activo && 'activo').
export function cx(...clases) {
  return clases.filter(Boolean).join(' ');
}

export default cx;
