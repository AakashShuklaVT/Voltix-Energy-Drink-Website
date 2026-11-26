// Converts the reference product shots in /design/reference into
// lightweight WebP files used by the site (angle selector thumbnails + OG image).
// Run with: npm run images
import sharp from 'sharp'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

const SRC = path.resolve('design/reference')
const OUT = path.resolve('public/images/angles')

const names = {
  '01_electric_citrus_front.png': 'front',
  '02_electric_citrus_back.png': 'back',
  '03_electric_citrus_side.png': 'side',
  '04_electric_citrus_three_quarter.png': 'three-quarter',
  '05_electric_citrus_top_angle.png': 'top',
}

await mkdir(OUT, { recursive: true })

for (const file of await readdir(SRC)) {
  const slug = names[file]
  if (!slug) continue
  const input = path.join(SRC, file)
  // Thumbnail for the angle selector (keeps alpha)
  await sharp(input).resize({ height: 360 }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(OUT, `${slug}.webp`))
  // Larger version for the hover preview
  await sharp(input).resize({ height: 900 }).webp({ quality: 80, alphaQuality: 90 }).toFile(path.join(OUT, `${slug}@2x.webp`))
  console.log('✓', slug)
}

// Social card
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#070c18' } })
  .composite([{ input: await sharp(path.join(SRC, '04_electric_citrus_three_quarter.png')).resize({ height: 560 }).toBuffer(), gravity: 'center' }])
  .jpeg({ quality: 82 })
  .toFile(path.resolve('public/images/og.jpg'))
console.log('✓ og.jpg')
