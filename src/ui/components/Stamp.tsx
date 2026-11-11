import type { ButtonHTMLAttributes } from 'react';

/** Rubber-stamp button: the game's only "button" look. */
export function Stamp({
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`stamp ${className}`} {...props} />;
}
