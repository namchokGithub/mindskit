export interface McItem {
  name: string
  displayName: string
  stackSize: number
  /** Texture file name under `/data/minecraft/textures/`, or null. */
  texture: string | null
}

export type McRecipeType = 'crafting' | 'smelting' | 'blasting' | 'smoking' | 'campfire' | 'stonecutting' | 'smithing'

export interface McIngredient {
  /** Accepted items; entries starting with `#` are item tags (e.g. `#planks`). */
  options: string[]
  /** Units used per craft. */
  quantity: number
}

export interface McRecipe {
  id: string
  type: McRecipeType
  shaped: boolean
  result: string
  /** Items produced per craft. */
  count: number
  ingredients: McIngredient[]
}

export interface McDataset {
  version: string
  items: McItem[]
  tags: Record<string, string[]>
  recipes: McRecipe[]
}

export interface CraftRequest {
  name: string
  quantity: number
}

export interface CraftSettings {
  /** Item → chosen recipe id. */
  recipeChoices?: Record<string, string>
  /** Ingredient option-set key (`optionsKey`) → chosen item. */
  ingredientChoices?: Record<string, string>
  /** Items already owned; used before crafting anything. */
  inventory?: Record<string, number>
}

export interface CraftNode {
  name: string
  /** Quantity this branch asked for. */
  quantity: number
  /** Part of `quantity` taken from the inventory. */
  fromInventory: number
  /** Part of `quantity` covered by leftovers from earlier crafts. */
  fromSurplus: number
  /** Times the recipe runs for this branch (0 for base materials or fully covered demand). */
  crafts: number
  /** Items made per craft. */
  perCraft: number
  recipeId: string | null
  recipeType: McRecipeType | null
  /** No usable recipe: gathered, mined, or dropped. */
  isBase: boolean
  children: CraftNode[]
}

export interface CraftPlan {
  tree: CraftNode[]
  /** Base materials still to gather, largest first. */
  materials: { name: string; quantity: number }[]
  /** Total crafts per item, in the order they first appear, with the recipe type used. */
  steps: { name: string; crafts: number; produced: number; recipeType: McRecipeType }[]
  /** Extra items left over because recipes produce in batches. */
  leftovers: { name: string; quantity: number }[]
  /** Inventory items the plan used. */
  usedInventory: { name: string; quantity: number }[]
  /** Ingredient choices that had alternatives in this plan (for the "alternative ingredients" controls). */
  alternatives: { key: string; options: string[]; chosen: string }[]
}

export const RECIPE_TYPE_LABELS: Record<McRecipeType, string> = {
  crafting: 'Crafting table',
  smelting: 'Furnace',
  blasting: 'Blast furnace',
  smoking: 'Smoker',
  campfire: 'Campfire',
  stonecutting: 'Stonecutter',
  smithing: 'Smithing table',
}

/** Default order when an item has recipes of several types: crafting table first, specialised stations later. */
const TYPE_PRIORITY: McRecipeType[] = ['crafting', 'smelting', 'stonecutting', 'smithing', 'campfire', 'smoking', 'blasting']

/** Ingredients preferred by default when there are equivalent choices (wood type, stone type, fuel, ore form). */
const PREFERRED_INGREDIENTS = new Set(['oak_planks', 'oak_log', 'oak_slab', 'oak_wood', 'cobblestone', 'cobblestone_slab', 'coal', 'raw_iron', 'raw_gold', 'raw_copper', 'stone', 'sand'])

export const optionsKey = (options: readonly string[]) => options.join('|')

export interface McIndex {
  dataset: McDataset
  byResult: Map<string, McRecipe[]>
  expand: (options: readonly string[]) => string[]
}

/** Indexes recipes by result and expands nested item tags (with a guard against tag cycles). */
export function createIndex(dataset: McDataset): McIndex {
  const byResult = new Map<string, McRecipe[]>()
  for (const recipe of dataset.recipes) byResult.set(recipe.result, [...(byResult.get(recipe.result) ?? []), recipe])
  const tagCache = new Map<string, string[]>()
  const expandTag = (tag: string, seen: Set<string>): string[] => {
    const cached = tagCache.get(tag)
    if (cached) return cached
    if (seen.has(tag)) return []
    seen.add(tag)
    const items = [...new Set((dataset.tags[tag] ?? []).flatMap((value) => (value.startsWith('#') ? expandTag(value.slice(1), seen) : [value])))]
    tagCache.set(tag, items)
    return items
  }
  const expand = (options: readonly string[]) => [...new Set(options.flatMap((option) => (option.startsWith('#') ? expandTag(option.slice(1), new Set()) : [option])))]
  return { dataset, byResult, expand }
}

/** The item used for an ingredient: the user's choice if valid, else a preferred variant, else the first option. */
export function chosenOption(ingredient: McIngredient, index: McIndex, settings: CraftSettings = {}): string {
  const options = index.expand(ingredient.options)
  const choice = settings.ingredientChoices?.[optionsKey(ingredient.options)]
  if (choice && options.includes(choice)) return choice
  return options.find((option) => PREFERRED_INGREDIENTS.has(option)) ?? options[0] ?? ingredient.options[0]
}

/**
 * Recipes the calculator does not follow by default:
 * - "unpacking" storage recipes (1 iron block → 9 ingots, 1 hay bale → 9 wheat) when the packing recipe exists;
 * - packing nuggets into ingots, because ingots normally come from smelting.
 */
export function isSkippedRecipe(recipe: McRecipe, index: McIndex): boolean {
  if (recipe.type !== 'crafting' || recipe.ingredients.length !== 1) return false
  const [ingredient] = recipe.ingredients
  const sources = index.expand(ingredient.options)
  if (sources.length !== 1) return false
  const [source] = sources
  if (ingredient.quantity === 1 && recipe.count > 1) {
    const packs = (index.byResult.get(source) ?? []).some((candidate) => candidate.type === 'crafting' && candidate.ingredients.length === 1 && index.expand(candidate.ingredients[0].options).includes(recipe.result))
    if (packs) return true
  }
  return recipe.result.endsWith('_ingot') && source.endsWith('_nugget')
}

/** Recipes worth following for an item, default first (type priority, preferred ingredients, data order). */
export function usableRecipes(name: string, index: McIndex): McRecipe[] {
  const recipes = (index.byResult.get(name) ?? []).filter((recipe) => !isSkippedRecipe(recipe, index))
  const score = (recipe: McRecipe) => recipe.ingredients.filter((ingredient) => index.expand(ingredient.options).some((option) => PREFERRED_INGREDIENTS.has(option))).length
  return recipes
    .map((recipe, order) => ({ recipe, order }))
    .sort((a, b) => TYPE_PRIORITY.indexOf(a.recipe.type) - TYPE_PRIORITY.indexOf(b.recipe.type) || score(b.recipe) - score(a.recipe) || a.order - b.order)
    .map(({ recipe }) => recipe)
}

export function isCraftable(name: string, index: McIndex): boolean {
  return usableRecipes(name, index).length > 0
}

/** Adds up repeated requests for the same item and drops non-positive quantities. */
export function mergeRequests(requests: readonly CraftRequest[]): CraftRequest[] {
  const totals = new Map<string, number>()
  for (const request of requests) {
    if (!(request.quantity > 0)) continue
    totals.set(request.name, (totals.get(request.name) ?? 0) + Math.floor(request.quantity))
  }
  return [...totals].map(([name, quantity]) => ({ name, quantity }))
}

/**
 * Plans every craft for the requests: inventory first, then leftovers, then recipes (chosen or default) expanded
 * recursively with batch rounding, merged base materials, and a guard against recipe cycles.
 * Fuel for furnaces and campfires is not counted.
 */
export function planCrafting(requests: readonly CraftRequest[], index: McIndex, settings: CraftSettings = {}): CraftPlan {
  const inventory = new Map(Object.entries(settings.inventory ?? {}).filter(([, quantity]) => quantity > 0).map(([name, quantity]) => [name, Math.floor(quantity)]))
  const usedInventory = new Map<string, number>()
  const surplus = new Map<string, number>()
  const materials = new Map<string, number>()
  const steps = new Map<string, { crafts: number; produced: number; recipeType: McRecipeType }>()
  const alternatives = new Map<string, { key: string; options: string[]; chosen: string }>()

  const pickRecipe = (name: string, visiting: ReadonlySet<string>) => {
    const candidates = usableRecipes(name, index).filter((recipe) => !recipe.ingredients.some((ingredient) => {
      const option = chosenOption(ingredient, index, settings)
      return option === name || visiting.has(option)
    }))
    const chosenId = settings.recipeChoices?.[name]
    return candidates.find((recipe) => recipe.id === chosenId) ?? candidates[0]
  }

  const need = (name: string, quantity: number, visiting: ReadonlySet<string>): CraftNode => {
    const owned = inventory.get(name) ?? 0
    const fromInventory = Math.min(owned, quantity)
    if (fromInventory) {
      inventory.set(name, owned - fromInventory)
      usedInventory.set(name, (usedInventory.get(name) ?? 0) + fromInventory)
    }
    const available = surplus.get(name) ?? 0
    const fromSurplus = Math.min(available, quantity - fromInventory)
    if (fromSurplus) surplus.set(name, available - fromSurplus)
    const remaining = quantity - fromInventory - fromSurplus
    const recipe = pickRecipe(name, visiting)
    const base = { name, quantity, fromInventory, fromSurplus, recipeId: recipe?.id ?? null, recipeType: recipe?.type ?? null, isBase: !recipe }

    if (remaining === 0) return { ...base, crafts: 0, perCraft: recipe?.count ?? 1, children: [] }
    if (!recipe) {
      materials.set(name, (materials.get(name) ?? 0) + remaining)
      return { ...base, crafts: 0, perCraft: 1, children: [] }
    }

    const crafts = Math.ceil(remaining / recipe.count)
    const produced = crafts * recipe.count
    surplus.set(name, (surplus.get(name) ?? 0) + produced - remaining)
    const step = steps.get(name)
    steps.set(name, { crafts: (step?.crafts ?? 0) + crafts, produced: (step?.produced ?? 0) + produced, recipeType: recipe.type })

    const nextVisiting = new Set(visiting).add(name)
    const children = recipe.ingredients.map((ingredient) => {
      const option = chosenOption(ingredient, index, settings)
      const expanded = index.expand(ingredient.options)
      if (expanded.length > 1) alternatives.set(optionsKey(ingredient.options), { key: optionsKey(ingredient.options), options: expanded, chosen: option })
      return need(option, ingredient.quantity * crafts, nextVisiting)
    })
    return { ...base, crafts, perCraft: recipe.count, children }
  }

  const tree = mergeRequests(requests).map((request) => need(request.name, request.quantity, new Set()))
  const toList = (map: Map<string, number>) => [...map].filter(([, quantity]) => quantity > 0).map(([name, quantity]) => ({ name, quantity }))
  return {
    tree,
    materials: toList(materials).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
    steps: [...steps].map(([name, step]) => ({ name, ...step })),
    leftovers: toList(surplus),
    usedInventory: toList(usedInventory),
    alternatives: [...alternatives.values()],
  }
}

/** "3 stacks + 5" style breakdown for a quantity and stack size (64, 16, or 1). */
export function formatStacks(quantity: number, stackSize: number): string {
  if (stackSize <= 1 || quantity < stackSize) return ''
  const stacks = Math.floor(quantity / stackSize)
  const rest = quantity % stackSize
  return `${stacks} stack${stacks === 1 ? '' : 's'}${rest ? ` + ${rest}` : ''}`
}

/** Plain-text material list for copying. */
export function formatMaterialList(plan: CraftPlan, displayName: (name: string) => string): string {
  return plan.materials.map((material) => `${material.quantity} × ${displayName(material.name)}`).join('\n')
}
