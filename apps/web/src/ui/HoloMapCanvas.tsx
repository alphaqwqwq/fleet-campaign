import { useEffect, useRef } from 'react'

import type { BattleState } from '@fleet-campaign/battle'

/**
 * M2-E 全息地图 canvas：从 docs/reference/ui-mockups/holo-map.html 视觉基线移植。
 * - 星系背景：Kepler 轨道 + 摄像机卫星 + Lambert 光照 + 遮挡 + 扫描网格
 * - 带轨：左=极限(5) → 右=至近(0)，双方战斗群按各自 distance 定位，相向而视
 * - 舰船符号：wowsdb 标准矢量（Path2D）；航迹 / HP 环 / 选中圈 / 索敌高亮
 * - 特效：齐射弧线 / 护盾 / 伤害数字
 *
 * 数据：props.state 每个 rAF 帧读取（经 ref 缓存），交互通过回调上抛。
 */

export interface HoloMapTargeting {
  label: string
  /** 当前选中（我方舰或索敌提示）。 */
  active?: boolean
}

export interface HoloMapProps {
  state: BattleState
  selectedShipId: string | null
  /** 索敌模式：非 null 时点敌方舰触发 onTargetShip。 */
  targetingLabel: string | null
  /** 新事件（自上次渲染以来），用于在 canvas 上触发齐射/护盾/伤害特效。 */
  pendingEvents: import('@fleet-campaign/battle').BattleEvent[]
  onSelectShip: (shipId: string, groupId: string, isEnemy: boolean) => void
  onTargetShip: (shipId: string, groupId: string) => void
}

// 舰种 → 图标类（与 holo-map 一致：bb 战列 / ff 巡防 / cv 航母）
function iconClassFor(type: string): string {
  switch (type) {
    case 'battleship':
      return 'bb'
    case 'carrier':
      return 'cv'
    case 'frigate':
      return 'ff'
    default:
      return 'dd'
  }
}

export function HoloMapCanvas(props: HoloMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas
    const g = canvas.getContext('2d') as CanvasRenderingContext2D

    let W = 0
    let H = 0
    let DPR = 1
    let raf = 0
    let clock = 0
    let lastFxEventCount = 0

    function resize(): void {
      DPR = window.devicePixelRatio || 1
      W = c.clientWidth
      H = c.clientHeight
      c.width = Math.max(1, Math.floor(W * DPR))
      c.height = Math.max(1, Math.floor(H * DPR))
      g.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // 星系背景配置（DESIGN-M2-UI 定稿默认值）。
    const FOCAL = 410
    const ELEV = 42
    const VIEWD = 330
    const SUN_R = 24
    const GIANT = { a: 360, e: 0.05, T: 300, r: 95, phase: 1.1 }
    const ROCKY = { a: 230, e: 0.12, T: 291, r: 47, phase: 3.4 }
    const MOON = { a: 96, e: 0.03, T: 268, r: 12, phase: 2.2 }
    const CAM = { a: 150, T: 120, phase: 0, yaw: -0.09 }
    const farStars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.8 + 0.2,
      rph: Math.random() * 6,
    }))

    function kepler(body: { a: number; e: number; T: number; phase: number }, t: number) {
      const M = (2 * Math.PI * t) / body.T + body.phase
      let E = M
      for (let i = 0; i < 5; i++) E = E - (E - body.e * Math.sin(E) - M) / (1 - body.e * Math.cos(E))
      const nu = 2 * Math.atan2(Math.sqrt(1 + body.e) * Math.sin(E / 2), Math.sqrt(1 - body.e) * Math.cos(E / 2))
      const rr = (body.a * (1 - body.e * body.e)) / (1 + body.e * Math.cos(nu))
      return { x: Math.cos(nu) * rr, y: Math.sin(nu) * rr }
    }
    function keplerRel(body: { a: number; T: number; phase: number }, t: number) {
      const M = (2 * Math.PI * t) / body.T + body.phase
      return { x: Math.cos(M) * body.a, y: Math.sin(M) * body.a }
    }
    function camPos(gpos: { x: number; y: number }, t: number) {
      const ang = CAM.phase + (2 * Math.PI * t) / CAM.T
      return { x: gpos.x + Math.cos(ang) * CAM.a, y: gpos.y + Math.sin(ang) * CAM.a }
    }
    function norm(v: { x: number; y: number }) {
      const d = Math.hypot(v.x, v.y) || 1
      return { x: v.x / d, y: v.y / d }
    }
    function rotate(v: { x: number; y: number }, a: number) {
      return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }
    }
    function viewDirFor(cp: { x: number; y: number }, tgt: { x: number; y: number }) {
      const vd = norm({ x: tgt.x - cp.x, y: tgt.y - cp.y })
      return rotate(vd, CAM.yaw)
    }
    function project(pos: { x: number; y: number }, rad: number, vpos: { x: number; y: number }, vdir: { x: number; y: number }) {
      const dx = pos.x - vpos.x
      const dy = pos.y - vpos.y
      const dist = Math.hypot(dx, dy) || 1
      const along = dx * vdir.x + dy * vdir.y
      if (along <= 0) return null
      const perp = dx * vdir.y - dy * vdir.x
      const sy = H * 0.44 + (ELEV / along - ELEV / VIEWD) * FOCAL
      const sx = W / 2 + (perp / along) * FOCAL
      return { x: sx, y: sy, size: (rad / dist) * FOCAL, along, dist }
    }
    function projectNoReject(pos: { x: number; y: number }, rad: number, vpos: { x: number; y: number }, vdir: { x: number; y: number }) {
      const dx = pos.x - vpos.x
      const dy = pos.y - vpos.y
      const dist = Math.hypot(dx, dy) || 1
      const along = Math.max(dx * vdir.x + dy * vdir.y, 40)
      const perp = dx * vdir.y - dy * vdir.x
      const sy = H * 0.44 + (ELEV / along - ELEV / VIEWD) * FOCAL
      return { x: W / 2 + (perp / along) * FOCAL, y: sy, size: (rad / dist) * FOCAL }
    }

    // 带轨：左=极限(5) → 至近(0)
    const BANDS = ['极限', '长', '瞄准镜', '坍缩', '近', '至近']
    const railL = 0.1 * W
    const railR = 0.9 * W
    const railY = H * 0.16
    const BX = (b: number) => railL + (5 - b) * ((railR - railL) / 5)

    // 舰船图标（wowsdb 标准矢量，viewBox 27×27，船头朝右）
    const ICONS: Record<string, string[]> = {
      dd: ['m4.5 8.5 19 5-19 5z'],
      ff: ['M4.5 8.5h10.35l-5.7 10H4.5z', 'm15.75 8.5 1.75.02 6 4.98-6 5h-7.45z'],
      bb: ['M4.5 8.5h8.35l-5.7 10H4.5z', 'M13.75 8.5h3.1l-5.7 10h-3.1z', 'm17.75 8.5 5.75 5-6 5h-5.45z'],
      cv: ['M4.5 8.5h10.55v4.55H4.5z', 'M4.5 13.95h10.55v4.55H4.5z', 'm15.95 8.5 7.55 5-7.55 5z'],
    }
    function seedStr(n: string): number {
      let h = 0
      for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) | 0
      return Math.abs(h)
    }

    interface RenderShip {
      id: string
      groupId: string
      faction: 'player' | 'enemy'
      type: string
      distance: number
      hpRatio: number
      status: string
      xOff: number
      dy: number
      color: string
    }

    // 每帧从 props 派生渲染舰船（group 各自 distance，玩家左敌右、相向而视）。
    function renderShips(): RenderShip[] {
      const p = propsRef.current
      const ships: RenderShip[] = []
      for (const group of p.state.battleGroups) {
        const isPlayer = group.faction === 'player'
        const color = isPlayer ? '#59d8ff' : '#ffb34d'
        const fleet = [group.flagship, ...group.ships]
        fleet.forEach((ship, i) => {
          const off = (i - (fleet.length - 1) / 2) * 0.05
          ships.push({
            id: ship.id,
            groupId: group.id,
            faction: group.faction,
            type: ship.type,
            distance: group.distance,
            hpRatio: ship.maxHp > 0 ? ship.hp / ship.maxHp : 0,
            status: ship.status,
            xOff: off,
            dy: i % 2 === 0 ? -18 : 16,
            color,
          })
        })
      }
      return ships
    }

    function shipPos(ship: RenderShip): { x: number; y: number } {
      const breathing = 0.003 * W * Math.sin(clock * 0.03)
      const drift = Math.sin(clock * 0.08 + seedStr(ship.id)) * 2
      const bob = Math.sin(clock * 0.25 + seedStr(ship.id)) * 1.6
      const side = ship.faction === 'player' ? -1 : 1
      const gap = 0.05 * W
      return { x: BX(ship.distance) + ship.xOff * W + side * gap + side * breathing + drift, y: H * 0.44 + ship.dy + bob }
    }

    function drawShipIcon(cls: string, x: number, y: number, color: string, scale: number, glow: boolean, mirror: boolean) {
      g.save()
      g.translate(x, y)
      g.scale(scale * (mirror ? -1 : 1), scale)
      g.translate(-13.5, -13.5)
      g.fillStyle = color
      if (glow) {
        g.shadowColor = color
        g.shadowBlur = 7
      }
      g.globalAlpha = 0.92
      for (const d of ICONS[cls] || ICONS.dd) g.fill(new Path2D(d))
      g.globalAlpha = 1
      g.shadowBlur = 0
      g.restore()
    }

    function wake(x: number, y: number, color: string, mirror: boolean) {
      g.strokeStyle = color
      g.globalAlpha = 0.28
      g.lineWidth = 1
      g.beginPath()
      if (mirror) {
        g.moveTo(x + 6, y)
        g.lineTo(x + 20, y)
      } else {
        g.moveTo(x - 6, y)
        g.lineTo(x - 20, y)
      }
      g.stroke()
      g.globalAlpha = 1
    }

    function hpRing(ship: RenderShip) {
      const p = shipPos(ship)
      const w = 30
      const h = 2.5
      g.fillStyle = 'rgba(20,40,52,.8)'
      g.fillRect(p.x - w / 2, p.y + 14, w, h)
      g.fillStyle = ship.color
      g.fillRect(p.x - w / 2, p.y + 14, w * Math.max(0, ship.hpRatio), h)
    }

    function drawSel(ship: RenderShip) {
      const p = shipPos(ship)
      const pulse = 1 + 0.15 * Math.sin(performance.now() / 300)
      g.strokeStyle = '#59d8ff'
      g.lineWidth = 1.5
      g.shadowColor = '#59d8ff'
      g.shadowBlur = 10
      g.beginPath()
      g.arc(p.x, p.y, 16 * pulse, 0, 6.28)
      g.stroke()
      g.shadowBlur = 0
    }

    // 特效（fire 齐射弧线 / shield 护盾 / dmg 伤害数字）
    interface Fx {
      k: 'fire' | 'shield' | 'dmg'
      from?: { x: number; y: number }
      to: { x: number; y: number }
      t: number
      dur: number
      color: string
      text?: string
    }
    const FX: Fx[] = []

    function drawBackground() {
      const t = clock
      const gpos = kepler(GIANT, t)
      const rpos = kepler(ROCKY, t)
      const mrel = keplerRel(MOON, t)
      const mpos = { x: gpos.x + mrel.x, y: gpos.y + mrel.y }
      const cp = camPos(gpos, t)
      const vdir = viewDirFor(cp, gpos)

      g.fillStyle = '#04080c'
      g.fillRect(0, 0, W, H)
      for (const s of farStars) {
        g.globalAlpha = 0.22 + 0.4 * Math.abs(Math.sin(performance.now() / 1600 + s.rph))
        g.fillStyle = '#dceeff'
        g.beginPath()
        g.arc(s.x * W, s.y * H, s.r, 0, 6.28)
        g.fill()
      }
      g.globalAlpha = 1

      const spC = projectNoReject({ x: 0, y: 0 }, SUN_R, cp, vdir)
      const spReal = project({ x: 0, y: 0 }, SUN_R, cp, vdir)
      const gp = project(gpos, GIANT.r, cp, vdir)

      function occluded(bp: { x: number; y: number }): boolean {
        if (!gp) return false
        if (Math.hypot(bp.x - gp.x, bp.y - gp.y) >= gp.size) return false
        const gDist = Math.hypot(gpos.x - cp.x, gpos.y - cp.y) || 1
        return Math.hypot(bp.x - cp.x, bp.y - cp.y) > gDist - GIANT.r
      }
      function litFactor(bp: { x: number; y: number }): number {
        const s = norm({ x: 0 - bp.x, y: 0 - bp.y })
        const c = norm({ x: cp.x - bp.x, y: cp.y - bp.y })
        return Math.max(0, s.x * c.x + s.y * c.y)
      }

      function drawPlanet(x: number, y: number, r: number, color: string, light: { x: number; y: number }, lit: number) {
        if (r < 2) return
        const grad = g.createRadialGradient(x + light.x * r * 0.5, y + light.y * r * 0.5, r * 0.1, x, y, r)
        grad.addColorStop(0, color)
        grad.addColorStop(0.55, color)
        grad.addColorStop(1, 'rgba(6,14,24,.92)')
        g.fillStyle = grad
        g.beginPath()
        g.arc(x, y, r, 0, 6.28)
        g.fill()
        const term = g.createRadialGradient(x + light.x * r * 0.75, y + light.y * r * 0.75, 0, x, y, r * 1.2)
        term.addColorStop(0, 'rgba(255,255,255,0)')
        term.addColorStop(0.6, 'rgba(255,255,255,0)')
        term.addColorStop(0.68, `rgba(4,8,12,${0.5 + 0.2 * lit})`)
        term.addColorStop(1, 'rgba(2,5,9,.92)')
        g.fillStyle = term
        g.beginPath()
        g.arc(x, y, r, 0, 6.28)
        g.fill()
      }

      const list: { along: number; draw: () => void }[] = []
      if (spReal && !occluded(spReal)) {
        list.push({
          along: spReal.along,
          draw: () => {
            g.fillStyle = '#fff6d0'
            g.beginPath()
            g.arc(spReal.x, spReal.y, Math.max(spReal.size * 1.5, 1.5), 0, 6.28)
            g.fill()
          },
        })
      }
      const rp = project(rpos, ROCKY.r, cp, vdir)
      if (rp && !occluded(rp)) {
        list.push({
          along: rp.along,
          draw: () => drawPlanet(rp.x, rp.y, rp.size, 'rgba(224,184,142,.82)', lightFor(spC, rp), litFactor(rpos)),
        })
      }
      if (gp) list.push({ along: gp.along, draw: () => drawPlanet(gp.x, gp.y, gp.size, 'rgba(110,160,220,.85)', lightFor(spC, gp), litFactor(gpos)) })
      const mp = project(mpos, MOON.r, cp, vdir)
      if (mp && !occluded(mp)) {
        list.push({
          along: mp.along,
          draw: () => drawPlanet(mp.x, mp.y, mp.size, 'rgba(220,232,242,.85)', lightFor(spC, mp), litFactor(mpos)),
        })
      }
      list.sort((a, b) => a.along - b.along)
      for (const b of list) b.draw()

      // 扫描网格
      g.strokeStyle = 'rgba(89,216,255,.04)'
      g.lineWidth = 1
      g.beginPath()
      for (let x = 0; x <= W; x += 48) {
        g.moveTo(x, 0)
        g.lineTo(x, H)
      }
      for (let y = 0; y <= H; y += 48) {
        g.moveTo(0, y)
        g.lineTo(W, y)
      }
      g.stroke()
    }

    function lightFor(sp: { x: number; y: number }, bp: { x: number; y: number }) {
      const dd = Math.hypot(sp.x - bp.x, sp.y - bp.y) || 1
      return { x: (sp.x - bp.x) / dd, y: (sp.y - bp.y) / dd }
    }

    // 命中检测：记录每帧舰船位置供点击用。
    let hitShips: { ship: RenderShip; x: number; y: number }[] = []

    function draw() {
      clock += 0.016
      g.clearRect(0, 0, W, H)
      drawBackground()
      const p = propsRef.current

      // 带轨
      for (let b = 0; b < 6; b++) {
        const x = BX(b)
        const on = p.state.battleGroups.some((g) => g.distance === b)
        g.strokeStyle = on ? 'rgba(89,216,255,.9)' : 'rgba(89,216,255,.15)'
        g.lineWidth = on ? 2 : 1
        if (on) {
          g.shadowColor = 'rgba(89,216,255,.6)'
          g.shadowBlur = 10
        }
        g.beginPath()
        g.moveTo(x, railY - 8)
        g.lineTo(x, H * 0.84)
        g.stroke()
        g.shadowBlur = 0
        g.fillStyle = on ? '#a8e6ff' : 'rgba(150,180,195,.4)'
        g.font = '10px sans-serif'
        g.textAlign = 'center'
        g.fillText(BANDS[b], x, railY - 12)
      }

      const ships = renderShips()
      hitShips = []
      for (const ship of ships) {
        const pos = shipPos(ship)
        if (ship.status === 'active') hitShips.push({ ship, x: pos.x, y: pos.y })
        const mirror = ship.faction === 'enemy'
        wake(pos.x, pos.y, ship.color, mirror)
        drawShipIcon(iconClassFor(ship.type), pos.x, pos.y, ship.color, 1.0, false, mirror)
      }

      // 新事件 → 特效（齐射弧线 / 护盾 / 伤害数字）
      const events = p.pendingEvents
      if (events.length > lastFxEventCount) {
        for (let i = lastFxEventCount; i < events.length; i++) {
          const ev = events[i]
          if (ev.type === 'attack-resolved') {
            const attacker = ships.find((s) => s.groupId === ev.attackerGroupId && s.status === 'active') ?? ships.find((s) => s.groupId === ev.attackerGroupId)
            const target = ships.find((s) => s.id === ev.targetShipId)
            if (attacker && target) {
              FX.push({ k: 'fire', from: shipPos(attacker), to: shipPos(target), t: 0, dur: 0.9, color: '#59d8ff' })
              if (ev.hit) {
                FX.push({ k: 'shield', to: shipPos(target), t: 0.3, dur: 0.7, color: '#ffb34d' })
              }
            }
          } else if (ev.type === 'damage-applied' && ev.net > 0) {
            const target = ships.find((s) => s.id === ev.targetShipId)
            if (target) FX.push({ k: 'dmg', to: shipPos(target), t: 0.5, dur: 1.0, color: '#ff5a5a', text: `-${ev.net}` })
          }
        }
        lastFxEventCount = events.length
      }

      for (const ship of ships) {
        if (ship.status !== 'active') continue
        hpRing(ship)
      }
      for (const ship of ships) {
        if (ship.id === p.selectedShipId) drawSel(ship)
      }

      // 索敌高亮：targeting 模式下敌方舰描边。
      if (p.targetingLabel) {
        for (const ship of ships) {
          if (ship.faction !== 'enemy' || ship.status !== 'active') continue
          const pos = shipPos(ship)
          const pulse = 1 + 0.1 * Math.sin(performance.now() / 250)
          g.strokeStyle = 'rgba(255,179,77,.9)'
          g.lineWidth = 1.5
          g.shadowColor = '#ffb34d'
          g.shadowBlur = 8
          g.beginPath()
          g.arc(pos.x, pos.y, 17 * pulse, 0, 6.28)
          g.stroke()
          g.shadowBlur = 0
        }
      }

      // 特效
      for (let i = FX.length - 1; i >= 0; i--) {
        const f = FX[i]
        f.t += 0.016
        if (f.t > f.dur) {
          FX.splice(i, 1)
          continue
        }
        const q = f.t / f.dur
        if (f.k === 'fire' && f.from) {
          g.strokeStyle = `rgba(89,216,255,${0.7 * (1 - q)})`
          g.lineWidth = 2
          g.shadowColor = '#59d8ff'
          g.shadowBlur = 6
          g.beginPath()
          for (let k = 0; k <= 12; k++) {
            const tt = k / 12
            const xx = f.from.x + (f.to.x - f.from.x) * tt
            const yy = f.from.y + (f.to.y - f.from.y) * tt + Math.sin(tt * Math.PI) * (-2 - q * 16)
            if (k) g.lineTo(xx, yy)
            else g.moveTo(xx, yy)
          }
          g.stroke()
          g.shadowBlur = 0
        } else if (f.k === 'shield') {
          g.strokeStyle = `rgba(255,179,77,${0.85 * (1 - q)})`
          g.lineWidth = 2
          g.shadowColor = '#ffb34d'
          g.shadowBlur = 10
          g.beginPath()
          g.arc(f.to.x, f.to.y, 8 + q * 22, 0, 6.28)
          g.stroke()
          g.shadowBlur = 0
        } else if (f.k === 'dmg') {
          g.fillStyle = `rgba(255,179,77,${1 - q})`
          g.font = 'bold 15px monospace'
          g.textAlign = 'center'
          g.fillText(f.text ?? '-?', f.to.x, f.to.y - 10 - q * 16)
        }
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    function hitTest(cx: number, cy: number): { ship: RenderShip; x: number; y: number } | null {
      for (const h of hitShips) {
        if (Math.hypot(cx - h.x, cy - h.y) < 18) return h
      }
      return null
    }

    function onClick(e: MouseEvent): void {
      const r = c.getBoundingClientRect()
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      const hit = hitTest(cx, cy)
      const p = propsRef.current
      if (!hit) return
      if (hit.ship.faction === 'enemy' && p.targetingLabel) {
        p.onTargetShip(hit.ship.id, hit.ship.groupId)
      } else {
        p.onSelectShip(hit.ship.id, hit.ship.groupId, hit.ship.faction === 'enemy')
      }
    }
    c.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      c.removeEventListener('click', onClick)
    }
  }, [])

  return <canvas ref={canvasRef} className="b-holo" />
}
