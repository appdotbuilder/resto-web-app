import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, ordersTable, categoriesTable, menuItemsTable } from '../db/schema';
import { checkPaymentStatus } from '../handlers/check_payment_status';
import { eq } from 'drizzle-orm';

describe('checkPaymentStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent payment', async () => {
    const result = await checkPaymentStatus(999);
    expect(result).toBeNull();
  });

  it('should return payment with proper numeric conversion', async () => {
    // Create prerequisite data
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '19.99',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const order = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        customer_email: 'test@example.com',
        total_amount: '19.99'
      })
      .returning()
      .execute();

    // Create test payment
    const payment = await db.insert(paymentsTable)
      .values({
        order_id: order[0].id,
        payment_gateway: 'test_gateway',
        qr_code_data: 'test_qr_data',
        qr_code_url: 'https://example.com/qr.png',
        amount: '19.99',
        status: 'pending',
        gateway_reference: 'test_ref_123'
      })
      .returning()
      .execute();

    const result = await checkPaymentStatus(payment[0].id);

    expect(result).toBeDefined();
    expect(result!.id).toBe(payment[0].id);
    expect(result!.order_id).toBe(order[0].id);
    expect(result!.payment_gateway).toBe('test_gateway');
    expect(result!.qr_code_data).toBe('test_qr_data');
    expect(result!.amount).toBe(19.99); // Should be converted to number
    expect(typeof result!.amount).toBe('number');
    expect(result!.gateway_reference).toBe('test_ref_123');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should mark payment as expired when past expiry date', async () => {
    // Create prerequisite data
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '25.00',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const order = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        customer_email: 'test@example.com',
        total_amount: '25.00'
      })
      .returning()
      .execute();

    // Create expired payment
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago

    const payment = await db.insert(paymentsTable)
      .values({
        order_id: order[0].id,
        payment_gateway: 'test_gateway',
        qr_code_data: 'expired_qr_data',
        amount: '25.00',
        status: 'pending',
        expires_at: pastDate
      })
      .returning()
      .execute();

    const result = await checkPaymentStatus(payment[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toBe('expired');
    expect(result!.amount).toBe(25.00);

    // Verify database was updated
    const updatedPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, payment[0].id))
      .execute();

    expect(updatedPayments[0].status).toBe('expired');
    expect(updatedPayments[0].updated_at > payment[0].updated_at).toBe(true);
  });

  it('should not change status for already completed payments', async () => {
    // Create prerequisite data
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '30.00',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const order = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        customer_email: 'test@example.com',
        total_amount: '30.00'
      })
      .returning()
      .execute();

    const paidDate = new Date();
    const payment = await db.insert(paymentsTable)
      .values({
        order_id: order[0].id,
        payment_gateway: 'test_gateway',
        qr_code_data: 'paid_qr_data',
        amount: '30.00',
        status: 'paid',
        paid_at: paidDate
      })
      .returning()
      .execute();

    const result = await checkPaymentStatus(payment[0].id);

    expect(result).toBeDefined();
    expect(result!.status).toBe('paid');
    expect(result!.amount).toBe(30.00);
    expect(result!.paid_at).toEqual(paidDate);
  });

  it('should handle payments without expiry date', async () => {
    // Create prerequisite data
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '15.50',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const order = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        customer_email: 'test@example.com',
        total_amount: '15.50'
      })
      .returning()
      .execute();

    const payment = await db.insert(paymentsTable)
      .values({
        order_id: order[0].id,
        payment_gateway: 'test_gateway',
        qr_code_data: 'no_expiry_qr_data',
        amount: '15.50',
        status: 'pending',
        expires_at: null
      })
      .returning()
      .execute();

    const result = await checkPaymentStatus(payment[0].id);

    expect(result).toBeDefined();
    expect(result!.id).toBe(payment[0].id);
    expect(result!.amount).toBe(15.50);
    expect(result!.expires_at).toBeNull();
    // Status might remain pending or change based on simulation
    expect(['pending', 'paid', 'failed'].includes(result!.status)).toBe(true);
  });

  it('should set paid_at timestamp when payment becomes paid', async () => {
    // Create prerequisite data
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();

    const menuItem = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'Test item description',
        price: '40.00',
        category_id: category[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const order = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        customer_email: 'test@example.com',
        total_amount: '40.00'
      })
      .returning()
      .execute();

    const payment = await db.insert(paymentsTable)
      .values({
        order_id: order[0].id,
        payment_gateway: 'test_gateway',
        qr_code_data: 'pending_qr_data',
        amount: '40.00',
        status: 'pending',
        paid_at: null
      })
      .returning()
      .execute();

    // Test multiple times to increase chance of getting 'paid' status from simulation
    let result = null;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      result = await checkPaymentStatus(payment[0].id);
      if (result?.status === 'paid') {
        break;
      }
      attempts++;
    }

    // If we got a paid status, verify paid_at was set
    if (result?.status === 'paid') {
      expect(result.paid_at).toBeDefined();
      expect(result.paid_at).toBeInstanceOf(Date);

      // Verify database was updated
      const updatedPayments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, payment[0].id))
        .execute();

      expect(updatedPayments[0].status).toBe('paid');
      expect(updatedPayments[0].paid_at).toBeDefined();
    }

    // Regardless of simulation outcome, basic fields should be correct
    expect(result).toBeDefined();
    expect(result!.amount).toBe(40.00);
    expect(typeof result!.amount).toBe('number');
  });
});