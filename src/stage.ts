/*
 * Sahna: kapishonli figura rels ostidagi maydonchadan yurib keladi, parda ipini
 * ushlab pastga sakraydi (parda u bilan birga tushadi), yashik ustidagi noutbukni
 * olib o'tiradi va yoza boshlaydi.
 *
 * Figura bo'g'imli skelet: har bir kadrda bo'g'im burchaklari hisoblanadi va SVG
 * guruhlariga yoziladi. Yurishda tayanch oyoq yerga "mixlanadi", shuning uchun
 * oyoq sirpanmaydi va tana tabiiy ravishda ko'tarilib-tushadi.
 */

type Pose = {
  lean: number; head: number
  sF: number; eF: number; sB: number; eB: number // yelka va tirsak (old / orqa qo'l)
  hF: number; kF: number; hB: number; kB: number // son va tizza (old / orqa oyoq)
  pF: number; pB: number // oyoq kafti qiyaligi
}

const L1 = 44, L2 = 44, SOLE = 8, UPPER = 32, FORE = 30
const SHOULDER_X = 2, SHOULDER_Y = -54
const CRATE_H = 42.5
const UNITS_TALL = 192
const RAD = Math.PI / 180

const STAND: Pose = { lean: 2, head: 0, sF: 6, eF: 14, sB: -6, eB: 12, hF: 9, kF: 5, hB: -7, kB: 4, pF: 0, pB: 0 }
const REACH: Pose = { lean: -2, head: -24, sF: 150, eF: 15, sB: 141, eB: 22, hF: 8, kF: 4, hB: -8, kB: 4, pF: 0, pB: 0 }
const CROUCH: Pose = { lean: 16, head: -14, sF: 158, eF: 6, sB: 150, eB: 12, hF: 44, kF: 84, hB: 32, kB: 76, pF: 0, pB: 12 }
const FALL: Pose = { lean: 9, head: -4, sF: 168, eF: 6, sB: 161, eB: 10, hF: 38, kF: 62, hB: -12, kB: 44, pF: 24, pB: 34 }
const TOUCH: Pose = { lean: 12, head: 4, sF: 120, eF: 20, sB: 100, eB: 24, hF: 26, kF: 36, hB: 10, kB: 26, pF: 0, pB: 6 }
const LAND: Pose = { lean: 36, head: 12, sF: 34, eF: 34, sB: -34, eB: 24, hF: 72, kF: 122, hB: 56, kB: 114, pF: 0, pB: 18 }
const PICK: Pose = { lean: 50, head: 14, sF: 62, eF: 25, sB: 56, eB: 26, hF: 55, kF: 100, hB: 40, kB: 94, pF: 0, pB: 22 }
const HOLD: Pose = { lean: 4, head: 6, sF: 20, eF: 85, sB: 14, eB: 84, hF: 10, kF: 6, hB: -8, kB: 5, pF: 0, pB: 0 }
const SIT: Pose = { lean: 12, head: 17, sF: 10, eF: 82, sB: 5, eB: 78, hF: 92, kF: 88, hB: 86, kB: 81, pF: 0, pB: 0 }

const LAP = { x: 36, y: -11.5 } // noutbukning tizzadagi o'rni (figura birliklarida)
const GRIP = { x: 10, y: -3 } // qo'lga nisbatan noutbuk markazi

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sin = (deg: number) => Math.sin(deg * RAD)
const cos = (deg: number) => Math.cos(deg * RAD)

const ease = {
  linear: (u: number) => u,
  inOut: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: (u: number) => 1 - Math.pow(1 - u, 3),
  in: (u: number) => u * u * u,
  outBack: (u: number) => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2),
}

function mix(a: Pose, b: Pose, t: number): Pose {
  const o = {} as Pose
  for (const k of Object.keys(a) as (keyof Pose)[]) o[k] = lerp(a[k], b[k], t)
  return o
}

/** Oyoq tagining figura ichidagi o'rni. */
function sole(h: number, k: number) {
  return { x: L1 * sin(h) + L2 * sin(h - k), y: L1 * cos(h) + L2 * cos(h - k) + SOLE }
}
/** Poza uchun bel balandligi: pastroqdagi oyoq yerga tegib turadi. */
const hipHeight = (p: Pose) => Math.max(sole(p.hF, p.kF).y, sole(p.hB, p.kB).y)

/** Old qo'l kaftining figura ichidagi o'rni. */
function hand(p: Pose) {
  const sx = SHOULDER_X * cos(p.lean) - SHOULDER_Y * sin(p.lean)
  const sy = SHOULDER_X * sin(p.lean) + SHOULDER_Y * cos(p.lean)
  const a1 = p.sF - p.lean
  const a2 = a1 + p.eF
  return { x: sx + UPPER * sin(a1) + FORE * sin(a2), y: sy + UPPER * cos(a1) + FORE * cos(a2) }
}

/** Yurish sikli: faza bo'yicha poza. */
function walkPose(ph: number): Pose {
  const leg = (f: number) => {
    const h = 27 * Math.sin(f)
    // Tizza: oyoq yerdan uzilganda bukila boshlaydi, son tik kelganda eng ko'p bukiladi,
    // tovon yerga tegishidan oldin yana to'g'rilanadi.
    const a = Math.atan2(Math.sin(f), Math.cos(f))
    const bump = a >= -1.9 && a <= 0.15 ? Math.pow(Math.sin(((a + 1.9) / 2.05) * (Math.PI / 2)), 2)
      : a > 0.15 && a <= 1.5 ? Math.pow(Math.cos(((a - 0.15) / 1.35) * (Math.PI / 2)), 2) : 0
    const k = 5 + 52 * bump
    const p = 26 * Math.max(0, Math.cos(f + 1.0)) - 12 * Math.max(0, Math.cos(f - 1.25))
    return { h, k, p }
  }
  const f = leg(ph), b = leg(ph + Math.PI)
  return {
    lean: 6 + 1.4 * Math.sin(2 * ph), head: -3 + 1.6 * Math.sin(2 * ph + 1),
    sF: 4 - 20 * Math.sin(ph), eF: 22 - 12 * Math.sin(ph),
    sB: 4 + 20 * Math.sin(ph), eB: 22 + 12 * Math.sin(ph),
    hF: f.h, kF: f.k, hB: b.h, kB: b.k, pF: f.p, pB: b.p,
  }
}

/** Yarim sikl davomida belning siljishi: tayanch oyoq joyida qoladi. */
const STEP_SAMPLES = 96
const stepTable = (() => {
  const t = new Float32Array(STEP_SAMPLES + 1)
  let prev = walkPose(0)
  for (let i = 1; i <= STEP_SAMPLES; i++) {
    const cur = walkPose((i / STEP_SAMPLES) * Math.PI)
    // Sikl birinchi yarmining boshida orqa oyoq, keyin old oyoq tayanch bo'ladi.
    const front = i > STEP_SAMPLES / 2
    const now = front ? sole(cur.hF, cur.kF) : sole(cur.hB, cur.kB)
    const was = front ? sole(prev.hF, prev.kF) : sole(prev.hB, prev.kB)
    t[i] = t[i - 1] - (now.x - was.x)
    prev = cur
  }
  return t
})()
const STEP_LEN = stepTable[STEP_SAMPLES]
function walkTravel(ph: number) {
  const steps = Math.floor(ph / Math.PI)
  const f = ((ph / Math.PI) - steps) * STEP_SAMPLES
  const i = Math.min(STEP_SAMPLES - 1, Math.floor(f))
  return steps * STEP_LEN + lerp(stepTable[i], stepTable[i + 1], f - i)
}

const ABORT = Symbol('abort')

/** Kadr manbai. Tekshiruv rejimida qo'lda yurgiziladigan soat bilan almashtiriladi. */
export const clock = { raf: (cb: FrameRequestCallback): void => { requestAnimationFrame(cb) } }

const MARKUP = `
<defs><radialGradient id="spot-grad"><stop offset="0" class="spot-in"/><stop offset="1" class="spot-out"/></radialGradient></defs>
<circle data-el="spot" r="10" fill="url(#spot-grad)"/>
<rect data-el="roller" class="prop-rail"/>
<g data-el="ledge"><rect data-el="ledgeBody" class="prop-ledge"/><rect data-el="ledgeTop" class="prop-ledge-top"/></g>
<ellipse data-el="crateShadow" class="prop-shadow"/>
<ellipse data-el="shadow" class="prop-shadow"/>
<g data-el="crate">
  <rect class="prop-case" x="-34" y="0" width="68" height="${CRATE_H}" rx="3"/>
  <rect class="prop-case-band" x="-34" y="13" width="68" height="5"/>
  <rect class="prop-case-metal" x="-34" y="0" width="7" height="7" rx="1.5"/><rect class="prop-case-metal" x="27" y="0" width="7" height="7" rx="1.5"/>
  <rect class="prop-case-metal" x="-34" y="${CRATE_H - 7}" width="7" height="7" rx="1.5"/><rect class="prop-case-metal" x="27" y="${CRATE_H - 7}" width="7" height="7" rx="1.5"/>
  <rect class="prop-case-metal" x="-8" y="25" width="16" height="4" rx="2"/>
</g>
<path data-el="cord" class="prop-cord"/>
<circle data-el="handle" class="prop-handle"/>
<g data-el="actor" class="rig">
  <g data-el="legB"><line class="limb leg-b" y2="${L1}" stroke-width="16"/><g data-el="shinB"><line class="limb leg-b" y2="${L2}" stroke-width="13"/><g data-el="footB"><path class="shoe-b" d="M-8 -5H4C6 -1 14 -1 17 4V8H-8Z"/><rect class="sole" x="-8" y="5.6" width="25" height="2.4"/></g></g></g>
  <g data-el="legF"><line class="limb leg-f" y2="${L1}" stroke-width="16"/><g data-el="shinF"><line class="limb leg-f" y2="${L2}" stroke-width="13"/><g data-el="footF"><path class="shoe" d="M-8 -5H4C6 -1 14 -1 17 4V8H-8Z"/><rect class="sole" x="-8" y="5.6" width="25" height="2.4"/></g></g></g>
  <g data-el="torso">
    <g data-el="armB"><line class="limb arm-b" y2="${UPPER}" stroke-width="13"/><g data-el="foreB"><line class="limb arm-b" y2="${FORE - 3}" stroke-width="11"/><circle class="skin-b" cy="${FORE + 1}" r="5.5"/></g></g>
    <path class="hood" d="M-13 5C-17 -18 -18 -44 -11 -59L8 -62C15 -55 16 -28 14 5Q0 10 -13 5Z"/>
    <path class="hood-hem" d="M-13.5 -1C-13.4 1.5 -13.2 3.4 -13 5Q0 10 14 5C14.1 3.2 14.2 1.4 14.3 -1Q0 4.5 -13.5 -1Z"/>
    <path class="hood-edge" d="M5.5 -22q5.5 3.5 6 12"/>
    <g data-el="head">
      <path class="hood" d="M-11 5C-22 -9 -21 -33 -5 -39C8 -43 20 -34 20 -21C20 -11 16 -1 10 5Z"/>
      <path class="void" d="M20 -21C20 -12 16 -2 11 3C6 -3 5 -13 8 -21C10.5 -27.5 17 -28 20 -21Z"/>
      <path class="hood-edge" d="M11 3C6 -3 5 -13 8 -21C10.5 -27.5 17 -28 20 -21"/>
      <path data-el="glint" class="glint" d="M12.5 -17.5L17.6 -16.4" opacity="0"/>
      <path class="string" d="M9 4L10.5 15"/>
    </g>
    <g data-el="armF"><line class="limb arm-f" y2="${UPPER}" stroke-width="13"/><g data-el="foreF"><line class="limb arm-f" y2="${FORE - 3}" stroke-width="11"/><circle class="skin" cy="${FORE + 1}" r="5.5"/></g></g>
  </g>
</g>
<g data-el="laptop">
  <rect class="prop-laptop-dark" x="-17" y="-2" width="34" height="4" rx="1.6"/>
  <g data-el="lid">
    <path data-el="glow" class="prop-glow" d="M-30 0L-4 0L10 36L-46 36Z" opacity="0"/>
    <rect class="prop-laptop" x="-33" y="-3" width="33" height="3" rx="1.5"/>
    <path data-el="screen" class="prop-screen" d="M-29.5 0.4H-4" opacity="0"/>
  </g>
</g>
<g data-el="dust">${'<circle class="prop-dust" r="0"/>'.repeat(6)}</g>`

export type Stage = {
  /** Kirish sahnasini boshidan o'ynaydi. Parda to'liq tushganda onCurtain chaqiriladi. */
  play(onCurtain: () => void): Promise<void>
  /** Yakuniy holat: parda tushgan, figura noutbuk bilan o'tiribdi. */
  settle(): void
  skip(): void
  setTyping(active: boolean): void
  glance(): void
  setVisible(visible: boolean): void
}

export function createStage(svg: SVGSVGElement, curtain: HTMLElement, inner: HTMLElement, rail: HTMLElement): Stage {
  svg.innerHTML = MARKUP
  const el: Record<string, SVGElement> = {}
  svg.querySelectorAll<SVGElement>('[data-el]').forEach((n) => { el[n.dataset.el!] = n })
  const dust = Array.from(el.dust.children) as SVGCircleElement[]
  const set = (name: string, attr: string, v: string | number) => el[name].setAttribute(attr, String(v))
  const show = (name: string, on: boolean) => { el[name].style.display = on ? '' : 'none' }
  const fade = (name: string, o: number) => set(name, 'opacity', o.toFixed(3))

  // geometriya (px), har o'lcham o'zgarganda qayta hisoblanadi
  let W = 0, H = 0, s = 1, railH = 0, floorY = 0, ledgeY = 0, seatX = 0, seatY = 0, crateTop = 0
  let pickX = 0, grabX = 0, cordX = 0, handleRestY = 0

  // holat
  let pose: Pose = STAND
  let x = 0, y = 0, flip = 1
  let lidAngle = 0
  let wAttach = 0, wLap = 0 // noutbuk: yashik -> qo'l -> tizza
  let token = 0
  let playing = false
  let early = false // yurish bosqichi: o'lcham o'zgarsa sahna boshidan boshlanadi
  let restart = false
  let settled = false
  let typing = false
  let visible = true
  let glanceUntil = 0
  let loopId = 0
  let lastNow = 0

  function measure() {
    const box = svg.getBoundingClientRect()
    W = box.width; H = box.height
    railH = rail.offsetHeight
    const tall = Math.min(clamp(H * 0.3, 120, 250), W * 0.5)
    s = tall / UNITS_TALL
    floorY = H - 12 - 6 * s
    crateTop = floorY - CRATE_H * s
    const right = Math.min(W - 14, inner.getBoundingClientRect().right - box.left)
    seatX = right - 44 * s
    seatY = crateTop - 8 * s
    ledgeY = Math.min(railH + 10 * s + tall * 1.3, floorY - tall * 1.05)
    pickX = seatX - 19 * s - hand(PICK).x * s
    const jump = Math.min(tall * 1.15, Math.max(tall * 0.5, pickX - 70))
    grabX = pickX - jump
    cordX = grabX + hand(REACH).x * s
    handleRestY = ledgeY - hipHeight(REACH) * s + hand(REACH).y * s

    set('roller', 'x', 0); set('roller', 'y', railH); set('roller', 'width', W); set('roller', 'height', (7 * s).toFixed(1))
    set('crate', 'transform', `translate(${seatX.toFixed(1)} ${crateTop.toFixed(1)}) scale(${s.toFixed(4)})`)
    set('crateShadow', 'cx', seatX); set('crateShadow', 'cy', floorY + 2); set('crateShadow', 'rx', 50 * s); set('crateShadow', 'ry', 5 * s)
    set('shadow', 'cy', floorY + 2); set('shadow', 'ry', 4 * s)
    const ledgeW = grabX + 30 * s + 200
    set('ledgeBody', 'x', -200); set('ledgeBody', 'y', ledgeY); set('ledgeBody', 'width', ledgeW); set('ledgeBody', 'height', (9 * s).toFixed(1))
    set('ledgeTop', 'x', -200); set('ledgeTop', 'y', ledgeY); set('ledgeTop', 'width', ledgeW); set('ledgeTop', 'height', 2)
    set('handle', 'r', (4.5 * s).toFixed(1))
    set('spot', 'r', tall * 1.7)
  }

  function render() {
    const p = pose
    const sc = `scale(${(s * flip).toFixed(4)} ${s.toFixed(4)})`
    set('actor', 'transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) ${sc}`)
    set('torso', 'transform', `rotate(${p.lean.toFixed(2)})`)
    set('head', 'transform', `translate(0 -62) rotate(${p.head.toFixed(2)})`)
    set('armF', 'transform', `translate(${SHOULDER_X} ${SHOULDER_Y}) rotate(${(-p.sF).toFixed(2)})`)
    set('foreF', 'transform', `translate(0 ${UPPER}) rotate(${(-p.eF).toFixed(2)})`)
    set('armB', 'transform', `translate(${SHOULDER_X - 3} ${SHOULDER_Y}) rotate(${(-p.sB).toFixed(2)})`)
    set('foreB', 'transform', `translate(0 ${UPPER}) rotate(${(-p.eB).toFixed(2)})`)
    set('legF', 'transform', `rotate(${(-p.hF).toFixed(2)})`)
    set('shinF', 'transform', `translate(0 ${L1}) rotate(${p.kF.toFixed(2)})`)
    set('footF', 'transform', `translate(0 ${L2}) rotate(${(p.pF + p.hF - p.kF).toFixed(2)})`)
    set('legB', 'transform', `rotate(${(-p.hB).toFixed(2)})`)
    set('shinB', 'transform', `translate(0 ${L1}) rotate(${p.kB.toFixed(2)})`)
    set('footB', 'transform', `translate(0 ${L2}) rotate(${(p.pB + p.hB - p.kB).toFixed(2)})`)

    // noutbuk: yashik ustida -> qo'lda -> tizzada
    const h = hand(p)
    let lx = seatX - 6 * s, ly = crateTop - 2 * s, lf = 1
    if (wAttach > 0) {
      lx = lerp(lx, x + flip * s * (h.x + GRIP.x), wAttach)
      ly = lerp(ly, y + s * (h.y + GRIP.y), wAttach)
      lf = lerp(1, flip, wAttach)
    }
    if (wLap > 0) {
      lx = lerp(lx, x + flip * s * LAP.x, wLap)
      ly = lerp(ly, y + s * LAP.y, wLap)
    }
    set('laptop', 'transform', `translate(${lx.toFixed(2)} ${ly.toFixed(2)}) scale(${(s * lf).toFixed(4)} ${s.toFixed(4)})`)
    set('lid', 'transform', `translate(17 -2) rotate(${lidAngle.toFixed(2)})`)
    set('shadow', 'cx', x.toFixed(1))
  }

  function setCurtain(p: number) {
    curtain.style.transform = p >= 1 ? 'none' : `translate3d(0, ${(-(1 - p) * 101).toFixed(3)}%, 0)`
    fade('shadow', 0.3 * p); fade('crateShadow', 0.3 * p)
  }
  function setCord(hx: number, hy: number, on: boolean) {
    show('cord', on); show('handle', on)
    if (!on) return
    set('cord', 'd', `M${cordX.toFixed(1)} ${railH + 4}L${hx.toFixed(1)} ${hy.toFixed(1)}`)
    set('handle', 'cx', hx.toFixed(1)); set('handle', 'cy', (hy + 4.5 * s).toFixed(1))
  }
  function setSpot(o: number) {
    set('spot', 'cx', x.toFixed(1)); set('spot', 'cy', (y - 40 * s).toFixed(1)); fade('spot', o)
  }
  const worldHand = () => { const h = hand(pose); return { x: x + flip * s * h.x, y: y + s * h.y } }

  function tween(ms: number, fn: (u: number) => void, e: (u: number) => number = ease.linear) {
    const mine = token
    return new Promise<void>((resolve, reject) => {
      let start = -1
      const tick = (now: number) => {
        if (mine !== token) return reject(ABORT)
        if (start < 0) start = now
        const u = Math.min(1, (now - start) / ms)
        fn(e(u)); render()
        if (u < 1) clock.raf(tick); else resolve()
      }
      clock.raf(tick)
    })
  }
  const toPose = (to: Pose, ms: number, ground: number, e = ease.inOut) => {
    const from = pose
    return tween(ms, (u) => { pose = mix(from, to, u); y = ground - hipHeight(pose) * s }, e)
  }

  function puff(px: number, py: number) {
    const mine = token
    let start = -1
    const tick = (now: number) => {
      if (mine !== token) return
      if (start < 0) start = now
      const u = Math.min(1, (now - start) / 560)
      dust.forEach((c, i) => {
        const dir = i % 2 ? 1 : -1, k = 0.5 + (i % 3) * 0.35
        c.setAttribute('cx', (px + dir * ease.out(u) * (18 + i * 7) * s * k).toFixed(1))
        c.setAttribute('cy', (py - ease.out(u) * (5 + (i % 3) * 5) * s).toFixed(1))
        c.setAttribute('r', ((2 + ease.out(u) * (4 + (i % 3) * 2)) * s).toFixed(1))
        c.setAttribute('opacity', (0.5 * (1 - u)).toFixed(3))
      })
      if (u < 1) clock.raf(tick)
    }
    clock.raf(tick)
  }

  async function sequence(onCurtain: () => void) {
    const tall = UNITS_TALL * s
    // boshlang'ich holat
    wAttach = 0; wLap = 0; lidAngle = 0; flip = 1
    fade('glint', 0); fade('screen', 0); fade('glow', 0)
    show('ledge', true); set('ledge', 'transform', 'translate(0 0)')
    setCurtain(0); setCord(cordX, handleRestY, true)

    // 1. chapdan yurib keladi
    const stepPx = STEP_LEN * s
    const steps = clamp(Math.round((grabX + 60 * s) / stepPx), 3, 8)
    const startX = grabX - steps * stepPx
    const fadeIn = startX > -30 * s
    el.actor.style.opacity = fadeIn ? '0' : '1'
    await tween((steps / 3) * 1000, (u) => {
      const ph = u * steps * Math.PI
      pose = walkPose(ph)
      x = startX + walkTravel(ph) * s
      y = ledgeY - hipHeight(pose) * s
      setSpot(Math.min(1, u * 4))
      if (fadeIn) el.actor.style.opacity = Math.min(1, u * 5).toFixed(2)
    })
    el.actor.style.opacity = '1'
    x = grabX
    early = false

    // 2. to'xtaydi, ipga qo'l uzatadi
    await toPose(STAND, 200, ledgeY, ease.out)
    await toPose(REACH, 330, ledgeY)
    await tween(110, () => {})

    // 3. cho'kib kuch oladi: ip biroz tortiladi, parda chetidan mo'ralaydi
    const follow = () => { const h = worldHand(); setCord(h.x, h.y, true); return h }
    const pull0 = worldHand().y
    {
      const from = pose
      await tween(230, (u) => {
        pose = mix(from, CROUCH, u); y = ledgeY - hipHeight(pose) * s
        const h = follow(); setCurtain(clamp((h.y - pull0) / H, 0, 0.06) + 0.012 * u); setSpot(1)
      }, ease.inOut)
    }

    // 4. sakraydi: ip qo'lda, parda u bilan birga tushadi
    const x0 = x, y0 = y
    const y1 = floorY - hipHeight(TOUCH) * s
    const fall = y1 - y0
    const dur = clamp(0.52 + 0.13 * (fall / tall), 0.62, 0.95) * 1000
    const pullEnd = y1 + hand(TOUCH).y * s
    const crouched = pose
    const hop = tall * 0.13
    let curtainP = 0
    await tween(dur, (u) => {
      x = lerp(x0, pickX, 1 - Math.pow(1 - u, 1.35))
      const up = u < 0.34 ? Math.sin((u / 0.34) * Math.PI) : 0
      y = y0 - hop * up + fall * Math.pow(u, 2.3)
      pose = u < 0.3 ? mix(crouched, FALL, ease.out(u / 0.3)) : u > 0.74 ? mix(FALL, TOUCH, ease.inOut((u - 0.74) / 0.26)) : FALL
      const h = follow()
      curtainP = Math.max(curtainP, clamp((h.y - pull0) / (pullEnd - pull0), 0, 1) * 0.9)
      setCurtain(curtainP)
      setSpot(1 - clamp((curtainP - 0.25) / 0.5, 0, 1))
      set('ledge', 'transform', `translate(${(-ease.in(Math.min(1, u * 1.5)) * (grabX + 300)).toFixed(1)} 0)`)
    })
    show('ledge', false); fade('spot', 0)

    // 5. yerga tushadi: ipni qo'yib yuboradi, parda oxirigacha tushib bir silkinadi
    puff(x + 6 * s, floorY)
    const release = worldHand()
    const quiet = () => {} // to'xtatilganda asosiy zanjir o'zi xabar beradi
    const rest = tween(520, (u) => { setCurtain(lerp(curtainP, 1, ease.outBack(u))) }, ease.linear).then(() => { setCurtain(1); onCurtain() }, quiet)
    const recoil = tween(420, (u) => setCord(lerp(release.x, cordX, u), lerp(release.y, railH + 6, u), u < 1), ease.in).catch(quiet)
    await toPose(LAND, 150, floorY, ease.out)

    // 6. noutbukka egiladi va oladi
    await toPose(PICK, 320, floorY)
    await tween(130, (u) => { wAttach = u }, ease.out)
    await Promise.all([rest, recoil])

    // 7. ko'tarilib, o'girilib yashikka o'tiradi
    await toPose(HOLD, 340, floorY)
    {
      const fx = x, tx = seatX - 22 * s, base = y
      await tween(360, (u) => {
        flip = lerp(1, -1, ease.inOut(u))
        x = lerp(fx, tx, ease.inOut(u))
        y = base - Math.sin(u * Math.PI) * 7 * s
      })
      flip = -1
    }
    {
      const fx = x, fy = y, from = pose
      await tween(440, (u) => {
        pose = mix(from, SIT, u)
        x = lerp(fx, seatX, u); y = lerp(fy, seatY, u)
        wLap = u
      }, ease.inOut)
      // o'tirganda yengil silkinish
      await tween(180, (u) => { y = seatY + Math.sin(u * Math.PI) * 2.2 * s; pose = { ...SIT, lean: SIT.lean + 3 * Math.sin(u * Math.PI) } })
    }

    // 8. noutbukni ochadi
    await tween(340, (u) => {
      lidAngle = 105 * ease.outBack(u)
      const o = clamp((u - 0.45) / 0.55, 0, 1)
      fade('screen', o); fade('glow', 0.2 * o); fade('glint', o)
    })
  }

  function settle() {
    token++
    playing = false
    measure()
    pose = SIT; x = seatX; y = seatY; flip = -1
    wAttach = 1; wLap = 1; lidAngle = 105
    show('ledge', false); fade('spot', 0); setCord(0, 0, false)
    dust.forEach((c) => c.setAttribute('opacity', '0'))
    el.actor.style.opacity = '1'
    fade('screen', 1); fade('glow', 0.2); fade('glint', 1)
    setCurtain(1)
    render()
    settled = true
    idle()
  }

  /** O'tirgan holatdagi jonli harakat: terish, nafas, ora-sira ekranga qarash. */
  function idle() {
    const mine = ++loopId
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let burst = 0
    const tick = (now: number) => {
      if (mine !== loopId || !settled) return
      clock.raf(tick)
      lastNow = now
      if (!visible) return
      const t = now / 1000
      if (!typing && Math.sin(t * 0.9) > 0.86) burst = now + 700 // ora-sira bir-ikki tugma
      const amp = typing ? 1 : now < burst ? 0.7 : 0
      const up = now < glanceUntil ? 1 : 0
      const target = SIT.head - 26 * up
      pose = {
        ...SIT,
        lean: SIT.lean + 0.9 * Math.sin(t * 1.5) - 3 * up,
        head: lerp(pose.head, target + 1.2 * Math.sin(t * 2.2), 0.18),
        eF: SIT.eF + amp * (4.5 * Math.sin(t * 34) + 2 * Math.sin(t * 13)),
        eB: SIT.eB + amp * (4.5 * Math.sin(t * 29 + 1.4) + 2 * Math.sin(t * 11)),
        sF: SIT.sF + amp * 1.6 * Math.sin(t * 9),
        sB: SIT.sB + amp * 1.6 * Math.sin(t * 7 + 2),
      }
      y = seatY + 0.5 * s * Math.sin(t * 1.5)
      fade('glow', 0.17 + 0.05 * Math.sin(t * 5.3) * amp)
      render()
    }
    clock.raf(tick)
  }

  let sized: (() => void) | undefined
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const box = svg.getBoundingClientRect()
      if (Math.abs(box.width - W) < 1 && Math.abs(box.height - H) < 1) return
      if (sized) { sized(); sized = undefined; return }
      // o'lcham o'zgarsa sahna darhol yakuniy holatga o'tadi
      if (playing) { restart = early; token++ } else if (settled) settle()
    }).observe(svg)
  }

  const api: Stage = {
    async play(onCurtain) {
      measure()
      // Sahifa hali chizilmagan bo'lsa (o'lcham nol), haqiqiy o'lchamni kutamiz.
      if (W < 40 || H < 40) {
        await new Promise<void>((resolve) => { sized = resolve; setTimeout(resolve, 1500) })
        measure()
      }
      playing = true; settled = false; early = true; restart = false
      let curtainDone = false
      const done = () => { if (!curtainDone) { curtainDone = true; onCurtain() } }
      try {
        await sequence(done)
        playing = false; settled = true
        idle()
      } catch (err) {
        if (err !== ABORT) console.error(err)
        if (restart) return api.play(onCurtain)
        settle(); done()
      }
    },
    settle,
    skip() { if (playing) token++ },
    setTyping(active) { typing = active },
    glance() { glanceUntil = lastNow + 650 },
    setVisible(v) { visible = v },
  }
  return api
}
