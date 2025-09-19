import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, ordersTable, orderItemsTable } from '../db/schema';
import { getOrders } from '../handlers/get_orders';

describe('getOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no orders exist', async () => {
    const result = await getOrders();

    expect(result).toEqual([]);
  });

  it('should return orders with their items', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Category for testing'
      })
      .returning()
      .execute();

    // Create test menu items
    const [menuItem1] = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item 1',
        description: 'First test item',
        price: '15.99',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    const [menuItem2] = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item 2',
        description: 'Second test item',
        price: '12.50',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    // Create test order
    const [order] = await db.insert(ordersTable)
      .values({
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        customer_email: 'john@example.com',
        total_amount: '45.48',
        status: 'pending',
        payment_status: 'pending',
        notes: 'Test order'
      })
      .returning()
      .execute();

    // Create order items
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: order.id,
          menu_item_id: menuItem1.id,
          quantity: 2,
          price_at_time: '15.99'
        },
        {
          order_id: order.id,
          menu_item_id: menuItem2.id,
          quantity: 1,
          price_at_time: '12.50'
        }
      ])
      .execute();

    const result = await getOrders();

    expect(result).toHaveLength(1);
    
    const orderWithItems = result[0];
    expect(orderWithItems.id).toEqual(order.id);
    expect(orderWithItems.customer_name).toEqual('John Doe');
    expect(orderWithItems.customer_phone).toEqual('+1234567890');
    expect(orderWithItems.customer_email).toEqual('john@example.com');
    expect(orderWithItems.total_amount).toEqual(45.48);
    expect(typeof orderWithItems.total_amount).toEqual('number');
    expect(orderWithItems.status).toEqual('pending');
    expect(orderWithItems.payment_status).toEqual('pending');
    expect(orderWithItems.notes).toEqual('Test order');
    expect(orderWithItems.created_at).toBeInstanceOf(Date);
    expect(orderWithItems.updated_at).toBeInstanceOf(Date);

    // Verify items
    expect(orderWithItems.items).toHaveLength(2);
    
    const item1 = orderWithItems.items.find(item => item.menu_item.name === 'Test Item 1');
    expect(item1).toBeDefined();
    expect(item1!.quantity).toEqual(2);
    expect(item1!.price_at_time).toEqual(15.99);
    expect(typeof item1!.price_at_time).toEqual('number');
    expect(item1!.menu_item.name).toEqual('Test Item 1');
    expect(item1!.menu_item.description).toEqual('First test item');
    expect(item1!.menu_item.price).toEqual(15.99);
    expect(typeof item1!.menu_item.price).toEqual('number');

    const item2 = orderWithItems.items.find(item => item.menu_item.name === 'Test Item 2');
    expect(item2).toBeDefined();
    expect(item2!.quantity).toEqual(1);
    expect(item2!.price_at_time).toEqual(12.50);
    expect(item2!.menu_item.name).toEqual('Test Item 2');
    expect(item2!.menu_item.price).toEqual(12.50);
  });

  it('should return multiple orders in chronological order', async () => {
    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item',
        price: '10.00',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    // Create multiple orders with slight delay to ensure different timestamps
    const [order1] = await db.insert(ordersTable)
      .values({
        customer_name: 'Customer 1',
        customer_phone: '+1111111111',
        total_amount: '10.00',
        status: 'pending',
        payment_status: 'pending'
      })
      .returning()
      .execute();

    // Add order item for first order
    await db.insert(orderItemsTable)
      .values({
        order_id: order1.id,
        menu_item_id: menuItem.id,
        quantity: 1,
        price_at_time: '10.00'
      })
      .execute();

    const [order2] = await db.insert(ordersTable)
      .values({
        customer_name: 'Customer 2',
        customer_phone: '+2222222222',
        total_amount: '20.00',
        status: 'confirmed',
        payment_status: 'paid'
      })
      .returning()
      .execute();

    // Add order item for second order
    await db.insert(orderItemsTable)
      .values({
        order_id: order2.id,
        menu_item_id: menuItem.id,
        quantity: 2,
        price_at_time: '10.00'
      })
      .execute();

    const result = await getOrders();

    expect(result).toHaveLength(2);
    
    // Verify orders are in chronological order
    expect(result[0].customer_name).toEqual('Customer 1');
    expect(result[1].customer_name).toEqual('Customer 2');
    expect(result[0].created_at <= result[1].created_at).toBe(true);

    // Verify each order has its items
    expect(result[0].items).toHaveLength(1);
    expect(result[1].items).toHaveLength(1);
    expect(result[1].items[0].quantity).toEqual(2);
  });

  it('should handle orders without items', async () => {
    // Create test order without items
    const [order] = await db.insert(ordersTable)
      .values({
        customer_name: 'Jane Doe',
        total_amount: '0.00',
        status: 'cancelled',
        payment_status: 'failed'
      })
      .returning()
      .execute();

    const result = await getOrders();

    expect(result).toHaveLength(1);
    expect(result[0].customer_name).toEqual('Jane Doe');
    expect(result[0].items).toEqual([]);
  });

  it('should convert all numeric fields to numbers', async () => {
    // Create test category and menu item
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category'
      })
      .returning()
      .execute();

    const [menuItem] = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        price: '99.99',
        category_id: category.id,
        is_available: true
      })
      .returning()
      .execute();

    const [order] = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        total_amount: '199.98',
        status: 'completed',
        payment_status: 'paid'
      })
      .returning()
      .execute();

    await db.insert(orderItemsTable)
      .values({
        order_id: order.id,
        menu_item_id: menuItem.id,
        quantity: 2,
        price_at_time: '99.99'
      })
      .execute();

    const result = await getOrders();

    expect(result).toHaveLength(1);
    
    const orderWithItems = result[0];
    // Verify order total_amount is a number
    expect(typeof orderWithItems.total_amount).toEqual('number');
    expect(orderWithItems.total_amount).toEqual(199.98);

    // Verify order item numeric fields are numbers
    expect(orderWithItems.items).toHaveLength(1);
    const item = orderWithItems.items[0];
    expect(typeof item.price_at_time).toEqual('number');
    expect(item.price_at_time).toEqual(99.99);
    expect(typeof item.menu_item.price).toEqual('number');
    expect(item.menu_item.price).toEqual(99.99);
  });
});