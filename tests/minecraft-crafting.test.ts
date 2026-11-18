import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { chosenOption, createIndex, formatMaterialList, formatStacks, isCraftable, mergeRequests, planCrafting, usableRecipes, type McDataset, type McRecipe } from '../src/features/minecraft/crafting.ts'
import { buildCraftGraph, connectedItems } from '../src/features/minecraft/graph.ts'

const item = (name: string, stackSize = 64) => ({ name, displayName: name, stackSize, texture: null })
const recipe = (id: string, type: McRecipe['type'], result: string, count: number, ingredients: [string[], number][]): McRecipe => ({ id, type, shaped: false, result, count, ingredients: ingredients.map(([options, quantity]) => ({ options, quantity })) })

const fixture: McDataset = {
  version: 'test',
  items: ['oak_log', 'birch_log', 'oak_planks', 'birch_planks', 'stick', 'coal', 'charcoal', 'torch', 'crafting_table', 'raw_iron', 'iron_ingot', 'iron_nugget', 'iron_block', 'cobblestone', 'stone', 'stone_slab', 'a', 'b'].map((name) => item(name)),
  tags: { planks: ['oak_planks', 'birch_planks'], logs: ['#oak_logs', 'birch_log'], oak_logs: ['oak_log'] },
  recipes: [
    recipe('oak_planks', 'crafting', 'oak_planks', 4, [[['#oak_logs'], 1]]),
    recipe('birch_planks', 'crafting', 'birch_planks', 4, [[['birch_log'], 1]]),
    recipe('stick', 'crafting', 'stick', 4, [[['#planks'], 2]]),
    recipe('torch', 'crafting', 'torch', 4, [[['charcoal', 'coal'], 1], [['stick'], 1]]),
    recipe('crafting_table', 'crafting', 'crafting_table', 1, [[['#planks'], 4]]),
    recipe('iron_ingot_from_nuggets', 'crafting', 'iron_ingot', 1, [[['iron_nugget'], 9]]),
    recipe('iron_ingot_from_block', 'crafting', 'iron_ingot', 9, [[['iron_block'], 1]]),
    recipe('iron_ingot_from_blasting', 'blasting', 'iron_ingot', 1, [[['raw_iron'], 1]]),
    recipe('iron_ingot_from_smelting', 'smelting', 'iron_ingot', 1, [[['raw_iron'], 1]]),
    recipe('iron_nugget', 'crafting', 'iron_nugget', 9, [[['iron_ingot'], 1]]),
    recipe('iron_block', 'crafting', 'iron_block', 1, [[['iron_ingot'], 9]]),
    recipe('stone', 'smelting', 'stone', 1, [[['cobblestone'], 1]]),
    recipe('stone_slab', 'crafting', 'stone_slab', 6, [[['stone'], 3]]),
    recipe('stone_slab_from_stonecutting', 'stonecutting', 'stone_slab', 2, [[['stone'], 1]]),
    recipe('a', 'crafting', 'a', 1, [[['b'], 1]]),
    recipe('b', 'crafting', 'b', 1, [[['a'], 1]]),
  ],
}
const index = createIndex(fixture)

test('expands nested tags and picks preferred options', () => {
  assert.deepEqual(index.expand(['#logs']), ['oak_log', 'birch_log'])
  assert.equal(chosenOption({ options: ['#planks'], quantity: 1 }, index), 'oak_planks')
  assert.equal(chosenOption({ options: ['charcoal', 'coal'], quantity: 1 }, index), 'coal')
  assert.equal(chosenOption({ options: ['#planks'], quantity: 1 }, index, { ingredientChoices: { '#planks': 'birch_planks' } }), 'birch_planks')
})

test('expands recipes recursively and rounds crafts up to whole batches', () => {
  const plan = planCrafting([{ name: 'torch', quantity: 5 }], index)
  assert.deepEqual(plan.materials, [{ name: 'coal', quantity: 2 }, { name: 'oak_log', quantity: 1 }])
  assert.deepEqual(plan.steps.map((step) => [step.name, step.crafts, step.produced]), [['torch', 2, 8], ['stick', 1, 4], ['oak_planks', 1, 4]])
  assert.deepEqual(plan.leftovers, [{ name: 'torch', quantity: 3 }, { name: 'stick', quantity: 2 }, { name: 'oak_planks', quantity: 2 }])
  assert.deepEqual(plan.alternatives.map((alternative) => [alternative.key, alternative.chosen]), [['charcoal|coal', 'coal'], ['#planks', 'oak_planks']])
})

test('uses alternative ingredient and recipe choices', () => {
  const plan = planCrafting([{ name: 'stick', quantity: 4 }], index, { ingredientChoices: { '#planks': 'birch_planks' } })
  assert.deepEqual(plan.materials, [{ name: 'birch_log', quantity: 1 }])
  assert.equal(usableRecipes('stone_slab', index)[0].id, 'stone_slab')
  const cut = planCrafting([{ name: 'stone_slab', quantity: 6 }], index, { recipeChoices: { stone_slab: 'stone_slab_from_stonecutting' } })
  assert.deepEqual(cut.steps.map((step) => [step.name, step.crafts, step.recipeType]), [['stone_slab', 3, 'stonecutting'], ['stone', 3, 'smelting']])
  assert.deepEqual(cut.materials, [{ name: 'cobblestone', quantity: 3 }])
})

test('smelts ingots from raw ore and crafts blocks from ingots', () => {
  assert.equal(usableRecipes('iron_ingot', index)[0].id, 'iron_ingot_from_smelting')
  assert.equal(isCraftable('iron_nugget', index), false)
  const plan = planCrafting([{ name: 'iron_block', quantity: 2 }], index)
  assert.deepEqual(plan.materials, [{ name: 'raw_iron', quantity: 18 }])
})

test('subtracts inventory before crafting', () => {
  const plan = planCrafting([{ name: 'torch', quantity: 8 }], index, { inventory: { stick: 1, coal: 5 } })
  assert.deepEqual(plan.usedInventory, [{ name: 'coal', quantity: 2 }, { name: 'stick', quantity: 1 }])
  assert.deepEqual(plan.materials, [{ name: 'oak_log', quantity: 1 }])
  const owned = planCrafting([{ name: 'torch', quantity: 4 }], index, { inventory: { torch: 10 } })
  assert.deepEqual(owned.materials, [])
  assert.equal(owned.tree[0].fromInventory, 4)
})

test('shares leftovers, merges requests, and stops at cycles', () => {
  assert.deepEqual(mergeRequests([{ name: 'stick', quantity: 1 }, { name: 'stick', quantity: 2 }, { name: 'torch', quantity: 0 }]), [{ name: 'stick', quantity: 3 }])
  assert.deepEqual(planCrafting([{ name: 'crafting_table', quantity: 1 }, { name: 'stick', quantity: 4 }], index).materials, [{ name: 'oak_log', quantity: 2 }])
  assert.deepEqual(planCrafting([{ name: 'a', quantity: 3 }], index).materials, [{ name: 'b', quantity: 3 }])
})

test('builds an item graph with summed edges, depth, collapse, and highlighting', () => {
  const plan = planCrafting([{ name: 'torch', quantity: 4 }, { name: 'crafting_table', quantity: 1 }], index)
  const graph = buildCraftGraph(plan)
  const planks = graph.nodes.find((node) => node.id === 'oak_planks')
  assert.equal(planks?.depth, 2)
  assert.ok(graph.edges.some((edge) => edge.source === 'oak_planks' && edge.target === 'crafting_table' && edge.quantity === 4))
  assert.deepEqual([...connectedItems(graph, 'stick')].sort(), ['oak_log', 'oak_planks', 'stick', 'torch'])
  const collapsed = buildCraftGraph(plan, new Set(['torch']))
  assert.equal(collapsed.nodes.find((node) => node.id === 'torch')?.collapsed, true)
  assert.ok(!collapsed.nodes.some((node) => node.id === 'stick'))
})

test('formats stacks and the copyable material list', () => {
  assert.equal(formatStacks(130, 64), '2 stacks + 2')
  assert.equal(formatStacks(10, 64), '')
  assert.equal(formatMaterialList(planCrafting([{ name: 'torch', quantity: 4 }], index), (name) => name.toUpperCase()), '1 × COAL\n1 × OAK_LOG')
})

test('plans real recipes from both generated datasets', () => {
  for (const version of ['1.21.11', '1.20.6']) {
    const real = createIndex(JSON.parse(readFileSync(new URL(`../public/data/minecraft/${version}.json`, import.meta.url), 'utf8')) as McDataset)
    assert.deepEqual(planCrafting([{ name: 'crafting_table', quantity: 1 }], real).materials, [{ name: 'oak_log', quantity: 1 }], version)
    assert.deepEqual(planCrafting([{ name: 'iron_block', quantity: 1 }], real).materials, [{ name: 'raw_iron', quantity: 9 }], version)
    assert.deepEqual(planCrafting([{ name: 'furnace', quantity: 1 }], real).materials, [{ name: 'cobblestone', quantity: 8 }], version)
    assert.equal(isCraftable('wheat', real), false, version)
  }
})
