import type { ButtonHTMLAttributes } from 'react';

/** Rubber-stamp button: the game's only "button" look. */
export function Stamp({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`stamp ${className}`} {...props} />;
}
