import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { cartItemsTable, categoriesTable, menuItemsTable } from '../db/schema';
import { type GetCartInput } from '../schema';
import { clearCart } from '../handlers/clear_cart';
import { eq } from 'drizzle-orm';

// Test input
const testInput: GetCartInput = {
  session_id: 'test-session-123'
};

const anotherSessionInput: GetCartInput = {
  session_id: 'another-session-456'
};

describe('clearCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should clear all items from cart for given session', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    // Create test menu items
    const [menuItem1, menuItem2] = await db.insert(menuItemsTable)
      .values([
        {
          name: 'Test Item 1',
          description: 'First test item',
          price: '19.99',
          category_id: category.id,
          is_available: true
        },
        {
          name: 'Test Item 2',
          description: 'Second test item',
          price: '29.99',
          category_id: category.id,
          is_available: true
        }
      ])
      .returning()
      .execute();

    // Add items to cart
    await db.insert(cartItemsTable)
      .values([
        {
          session_id: testInput.session_id,
          menu_item_id: menuItem1.id,
          quantity: 2
        },
        {
          session_id: testInput.session_id,
          menu_item_id: menuItem2.id,
          quantity: 1
        }
      ])
      .execute();

    // Verify items exist before clearing
    const itemsBeforeClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(itemsBeforeClear).toHaveLength(2);

    // Clear the cart
    const result = await clearCart(testInput);

    expect(result).toBe(true);

    // Verify cart is empty
    const itemsAfterClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(itemsAfterClear).toHaveLength(0);
  });

  it('should only clear items for the specific session', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test item',
        price: '19.99',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    // Add items to different sessions
    await db.insert(cartItemsTable)
      .values([
        {
          session_id: testInput.session_id,
          menu_item_id: menuItem.id,
          quantity: 2
        },
        {
          session_id: anotherSessionInput.session_id,
          menu_item_id: menuItem.id,
          quantity: 3
        }
      ])
      .execute();

    // Clear cart for first session
    const result = await clearCart(testInput);

    expect(result).toBe(true);

    // Verify first session cart is empty
    const firstSessionItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(firstSessionItems).toHaveLength(0);

    // Verify second session cart is unchanged
    const secondSessionItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, anotherSessionInput.session_id))
      .execute();

    expect(secondSessionItems).toHaveLength(1);
    expect(secondSessionItems[0].quantity).toBe(3);
  });

  it('should return true when clearing an empty cart', async () => {
    // Verify cart is empty
    const itemsBeforeClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(itemsBeforeClear).toHaveLength(0);

    // Clear the empty cart
    const result = await clearCart(testInput);

    expect(result).toBe(true);

    // Verify cart is still empty
    const itemsAfterClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(itemsAfterClear).toHaveLength(0);
  });

  it('should return true when clearing cart for non-existent session', async () => {
    const nonExistentSessionInput: GetCartInput = {
      session_id: 'non-existent-session-789'
    };

    // Clear cart for non-existent session
    const result = await clearCart(nonExistentSessionInput);

    expect(result).toBe(true);

    // Verify no items exist for this session
    const items = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, nonExistentSessionInput.session_id))
      .execute();

    expect(items).toHaveLength(0);
  });

  it('should handle session with special characters', async () => {
    const specialSessionInput: GetCartInput = {
      session_id: 'session-with-special@chars#123!'
    };

    // Create test category and menu item
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test item',
        price: '19.99',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    // Add item to cart with special session ID
    await db.insert(cartItemsTable)
      .values({
        session_id: specialSessionInput.session_id,
        menu_item_id: menuItem.id,
        quantity: 1
      })
      .execute();

    // Clear the cart
    const result = await clearCart(specialSessionInput);

    expect(result).toBe(true);

    // Verify cart is empty
    const items = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, specialSessionInput.session_id))
      .execute();

    expect(items).toHaveLength(0);
  });
});