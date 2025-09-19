import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, cartItemsTable } from '../db/schema';
import { type UpdateCartItemInput } from '../schema';
import { updateCartItem } from '../handlers/update_cart_item';
import { eq } from 'drizzle-orm';

describe('updateCartItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update cart item quantity', async () => {
    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '15.99',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create test cart item
    const cartItem = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-123',
        menu_item_id: menuItem[0].id,
        quantity: 2
      })
      .returning()
      .execute();

    const input: UpdateCartItemInput = {
      id: cartItem[0].id,
      quantity: 5
    };

    const result = await updateCartItem(input);

    // Verify the result
    expect(result.id).toBe(cartItem[0].id);
    expect(result.quantity).toBe(5);
    expect(result.session_id).toBe('test-session-123');
    expect(result.menu_item_id).toBe(menuItem[0].id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save updated quantity to database', async () => {
    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '12.50',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create test cart item with initial quantity
    const cartItem = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-456',
        menu_item_id: menuItem[0].id,
        quantity: 1
      })
      .returning()
      .execute();

    const input: UpdateCartItemInput = {
      id: cartItem[0].id,
      quantity: 3
    };

    await updateCartItem(input);

    // Verify the cart item was updated in database
    const updatedCartItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItem[0].id))
      .execute();

    expect(updatedCartItem).toHaveLength(1);
    expect(updatedCartItem[0].quantity).toBe(3);
    expect(updatedCartItem[0].session_id).toBe('test-session-456');
    expect(updatedCartItem[0].menu_item_id).toBe(menuItem[0].id);
  });

  it('should throw error when cart item does not exist', async () => {
    const input: UpdateCartItemInput = {
      id: 999999, // Non-existent ID
      quantity: 2
    };

    await expect(updateCartItem(input)).rejects.toThrow(/Cart item with id 999999 not found/i);
  });

  it('should update cart item to minimum quantity of 1', async () => {
    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '8.99',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create test cart item
    const cartItem = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-789',
        menu_item_id: menuItem[0].id,
        quantity: 5
      })
      .returning()
      .execute();

    const input: UpdateCartItemInput = {
      id: cartItem[0].id,
      quantity: 1
    };

    const result = await updateCartItem(input);

    expect(result.quantity).toBe(1);

    // Verify in database
    const updatedCartItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItem[0].id))
      .execute();

    expect(updatedCartItem[0].quantity).toBe(1);
  });

  it('should update cart item to large quantity', async () => {
    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '25.00',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create test cart item
    const cartItem = await db.insert(cartItemsTable)
      .values({
        session_id: 'test-session-large',
        menu_item_id: menuItem[0].id,
        quantity: 1
      })
      .returning()
      .execute();

    const input: UpdateCartItemInput = {
      id: cartItem[0].id,
      quantity: 100
    };

    const result = await updateCartItem(input);

    expect(result.quantity).toBe(100);

    // Verify in database
    const updatedCartItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItem[0].id))
      .execute();

    expect(updatedCartItem[0].quantity).toBe(100);
  });
});