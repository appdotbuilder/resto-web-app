import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { ordersTable, categoriesTable, menuItemsTable } from '../db/schema';
import { type UpdateOrderStatusInput } from '../schema';
import { updateOrderStatus } from '../handlers/update_order_status';
import { eq } from 'drizzle-orm';

describe('updateOrderStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testOrderId: number;

  beforeEach(async () => {
    // Create test category first
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Category for testing'
      })
      .returning()
      .execute();

    // Create test menu item
    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Item for testing',
        price: '15.99',
        category_id: categoryResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        customer_email: 'john@example.com',
        total_amount: '25.50',
        status: 'pending',
        payment_status: 'pending',
        notes: 'Test order'
      })
      .returning()
      .execute();

    testOrderId = orderResult[0].id;
  });

  it('should update order status successfully', async () => {
    const input: UpdateOrderStatusInput = {
      id: testOrderId,
      status: 'confirmed'
    };

    const result = await updateOrderStatus(input);

    // Verify return values
    expect(result.id).toEqual(testOrderId);
    expect(result.status).toEqual('confirmed');
    expect(result.customer_name).toEqual('John Doe');
    expect(result.customer_phone).toEqual('+1234567890');
    expect(result.customer_email).toEqual('john@example.com');
    expect(result.total_amount).toEqual(25.50);
    expect(result.payment_status).toEqual('pending');
    expect(result.notes).toEqual('Test order');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(typeof result.total_amount).toBe('number');
  });

  it('should save updated status to database', async () => {
    const input: UpdateOrderStatusInput = {
      id: testOrderId,
      status: 'preparing'
    };

    await updateOrderStatus(input);

    // Verify database was updated
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, testOrderId))
      .execute();

    expect(orders).toHaveLength(1);
    expect(orders[0].status).toEqual('preparing');
    expect(orders[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update updated_at timestamp', async () => {
    const input: UpdateOrderStatusInput = {
      id: testOrderId,
      status: 'ready'
    };

    // Get original timestamp
    const originalOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, testOrderId))
      .execute();
    const originalTimestamp = originalOrders[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await updateOrderStatus(input);

    // Verify timestamp was updated
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });

  it('should handle all valid order statuses', async () => {
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'] as const;

    for (const status of validStatuses) {
      const input: UpdateOrderStatusInput = {
        id: testOrderId,
        status
      };

      const result = await updateOrderStatus(input);
      expect(result.status).toEqual(status);

      // Verify in database
      const orders = await db.select()
        .from(ordersTable)
        .where(eq(ordersTable.id, testOrderId))
        .execute();
      expect(orders[0].status).toEqual(status);
    }
  });

  it('should throw error for non-existent order', async () => {
    const input: UpdateOrderStatusInput = {
      id: 99999,
      status: 'confirmed'
    };

    expect(updateOrderStatus(input)).rejects.toThrow(/Order with id 99999 not found/i);
  });

  it('should preserve other order fields when updating status', async () => {
    const input: UpdateOrderStatusInput = {
      id: testOrderId,
      status: 'completed'
    };

    const result = await updateOrderStatus(input);

    // Verify all original fields are preserved
    expect(result.customer_name).toEqual('John Doe');
    expect(result.customer_phone).toEqual('+1234567890');
    expect(result.customer_email).toEqual('john@example.com');
    expect(result.total_amount).toEqual(25.50);
    expect(result.payment_status).toEqual('pending');
    expect(result.payment_method).toBeNull();
    expect(result.payment_reference).toBeNull();
    expect(result.notes).toEqual('Test order');
    expect(result.created_at).toBeInstanceOf(Date);
  });
});