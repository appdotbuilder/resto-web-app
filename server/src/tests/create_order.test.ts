import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, cartItemsTable, ordersTable, orderItemsTable } from '../db/schema';
import { type CreateOrderInput } from '../schema';
import { createOrder } from '../handlers/create_order';
import { eq } from 'drizzle-orm';

const testInput: CreateOrderInput = {
  session_id: 'test-session-123',
  customer_name: 'John Doe',
  customer_phone: '+1234567890',
  customer_email: 'john@example.com',
  notes: 'Extra spicy please'
};

describe('createOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an order from cart items', async () => {
    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const category = categoryResult[0];

    // Create test menu items
    const menuItemResults = await db.insert(menuItemsTable)
      .values([
        {
          name: 'Test Item 1',
          description: 'First test item',
          price: '10.50',
          category_id: category.id,
          is_available: true
        },
        {
          name: 'Test Item 2',
          description: 'Second test item',
          price: '15.00',
          category_id: category.id,
          is_available: true
        }
      ])
      .returning()
      .execute();

    const menuItem1 = menuItemResults[0];
    const menuItem2 = menuItemResults[1];

    // Create cart items
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

    // Create order
    const result = await createOrder(testInput);

    // Validate order properties
    expect(result.customer_name).toEqual('John Doe');
    expect(result.customer_phone).toEqual('+1234567890');
    expect(result.customer_email).toEqual('john@example.com');
    expect(result.notes).toEqual('Extra spicy please');
    expect(result.status).toEqual('pending');
    expect(result.payment_status).toEqual('pending');
    expect(result.total_amount).toEqual(36.00); // (10.50 * 2) + (15.00 * 1) = 36.00
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Validate order items
    expect(result.items).toHaveLength(2);
    
    const item1 = result.items.find(item => item.menu_item_id === menuItem1.id);
    expect(item1).toBeDefined();
    expect(item1!.quantity).toEqual(2);
    expect(item1!.price_at_time).toEqual(10.50);
    expect(item1!.menu_item.name).toEqual('Test Item 1');

    const item2 = result.items.find(item => item.menu_item_id === menuItem2.id);
    expect(item2).toBeDefined();
    expect(item2!.quantity).toEqual(1);
    expect(item2!.price_at_time).toEqual(15.00);
    expect(item2!.menu_item.name).toEqual('Test Item 2');
  });

  it('should save order to database correctly', async () => {
    // Create prerequisite data
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '20.00',
        category_id: categoryResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    await db.insert(cartItemsTable)
      .values({
        session_id: testInput.session_id,
        menu_item_id: menuItemResult[0].id,
        quantity: 3
      })
      .execute();

    // Create order
    const result = await createOrder(testInput);

    // Verify order exists in database
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, result.id))
      .execute();

    expect(orders).toHaveLength(1);
    expect(orders[0].customer_name).toEqual('John Doe');
    expect(parseFloat(orders[0].total_amount)).toEqual(60.00); // 20.00 * 3 = 60.00

    // Verify order items exist in database
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, result.id))
      .execute();

    expect(orderItems).toHaveLength(1);
    expect(orderItems[0].quantity).toEqual(3);
    expect(parseFloat(orderItems[0].price_at_time)).toEqual(20.00);
  });

  it('should clear cart after order creation', async () => {
    // Create prerequisite data
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '12.50',
        category_id: categoryResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    await db.insert(cartItemsTable)
      .values({
        session_id: testInput.session_id,
        menu_item_id: menuItemResult[0].id,
        quantity: 2
      })
      .execute();

    // Verify cart has items before order creation
    const cartBefore = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(cartBefore).toHaveLength(1);

    // Create order
    await createOrder(testInput);

    // Verify cart is empty after order creation
    const cartAfter = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.session_id, testInput.session_id))
      .execute();

    expect(cartAfter).toHaveLength(0);
  });

  it('should throw error when cart is empty', async () => {
    // Try to create order without cart items
    await expect(createOrder(testInput)).rejects.toThrow(/cart is empty/i);
  });

  it('should handle orders with nullable fields', async () => {
    // Create test data
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: null
      })
      .returning()
      .execute();

    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: null,
        price: '25.00',
        category_id: categoryResult[0].id,
        is_available: true,
        image_url: null
      })
      .returning()
      .execute();

    await db.insert(cartItemsTable)
      .values({
        session_id: testInput.session_id,
        menu_item_id: menuItemResult[0].id,
        quantity: 1
      })
      .execute();

    const orderInput: CreateOrderInput = {
      session_id: testInput.session_id,
      customer_name: 'Jane Doe',
      customer_phone: null,
      customer_email: null,
      notes: null
    };

    // Create order with nullable fields
    const result = await createOrder(orderInput);

    expect(result.customer_name).toEqual('Jane Doe');
    expect(result.customer_phone).toBeNull();
    expect(result.customer_email).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.total_amount).toEqual(25.00);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].menu_item.description).toBeNull();
    expect(result.items[0].menu_item.image_url).toBeNull();
  });

  it('should calculate total amount correctly with multiple items', async () => {
    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    // Create menu items with decimal prices
    const menuItemResults = await db.insert(menuItemsTable)
      .values([
        {
          name: 'Expensive Item',
          price: '99.99',
          category_id: categoryResult[0].id
        },
        {
          name: 'Cheap Item',
          price: '5.50',
          category_id: categoryResult[0].id
        },
        {
          name: 'Medium Item',
          price: '12.75',
          category_id: categoryResult[0].id
        }
      ])
      .returning()
      .execute();

    // Add items to cart
    await db.insert(cartItemsTable)
      .values([
        {
          session_id: testInput.session_id,
          menu_item_id: menuItemResults[0].id,
          quantity: 2
        },
        {
          session_id: testInput.session_id,
          menu_item_id: menuItemResults[1].id,
          quantity: 3
        },
        {
          session_id: testInput.session_id,
          menu_item_id: menuItemResults[2].id,
          quantity: 1
        }
      ])
      .execute();

    const result = await createOrder(testInput);

    // Expected total: (99.99 * 2) + (5.50 * 3) + (12.75 * 1) = 199.98 + 16.50 + 12.75 = 229.23
    expect(result.total_amount).toEqual(229.23);
  });
});