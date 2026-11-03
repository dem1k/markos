import { escapeHtml } from '../icons'

export type BrowserSubmitEmail = (account: {
  user: string
  domain: string
  pass: string
}) => void

export function mountBrowser(
  host: HTMLElement,
  opts: { startUrl?: string; onCreateEmail: BrowserSubmitEmail },
): { destroy: () => void; navigate: (url: string) => void } {
  let url = opts.startUrl || 'home.markos'
  host.innerHTML = `<div class="browser-app">
    <div class="browser-bar">
      <button type="button" class="browser-nav" data-go="back">&lt;</button>
      <button type="button" class="browser-nav" data-go="home">Home</button>
      <input class="browser-url" value="${escapeHtml(url)}" />
      <button type="button" class="browser-nav" data-go="go">Go</button>
    </div>
    <div class="browser-page"></div>
  </div>`

  const page = host.querySelector('.browser-page') as HTMLElement
  const input = host.querySelector('.browser-url') as HTMLInputElement
  const history: string[] = []

  const renderPage = (target: string) => {
    url = normalizeUrl(target)
    input.value = url
    history.push(url)
    if (url === 'home.markos' || url === '') {
      page.innerHTML = `<div class="browser-home">
        <h2>markOS Web</h2>
        <p>Bookmarks:</p>
        <button type="button" class="browser-link" data-href="mail.markos">mail.markos — Create email</button>
        <button type="button" class="browser-link" data-href="news.markos">news.markos</button>
      </div>`
    } else if (url.startsWith('mail.markos')) {
      page.innerHTML = `<div class="browser-mail">
        <h2>mail.markos</h2>
        <p>Create your first email account</p>
        <label>Username <input class="mail-user" placeholder="mark" /></label>
        <label>Password <input class="mail-pass" type="password" placeholder="****" /></label>
        <button type="button" class="mail-create">Create account</button>
        <div class="mail-msg"></div>
      </div>`
      page.querySelector('.mail-create')?.addEventListener('click', () => {
        const user = (page.querySelector('.mail-user') as HTMLInputElement).value.trim()
        const pass = (page.querySelector('.mail-pass') as HTMLInputElement).value
        const msg = page.querySelector('.mail-msg') as HTMLElement
        if (!user || user.length < 2) {
          msg.textContent = 'Pick a username (at least 2 letters).'
          return
        }
        if (!pass || pass.length < 3) {
          msg.textContent = 'Password must be at least 3 characters.'
          return
        }
        msg.textContent = `Created ${user}@markos.mail`
        opts.onCreateEmail({ user, domain: 'markos.mail', pass })
      })
    } else if (url.startsWith('news.markos')) {
      page.innerHTML = `<div class="browser-home">
        <h2>news.markos</h2>
        <p>Local news: Server online. First quest — create email.</p>
      </div>`
    } else {
      page.innerHTML = `<div class="browser-home">
        <h2>Not found</h2>
        <p>No page at ${escapeHtml(url)}</p>
        <button type="button" class="browser-link" data-href="home.markos">Go home</button>
      </div>`
    }
    page.querySelectorAll('[data-href]').forEach((el) => {
      el.addEventListener('click', () => renderPage((el as HTMLElement).dataset.href || 'home.markos'))
    })
  }

  host.querySelector('[data-go="go"]')?.addEventListener('click', () => renderPage(input.value))
  host.querySelector('[data-go="home"]')?.addEventListener('click', () => renderPage('home.markos'))
  host.querySelector('[data-go="back"]')?.addEventListener('click', () => {
    history.pop()
    renderPage(history.pop() || 'home.markos')
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renderPage(input.value)
  })

  renderPage(url)

  return {
    destroy: () => {
      host.innerHTML = ''
    },
    navigate: (u: string) => renderPage(u),
  }
}

function normalizeUrl(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'home.markos'
}
