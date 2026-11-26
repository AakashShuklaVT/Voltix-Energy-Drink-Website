import * as THREE from 'three'
import { BODY_LENGTH, RADIUS, arcAtY } from './profile'

/**
 * Procedural label artwork for the VOLTIX can, recreated from the reference
 * product shots in /design/reference.
 *
 * Everything is drawn in "label units" (1 unit = 1/1000 can-unit) on a canvas
 * whose x axis wraps the full circumference and whose y axis follows the arc
 * length of the can wall — so text and shapes appear undistorted on the 3D
 * model. The same drawing routine runs twice:
 *   • pass 'color' → albedo map
 *   • pass 'orm'   → packed (AO, roughness, metalness) map, so the printed inks,
 *                    the metallic navy and the bare aluminium all reflect light
 *                    differently.
 */

const LABEL_SCALE = 1000 // label units per can-unit
export const LABEL_C = Math.PI * 2 * RADIUS * LABEL_SCALE // circumference in label units
export const LABEL_S = BODY_LENGTH * LABEL_SCALE // printed height in label units
const FRONT_X = LABEL_C / 2 // front centre
const DISPLAY_FONT = "'Archivo Variable', 'Arial Black', sans-serif"
const BODY_FONT = "'Inter Variable', 'Helvetica Neue', Arial, sans-serif"

// Physical height (can-units, from the base) → label y (from the top)
const labelY = (y) => LABEL_S - arcAtY(y) * LABEL_SCALE

// Material response per ink: [roughness, metalness]
const INK_MATERIALS = {
  base: [0.34, 0.5],
  baseDeep: [0.34, 0.5],
  accent: [0.27, 0.6],
  accentDeep: [0.27, 0.6],
  accentSoft: [0.27, 0.6],
  ink: [0.36, 0.25],
  metal: [0.2, 1],
  shade: [0.32, 0.7],
}

export async function ensureLabelFonts() {
  if (!document.fonts) return
  await Promise.all(
    [
      "italic 900 100px 'Archivo Variable'",
      "900 100px 'Archivo Variable'",
      "800 100px 'Archivo Variable'",
      "600 100px 'Inter Variable'",
      "400 100px 'Inter Variable'",
    ].map((font) => document.fonts.load(font).catch(() => null)),
  )
}

// --- Helpers --------------------------------------------------------------

// Some browsers accept ctx.fontStretch but ignore it, so check that it actually widens the text
let stretchSupported = null
function supportsFontStretch(ctx) {
  if (stretchSupported !== null) return stretchSupported
  if (!('fontStretch' in ctx)) return (stretchSupported = false)
  ctx.save()
  ctx.font = `900 100px ${DISPLAY_FONT}`
  ctx.fontStretch = 'normal'
  const normalWidth = ctx.measureText('VOLTIX').width
  ctx.fontStretch = 'expanded'
  const expandedWidth = ctx.measureText('VOLTIX').width
  ctx.restore()
  return (stretchSupported = expandedWidth / normalWidth > 1.06)
}

/** Draws text with optional wide font-stretch (falls back to a horizontal scale). Returns the drawn width. */
function drawText(ctx, content, x, y, { size, weight = 900, italic = false, family = DISPLAY_FONT, wide = false, align = 'center', tracking = 0, fill }) {
  let drawnWidth = 0
  ctx.save()
  ctx.fillStyle = fill
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
  let scaleX = 1
  if (wide) {
    if (supportsFontStretch(ctx)) ctx.fontStretch = 'expanded'
    else scaleX = 1.18
  }
  ctx.translate(x, y)
  ctx.scale(scaleX, 1)
  if (!tracking) {
    ctx.textAlign = align
    ctx.fillText(content, 0, 0)
    drawnWidth = ctx.measureText(content).width * scaleX
  } else {
    // manual letter-spacing (canvas letterSpacing isn't universal)
    const chars = [...content]
    const widths = chars.map((char) => ctx.measureText(char).width)
    const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1)
    drawnWidth = total * scaleX
    let cursorX = align === 'center' ? -total / 2 : align === 'right' ? -total : 0
    ctx.textAlign = 'left'
    chars.forEach((char, i) => {
      ctx.fillText(char, cursorX, 0)
      cursorX += widths[i] + tracking
    })
  }
  ctx.restore()
  return drawnWidth
}

function traceRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Simple seeded RNG so every texture regeneration is identical
function seededRandom(seed = 7) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function drawBolt(ctx, x, y, size) {
  ctx.beginPath()
  ctx.moveTo(x + 0.1 * size, y - 0.5 * size)
  ctx.lineTo(x - 0.32 * size, y + 0.06 * size)
  ctx.lineTo(x - 0.02 * size, y + 0.06 * size)
  ctx.lineTo(x - 0.12 * size, y + 0.5 * size)
  ctx.lineTo(x + 0.32 * size, y - 0.08 * size)
  ctx.lineTo(x + 0.02 * size, y - 0.08 * size)
  ctx.closePath()
  ctx.fill()
}

/**
 * Crescent "swoosh": the area between two cubic Bézier curves that share
 * end points. `outer1`/`outer2` are the control points of the outer edge,
 * `inner1`/`inner2` those of the inner edge.
 */
function traceSwoosh(ctx, start, end, outer1, outer2, inner1, inner2) {
  ctx.beginPath()
  ctx.moveTo(start[0], start[1])
  ctx.bezierCurveTo(outer1[0], outer1[1], outer2[0], outer2[1], end[0], end[1])
  ctx.bezierCurveTo(inner2[0], inner2[1], inner1[0], inner1[1], start[0], start[1])
  ctx.closePath()
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
}

/**
 * Halftone dots that fade out with distance from a curve.
 * `side` (1 / -1) keeps only the dots on one side of the curve; 0 keeps both.
 */
function halftoneAlong(ctx, samples, width, spacing, maxR, fill, side = 0) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of samples) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  minX -= width; minY -= width; maxX += width; maxY += width
  ctx.fillStyle = fill
  ctx.beginPath()
  // hexagonal grid: rows are √3/2 apart and every other row is offset by half a step
  let row = 0
  for (let y = minY; y <= maxY; y += spacing * 0.866, row++) {
    for (let x = minX + (row % 2) * spacing * 0.5; x <= maxX; x += spacing) {
      let bestDistSq = Infinity, nearest = 0
      for (let i = 0; i < samples.length; i++) {
        const dx = x - samples[i][0], dy = y - samples[i][1]
        const distSq = dx * dx + dy * dy
        if (distSq < bestDistSq) { bestDistSq = distSq; nearest = i }
      }
      const distance = Math.sqrt(bestDistSq)
      if (distance > width) continue
      if (side) {
        // keep only dots on one side of the curve (by local normal)
        const before = samples[Math.max(0, nearest - 1)], after = samples[Math.min(samples.length - 1, nearest + 1)]
        const normalX = -(after[1] - before[1]), normalY = after[0] - before[0]
        if (Math.sign((x - samples[nearest][0]) * normalX + (y - samples[nearest][1]) * normalY) !== side) continue
      }
      const radius = maxR * Math.pow(1 - distance / width, 1.3)
      if (radius < 0.6) continue
      ctx.moveTo(x + radius, y)
      ctx.arc(x, y, radius, 0, Math.PI * 2)
    }
  }
  ctx.fill()
}

// --- Artwork --------------------------------------------------------------

function drawArtwork(ctx, pass, flavor) {
  const isColor = pass === 'color'
  // Colour pass → the actual ink colour. ORM pass → that ink's material packed as (AO, roughness, metalness).
  const paint = (key) => {
    if (isColor) return key === 'metal' ? '#c3c9d2' : key === 'shade' ? 'rgba(4,8,18,0.55)' : flavor[key]
    const [roughness, metalness] = INK_MATERIALS[key]
    return `rgb(255, ${Math.round(roughness * 255)}, ${Math.round(metalness * 255)})`
  }

  // 1. Bare aluminium everywhere (neck + lower taper stay unprinted)
  ctx.fillStyle = paint('metal')
  ctx.fillRect(-10, -10, LABEL_C + 20, LABEL_S + 20)

  const printTop = labelY(2.405)
  const printBottom = labelY(0.168)

  // 2. Metallic base colour
  if (isColor) {
    const gradient = ctx.createLinearGradient(0, printTop, 0, printBottom)
    gradient.addColorStop(0, flavor.baseLight)
    gradient.addColorStop(0.35, flavor.base)
    gradient.addColorStop(1, flavor.baseDeep)
    ctx.fillStyle = gradient
  } else ctx.fillStyle = paint('base')
  ctx.fillRect(-10, printTop, LABEL_C + 20, printBottom - printTop)

  // Wavy edge of the coloured top band (θ = 0 at the front)
  const edgeY = (x) => {
    const theta = ((x - FRONT_X) / LABEL_C) * Math.PI * 2
    return labelY(2.17 - 0.16 * Math.cos(theta - 0.5) - 0.05 * Math.sin(2 * theta + 0.4))
  }

  // 3. Top colour band
  ctx.beginPath()
  ctx.moveTo(-10, printTop)
  ctx.lineTo(LABEL_C + 10, printTop)
  for (let x = LABEL_C + 10; x >= -10; x -= 12) ctx.lineTo(x, edgeY(x))
  ctx.closePath()
  if (isColor) {
    const gradient = ctx.createLinearGradient(0, printTop, 0, labelY(1.9))
    gradient.addColorStop(0, flavor.accentSoft)
    gradient.addColorStop(0.55, flavor.accent)
    gradient.addColorStop(1, flavor.accentDeep)
    ctx.fillStyle = gradient
  } else ctx.fillStyle = paint('accent')
  ctx.fill()

  // Halftone gradient bleeding out of the band
  const edgeSamples = []
  for (let x = -40; x <= LABEL_C + 40; x += 10) edgeSamples.push([x, edgeY(x)])
  halftoneAlong(ctx, edgeSamples, 150, 15, 6.6, paint('accent'), -1)

  // Thin highlight under the band
  ctx.save()
  ctx.strokeStyle = isColor ? 'rgba(255,255,255,0.55)' : paint('ink')
  ctx.lineWidth = 4
  ctx.beginPath()
  for (let x = FRONT_X - 1200; x <= FRONT_X + 300; x += 10) {
    const y = edgeY(x) + 46 + Math.sin((x - FRONT_X) / 260) * 8
    x === FRONT_X - 1200 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // 4. Swooshes — drawn at x and x ± C so they wrap seamlessly
  const drawWrapped = (draw) => {
    for (const offset of [-LABEL_C, 0, LABEL_C]) {
      ctx.save()
      ctx.translate(offset, 0)
      draw()
      ctx.restore()
    }
  }

  const swooshFill = (x0, y0, x1, y1) => {
    if (!isColor) return paint('accent')
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
    gradient.addColorStop(0, flavor.accentDeep)
    gradient.addColorStop(0.5, flavor.accent)
    gradient.addColorStop(1, flavor.accentSoft)
    return gradient
  }

  drawWrapped(() => {
    // A — upper sweep behind the logo (right → left, downwards)
    const upperStart = [FRONT_X + 980, labelY(2.06)]
    const upperEnd = [FRONT_X - 760, labelY(1.28)]
    traceSwoosh(ctx, upperStart, upperEnd, [FRONT_X + 520, labelY(1.98)], [FRONT_X - 300, labelY(1.62)], [FRONT_X + 520, labelY(1.86)], [FRONT_X - 250, labelY(1.5)])
    ctx.fillStyle = swooshFill(upperStart[0], upperStart[1], upperEnd[0], upperEnd[1])
    ctx.fill()
    // white pin-stripe inside A
    ctx.strokeStyle = isColor ? 'rgba(255,255,255,0.75)' : paint('ink')
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(FRONT_X + 820, labelY(1.99))
    ctx.bezierCurveTo(FRONT_X + 420, labelY(1.89), FRONT_X - 200, labelY(1.6), FRONT_X - 600, labelY(1.33))
    ctx.stroke()

    // B — big lower crescent (left → up to the right)
    const lowerStart = [FRONT_X - 900, labelY(0.36)]
    const lowerEnd = [FRONT_X + 900, labelY(1.16)]
    traceSwoosh(ctx, lowerStart, lowerEnd, [FRONT_X - 650, labelY(0.92)], [FRONT_X + 300, labelY(1.02)], [FRONT_X - 500, labelY(0.66)], [FRONT_X + 300, labelY(0.86)])
    ctx.fillStyle = swooshFill(lowerStart[0], lowerStart[1], lowerEnd[0], lowerEnd[1])
    ctx.fill()
    ctx.strokeStyle = isColor ? 'rgba(255,255,255,0.8)' : paint('ink')
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(FRONT_X - 820, labelY(0.44))
    ctx.bezierCurveTo(FRONT_X - 560, labelY(0.86), FRONT_X + 260, labelY(0.97), FRONT_X + 820, labelY(1.12))
    ctx.stroke()
    // second, thinner sliver under B
    traceSwoosh(ctx, [FRONT_X - 760, labelY(0.25)], [FRONT_X + 760, labelY(0.7)], [FRONT_X - 420, labelY(0.55)], [FRONT_X + 300, labelY(0.6)], [FRONT_X - 380, labelY(0.46)], [FRONT_X + 320, labelY(0.52)])
    ctx.fillStyle = swooshFill(FRONT_X - 760, 0, FRONT_X + 760, 0)
    ctx.fill()

    // C/D — long diagonal blades running down both sides of the can
    for (const side of [1, -1]) {
      const bladeTop = [FRONT_X + side * 1180, labelY(2.12)]
      const bladeBottom = [FRONT_X + side * 560, labelY(0.2)]
      traceSwoosh(ctx, bladeTop, bladeBottom, [FRONT_X + side * 1110, labelY(1.3)], [FRONT_X + side * 760, labelY(0.7)], [FRONT_X + side * 1010, labelY(1.35)], [FRONT_X + side * 690, labelY(0.75)])
      ctx.fillStyle = swooshFill(bladeTop[0], bladeTop[1], bladeBottom[0], bladeBottom[1])
      ctx.fill()
    }
  })

  // Halftone accents following swooshes A and B
  const curveA = [], curveB = []
  for (let t = 0; t <= 1; t += 0.02) {
    curveA.push(cubicPoint([FRONT_X + 980, labelY(2.06)], [FRONT_X + 520, labelY(1.98)], [FRONT_X - 300, labelY(1.62)], [FRONT_X - 760, labelY(1.28)], t))
    curveB.push(cubicPoint([FRONT_X - 900, labelY(0.36)], [FRONT_X - 500, labelY(0.66)], [FRONT_X + 300, labelY(0.86)], [FRONT_X + 900, labelY(1.16)], t))
  }
  halftoneAlong(ctx, curveA, 120, 14, 5.6, paint('accent'), 1)
  halftoneAlong(ctx, curveB, 150, 14, 6, paint('accent'), -1)

  // 5. Front typography
  const inkFill = () => {
    if (!isColor) return paint('ink')
    const gradient = ctx.createLinearGradient(0, labelY(1.68), 0, labelY(1.36))
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.55, flavor.ink)
    gradient.addColorStop(1, '#c9d2de')
    return gradient
  }

  drawText(ctx, 'SPARKLING', FRONT_X, labelY(2.255), { size: 58, weight: 800, wide: true, tracking: 20, fill: paint('base') })
  drawText(ctx, 'ENERGY', FRONT_X, labelY(2.175), { size: 58, weight: 800, wide: true, tracking: 20, fill: paint('base') })

  // VOLTIX wordmark (with a soft drop shadow in the colour pass)
  if (isColor) {
    ctx.save()
    ctx.globalAlpha = 0.45
    drawText(ctx, 'VOLTIX', FRONT_X + 10, labelY(1.385) + 12, { size: 232, italic: true, wide: true, tracking: -6, fill: '#02050c' })
    ctx.restore()
  }
  const logoWidth = drawText(ctx, 'VOLTIX', FRONT_X, labelY(1.385), { size: 232, italic: true, wide: true, tracking: -6, fill: inkFill() })
  drawText(ctx, '®', FRONT_X + logoWidth / 2 + 26, labelY(1.56), { size: 40, weight: 600, family: BODY_FONT, fill: paint('ink') })

  // flavour name
  drawText(ctx, flavor.line1, FRONT_X + 16, labelY(1.1), { size: 92, italic: true, wide: true, fill: paint('accent') })
  drawText(ctx, flavor.line2, FRONT_X + 16, labelY(0.995), { size: 92, italic: true, wide: true, fill: paint('accent') })

  ctx.fillStyle = paint('accent')
  drawBolt(ctx, FRONT_X, labelY(0.58), 120)

  drawText(ctx, 'ENERGY   |   FOCUS   |   PERFORMANCE', FRONT_X, labelY(0.4), { size: 30, weight: 600, family: BODY_FONT, tracking: 6, fill: paint('ink') })
  drawText(ctx, '250 ml', FRONT_X, labelY(0.255), { size: 56, weight: 600, family: BODY_FONT, fill: paint('ink') })

  // 6. Back panel (centred on the seam: drawn at x = 0 and x = C)
  for (const offset of [0, LABEL_C]) {
    ctx.save()
    ctx.translate(offset, 0)
    drawBackPanel(ctx, paint, isColor, flavor)
    ctx.restore()
  }

  // 7. Subtle printed vertical gloss streaks (colour pass only)
  if (isColor) {
    const random = seededRandom(11)
    ctx.save()
    ctx.globalCompositeOperation = 'overlay'
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + random() * 0.04})`
      ctx.fillRect(random() * LABEL_C, printTop, 2 + random() * 10, printBottom - printTop)
    }
    ctx.restore()
  }
}

// Drawn centred on x = 0; the caller translates it onto both sides of the seam.
function drawBackPanel(ctx, paint, isColor, flavor) {
  const panelWidth = 760
  const left = -panelWidth / 2
  const logoWidth = drawText(ctx, 'VOLTIX', 0, labelY(2.02), { size: 140, italic: true, wide: true, tracking: -3, fill: paint('ink') })
  drawText(ctx, '®', logoWidth / 2 + 18, labelY(2.12), { size: 26, weight: 600, family: BODY_FONT, fill: paint('ink') })
  drawText(ctx, flavor.line1, 0, labelY(1.915), { size: 70, italic: true, wide: true, fill: paint('accent') })
  drawText(ctx, flavor.line2, 0, labelY(1.845), { size: 70, italic: true, wide: true, fill: paint('accent') })
  drawText(ctx, 'SPARKLING', 0, labelY(1.79), { size: 30, weight: 600, family: BODY_FONT, tracking: 12, fill: paint('ink') })
  drawText(ctx, 'ENERGY DRINK', 0, labelY(1.75), { size: 30, weight: 600, family: BODY_FONT, tracking: 12, fill: paint('ink') })

  // Icon row
  const icons = [
    ['INSTANT', 'ENERGY'],
    ['B VITAMINS', '(B3, B6, B12)'],
    ['IMPROVES', 'FOCUS'],
    ['ZERO ARTIFICIAL', 'COLORS'],
  ]
  const columnWidth = panelWidth / 4
  const iconY = labelY(1.66)
  icons.forEach((caption, i) => {
    const x = left + columnWidth * (i + 0.5)
    ctx.fillStyle = paint('accent')
    ctx.strokeStyle = paint('accent')
    ctx.lineWidth = 6
    if (i === 0) drawBolt(ctx, x, iconY, 64)
    if (i === 1) {
      // leaf
      ctx.beginPath()
      ctx.ellipse(x, iconY, 20, 30, Math.PI / 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x - 18, iconY + 18); ctx.lineTo(x + 14, iconY - 14); ctx.stroke()
    }
    if (i === 2) {
      // focus target
      ctx.beginPath(); ctx.arc(x, iconY, 26, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(x, iconY, 12, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(x, iconY, 3, 0, Math.PI * 2); ctx.fill()
    }
    if (i === 3) {
      // droplet
      ctx.beginPath()
      ctx.moveTo(x, iconY - 32)
      ctx.bezierCurveTo(x + 12, iconY - 14, x + 24, iconY, x + 24, iconY + 10)
      ctx.arc(x, iconY + 10, 24, 0, Math.PI)
      ctx.bezierCurveTo(x - 24, iconY, x - 12, iconY - 14, x, iconY - 32)
      ctx.stroke()
    }
    drawText(ctx, caption[0], x, iconY + 66, { size: 21, weight: 700, family: BODY_FONT, fill: paint('ink') })
    drawText(ctx, caption[1], x, iconY + 92, { size: 21, weight: 700, family: BODY_FONT, fill: paint('ink') })
    // divider between columns
    if (i > 0) {
      ctx.fillStyle = paint('ink')
      ctx.globalAlpha = isColor ? 0.35 : 1
      ctx.fillRect(left + columnWidth * i - 1, iconY - 40, 2, 140)
      ctx.globalAlpha = 1
    }
  })

  // Nutrition facts
  const factsTop = labelY(1.5)
  const nutritionRows = [
    ['Energy', '110 kcal'],
    ['Total Carbohydrate', '27 g'],
    ['Sugars', '24 g'],
    ['Protein', '0 g'],
    ['Total Fat', '0 g'],
    ['Sodium', '120 mg'],
    ['Vitamin B3 (Niacin)', '16 mg (100% RDA)'],
    ['Vitamin B6', '1.7 mg (100% RDA)'],
    ['Vitamin B12', '2.4 mcg (100% RDA)'],
  ]
  const rowHeight = 40
  const boxHeight = 120 + nutritionRows.length * rowHeight
  ctx.strokeStyle = paint('ink')
  ctx.lineWidth = 4
  traceRoundRect(ctx, left, factsTop, panelWidth, boxHeight, 18)
  ctx.stroke()
  drawText(ctx, 'NUTRITION FACTS', left + 28, factsTop + 52, { size: 38, weight: 800, align: 'left', fill: paint('ink') })
  ctx.fillStyle = paint('ink')
  ctx.fillRect(left + 22, factsTop + 70, panelWidth - 44, 2)
  drawText(ctx, 'Serving Size: 250 ml', left + 28, factsTop + 100, { size: 22, weight: 500, family: BODY_FONT, align: 'left', fill: paint('ink') })
  drawText(ctx, 'Per Serving', -left - 28, factsTop + 100, { size: 22, weight: 500, family: BODY_FONT, align: 'right', fill: paint('ink') })
  ctx.fillRect(left + 22, factsTop + 114, panelWidth - 44, 5)
  nutritionRows.forEach(([nutrient, amount], i) => {
    const y = factsTop + 114 + rowHeight * (i + 1) - 9
    drawText(ctx, nutrient, left + 28, y, { size: 26, weight: 500, family: BODY_FONT, align: 'left', fill: paint('ink') })
    drawText(ctx, amount, -left - 28, y, { size: 26, weight: 500, family: BODY_FONT, align: 'right', fill: paint('ink') })
    // hairline under every row except the last
    if (i < nutritionRows.length - 1) {
      ctx.fillStyle = paint('ink')
      ctx.globalAlpha = isColor ? 0.45 : 1
      ctx.fillRect(left + 22, y + 9, panelWidth - 44, 1.5)
      ctx.globalAlpha = 1
    }
  })

  // Ingredients paragraph
  const ingredientLines = [
    'INGREDIENTS: Carbonated Water, Sugar, Citric',
    'Acid (INS 330), Taurine, Caffeine (32 mg/250 ml),',
    'Vitamins (B3, B6, B12), Natural & Nature-Identical',
    'Flavor (Citrus), Preservative (INS 211).',
  ]
  let lineY = factsTop + boxHeight + 52
  ingredientLines.forEach((line, i) => {
    drawText(ctx, line, left + 6, lineY, { size: 25, weight: i === 0 ? 600 : 500, family: BODY_FONT, align: 'left', fill: paint('ink') })
    lineY += 35
  })

  // Caffeine warning
  const warningY = lineY + 8
  ctx.strokeStyle = paint('accent')
  ctx.lineWidth = 4
  traceRoundRect(ctx, left, warningY, panelWidth, 84, 14)
  ctx.stroke()
  ctx.fillStyle = paint('accent')
  ctx.beginPath()
  ctx.moveTo(left + 48, warningY + 18); ctx.lineTo(left + 76, warningY + 66); ctx.lineTo(left + 20, warningY + 66); ctx.closePath()
  ctx.fill()
  drawText(ctx, 'HIGH CAFFEINE CONTENT', left + 100, warningY + 38, { size: 25, weight: 800, family: BODY_FONT, align: 'left', fill: paint('accent') })
  drawText(ctx, '(32 mg per 250 ml)', left + 100, warningY + 68, { size: 25, weight: 600, family: BODY_FONT, align: 'left', fill: paint('accent') })

  drawText(ctx, 'Not recommended for children, pregnant', left + 6, warningY + 124, { size: 21, weight: 500, family: BODY_FONT, align: 'left', fill: paint('ink') })
  drawText(ctx, 'or lactating women, and people sensitive to caffeine.', left + 6, warningY + 152, { size: 21, weight: 500, family: BODY_FONT, align: 'left', fill: paint('ink') })

  // Net quantity + recycle + barcode
  const footerY = labelY(0.47)
  drawText(ctx, 'NET QUANTITY:', left + 6, footerY, { size: 24, weight: 800, family: BODY_FONT, align: 'left', fill: paint('ink') })
  drawText(ctx, '250 ml', left + 6, footerY + 58, { size: 50, weight: 800, family: BODY_FONT, align: 'left', fill: paint('ink') })

  // recycle mark: three arcs chasing each other round a circle
  ctx.strokeStyle = paint('ink')
  ctx.lineWidth = 5
  const recycleX = left + 300, recycleY = footerY + 20
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.arc(recycleX, recycleY, 30, angle + 0.35, angle + 1.75)
    ctx.stroke()
  }

  const barcodeX = 70, barcodeWidth = 310, barcodeHeight = 120
  ctx.fillStyle = isColor ? '#f4f6f8' : paint('ink')
  traceRoundRect(ctx, barcodeX, footerY - 40, barcodeWidth, barcodeHeight, 6)
  ctx.fill()
  ctx.fillStyle = isColor ? '#0a0f18' : paint('shade')
  // random bar widths / gaps (2, 4 or 6) from a fixed seed
  const random = seededRandom(3)
  let barX = barcodeX + 18
  while (barX < barcodeX + barcodeWidth - 22) {
    const barWidth = 2 + Math.floor(random() * 3) * 2
    ctx.fillRect(barX, footerY - 28, barWidth, barcodeHeight - 50)
    barX += barWidth + 2 + Math.floor(random() * 3) * 2
  }
  drawText(ctx, 'MFD. BY VOLTIX BEVERAGES CO.  ·  BEST SERVED ICE COLD', 0, labelY(0.3), { size: 19, weight: 600, family: BODY_FONT, tracking: 2, fill: paint('ink') })
  drawText(ctx, '8 904567 890123', barcodeX + barcodeWidth / 2, footerY + 72, { size: 22, weight: 500, family: BODY_FONT, tracking: 3, fill: isColor ? '#0a0f18' : paint('shade') })
}

// --- Condensation normal map -------------------------------------------------

// A single water drop as a tangent-space normal map: a hemisphere encoded in RGB,
// with alpha fading out towards the rim.
function dropletSprite(size = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const radius = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - radius) / radius
      const dy = (y + 0.5 - radius) / radius
      const distSq = dx * dx + dy * dy
      const i = (y * size + x) * 4
      if (distSq >= 1) { image.data[i + 3] = 0; continue }
      const normalZ = Math.sqrt(1 - distSq)
      image.data[i] = (dx * 0.5 + 0.5) * 255
      image.data[i + 1] = (-dy * 0.5 + 0.5) * 255
      image.data[i + 2] = (normalZ * 0.5 + 0.5) * 255
      image.data[i + 3] = Math.min(1, (1 - distSq) * 6) * 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function drawCondensation(ctx) {
  // flat normal everywhere, then stamp drops on top
  ctx.fillStyle = 'rgb(128,128,255)'
  ctx.fillRect(-10, -10, LABEL_C + 20, LABEL_S + 20)
  const sprite = dropletSprite()
  const random = seededRandom(42)
  // stamp at x and x ± C so drops crossing the seam wrap seamlessly
  const stamp = (x, y, w, h) => {
    for (const offset of [-LABEL_C, 0, LABEL_C]) ctx.drawImage(sprite, x + offset - w / 2, y - h / 2, w, h)
  }
  // fine mist
  for (let i = 0; i < 5200; i++) {
    const size = 4 + random() * 7
    stamp(random() * LABEL_C, random() * LABEL_S, size, size * (1 + random() * 0.15))
  }
  // droplets — slightly taller than wide, as if sagging under gravity
  for (let i = 0; i < 1100; i++) {
    const size = 10 + Math.pow(random(), 2.2) * 26
    stamp(random() * LABEL_C, random() * LABEL_S, size, size * (1.05 + random() * 0.3))
  }
  // a few heavy drops with trails
  for (let i = 0; i < 46; i++) {
    const x = random() * LABEL_C
    const y = random() * LABEL_S * 0.85
    const trailLength = 60 + random() * 260
    for (let k = 0; k < trailLength; k += 5) stamp(x + Math.sin(k * 0.03) * 2, y + k, 7, 9)
    const size = 26 + random() * 16
    stamp(x, y + trailLength, size, size * 1.3)
  }
}

// --- Public API -----------------------------------------------------------------

const cache = new Map()

/**
 * Builds (and caches) the three label textures for a flavour.
 * @param flavor   palette object from lib/flavors.js
 * @param quality  1 = desktop (≈3k px wide), 0.66 = mobile
 */
export function createLabelTextures(flavor, quality = 1) {
  const key = `${flavor.id}-${quality}`
  if (cache.has(key)) return cache.get(key)

  const pixelsPerUnit = quality
  const width = Math.round(LABEL_C * pixelsPerUnit)
  const height = Math.round(LABEL_S * pixelsPerUnit)

  // a canvas at texture resolution, scaled so drawing code can work in label units
  const renderCanvas = (draw) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.scale(width / LABEL_C, height / LABEL_S)
    draw(ctx)
    return canvas
  }

  const map = new THREE.CanvasTexture(renderCanvas((ctx) => drawArtwork(ctx, 'color', flavor)))
  map.colorSpace = THREE.SRGBColorSpace
  const orm = new THREE.CanvasTexture(renderCanvas((ctx) => drawArtwork(ctx, 'orm', flavor)))

  // condensation is flavour independent → share it
  let normal = cache.get(`normal-${quality}`)
  if (!normal) {
    normal = new THREE.CanvasTexture(renderCanvas(drawCondensation))
    cache.set(`normal-${quality}`, normal)
  }

  for (const texture of [map, orm, normal]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.anisotropy = 8
  }

  const result = { map, orm, normal }
  cache.set(key, result)
  return result
}
