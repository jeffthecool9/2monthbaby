// Downloads the CC0 assets the apartment uses from Poly Haven into public/assets and writes CREDITS.md.
// Usage: node scripts/fetch-assets.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const OUT = 'public/assets'
const API = 'https://api.polyhaven.com'

// Textures: [poly haven id, local name]
const TEXTURES = [
  ['herringbone_parquet', 'floor_wood'],
  ['marble_tiles', 'floor_tile'],
  ['wood_floor_deck', 'floor_deck'],
  ['painted_plaster_wall', 'wall_plaster'],
  ['marble_01', 'counter_marble'],
  ['wool_boucle', 'fabric_sofa'],
]
const HDRI = 'sunset_jhbcentral'
// Models: [poly haven id, local name]
const MODELS = [
  ['modern_coffee_table_01', 'coffeeTable'],
  ['television_02', 'tv'],
  ['potted_plant_02', 'plant'],
  ['dining_chair_02', 'diningChair'],
  ['round_wooden_table_01', 'diningTable'],
  ['modern_wooden_cabinet', 'wardrobe'],
  ['outdoor_table_chair_set_01', 'balconySet'],
  ['electric_stove', 'stove'],
  ['modern_ceiling_lamp_01', 'ceilingLamp'],
  ['standing_picture_frame_01', 'pictureFrame'],
]

const credits = ['# Asset credits', '', 'All assets below are CC0 (public domain) from [Poly Haven](https://polyhaven.com).', '']

async function json(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

async function download(url, path) {
  if (existsSync(path)) return
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, Buffer.from(await r.arrayBuffer()))
}

async function info(id) {
  const i = await json(`${API}/info/${id}`)
  credits.push(`- **${i.name}** (\`${id}\`) by ${Object.keys(i.authors ?? {}).join(', ')}: https://polyhaven.com/a/${id}`)
}

for (const [id, name] of TEXTURES) {
  const f = await json(`${API}/files/${id}`)
  const maps = { diff: f.Diffuse ?? f.diff, nor: f.nor_gl, arm: f.arm }
  for (const [kind, entry] of Object.entries(maps)) {
    const url = entry?.['1k']?.jpg?.url
    if (url) await download(url, join(OUT, 'tex', `${name}_${kind}.jpg`))
  }
  await info(id)
  console.log('texture', id)
}

{
  const f = await json(`${API}/files/${HDRI}`)
  await download(f.hdri['1k'].hdr.url, join(OUT, 'env', 'sky.hdr'))
  await info(HDRI)
  console.log('hdri', HDRI)
}

for (const [id, name] of MODELS) {
  const f = await json(`${API}/files/${id}`)
  const g = f.gltf['1k'].gltf
  const dir = join(OUT, 'models', name)
  await download(g.url, join(dir, `${name}.gltf`))
  for (const [rel, entry] of Object.entries(g.include)) await download(entry.url, join(dir, rel))
  await info(id)
  console.log('model', id)
}

// Re-encode textures at JPEG quality 70 to keep the total under 25 MB (macOS `sips`).
if (process.platform === 'darwin') {
  const tex = join(OUT, 'tex')
  const files = readdirSync(tex).filter((f) => f.endsWith('.jpg')).map((f) => join(tex, f))
  execFileSync('sips', ['-s', 'formatOptions', '70', ...files, '--out', tex], { stdio: 'ignore' })
}

await writeFile(join(OUT, 'CREDITS.md'), credits.join('\n') + '\n')
console.log('done')
