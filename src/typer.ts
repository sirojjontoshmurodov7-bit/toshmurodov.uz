/*
 * Matnni harfma-harf chiqaradi. Harflar oldindan o'z joyiga qo'yiladi va faqat
 * ko'rinishi yoqiladi, shuning uchun terish paytida sahifa "sakramaydi".
 */

export type Typer = {
  run(onLine?: () => void): Promise<void>
  /** Qolgan matnni darhol to'liq ko'rsatadi. */
  finish(): void
}

const SPEED: Record<string, number> = { P: 21, H1: 44 }

export function createTyper(els: HTMLElement[]): Typer {
  let finished = false
  let wake: (() => void) | undefined
  const originals = new Map<HTMLElement, string>()

  const restore = (el: HTMLElement) => {
    const text = originals.get(el)
    if (text !== undefined) { el.textContent = text; originals.delete(el) }
    el.classList.remove('is-typing')
    el.classList.add('is-typed')
  }

  const wait = (ms: number) => new Promise<void>((resolve) => {
    const id = setTimeout(() => { wake = undefined; resolve() }, ms)
    wake = () => { clearTimeout(id); resolve() }
  })

  async function typeOne(el: HTMLElement) {
    const text = el.textContent ?? ''
    originals.set(el, text)
    const base = el.classList.contains('lead') ? 15 : (SPEED[el.tagName] ?? 30)
    const frag = document.createDocumentFragment()
    const chars: HTMLSpanElement[] = []
    for (const c of text) {
      const span = document.createElement('span')
      span.className = 'ch'
      span.textContent = c
      chars.push(span)
      frag.append(span)
    }
    el.textContent = ''
    el.append(frag)
    el.setAttribute('aria-label', text)
    el.classList.add('is-typing')

    for (let i = 0; i < chars.length && !finished; i++) {
      if (i > 0) chars[i - 1].classList.remove('caret')
      chars[i].classList.add('on', 'caret')
      const c = chars[i].textContent
      const pause = c === ' ' ? base * 0.6 : c === '.' || c === ',' ? base * 4 : base * (0.55 + Math.random() * 0.9)
      await wait(pause)
    }
    el.removeAttribute('aria-label')
    restore(el)
  }

  return {
    async run(onLine) {
      for (const el of els) {
        if (finished) { restore(el); continue }
        await typeOne(el)
        onLine?.()
        if (!finished) await wait(170)
      }
    },
    finish() {
      finished = true
      wake?.()
      els.forEach(restore)
    },
  }
}
