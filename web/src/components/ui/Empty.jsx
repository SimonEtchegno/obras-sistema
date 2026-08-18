import cx from '../../lib/cx.js';

export function Empty({ className, children }) {
  return <div className={cx('py-8 text-center text-sm text-ink-muted', className)}>{children}</div>;
}

export default Empty;
