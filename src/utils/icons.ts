/** Google Material Symbols Outlined — size matches adjacent text (1em). */
export function msIcon(name: string, className = ''): string {
  const cls = className ? `ms-icon ${className}` : 'ms-icon';
  return `<span class="${cls}" aria-hidden="true">${name}</span>`;
}
