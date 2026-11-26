import * as THREE from 'three'

/**
 * Physical profile of a 250 ml "slim" can (53 × 134 mm) in can-units,
 * where the body radius is 0.5. Y grows from the standing ring upwards.
 *
 * The profile is shared by the 3D model and the label generator so that the
 * printed artwork lines up exactly with the geometry (UV `v` is computed from
 * arc-length, not from point index like THREE.LatheGeometry does by default).
 */

export const RADIUS = 0.5
export const CAN_HEIGHT = 2.58 // standing ring → top of rim bead
export const RIM_Y = 2.562
export const RIM_R = 0.447
export const RIM_TUBE = 0.018
export const LID_Y = 2.528

// Smoothly sample a list of [r, y] control points with a Catmull-Rom curve.
function sampleProfile(points, divisions) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  )
  return curve.getPoints(divisions).map((p) => new THREE.Vector2(p.x, p.y))
}

// Printed aluminium wall: from the lower taper up to the neck under the rim.
const bodyLower = sampleProfile(
  [
    [0.458, 0.055],
    [0.478, 0.085],
    [0.492, 0.12],
    [0.499, 0.155],
    [0.5, 0.19],
  ],
  14,
)
const bodyUpper = sampleProfile(
  [
    [0.5, 2.3],
    [0.497, 2.345],
    [0.486, 2.39],
    [0.47, 2.435],
    [0.456, 2.48],
    [0.449, 2.515],
    [0.4465, 2.548],
  ],
  24,
)
// Straight wall: few points are needed (geometry is a perfect cylinder there)
const straightWall = []
for (let i = 1; i < 12; i++) straightWall.push(new THREE.Vector2(0.5, 0.19 + ((2.3 - 0.19) * i) / 12))

export const BODY_POINTS = [...bodyLower, ...straightWall, ...bodyUpper]

// Cumulative arc length for every profile point
export const BODY_ARC = (() => {
  const arc = [0]
  for (let i = 1; i < BODY_POINTS.length; i++) arc.push(arc[i - 1] + BODY_POINTS[i].distanceTo(BODY_POINTS[i - 1]))
  return arc
})()
export const BODY_LENGTH = BODY_ARC[BODY_ARC.length - 1]

/** Arc length (from the bottom of the printed wall) at physical height y. */
export function arcAtY(y) {
  const points = BODY_POINTS
  if (y <= points[0].y) return 0
  // find the segment containing y and interpolate along it
  for (let i = 1; i < points.length; i++) {
    if (y <= points[i].y) {
      const t = (y - points[i - 1].y) / (points[i].y - points[i - 1].y)
      return BODY_ARC[i - 1] + t * (BODY_ARC[i] - BODY_ARC[i - 1])
    }
  }
  return BODY_LENGTH
}

/**
 * Lathe geometry with arc-length based UVs.
 * phiStart = -π puts u = 0.5 at the +Z axis, so the *front* of the label
 * (drawn in the centre of the texture) faces the camera at rotation 0.
 */
export function createBodyGeometry(segments = 128) {
  const geo = new THREE.LatheGeometry(BODY_POINTS, segments, -Math.PI, Math.PI * 2)
  const uv = geo.attributes.uv
  const pointCount = BODY_POINTS.length
  // lathe vertices are laid out one profile column per segment
  for (let segment = 0; segment <= segments; segment++) {
    for (let point = 0; point < pointCount; point++) {
      const vertex = segment * pointCount + point
      uv.setXY(vertex, segment / segments, BODY_ARC[point] / BODY_LENGTH)
    }
  }
  uv.needsUpdate = true
  return geo
}

/** Domed base with the standing ring (bare aluminium). */
export function createBaseGeometry(segments = 96) {
  const points = sampleProfile(
    [
      [0.0, 0.135],
      [0.16, 0.128],
      [0.28, 0.105],
      [0.355, 0.066],
      [0.388, 0.028],
      [0.398, 0.004],
      [0.41, 0.0],
      [0.425, 0.006],
      [0.44, 0.025],
      [0.458, 0.055],
    ],
    40,
  )
  // centre → outward gives normals that face down / out of the can
  return new THREE.LatheGeometry(points, segments)
}

/** Lid: inner rim wall, countersink groove and the recessed centre panel. */
export function createLidGeometry(segments = 96) {
  const points = sampleProfile(
    [
      [0.0, LID_Y],
      [0.25, LID_Y - 0.001],
      [0.375, LID_Y - 0.004],
      [0.398, LID_Y - 0.014],
      [0.41, LID_Y - 0.028],
      [0.421, LID_Y - 0.016],
      [0.428, LID_Y + 0.012],
      [0.432, RIM_Y],
    ],
    36,
  )
  // Seen from above → reverse so normals face up (and inward on the rim wall).
  return new THREE.LatheGeometry(points.reverse(), segments)
}

/** Stay-on pull tab: rounded outline with a finger hole and rivet hole. */
export function createTabGeometry() {
  const outline = new THREE.Shape()
  // Outline (in lid-plane coordinates, rivet at origin, tab pointing toward -Y)
  const halfWidth = 0.105
  outline.moveTo(-halfWidth * 0.62, 0.075)
  outline.quadraticCurveTo(0, 0.112, halfWidth * 0.62, 0.075)
  outline.quadraticCurveTo(halfWidth * 1.0, 0.04, halfWidth * 0.98, -0.04)
  outline.lineTo(halfWidth * 0.92, -0.17)
  outline.quadraticCurveTo(halfWidth * 0.85, -0.245, 0, -0.25)
  outline.quadraticCurveTo(-halfWidth * 0.85, -0.245, -halfWidth * 0.92, -0.17)
  outline.lineTo(-halfWidth * 0.98, -0.04)
  outline.quadraticCurveTo(-halfWidth * 1.0, 0.04, -halfWidth * 0.62, 0.075)

  // Finger hole
  const hole = new THREE.Path()
  hole.moveTo(-0.055, -0.08)
  hole.quadraticCurveTo(0, -0.064, 0.055, -0.08)
  hole.quadraticCurveTo(0.07, -0.13, 0.05, -0.19)
  hole.quadraticCurveTo(0, -0.214, -0.05, -0.19)
  hole.quadraticCurveTo(-0.07, -0.13, -0.055, -0.08)
  outline.holes.push(hole)

  // Slot around the rivet (the "U" cut)
  const slot = new THREE.Path()
  slot.moveTo(-0.04, 0.045)
  slot.quadraticCurveTo(0, 0.07, 0.04, 0.045)
  slot.lineTo(0.034, 0.036)
  slot.quadraticCurveTo(0, 0.056, -0.034, 0.036)
  slot.lineTo(-0.04, 0.045)
  outline.holes.push(slot)

  const geo = new THREE.ExtrudeGeometry(outline, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 24,
  })
  geo.computeVertexNormals()
  return geo
}

/** Score line of the opening (raised tear-drop outline on the lid). */
export function createScoreCurve() {
  const points = []
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    // tear-drop: wider towards the rim
    const x = Math.sin(angle) * 0.11 * (0.78 + 0.22 * Math.cos(angle))
    const y = 0.185 + Math.cos(angle) * 0.1
    points.push(new THREE.Vector3(x, y, 0))
  }
  return new THREE.CatmullRomCurve3(points, true)
}
