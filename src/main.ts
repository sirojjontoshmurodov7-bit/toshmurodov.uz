import './styles/site.css'
import { clock, createStage } from './stage'
import { createTyper } from './typer'

type Lang = 'uz' | 'ru' | 'en'
type Dict = Record<string, string>

declare global {
  interface Window { __booted?: boolean }
}
window.__booted = true

// Faqat ishlab chiqish rejimida: ?manual bilan sahna kadrlarini qo'lda yurgizib tekshirish mumkin.
if (import.meta.env.DEV && location.search.includes('manual')) {
  let now = 0
  let queue: FrameRequestCallback[] = []
  clock.raf = (cb) => { queue.push(cb) }
  Object.assign(window, {
    __step: async (ms: number, slices = 1) => {
      for (let i = 0; i < slices; i++) {
        now += ms / slices
        const run = queue
        queue = []
        run.forEach((cb) => cb(now))
        await new Promise((r) => setTimeout(r, 0))
      }
      return now
    },
  })
  // ?manual&t=3500: sahnani aynan shu millisekundgacha yurgizib qo'yadi.
  const at = location.search.match(/t=(\d+)/)
  if (at) {
    // Oyna o'lchami o'rnashgach boshlaydi (headless brauzer oynani kechroq o'lchaydi).
    const go = () => { void (window as unknown as { __step(ms: number, n: number): Promise<number> }).__step(Number(at[1]), Math.ceil(Number(at[1]) / 16)) }
    let timer = setTimeout(go, 5000)
    addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(go, 200) })
  }
}

const html = document.documentElement
const $ =<T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- tillar ---------- */
// O'zbekcha matn HTML'ning o'zida turadi; ruscha va inglizcha lug'at faqat kerak bo'lganda yuklanadi.
const textNodes = $$<HTMLElement>('[data-i18n]')
const attrNodes = $$<HTMLElement>('[data-i18n-attr]').map((el) => {
  const [attr, key] = el.dataset.i18nAttr!.split(':')
  return { el, attr, key }
})
const metaDesc = $<HTMLMetaElement>('meta[name="description"]')
const uz: Dict = {
  metaTitle: document.title,
  metaDesc: metaDesc.content,
  msgIntro: 'Assalomu alaykum! Ismim',
  copyDone: 'Nusxalandi',
}
textNodes.forEach((el) => { uz[el.dataset.i18n!] ??= el.textContent ?? '' })
attrNodes.forEach(({ el, attr, key }) => { uz[key] ??= el.getAttribute(attr) ?? '' })

let dict: Dict = uz
let lang: Lang = 'uz'
const t = (key: string) => dict[key] ?? uz[key] ?? ''

async function loadDict(next: Lang): Promise<Dict> {
  if (next === 'ru') return (await import('./i18n/ru')).default
  if (next === 'en') return (await import('./i18n/en')).default
  return uz
}

async function setLang(next: Lang, save = true) {
  const loaded = await loadDict(next)
  typer?.finish()
  dict = loaded
  lang = next
  html.lang = next
  textNodes.forEach((el) => { el.textContent = t(el.dataset.i18n!) })
  attrNodes.forEach(({ el, attr, key }) => el.setAttribute(attr, t(key)))
  document.title = t('metaTitle')
  metaDesc.content = t('metaDesc')
  $$<HTMLButtonElement>('.lang__list button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lang === next)))
  langCode.textContent = next.toUpperCase()
  langFlag.setAttribute('href', `#flag-${next}`)
  if (save) { try { localStorage.setItem('lang', next) } catch { /* xotira yopiq bo'lishi mumkin */ } }
}

const langBox = $<HTMLElement>('#lang')
const langBtn = $<HTMLButtonElement>('.lang__btn')
const langList = $<HTMLElement>('.lang__list')
const langCode = $<HTMLElement>('.lang__code')
const langFlag = $<SVGUseElement>('.lang__btn use')
const setLangMenu = (open: boolean) => { langList.hidden = !open; langBtn.setAttribute('aria-expanded', String(open)) }
langBtn.addEventListener('click', () => setLangMenu(langBtn.getAttribute('aria-expanded') !== 'true'))
$$<HTMLButtonElement>('.lang__list button').forEach((b) => {
  b.addEventListener('click', () => {
    setLangMenu(false)
    langBtn.focus()
    if (b.dataset.lang !== lang) void setLang(b.dataset.lang as Lang)
  })
})
document.addEventListener('click', (e) => { if (!langBox.contains(e.target as Node)) setLangMenu(false) })
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !langList.hidden) { setLangMenu(false); langBtn.focus() } })

/* ---------- sahna va kirish ---------- */
const hero = $<HTMLElement>('.hero')
const stage = createStage($<SVGSVGElement>('#stage'), $<HTMLElement>('#curtain'), $<HTMLElement>('.hero__inner'), $<HTMLElement>('#rail'))
const skipBtn = $<HTMLButtonElement>('#skip')
let typer: ReturnType<typeof createTyper> | undefined

const pending = html.dataset.langPending as Lang | undefined
const langReady = pending ? setLang(pending, false).catch(() => {}) : Promise.resolve()

async function runIntro() {
  const unlock = () => html.classList.remove('intro-lock')
  typer = createTyper($$<HTMLElement>('[data-type]', hero))
  const skip = () => { stage.skip(); typer?.finish() }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip() }
  skipBtn.hidden = false
  skipBtn.addEventListener('click', skip)
  addEventListener('keydown', onKey)
  try {
    await stage.play(unlock)
    await langReady
    stage.setTyping(true)
    await typer.run(() => stage.glance())
  } finally {
    stage.setTyping(false)
    typer.finish()
    typer = undefined
    unlock()
    html.classList.remove('intro')
    skipBtn.hidden = true
    removeEventListener('keydown', onKey)
    try { sessionStorage.setItem('intro', '1') } catch { /* muhim emas */ }
  }
}

if (html.classList.contains('intro')) {
  runIntro().catch((err) => { console.error(err); stage.settle() })
} else {
  html.classList.remove('intro-lock')
  stage.settle()
}

/* ---------- ko'rinishga kirganda ochilish ---------- */
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count)
  const start = performance.now()
  const tick = (now: number) => {
    const u = Math.min(1, (now - start) / 1300)
    el.textContent = `${Math.round(to * (1 - Math.pow(1 - u, 3)))}%`
    if (u < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function reveal(el: HTMLElement) {
  el.classList.add('in')
  if (!reduceMotion) $$<HTMLElement>('[data-count]', el).forEach(countUp)
  // Ochilish tugagach belgi olib tashlanadi: hover o'tishlari kechikishsiz ishlaydi.
  setTimeout(() => el.removeAttribute('data-reveal'), 1500)
}

let revealables = $$<HTMLElement>('[data-reveal]')
const revealOnce = (el: HTMLElement) => {
  if (el.classList.contains('in')) return
  io?.unobserve(el)
  reveal(el)
}
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) revealOnce(e.target as HTMLElement)
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  : undefined

// Zaxira yo'l: kuzatuvchi ishlamay qolsa ham (eski brauzer, ekran suratga oluvchi botlar)
// matn yashirin qolib ketmasin. Ro'yxat qisqargan sari tekshiruv ham yengillashadi.
let checking = false
const sweep = () => {
  checking = false
  const edge = innerHeight * 0.94
  revealables = revealables.filter((el) => {
    if (el.classList.contains('in')) return false
    const r = el.getBoundingClientRect()
    if (r.top < edge && r.bottom > 0) { revealOnce(el); return false }
    return true
  })
  if (!revealables.length) removeEventListener('scroll', onScroll)
}
const onScroll = () => { if (!checking) { checking = true; setTimeout(sweep, 120) } }
addEventListener('scroll', onScroll, { passive: true })
addEventListener('load', sweep)

if (io) {
  revealables.forEach((el) => io.observe(el))

  // Ekrandan chiqqan animatsiyalar to'xtab turadi.
  const route = $<SVGSVGElement>('.motif--route')
  if (reduceMotion) route.pauseAnimations()
  const idle = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === hero) stage.setVisible(e.isIntersecting)
      if (e.target === route.closest('.card')) {
        if (e.isIntersecting && !reduceMotion) route.unpauseAnimations(); else route.pauseAnimations()
      } else {
        e.target.classList.toggle('is-idle', !e.isIntersecting)
      }
    }
  })
  idle.observe(hero)
  idle.observe($('.contact'))
  idle.observe(route.closest('.card')!)

  // Qaysi bo'limda turganini navigatsiyada ko'rsatish.
  const links = new Map($$<HTMLAnchorElement>('.rail__nav a').map((a) => [a.hash.slice(1), a]))
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      links.forEach((a, id) => { if (id === e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current') })
    }
  }, { rootMargin: '-45% 0px -50% 0px' })
  $$<HTMLElement>('main > section[id]').forEach((sec) => spy.observe(sec))
} else {
  revealables.forEach((el) => el.classList.add('in'))
}

/* ---------- mobil menyu ---------- */
const rail = $<HTMLElement>('#rail')
const menuBtn = $<HTMLButtonElement>('.rail__menu')
const setMenu = (open: boolean) => { rail.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open)) }
menuBtn.addEventListener('click', () => setMenu(!rail.classList.contains('is-open')))
$$('.rail__nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)))
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false) })
document.addEventListener('click', (e) => { if (!rail.contains(e.target as Node)) setMenu(false) })

/* ---------- aloqa ---------- */
const form = $<HTMLFormElement>('#xabar')
const nameInput = $<HTMLInputElement>('#f-name')
const textInput = $<HTMLTextAreaElement>('#f-text')

function check(input: HTMLInputElement | HTMLTextAreaElement) {
  const ok = input.value.trim().length > 0
  input.setAttribute('aria-invalid', String(!ok))
  $<HTMLElement>(`#${input.id}-err`).hidden = ok
  return ok
}
;[nameInput, textInput].forEach((input) => input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') check(input) }))

// "Yuborish": Telegram ochiladi, xabar matni yozuv maydonida tayyor turadi.
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const okName = check(nameInput)
  const okText = check(textInput)
  if (!okName || !okText) { (okName ? textInput : nameInput).focus(); return }
  const message = `${t('msgIntro')} ${nameInput.value.trim()}.\n\n${textInput.value.trim()}`
  const url = `${form.action}?text=${encodeURIComponent(message)}`
  if (!window.open(url, '_blank', 'noopener')) location.href = url
})

// Email tugmasi pochta dasturini emas, shu sahifadagi xabar formasini ochadi.
$<HTMLAnchorElement>('[data-focus-form]').addEventListener('click', (e) => {
  e.preventDefault()
  form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  nameInput.focus({ preventScroll: true })
})

const copyBtn = $<HTMLButtonElement>('.copy')
const copyState = $<HTMLElement>('.copy__state')
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(copyBtn.dataset.copy!)
    copyBtn.classList.add('is-done')
    copyState.textContent = t('copyDone')
    setTimeout(() => { copyBtn.classList.remove('is-done'); copyState.textContent = t('copyIdle') }, 1800)
  } catch { /* nusxalash ruxsati yo'q: manzil baribir ko'rinib turibdi */ }
})
