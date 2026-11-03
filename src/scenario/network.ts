import type { NetworkInfo, ScenarioPack } from './types'
import { escapeHtml } from '../icons'

function wifiIcon(online: boolean): string {
  if (online) {
    return `<svg class="net-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 18.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm0-4.2c1.7 0 3.2.7 4.3 1.8l-1.4 1.4A4.5 4.5 0 0 0 12 16.3c-1.2 0-2.3.5-3.1 1.2L7.5 16c1.2-1.1 2.8-1.7 4.5-1.7zm0-4.3c2.9 0 5.5 1.2 7.4 3.1l-1.4 1.4A8.4 8.4 0 0 0 12 11c-2.2 0-4.2.8-5.8 2.3L4.8 12A10.9 10.9 0 0 1 12 10zm0-4.2c4 0 7.7 1.6 10.3 4.3l-1.4 1.4C18.6 9.2 15.5 7.8 12 7.8S5.4 9.2 3.1 11.5L1.7 10.1C4.3 7.4 8 5.8 12 5.8z"/>
    </svg>`
  }
  return `<svg class="net-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 18.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7.1-7.4 1.4-1.4C18.3 7.4 15.4 5.8 12 5.8c-1.2 0-2.3.2-3.4.5l1.7 1.7c.5-.1 1.1-.2 1.7-.2 3.1 0 5.8 1.2 7.1 2.8zM4.8 12l1.4 1.4A8.4 8.4 0 0 1 12 11c.4 0 .8 0 1.2.1l2.1 2.1c-.1 0-.2 0-.3 0-1.7 0-3.2.7-4.3 1.8L9 16.4A4.5 4.5 0 0 1 12 16.3c.3 0 .5 0 .8.1l2.3 2.3-.9.8c-.7.3-1.4.5-2.2.5a1.5 1.5 0 0 1-1.5-1.5c0-.3.1-.6.2-.8L2.1 4.9l1.4-1.4 16 16-1.4 1.4-4.1-4.1A4.6 4.6 0 0 1 12 21.5a3.5 3.5 0 0 1-3.5-3.5c0-.7.2-1.3.5-1.9L4.8 12z"/>
    </svg>`
}

export function networkTrayHtml(online: boolean, ssid: string | null): string {
  const label = online ? (ssid ? `Online: ${ssid}` : 'Online') : 'No network'
  const cls = online ? 'net-online' : 'net-offline'
  return `<button type="button" class="net-tray ${cls}" id="netTray" title="${escapeHtml(label)}">${wifiIcon(online)}</button>`
}

export function openNetworkWindow(
  pack: ScenarioPack,
  online: boolean,
  networkId: string | null,
  onConnect: (net: NetworkInfo) => void,
): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'window net-window'
  wrap.style.left = '120px'
  wrap.style.top = '80px'
  wrap.style.width = '320px'
  wrap.style.height = '280px'
  wrap.style.zIndex = '8000'
  const status = online
    ? `Connected${networkId ? ` — ${pack.networks.find((n) => n.id === networkId)?.ssid ?? networkId}` : ''}`
    : 'Not connected'
  const rows = pack.networks
    .map((n) => {
      const bars = '▁▃▅▇'.slice(0, Math.max(1, Math.min(4, n.signal)))
      const lock = n.secure ? 'lock' : 'open'
      const disabled = online && networkId === n.id ? 'disabled' : ''
      return `<button type="button" class="net-row" data-net="${escapeHtml(n.id)}" ${disabled}>
        <span class="net-ssid">${escapeHtml(n.ssid)}</span>
        <span class="net-meta">${lock} ${bars}</span>
      </button>`
    })
    .join('')
  wrap.innerHTML = `<div class="title-bar">
      <div class="title-text">Network</div>
      <button type="button" class="win-btn net-close">x</button>
    </div>
    <div class="window-body file-body net-body">
      <div class="net-status">${wifiIcon(online)} <span>${escapeHtml(status)}</span></div>
      <div class="net-hint">Choose Wi-Fi. Connection works only if markOS server is running.</div>
      <div class="net-list">${rows}</div>
    </div>`
  wrap.querySelector('.net-close')?.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    wrap.remove()
  })
  wrap.querySelectorAll('[data-net]').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const id = (el as HTMLElement).dataset.net!
      const net = pack.networks.find((n) => n.id === id)
      if (net) onConnect(net)
    })
  })
  return wrap
}
