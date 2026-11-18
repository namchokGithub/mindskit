import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { formatMaterialList, formatStacks, isCraftable, mergeRequests, planCrafting, usableRecipes, type McDataset } from '../src/features/minecraft/crafting.ts'

const item = (name: string, stackSize = 64) => ({ name, displayName: name, stackSize, texture: null })

const fixture: McDataset = {
  version: 'test',
  items: ['oak_log', 'oak_planks', 'birch_planks', 'stick', 'coal', 'torch', 'crafting_table', 'iron_ingot', 'iron_nugget', 'iron_block', 'a', 'b'].map((name) => item(name)),
  recipes: {
    oak_planks: [{ type: 'shapeless', count: 4, ingredients: { oak_log: 1 } }],
    stick: [{ type: 'shaped', count: 4, ingredients: { birch_planks: 2 } }, { type: 'shaped', count: 4, ingredients: { oak_planks: 2 } }],
    torch: [{ type: 'shaped', count: 4, ingredients: { coal: 1, stick: 1 } }],
    crafting_table: [{ type: 'shaped', count: 1, ingredients: { oak_planks: 4 } }],
    iron_ingot: [{ type: 'shaped', count: 1, ingredients: { iron_nugget: 9 } }, { type: 'shapeless', count: 9, ingredients: { iron_block: 1 } }],
    iron_nugget: [{ type: 'shapeless', count: 9, ingredients: { iron_ingot: 1 } }],
    iron_block: [{ type: 'shaped', count: 1, ingredients: { iron_ingot: 9 } }],
    a: [{ type: 'shapeless', count: 1, ingredients: { b: 1 } }],
    b: [{ type: 'shapeless', count: 1, ingredients: { a: 1 } }],
  },
}

test('expands recipes recursively and rounds crafts up to whole batches', () => {
  const plan = planCrafting([{ name: 'torch', quantity: 5 }], fixture)
  assert.deepEqual(plan.materials, [{ name: 'coal', quantity: 2 }, { name: 'oak_log', quantity: 1 }])
  assert.deepEqual(plan.steps, [
    { name: 'torch', crafts: 2, produced: 8 },
    { name: 'stick', crafts: 1, produced: 4 },
    { name: 'oak_planks', crafts: 1, produced: 4 },
  ])
  assert.deepEqual(plan.leftovers, [{ name: 'torch', quantity: 3 }, { name: 'stick', quantity: 2 }, { name: 'oak_planks', quantity: 2 }])
})

test('prefers oak over other wood when an item has equivalent recipes', () => {
  assert.deepEqual(usableRecipes('stick', fixture)[0].ingredients, { oak_planks: 2 })
})

test('shares leftovers across requests and merges duplicate requests', () => {
  assert.deepEqual(mergeRequests([{ name: 'stick', quantity: 1 }, { name: 'stick', quantity: 2 }, { name: 'torch', quantity: 0 }]), [{ name: 'stick', quantity: 3 }])
  const plan = planCrafting([{ name: 'crafting_table', quantity: 1 }, { name: 'stick', quantity: 4 }], fixture)
  // 4 planks for the table + 2 for sticks = 6 planks → 2 logs, with 2 planks left over.
  assert.deepEqual(plan.materials, [{ name: 'oak_log', quantity: 2 }])
  assert.equal(plan.tree[1].children[0].fromSurplus, 0)
  const second = planCrafting([{ name: 'stick', quantity: 4 }, { name: 'stick', quantity: 4 }], fixture)
  assert.deepEqual(second.materials, [{ name: 'oak_log', quantity: 1 }])
})

test('treats ingots as base materials and blocks as crafted from ingots', () => {
  assert.equal(isCraftable('iron_ingot', fixture), false)
  assert.equal(isCraftable('iron_nugget', fixture), false)
  assert.deepEqual(planCrafting([{ name: 'iron_block', quantity: 2 }], fixture).materials, [{ name: 'iron_ingot', quantity: 18 }])
})

test('stops at recipe cycles instead of looping', () => {
  const plan = planCrafting([{ name: 'a', quantity: 3 }], fixture)
  assert.deepEqual(plan.materials, [{ name: 'b', quantity: 3 }])
})

test('formats stacks and the copyable material list', () => {
  assert.equal(formatStacks(130, 64), '2 stacks + 2')
  assert.equal(formatStacks(64, 64), '1 stack')
  assert.equal(formatStacks(10, 64), '')
  assert.equal(formatStacks(5, 1), '')
  const plan = planCrafting([{ name: 'torch', quantity: 4 }], fixture)
  assert.equal(formatMaterialList(plan, (name) => name.toUpperCase()), '1 × COAL\n1 × OAK_LOG')
})

test('plans real 1.21.11 recipes from the generated dataset', () => {
  const dataset = JSON.parse(readFileSync(new URL('../public/data/minecraft/1.21.11.json', import.meta.url), 'utf8')) as McDataset
  assert.deepEqual(planCrafting([{ name: 'crafting_table', quantity: 1 }], dataset).materials, [{ name: 'oak_log', quantity: 1 }])
  assert.deepEqual(planCrafting([{ name: 'iron_block', quantity: 1 }], dataset).materials, [{ name: 'iron_ingot', quantity: 9 }])
  assert.deepEqual(planCrafting([{ name: 'furnace', quantity: 1 }], dataset).materials, [{ name: 'cobblestone', quantity: 8 }])
  assert.deepEqual(planCrafting([{ name: 'slime_block', quantity: 1 }], dataset).materials, [{ name: 'slime_ball', quantity: 9 }])
  assert.equal(isCraftable('wheat', dataset), false)
})
