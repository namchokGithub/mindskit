// Builds the compact Minecraft Crafting Calculator dataset from the minecraft-data and minecraft-assets
// devDependencies. Run with `pnpm data:minecraft`; the output in public/data/minecraft/ is committed, so builds need
// no network access.
//
// Output:
//   public/data/minecraft/<version>.json   items (name, display name, stack size, texture file) and crafting recipes
//   public/data/minecraft/<version>/textures/<item>.png   item textures (Minecraft assets; see CONTEXT.md)
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'

const VERSION = '1.21.11'
const require = createRequire(import.meta.url)
const dataRoot = path.join(path.dirname(require.resolve('minecraft-data/package.json')), 'minecraft-data', 'data')
const assetsRoot = path.join(path.dirname(require.resolve('minecraft-assets/package.json')), 'minecraft-assets', 'data', VERSION)
const outputRoot = path.resolve('public', 'data', 'minecraft')

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))

const dataPaths = (await readJson(path.join(dataRoot, 'dataPaths.json'))).pc[VERSION]
const items = await readJson(path.join(dataRoot, dataPaths.items, 'items.json'))
const recipes = await readJson(path.join(dataRoot, dataPaths.recipes, 'recipes.json'))
const textures = await readJson(path.join(assetsRoot, 'items_textures.json'))

const nameById = new Map(items.map((item) => [item.id, item.name]))
const textureByName = new Map(textures.map((entry) => [entry.name, entry.texture]))

const textureDir = path.join(outputRoot, VERSION, 'textures')
await rm(path.join(outputRoot, VERSION), { recursive: true, force: true })
await mkdir(textureDir, { recursive: true })

/** Copies the texture for an item and returns its file name, or null when there is none. */
async function copyTexture(name) {
  const texture = textureByName.get(name)
  if (!texture || texture.endsWith('missingno')) return null
  const [kind, file] = texture.replace(/^minecraft:/, '').split('/')
  const source = path.join(assetsRoot, kind === 'block' ? 'blocks' : 'items', `${file}.png`)
  if (!existsSync(source)) return null
  await copyFile(source, path.join(textureDir, `${name}.png`))
  return `${name}.png`
}

function countIngredients(list) {
  const counts = {}
  for (const id of list) {
    if (id === null || id === undefined) continue
    const ingredientId = typeof id === 'object' ? id.id : id
    const name = nameById.get(ingredientId)
    if (!name) return null
    counts[name] = (counts[name] ?? 0) + (typeof id === 'object' && id.count ? id.count : 1)
  }
  return counts
}

const outputRecipes = {}
for (const [resultId, list] of Object.entries(recipes)) {
  const resultName = nameById.get(Number(resultId))
  if (!resultName) continue
  const converted = []
  for (const recipe of list) {
    const shaped = Array.isArray(recipe.inShape)
    const ingredients = countIngredients(shaped ? recipe.inShape.flat() : recipe.ingredients ?? [])
    if (!ingredients || Object.keys(ingredients).length === 0) continue
    converted.push({
      type: shaped ? 'shaped' : 'shapeless',
      count: recipe.result?.count ?? 1,
      ingredients,
      ...(shaped ? { shape: recipe.inShape.map((row) => row.map((id) => (id === null ? null : nameById.get(typeof id === 'object' ? id.id : id) ?? null))) } : {}),
    })
  }
  if (converted.length) outputRecipes[resultName] = converted
}

const outputItems = []
for (const item of items) {
  if (item.name === 'air') continue
  outputItems.push({ name: item.name, displayName: item.displayName, stackSize: item.stackSize, texture: await copyTexture(item.name) })
}

await writeFile(path.join(outputRoot, `${VERSION}.json`), `${JSON.stringify({ version: VERSION, items: outputItems, recipes: outputRecipes })}\n`)
console.log(`Minecraft ${VERSION}: ${outputItems.length} items, ${Object.keys(outputRecipes).length} craftable items, ${outputItems.filter((item) => item.texture).length} textures`)
