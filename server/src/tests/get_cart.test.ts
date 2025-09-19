import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, cartItemsTable } from '../db/schema';
import { type GetCartInput } from '../schema';
import { getCart } from '../handlers/get_cart';

describe('getCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for session with no cart items', async () => {
    const input: GetCartInput = {
      session_id: 'empty-session-123'
    };

    const result = await getCart(input);

    expect(result).toEqual([]);
  });

  it('should return cart items with menu item details for valid session', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Beverages',
        description: 'Hot and cold drinks'
      })
      .returning()
      .execute();

    // Create test menu item
    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Coffee',
        description: 'Fresh brewed coffee',
        price: '4.50',
        category_id: category.id,
        image_url: 'coffee.jpg',
        is_available: true
      })
      .returning()
      .execute();

    // Create cart item
    const sessionId = 'test-session-456';
    const [cartItem] = await db.insert(cartItemsTable)
      .values({
        session_id: sessionId,
        menu_item_id: menuItem.id,
        quantity: 2
      })
      .returning()
      .execute();

    const input: GetCartInput = {
      session_id: sessionId
    };

    const result = await getCart(input);

    expect(result).toHaveLength(1);
    
    const item = result[0];
    expect(item.id).toEqual(cartItem.id);
    expect(item.session_id).toEqual(sessionId);
    expect(item.menu_item_id).toEqual(menuItem.id);
    expect(item.quantity).toEqual(2);
    expect(item.created_at).toBeInstanceOf(Date);

    // Verify menu item details
    expect(item.menu_item.id).toEqual(menuItem.id);
    expect(item.menu_item.name).toEqual('Coffee');
    expect(item.menu_item.description).toEqual('Fresh brewed coffee');
    expect(item.menu_item.price).toEqual(4.50);
    expect(typeof item.menu_item.price).toBe('number');
    expect(item.menu_item.category_id).toEqual(category.id);
    expect(item.menu_item.image_url).toEqual('coffee.jpg');
    expect(item.menu_item.is_available).toBe(true);
    expect(item.menu_item.created_at).toBeInstanceOf(Date);
  });

  it('should return multiple cart items for session with multiple items', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Delicious meals'
      })
      .returning()
      .execute();

    // Create multiple menu items
    const menuItems = await db.insert(menuItemsTable)
      .values([
        {
          name: 'Burger',
          description: 'Juicy beef burger',
          price: '12.99',
          category_id: category.id,
          is_available: true
        },
        {
          name: 'Pizza',
          description: 'Margherita pizza',
          price: '15.50',
          category_id: category.id,
          is_available: true
        }
      ])
      .returning()
      .execute();

    // Create multiple cart items
    const sessionId = 'multi-item-session-789';
    await db.insert(cartItemsTable)
      .values([
        {
          session_id: sessionId,
          menu_item_id: menuItems[0].id,
          quantity: 1
        },
        {
          session_id: sessionId,
          menu_item_id: menuItems[1].id,
          quantity: 3
        }
      ])
      .execute();

    const input: GetCartInput = {
      session_id: sessionId
    };

    const result = await getCart(input);

    expect(result).toHaveLength(2);
    
    // Check first item
    const burgerItem = result.find(item => item.menu_item.name === 'Burger');
    expect(burgerItem).toBeDefined();
    expect(burgerItem!.quantity).toEqual(1);
    expect(burgerItem!.menu_item.price).toEqual(12.99);
    expect(typeof burgerItem!.menu_item.price).toBe('number');

    // Check second item
    const pizzaItem = result.find(item => item.menu_item.name === 'Pizza');
    expect(pizzaItem).toBeDefined();
    expect(pizzaItem!.quantity).toEqual(3);
    expect(pizzaItem!.menu_item.price).toEqual(15.50);
    expect(typeof pizzaItem!.menu_item.price).toBe('number');
  });

  it('should only return cart items for the specified session', async () => {
    // Create test category and menu item
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Snacks',
        description: 'Quick bites'
      })
      .returning()
      .execute();

    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Chips',
        description: 'Crispy potato chips',
        price: '3.25',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    // Create cart items for different sessions
    await db.insert(cartItemsTable)
      .values([
        {
          session_id: 'session-a',
          menu_item_id: menuItem.id,
          quantity: 1
        },
        {
          session_id: 'session-b',
          menu_item_id: menuItem.id,
          quantity: 2
        }
      ])
      .execute();

    const input: GetCartInput = {
      session_id: 'session-a'
    };

    const result = await getCart(input);

    expect(result).toHaveLength(1);
    expect(result[0].session_id).toEqual('session-a');
    expect(result[0].quantity).toEqual(1);
  });

  it('should handle menu items with null values correctly', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Specials',
        description: null // Null description
      })
      .returning()
      .execute();

    // Create menu item with null values
    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Daily Special',
        description: null, // Null description
        price: '8.75',
        category_id: category.id,
        image_url: null, // Null image URL
        is_available: false // Not available
      })
      .returning()
      .execute();

    // Create cart item
    const sessionId = 'null-values-session';
    await db.insert(cartItemsTable)
      .values({
        session_id: sessionId,
        menu_item_id: menuItem.id,
        quantity: 1
      })
      .execute();

    const input: GetCartInput = {
      session_id: sessionId
    };

    const result = await getCart(input);

    expect(result).toHaveLength(1);
    
    const item = result[0];
    expect(item.menu_item.name).toEqual('Daily Special');
    expect(item.menu_item.description).toBeNull();
    expect(item.menu_item.price).toEqual(8.75);
    expect(typeof item.menu_item.price).toBe('number');
    expect(item.menu_item.image_url).toBeNull();
    expect(item.menu_item.is_available).toBe(false);
  });
});