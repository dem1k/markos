export function iconBoxHtml(badge: string, extraClass = ''): string {
  const text = badge || ''
  return `<div class="icon-box ${extraClass}"><span class="icon-badge">${escapeHtml(text)}</span></div>`
}

export function deskIconHtml(
  id: string,
  name: string,
  badge: string,
  selected: boolean,
  x: number,
  y: number,
  kind: 'file' | 'folder' | 'game' | 'app',
): string {
  const sel = selected ? ' selected' : ''
  const mark = kind === 'folder' ? badge || 'fld' : badge
  const box =
    kind === 'folder' ? 'folder-box' : kind === 'game' ? 'game-box' : kind === 'app' ? 'app-box' : ''
  return `<div class="desk-icon${sel}" data-id="${id}" data-kind="${kind}" style="left:${x}px;top:${y}px">
    ${iconBoxHtml(mark, box)}
    <div class="desk-label">${escapeHtml(name)}</div>
  </div>`
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
