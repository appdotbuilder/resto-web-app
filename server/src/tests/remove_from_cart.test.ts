import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, cartItemsTable } from '../db/schema';
import { removeFromCart } from '../handlers/remove_from_cart';
import { eq } from 'drizzle-orm';

describe('removeFromCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should remove an existing cart item', async () => {
    // Create prerequisite data: category and menu item
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category'
      })
      .returning()
      .execute();

    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '19.99',
        category_id: categoryResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create cart item to remove
    const cartItemResult = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-123',
        menu_item_id: menuItemResult[0].id,
        quantity: 2
      })
      .returning()
      .execute();

    const cartItemId = cartItemResult[0].id;

    // Remove the cart item
    const result = await removeFromCart(cartItemId);

    // Should return true for successful removal
    expect(result).toBe(true);

    // Verify the cart item no longer exists in database
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();

    expect(remainingItems).toHaveLength(0);
  });

  it('should return false when cart item does not exist', async () => {
    // Try to remove a non-existent cart item
    const result = await removeFromCart(999999);

    // Should return false when no item was found/removed
    expect(result).toBe(false);
  });

  it('should not affect other cart items when removing one', async () => {
    // Create prerequisite data: category and menu item
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category'
      })
      .returning()
      .execute();

    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '19.99',
        category_id: categoryResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create multiple cart items
    const cartItem1Result = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-123',
        menu_item_id: menuItemResult[0].id,
        quantity: 1
      })
      .returning()
      .execute();

    const cartItem2Result = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-456',
        menu_item_id: menuItemResult[0].id,
        quantity: 2
      })
      .returning()
      .execute();

    const cartItemId1 = cartItem1Result[0].id;
    const cartItemId2 = cartItem2Result[0].id;

    // Remove only the first cart item
    const result = await removeFromCart(cartItemId1);

    expect(result).toBe(true);

    // Verify first item is removed
    const removedItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId1))
      .execute();

    expect(removedItem).toHaveLength(0);

    // Verify second item still exists
    const remainingItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId2))
      .execute();

    expect(remainingItem).toHaveLength(1);
    expect(remainingItem[0].id).toBe(cartItemId2);
    expect(remainingItem[0].quantity).toBe(2);
  });

  it('should handle removal from different sessions independently', async () => {
    // Create prerequisite data: category and menu item
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category'
      })
      .returning()
      .execute();

    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '15.50',
        category_id: categoryResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create cart items for different sessions
    const sessionAItemResult = await db.insert(cartItemsTable)
      .values({
        session_id: 'session-a',
        menu_item_id: menuItemResult[0].id,
        quantity: 3
      })
      .returning()
      .execute();

    const sessionBItemResult = await db.insert(cartItemsTable)
      .values({
        session_id: 'session-b',
        menu_item_id: menuItemResult[0].id,
        quantity: 1
      })
      .returning()
      .execute();

    // Remove item from session A
    const result = await removeFromCart(sessionAItemResult[0].id);

    expect(result).toBe(true);

    // Verify session A item is removed
    const sessionAItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, 'session-a'))
      .execute();

    expect(sessionAItems).toHaveLength(0);

    // Verify session B item still exists
    const sessionBItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, 'session-b'))
      .execute();

    expect(sessionBItems).toHaveLength(1);
    expect(sessionBItems[0].id).toBe(sessionBItemResult[0].id);
    expect(sessionBItems[0].quantity).toBe(1);
  });
});