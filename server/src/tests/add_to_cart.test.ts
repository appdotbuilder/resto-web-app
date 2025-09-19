import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput } from '../schema';
import { addToCart } from '../handlers/add_to_cart';
import { eq, and } from 'drizzle-orm';

describe('addToCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let categoryId: number;
  let menuItemId: number;
  let unavailableMenuItemId: number;

  beforeEach(async () => {
    // Create test category
    const categories = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();
    categoryId = categories[0].id;

    // Create available menu item
    const menuItems = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '15.99',
        category_id: categoryId,
        image_url: null,
        is_available: true
      })
      .returning()
      .execute();
    menuItemId = menuItems[0].id;

    // Create unavailable menu item
    const unavailableItems = await db.insert(menuItemsTable)
      .values({
        name: 'Unavailable Item',
        description: 'An unavailable menu item',
        price: '12.99',
        category_id: categoryId,
        image_url: null,
        is_available: false
      })
      .returning()
      .execute();
    unavailableMenuItemId = unavailableItems[0].id;
  });

  it('should add new item to cart', async () => {
    const input: AddToCartInput = {
      session_id: 'test-session-1',
      menu_item_id: menuItemId,
      quantity: 2
    };

    const result = await addToCart(input);

    // Verify returned cart item
    expect(result.id).toBeDefined();
    expect(result.session_id).toEqual('test-session-1');
    expect(result.menu_item_id).toEqual(menuItemId);
    expect(result.quantity).toEqual(2);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save cart item to database', async () => {
    const input: AddToCartInput = {
      session_id: 'test-session-2',
      menu_item_id: menuItemId,
      quantity: 3
    };

    const result = await addToCart(input);

    // Query database to verify item was saved
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, result.id))
      .execute();

    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].session_id).toEqual('test-session-2');
    expect(cartItems[0].menu_item_id).toEqual(menuItemId);
    expect(cartItems[0].quantity).toEqual(3);
    expect(cartItems[0].created_at).toBeInstanceOf(Date);
  });

  it('should update quantity when item already exists in cart', async () => {
    const sessionId = 'test-session-3';

    // Add item to cart first time
    const firstInput: AddToCartInput = {
      session_id: sessionId,
      menu_item_id: menuItemId,
      quantity: 2
    };

    const firstResult = await addToCart(firstInput);

    // Add same item to cart again
    const secondInput: AddToCartInput = {
      session_id: sessionId,
      menu_item_id: menuItemId,
      quantity: 3
    };

    const secondResult = await addToCart(secondInput);

    // Should return the same cart item with updated quantity
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.session_id).toEqual(sessionId);
    expect(secondResult.menu_item_id).toEqual(menuItemId);
    expect(secondResult.quantity).toEqual(5); // 2 + 3
    expect(secondResult.created_at).toEqual(firstResult.created_at);

    // Verify only one cart item exists in database
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.session_id, sessionId),
          eq(cartItemsTable.menu_item_id, menuItemId)
        )
      )
      .execute();

    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].quantity).toEqual(5);
  });

  it('should allow different sessions to have same menu item', async () => {
    const input1: AddToCartInput = {
      session_id: 'session-1',
      menu_item_id: menuItemId,
      quantity: 2
    };

    const input2: AddToCartInput = {
      session_id: 'session-2',
      menu_item_id: menuItemId,
      quantity: 3
    };

    const result1 = await addToCart(input1);
    const result2 = await addToCart(input2);

    // Should create separate cart items
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.session_id).toEqual('session-1');
    expect(result2.session_id).toEqual('session-2');
    expect(result1.quantity).toEqual(2);
    expect(result2.quantity).toEqual(3);

    // Verify both items exist in database
    const allCartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.menu_item_id, menuItemId))
      .execute();

    expect(allCartItems).toHaveLength(2);
  });

  it('should throw error for non-existent menu item', async () => {
    const input: AddToCartInput = {
      session_id: 'test-session-4',
      menu_item_id: 99999, // Non-existent ID
      quantity: 1
    };

    expect(addToCart(input)).rejects.toThrow(/menu item with id 99999 not found/i);
  });

  it('should throw error for unavailable menu item', async () => {
    const input: AddToCartInput = {
      session_id: 'test-session-5',
      menu_item_id: unavailableMenuItemId,
      quantity: 1
    };

    expect(addToCart(input)).rejects.toThrow(/menu item with id .* is not available/i);
  });

  it('should handle large quantities correctly', async () => {
    const input: AddToCartInput = {
      session_id: 'test-session-6',
      menu_item_id: menuItemId,
      quantity: 100
    };

    const result = await addToCart(input);

    expect(result.quantity).toEqual(100);

    // Add more to test cumulative quantity
    const secondInput: AddToCartInput = {
      session_id: 'test-session-6',
      menu_item_id: menuItemId,
      quantity: 50
    };

    const secondResult = await addToCart(secondInput);
    expect(secondResult.quantity).toEqual(150);
  });
});