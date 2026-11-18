export interface McItem {
  name: string
  displayName: string
  stackSize: number
  /** Texture file name under `/data/minecraft/<version>/textures/`, or null. */
  texture: string | null
}

export interface McRecipe {
  type: 'shaped' | 'shapeless'
  /** Items produced per craft. */
  count: number
  /** Ingredient name → quantity used per craft. */
  ingredients: Record<string, number>
  shape?: (string | null)[][]
}

export interface McDataset {
  version: string
  items: McItem[]
  recipes: Record<string, McRecipe[]>
}

export interface CraftRequest {
  name: string
  quantity: number
}

export interface CraftNode {
  name: string
  /** Quantity this branch asked for. */
  quantity: number
  /** Part of `quantity` covered by leftovers from earlier crafts. */
  fromSurplus: number
  /** Times the recipe runs for this branch (0 for base materials or fully covered demand). */
  crafts: number
  /** Items made per craft. */
  perCraft: number
  /** No usable recipe: gathered, mined, smelted, or otherwise obtained outside crafting. */
  isBase: boolean
  children: CraftNode[]
}

export interface CraftPlan {
  tree: CraftNode[]
  /** Base materials to gather, largest first. */
  materials: { name: string; quantity: number }[]
  /** Total crafts per intermediate or final item, in the order they first appear. */
  steps: { name: string; crafts: number; produced: number }[]
  /** Extra items left over because recipes produce in batches. */
  leftovers: { name: string; quantity: number }[]
}

/** Ingredients preferred when an item has several equivalent recipes (e.g. the wood type for sticks). */
const PREFERRED_INGREDIENTS = new Set(['oak_planks', 'oak_log', 'oak_slab', 'oak_wood', 'cobblestone', 'cobblestone_slab', 'coal'])

function onlyIngredient(recipe: McRecipe): string | null {
  const names = Object.keys(recipe.ingredients)
  return names.length === 1 ? names[0] : null
}

/**
 * Recipes the calculator should not follow:
 * - "unpacking" storage recipes (1 iron block → 9 ingots, 1 hay bale → 9 wheat) when the reverse recipe exists;
 * - packing nuggets into ingots, because ingots normally come from smelting ore.
 * Following them would turn ingots into 81 nuggets or loop between a block and its contents.
 */
export function isSkippedRecipe(result: string, recipe: McRecipe, dataset: McDataset): boolean {
  const ingredient = onlyIngredient(recipe)
  if (!ingredient) return false
  const amount = recipe.ingredients[ingredient]
  if (amount === 1 && recipe.count > 1) {
    const reverse = dataset.recipes[ingredient]?.some((candidate) => onlyIngredient(candidate) === result)
    if (reverse) return true
  }
  return result.endsWith('_ingot') && ingredient.endsWith('_nugget')
}

/** Recipes worth following for an item, best default first (preferred ingredients, then data order). */
export function usableRecipes(name: string, dataset: McDataset): McRecipe[] {
  const recipes = (dataset.recipes[name] ?? []).filter((recipe) => !isSkippedRecipe(name, recipe, dataset))
  const score = (recipe: McRecipe) => Object.keys(recipe.ingredients).filter((ingredient) => PREFERRED_INGREDIENTS.has(ingredient)).length
  return recipes.map((recipe, index) => ({ recipe, index })).sort((a, b) => score(b.recipe) - score(a.recipe) || a.index - b.index).map(({ recipe }) => recipe)
}

export function isCraftable(name: string, dataset: McDataset): boolean {
  return usableRecipes(name, dataset).length > 0
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
 * Plans every craft needed for the requests: recursive recipe expansion with batch rounding, shared leftovers between
 * branches and requests, merged base materials, and a guard against recipe cycles.
 */
export function planCrafting(requests: readonly CraftRequest[], dataset: McDataset): CraftPlan {
  const surplus = new Map<string, number>()
  const materials = new Map<string, number>()
  const steps = new Map<string, { crafts: number; produced: number }>()

  const need = (name: string, quantity: number, visiting: ReadonlySet<string>): CraftNode => {
    const available = surplus.get(name) ?? 0
    const fromSurplus = Math.min(available, quantity)
    if (fromSurplus) surplus.set(name, available - fromSurplus)
    const remaining = quantity - fromSurplus
    const recipe = usableRecipes(name, dataset).find((candidate) => !Object.keys(candidate.ingredients).some((ingredient) => visiting.has(ingredient) || ingredient === name))

    if (remaining === 0) return { name, quantity, fromSurplus, crafts: 0, perCraft: recipe?.count ?? 1, isBase: !recipe, children: [] }
    if (!recipe) {
      materials.set(name, (materials.get(name) ?? 0) + remaining)
      return { name, quantity, fromSurplus, crafts: 0, perCraft: 1, isBase: true, children: [] }
    }

    const crafts = Math.ceil(remaining / recipe.count)
    const produced = crafts * recipe.count
    surplus.set(name, (surplus.get(name) ?? 0) + produced - remaining)
    const step = steps.get(name) ?? { crafts: 0, produced: 0 }
    steps.set(name, { crafts: step.crafts + crafts, produced: step.produced + produced })

    const nextVisiting = new Set(visiting).add(name)
    const children = Object.entries(recipe.ingredients).map(([ingredient, perCraft]) => need(ingredient, perCraft * crafts, nextVisiting))
    return { name, quantity, fromSurplus, crafts, perCraft: recipe.count, isBase: false, children }
  }

  const tree = mergeRequests(requests).map((request) => need(request.name, request.quantity, new Set()))
  return {
    tree,
    materials: [...materials].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
    steps: [...steps].map(([name, step]) => ({ name, ...step })),
    leftovers: [...surplus].filter(([, quantity]) => quantity > 0).map(([name, quantity]) => ({ name, quantity })),
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
