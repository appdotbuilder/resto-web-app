import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, ordersTable, categoriesTable, menuItemsTable, orderItemsTable } from '../db/schema';
import { getPayment } from '../handlers/get_payment';
import { eq } from 'drizzle-orm';

describe('getPayment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const setupTestData = async () => {
    // Create a test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();
    const categoryId = categoryResult[0].id;

    // Create a test menu item
    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test menu item',
        price: '15.99',
        category_id: categoryId,
        is_available: true
      })
      .returning()
      .execute();
    const menuItemId = menuItemResult[0].id;

    // Create a test order
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
    const orderId = orderResult[0].id;

    // Create order items
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        menu_item_id: menuItemId,
        quantity: 1,
        price_at_time: '15.99'
      })
      .execute();

    // Create a test payment
    const paymentResult = await db.insert(paymentsTable)
      .values({
        order_id: orderId,
        payment_gateway: 'test_gateway',
        qr_code_data: 'test_qr_data_12345',
        qr_code_url: 'https://example.com/qr/test.png',
        amount: '25.50',
        status: 'pending',
        gateway_reference: 'ref_123456',
        expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      })
      .returning()
      .execute();

    return {
      categoryId,
      menuItemId,
      orderId,
      paymentId: paymentResult[0].id,
      payment: paymentResult[0],
      order: orderResult[0]
    };
  };

  it('should retrieve payment with order details', async () => {
    const { paymentId } = await setupTestData();

    const result = await getPayment(paymentId);

    expect(result).toBeDefined();
    expect(result!.id).toBe(paymentId);
    expect(result!.payment_gateway).toBe('test_gateway');
    expect(result!.qr_code_data).toBe('test_qr_data_12345');
    expect(result!.qr_code_url).toBe('https://example.com/qr/test.png');
    expect(result!.amount).toBe(25.50);
    expect(typeof result!.amount).toBe('number');
    expect(result!.status).toBe('pending');
    expect(result!.gateway_reference).toBe('ref_123456');
    expect(result!.expires_at).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should include complete order details', async () => {
    const { paymentId, orderId } = await setupTestData();

    const result = await getPayment(paymentId);

    expect(result).toBeDefined();
    expect(result!.order).toBeDefined();
    expect(result!.order.id).toBe(orderId);
    expect(result!.order.customer_name).toBe('John Doe');
    expect(result!.order.customer_phone).toBe('+1234567890');
    expect(result!.order.customer_email).toBe('john@example.com');
    expect(result!.order.total_amount).toBe(25.50);
    expect(typeof result!.order.total_amount).toBe('number');
    expect(result!.order.status).toBe('pending');
    expect(result!.order.payment_status).toBe('pending');
    expect(result!.order.notes).toBe('Test order');
    expect(result!.order.created_at).toBeInstanceOf(Date);
    expect(result!.order.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent payment', async () => {
    const result = await getPayment(99999);

    expect(result).toBeNull();
  });

  it('should handle different payment statuses correctly', async () => {
    const { orderId } = await setupTestData();

    // Create a paid payment
    const paidPaymentResult = await db.insert(paymentsTable)
      .values({
        order_id: orderId,
        payment_gateway: 'gateway_two',
        qr_code_data: 'paid_qr_data',
        amount: '50.00',
        status: 'paid',
        paid_at: new Date(),
        gateway_reference: 'paid_ref_789'
      })
      .returning()
      .execute();

    const result = await getPayment(paidPaymentResult[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toBe('paid');
    expect(result!.paid_at).toBeInstanceOf(Date);
    expect(result!.gateway_reference).toBe('paid_ref_789');
    expect(result!.amount).toBe(50.00);
  });

  it('should handle payments with null optional fields', async () => {
    const { orderId } = await setupTestData();

    // Create payment with minimal data (nulls for optional fields)
    const minimalPaymentResult = await db.insert(paymentsTable)
      .values({
        order_id: orderId,
        payment_gateway: 'minimal_gateway',
        qr_code_data: 'minimal_qr_data',
        amount: '10.00',
        status: 'pending'
        // Omitting optional fields like qr_code_url, gateway_reference, expires_at, paid_at
      })
      .returning()
      .execute();

    const result = await getPayment(minimalPaymentResult[0].id);

    expect(result).toBeDefined();
    expect(result!.qr_code_url).toBeNull();
    expect(result!.gateway_reference).toBeNull();
    expect(result!.expires_at).toBeNull();
    expect(result!.paid_at).toBeNull();
    expect(result!.amount).toBe(10.00);
  });

  it('should verify payment is correctly linked to order', async () => {
    const { paymentId, orderId } = await setupTestData();

    const result = await getPayment(paymentId);

    expect(result).toBeDefined();
    expect(result!.order_id).toBe(orderId);
    expect(result!.order.id).toBe(orderId);

    // Verify the payment exists in database with correct order_id
    const dbPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    expect(dbPayments).toHaveLength(1);
    expect(dbPayments[0].order_id).toBe(orderId);
  });

  it('should handle expired payments correctly', async () => {
    const { orderId } = await setupTestData();

    // Create an expired payment
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const expiredPaymentResult = await db.insert(paymentsTable)
      .values({
        order_id: orderId,
        payment_gateway: 'expired_gateway',
        qr_code_data: 'expired_qr_data',
        amount: '30.00',
        status: 'expired',
        expires_at: pastDate
      })
      .returning()
      .execute();

    const result = await getPayment(expiredPaymentResult[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toBe('expired');
    expect(result!.expires_at).toBeInstanceOf(Date);
    expect(result!.expires_at!.getTime()).toBeLessThan(Date.now());
  });
});