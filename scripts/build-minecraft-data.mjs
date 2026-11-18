// Builds the Minecraft Crafting Calculator datasets. Run with `pnpm data:minecraft` (needs network access once);
// the output in public/data/minecraft/ is committed, so app builds need no network.
//
// Sources:
//   - items (names, display names, stack sizes): minecraft-data devDependency (MIT)
//   - recipes of every type and item tags: misode/mcmeta summaries, generated from the game's data packs
//   - textures: minecraft-assets devDependency (extracted from the game; see CONTEXT.md)
//
// Output:
//   public/data/minecraft/<version>.json   { version, items, tags, recipes }
//   public/data/minecraft/textures/<item>.png   shared by all versions
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const VERSIONS = ['1.21.11', '1.20.6']
/** Texture sets to read, newest first; older items fall back to older sets. */
const TEXTURE_VERSIONS = ['1.21.11', '1.20.2']

const require = createRequire(import.meta.url)
const dataRoot = path.join(path.dirname(require.resolve('minecraft-data/package.json')), 'minecraft-data', 'data')
const assetsRoot = path.join(path.dirname(require.resolve('minecraft-assets/package.json')), 'minecraft-assets', 'data')
const outputRoot = path.resolve('public', 'data', 'minecraft')
const textureDir = path.join(outputRoot, 'textures')

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

const stripNamespace = (id) => id.replace(/^minecraft:/, '')

// ---- textures (shared) ----
await rm(outputRoot, { recursive: true, force: true })
await mkdir(textureDir, { recursive: true })
const textureSources = []
for (const version of TEXTURE_VERSIONS) {
  const file = path.join(assetsRoot, version, 'items_textures.json')
  if (!existsSync(file)) continue
  for (const entry of await readJson(file)) textureSources.push({ version, ...entry })
}
const copiedTextures = new Set()
async function textureFor(name) {
  if (copiedTextures.has(name)) return `${name}.png`
  for (const entry of textureSources.filter((candidate) => candidate.name === name)) {
    if (!entry.texture || entry.texture.endsWith('missingno')) continue
    const [kind, file] = entry.texture.replace(/^minecraft:/, '').split('/')
    const source = path.join(assetsRoot, entry.version, kind === 'block' ? 'blocks' : 'items', `${file}.png`)
    if (!existsSync(source)) continue
    await copyFile(source, path.join(textureDir, `${name}.png`))
    copiedTextures.add(name)
    return `${name}.png`
  }
  return null
}

// ---- recipes ----
/** Ingredient JSON (string, {item}, {tag}, or an array of those) → list of "item" or "#tag" names. */
function ingredientOptions(value) {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.flatMap(ingredientOptions)
  if (typeof value === 'string') return [value.startsWith('#') ? `#${stripNamespace(value.slice(1))}` : stripNamespace(value)]
  if (value.item) return [stripNamespace(value.item)]
  if (value.tag) return [`#${stripNamespace(value.tag)}`]
  return []
}

const TYPE_MAP = {
  'minecraft:crafting_shaped': 'crafting',
  'minecraft:crafting_shapeless': 'crafting',
  'minecraft:crafting_transmute': 'crafting',
  'minecraft:smelting': 'smelting',
  'minecraft:blasting': 'blasting',
  'minecraft:smoking': 'smoking',
  'minecraft:campfire_cooking': 'campfire',
  'minecraft:stonecutting': 'stonecutting',
  'minecraft:smithing_transform': 'smithing',
}

/** One recipe → { id, type, result, count, ingredients: [{ options, quantity }] } or null when not plannable. */
function convertRecipe(id, recipe) {
  const type = TYPE_MAP[recipe.type]
  if (!type) return null
  const resultValue = recipe.result
  const result = typeof resultValue === 'string' ? stripNamespace(resultValue) : stripNamespace(resultValue?.id ?? resultValue?.item ?? '')
  if (!result) return null
  const count = typeof resultValue === 'object' && resultValue?.count ? resultValue.count : 1
  const slots = []
  if (recipe.type === 'minecraft:crafting_shaped') {
    const uses = {}
    for (const row of recipe.pattern) for (const symbol of row) if (symbol !== ' ') uses[symbol] = (uses[symbol] ?? 0) + 1
    for (const [symbol, quantity] of Object.entries(uses)) slots.push({ options: ingredientOptions(recipe.key[symbol]), quantity })
  } else if (recipe.type === 'minecraft:crafting_shapeless') {
    for (const ingredient of recipe.ingredients) slots.push({ options: ingredientOptions(ingredient), quantity: 1 })
  } else if (recipe.type === 'minecraft:crafting_transmute') {
    slots.push({ options: ingredientOptions(recipe.input), quantity: 1 }, { options: ingredientOptions(recipe.material), quantity: 1 })
  } else if (type === 'smithing') {
    slots.push({ options: ingredientOptions(recipe.template), quantity: 1 }, { options: ingredientOptions(recipe.base), quantity: 1 }, { options: ingredientOptions(recipe.addition), quantity: 1 })
  } else {
    slots.push({ options: ingredientOptions(recipe.ingredient), quantity: 1 })
  }
  // Merge identical option sets (shapeless recipes list each slot separately).
  const merged = new Map()
  for (const slot of slots) {
    if (slot.options.length === 0) continue
    const key = slot.options.join('|')
    merged.set(key, { options: slot.options, quantity: (merged.get(key)?.quantity ?? 0) + slot.quantity })
  }
  if (merged.size === 0) return null
  return { id, type, shaped: recipe.type === 'minecraft:crafting_shaped', result, count, ingredients: [...merged.values()] }
}

for (const version of VERSIONS) {
  const summary = `https://raw.githubusercontent.com/misode/mcmeta/${version}-summary/data`
  const [rawRecipes, rawTags] = await Promise.all([fetchJson(`${summary}/recipe/data.min.json`), fetchJson(`${summary}/tag/item/data.min.json`)])

  const dataPaths = (await readJson(path.join(dataRoot, 'dataPaths.json'))).pc[version]
  const itemList = await readJson(path.join(dataRoot, dataPaths.items, 'items.json'))
  const itemNames = new Set(itemList.map((item) => item.name))

  const tags = {}
  for (const [name, tag] of Object.entries(rawTags)) tags[name] = (tag.values ?? []).map((value) => (typeof value === 'string' ? value : value.id)).map((value) => (value.startsWith('#') ? `#${stripNamespace(value.slice(1))}` : stripNamespace(value)))

  const recipes = Object.entries(rawRecipes)
    .map(([id, recipe]) => convertRecipe(id, recipe))
    .filter((recipe) => recipe && itemNames.has(recipe.result))

  const items = []
  for (const item of itemList) {
    if (item.name === 'air') continue
    items.push({ name: item.name, displayName: item.displayName, stackSize: item.stackSize, texture: await textureFor(item.name) })
  }

  await writeFile(path.join(outputRoot, `${version}.json`), `${JSON.stringify({ version, items, tags, recipes })}\n`)
  console.log(`Minecraft ${version}: ${items.length} items, ${recipes.length} recipes, ${Object.keys(tags).length} tags`)
}
console.log(`Textures: ${copiedTextures.size}`)
