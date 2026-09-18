/**
 * Colour-vision-deficiency simulation, so the palette can be checked rather
 * than eyeballed.
 *
 * Colours are projected onto the dichromat plane in LMS space (the standard
 * Brettel/Viénot construction) and compared by CIE76 dE in Lab. Used by the
 * theme tests: any colour that carries meaning has to stay distinguishable from
 * every other one for protanopes, deuteranopes and tritanopes, not just for
 * trichromats. Judging a palette by eye is how the trail colour ended up
 * indistinguishable from the minor-triad blue in the first place.
 */

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const clamp = (v) => Math.min(1, Math.max(0, v))
const rgb2hex = (rgb) =>
  '#' + rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('')

const mul = (m, v) => m.map((row) => row.reduce((s, x, i) => s + x * v[i], 0))

// Hunt-Pointer-Estevez (normalised to D65) linear RGB <-> LMS
const RGB2LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
]
const LMS2RGB = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
]

// Standard dichromat projections in LMS.
const PROJECTION = {
  protanopia: [
    [0, 1.05118294, -0.05116099],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deuteranopia: [
    [1, 0, 0],
    [0.9513092, 0, 0.04866992],
    [0, 0, 1],
  ],
  tritanopia: [
    [1, 0, 0],
    [0, 1, 0],
    [-0.86744736, 1.86727089, 0],
  ],
}

export function simulate(hex, type) {
  if (type === 'normal') return hex
  const lin = hex2rgb(hex).map(srgbToLinear)
  const lms = mul(RGB2LMS, lin)
  const out = mul(LMS2RGB, mul(PROJECTION[type], lms))
  return rgb2hex(out.map(linearToSrgb))
}

function toLab(hex) {
  const [r, g, b] = hex2rgb(hex).map(srgbToLinear)
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  ;[x, y, z] = [f(x), f(y), f(z)]
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

export function deltaE(a, b) {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

export const TYPES = ['normal', 'protanopia', 'deuteranopia', 'tritanopia']

/** Worst-case dE between two colours across all vision types. */
export function worstCase(a, b) {
  return Math.min(...TYPES.map((t) => deltaE(simulate(a, t), simulate(b, t))))
}
