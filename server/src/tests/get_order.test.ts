import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, ordersTable, orderItemsTable } from '../db/schema';
import { getOrder } from '../handlers/get_order';

describe('getOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent order', async () => {
    const result = await getOrder(999);
    expect(result).toBeNull();
  });

  it('should get an order with its items and menu details', async () => {
    // Create test data
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    const category = categoryResult[0];

    const menuItemResult = await db.insert(menuItemsTable)
      .values([
        {
          name: 'Test Item 1',
          description: 'First test item',
          price: '12.99',
          category_id: category.id,
          image_url: 'http://example.com/item1.jpg',
          is_available: true
        },
        {
          name: 'Test Item 2',
          description: 'Second test item',
          price: '8.50',
          category_id: category.id,
          image_url: null,
          is_available: true
        }
      ])
      .returning()
      .execute();

    const menuItems = menuItemResult;

    const orderResult = await db.insert(ordersTable)
      .values({
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        customer_email: 'john@example.com',
        total_amount: '34.98',
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'qr_code',
        notes: 'Test order'
      })
      .returning()
      .execute();

    const order = orderResult[0];

    await db.insert(orderItemsTable)
      .values([
        {
          order_id: order.id,
          menu_item_id: menuItems[0].id,
          quantity: 2,
          price_at_time: '12.99'
        },
        {
          order_id: order.id,
          menu_item_id: menuItems[1].id,
          quantity: 1,
          price_at_time: '8.50'
        }
      ])
      .execute();

    // Test the handler
    const result = await getOrder(order.id);

    // Validate order details
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(order.id);
    expect(result!.customer_name).toEqual('John Doe');
    expect(result!.customer_phone).toEqual('+1234567890');
    expect(result!.customer_email).toEqual('john@example.com');
    expect(result!.total_amount).toEqual(34.98);
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.status).toEqual('pending');
    expect(result!.payment_status).toEqual('pending');
    expect(result!.payment_method).toEqual('qr_code');
    expect(result!.notes).toEqual('Test order');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Validate items
    expect(result!.items).toHaveLength(2);

    // Validate first item
    const firstItem = result!.items[0];
    expect(firstItem.quantity).toEqual(2);
    expect(firstItem.price_at_time).toEqual(12.99);
    expect(typeof firstItem.price_at_time).toBe('number');
    expect(firstItem.menu_item.name).toEqual('Test Item 1');
    expect(firstItem.menu_item.description).toEqual('First test item');
    expect(firstItem.menu_item.price).toEqual(12.99);
    expect(typeof firstItem.menu_item.price).toBe('number');
    expect(firstItem.menu_item.category_id).toEqual(category.id);
    expect(firstItem.menu_item.image_url).toEqual('http://example.com/item1.jpg');
    expect(firstItem.menu_item.is_available).toBe(true);

    // Validate second item
    const secondItem = result!.items[1];
    expect(secondItem.quantity).toEqual(1);
    expect(secondItem.price_at_time).toEqual(8.50);
    expect(typeof secondItem.price_at_time).toBe('number');
    expect(secondItem.menu_item.name).toEqual('Test Item 2');
    expect(secondItem.menu_item.description).toEqual('Second test item');
    expect(secondItem.menu_item.price).toEqual(8.50);
    expect(typeof secondItem.menu_item.price).toBe('number');
    expect(secondItem.menu_item.image_url).toBeNull();
  });

  it('should get an order with no items', async () => {
    // Create an order with no items
    const orderResult = await db.insert(ordersTable)
      .values({
        customer_name: 'Jane Doe',
        customer_phone: null,
        customer_email: null,
        total_amount: '0.00',
        status: 'pending',
        payment_status: 'pending',
        payment_method: null,
        notes: null
      })
      .returning()
      .execute();

    const order = orderResult[0];

    const result = await getOrder(order.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(order.id);
    expect(result!.customer_name).toEqual('Jane Doe');
    expect(result!.customer_phone).toBeNull();
    expect(result!.customer_email).toBeNull();
    expect(result!.total_amount).toEqual(0);
    expect(result!.payment_method).toBeNull();
    expect(result!.notes).toBeNull();
    expect(result!.items).toHaveLength(0);
  });

  it('should handle different order statuses', async () => {
    const orderResult = await db.insert(ordersTable)
      .values({
        customer_name: 'Bob Smith',
        customer_phone: '+9876543210',
        customer_email: 'bob@example.com',
        total_amount: '25.99',
        status: 'completed',
        payment_status: 'paid',
        payment_method: 'credit_card',
        payment_reference: 'REF123456',
        notes: 'Delivered successfully'
      })
      .returning()
      .execute();

    const order = orderResult[0];

    const result = await getOrder(order.id);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('completed');
    expect(result!.payment_status).toEqual('paid');
    expect(result!.payment_method).toEqual('credit_card');
    expect(result!.payment_reference).toEqual('REF123456');
    expect(result!.notes).toEqual('Delivered successfully');
  });
});