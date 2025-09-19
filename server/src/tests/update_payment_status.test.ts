import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, ordersTable, categoriesTable, menuItemsTable } from '../db/schema';
import { type UpdatePaymentStatusInput } from '../schema';
import { updatePaymentStatus } from '../handlers/update_payment_status';
import { eq } from 'drizzle-orm';

describe('updatePaymentStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create test data
  const createTestData = async () => {
    // Create category
    const categories = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category'
      })
      .returning()
      .execute();

    // Create menu item
    const menuItems = await db.insert(menuItemsTable)
      .values({
        name: 'Test Item',
        description: 'A test item',
        price: '19.99',
        category_id: categories[0].id,
        is_available: true
      })
      .returning()
      .execute();

    // Create order
    const orders = await db.insert(ordersTable)
      .values({
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        customer_email: 'test@example.com',
        total_amount: '19.99',
        status: 'pending',
        payment_status: 'pending'
      })
      .returning()
      .execute();

    // Create payment
    const payments = await db.insert(paymentsTable)
      .values({
        order_id: orders[0].id,
        payment_gateway: 'test-gateway',
        qr_code_data: 'test-qr-data',
        qr_code_url: 'https://test.com/qr',
        amount: '19.99',
        status: 'pending'
      })
      .returning()
      .execute();

    return { payment: payments[0], order: orders[0] };
  };

  it('should update payment status to paid', async () => {
    const { payment } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'paid',
      gateway_reference: 'gw-ref-123',
      paid_at: new Date()
    };

    const result = await updatePaymentStatus(input);

    // Verify the returned payment
    expect(result.id).toEqual(payment.id);
    expect(result.status).toEqual('paid');
    expect(result.gateway_reference).toEqual('gw-ref-123');
    expect(result.paid_at).toEqual(input.paid_at);
    expect(typeof result.amount).toBe('number');
    expect(result.amount).toEqual(19.99);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update payment status to failed', async () => {
    const { payment } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'failed',
      gateway_reference: 'gw-fail-456',
      paid_at: null
    };

    const result = await updatePaymentStatus(input);

    expect(result.status).toEqual('failed');
    expect(result.gateway_reference).toEqual('gw-fail-456');
    expect(result.paid_at).toBeNull();
  });

  it('should update payment status to expired', async () => {
    const { payment } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'expired',
      gateway_reference: null,
      paid_at: null
    };

    const result = await updatePaymentStatus(input);

    expect(result.status).toEqual('expired');
    expect(result.gateway_reference).toBeNull();
    expect(result.paid_at).toBeNull();
  });

  it('should update order payment status when payment is marked as paid', async () => {
    const { payment, order } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'paid',
      gateway_reference: 'gw-success-789',
      paid_at: new Date()
    };

    await updatePaymentStatus(input);

    // Verify order payment status was updated
    const updatedOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .execute();

    expect(updatedOrders).toHaveLength(1);
    expect(updatedOrders[0].payment_status).toEqual('paid');
    expect(updatedOrders[0].updated_at).toBeInstanceOf(Date);
  });

  it('should not update order payment status for non-paid payment status', async () => {
    const { payment, order } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'failed',
      gateway_reference: 'gw-fail-999',
      paid_at: null
    };

    await updatePaymentStatus(input);

    // Verify order payment status remains unchanged
    const updatedOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .execute();

    expect(updatedOrders[0].payment_status).toEqual('pending'); // Should remain pending
  });

  it('should save payment updates to database', async () => {
    const { payment } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'paid',
      gateway_reference: 'db-test-ref',
      paid_at: new Date('2024-01-15T10:30:00Z')
    };

    await updatePaymentStatus(input);

    // Query database directly to verify changes
    const updatedPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, payment.id))
      .execute();

    expect(updatedPayments).toHaveLength(1);
    expect(updatedPayments[0].status).toEqual('paid');
    expect(updatedPayments[0].gateway_reference).toEqual('db-test-ref');
    expect(updatedPayments[0].paid_at).toEqual(new Date('2024-01-15T10:30:00Z'));
    expect(updatedPayments[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent payment', async () => {
    const input: UpdatePaymentStatusInput = {
      id: 99999, // Non-existent payment ID
      status: 'paid',
      gateway_reference: 'test-ref',
      paid_at: new Date()
    };

    await expect(updatePaymentStatus(input)).rejects.toThrow(/payment not found/i);
  });

  it('should handle partial updates with only status change', async () => {
    const { payment } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'expired',
      gateway_reference: null,
      paid_at: null
    };

    const result = await updatePaymentStatus(input);

    expect(result.status).toEqual('expired');
    expect(result.gateway_reference).toBeNull();
    expect(result.paid_at).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);

    // Original fields should remain unchanged
    expect(result.order_id).toEqual(payment.order_id);
    expect(result.payment_gateway).toEqual(payment.payment_gateway);
    expect(result.qr_code_data).toEqual(payment.qr_code_data);
    expect(parseFloat(result.amount.toString())).toEqual(19.99);
  });

  it('should handle update with gateway reference but no paid_at', async () => {
    const { payment } = await createTestData();

    const input: UpdatePaymentStatusInput = {
      id: payment.id,
      status: 'failed',
      gateway_reference: 'failure-ref-123',
      paid_at: null
    };

    const result = await updatePaymentStatus(input);

    expect(result.status).toEqual('failed');
    expect(result.gateway_reference).toEqual('failure-ref-123');
    expect(result.paid_at).toBeNull();
  });
});