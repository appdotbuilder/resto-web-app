import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable, ordersTable, paymentsTable } from '../db/schema';
import { type CreatePaymentInput } from '../schema';
import { createPayment } from '../handlers/create_payment';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Main Dishes',
  description: 'Primary menu items'
};

const testMenuItem = {
  name: 'Burger',
  description: 'Delicious burger',
  price: '15.99',
  category_id: 1,
  image_url: null,
  is_available: true
};

const testOrder = {
  customer_name: 'John Doe',
  customer_phone: '+1234567890',
  customer_email: 'john@example.com',
  total_amount: '15.99',
  status: 'pending' as const,
  payment_status: 'pending' as const,
  payment_method: null,
  payment_reference: null,
  notes: 'Test order'
};

const testPaymentInput: CreatePaymentInput = {
  order_id: 1,
  payment_gateway: 'stripe',
  amount: 15.99
};

describe('createPayment', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite data
    await db.insert(categoriesTable).values(testCategory).execute();
    await db.insert(menuItemsTable).values(testMenuItem).execute();
    await db.insert(ordersTable).values(testOrder).execute();
  });

  afterEach(resetDB);

  it('should create a payment for valid order', async () => {
    const result = await createPayment(testPaymentInput);

    // Basic field validation
    expect(result.order_id).toEqual(1);
    expect(result.payment_gateway).toEqual('stripe');
    expect(result.amount).toEqual(15.99);
    expect(typeof result.amount).toEqual('number');
    expect(result.status).toEqual('pending');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // QR code data should be generated
    expect(result.qr_code_data).toMatch(/^payment_stripe_1_\d+$/);
    expect(result.qr_code_url).toBeNull();
    expect(result.gateway_reference).toBeNull();
    expect(result.paid_at).toBeNull();

    // Expiration should be set (15 minutes from now)
    expect(result.expires_at).toBeInstanceOf(Date);
    const expirationTime = result.expires_at!.getTime() - new Date().getTime();
    expect(expirationTime).toBeGreaterThan(14 * 60 * 1000); // At least 14 minutes
    expect(expirationTime).toBeLessThan(16 * 60 * 1000); // At most 16 minutes
  });

  it('should save payment to database', async () => {
    const result = await createPayment(testPaymentInput);

    // Query payment from database
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, result.id))
      .execute();

    expect(payments).toHaveLength(1);
    const payment = payments[0];
    expect(payment.order_id).toEqual(1);
    expect(payment.payment_gateway).toEqual('stripe');
    expect(parseFloat(payment.amount)).toEqual(15.99);
    expect(payment.status).toEqual('pending');
    expect(payment.qr_code_data).toMatch(/^payment_stripe_1_\d+$/);
    expect(payment.expires_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent order', async () => {
    const invalidInput: CreatePaymentInput = {
      order_id: 999,
      payment_gateway: 'stripe',
      amount: 15.99
    };

    await expect(createPayment(invalidInput)).rejects.toThrow(/Order with id 999 not found/i);
  });

  it('should throw error for cancelled order', async () => {
    // Update order status to cancelled
    await db.update(ordersTable)
      .set({ status: 'cancelled' })
      .where(eq(ordersTable.id, 1))
      .execute();

    await expect(createPayment(testPaymentInput)).rejects.toThrow(/Cannot create payment for order with status: cancelled/i);
  });

  it('should throw error for completed order', async () => {
    // Update order status to completed
    await db.update(ordersTable)
      .set({ status: 'completed' })
      .where(eq(ordersTable.id, 1))
      .execute();

    await expect(createPayment(testPaymentInput)).rejects.toThrow(/Cannot create payment for order with status: completed/i);
  });

  it('should throw error for already paid order', async () => {
    // Update payment status to paid
    await db.update(ordersTable)
      .set({ payment_status: 'paid' })
      .where(eq(ordersTable.id, 1))
      .execute();

    await expect(createPayment(testPaymentInput)).rejects.toThrow(/Order has already been paid/i);
  });

  it('should allow payment for preparing order', async () => {
    // Update order status to preparing (should still allow payment)
    await db.update(ordersTable)
      .set({ status: 'preparing' })
      .where(eq(ordersTable.id, 1))
      .execute();

    const result = await createPayment(testPaymentInput);

    expect(result.order_id).toEqual(1);
    expect(result.status).toEqual('pending');
  });

  it('should generate unique QR code data for different payments', async () => {
    // Create first payment
    const firstResult = await createPayment(testPaymentInput);

    // Create second order for another payment
    const secondOrder = {
      ...testOrder,
      customer_name: 'Jane Doe'
    };
    const orderResult = await db.insert(ordersTable).values(secondOrder).returning().execute();
    const secondOrderId = orderResult[0].id;

    const secondPaymentInput: CreatePaymentInput = {
      order_id: secondOrderId,
      payment_gateway: 'paypal',
      amount: 25.99
    };

    // Create second payment
    const secondResult = await createPayment(secondPaymentInput);

    // QR codes should be different
    expect(firstResult.qr_code_data).not.toEqual(secondResult.qr_code_data);
    expect(firstResult.qr_code_data).toMatch(/^payment_stripe_1_\d+$/);
    expect(secondResult.qr_code_data).toMatch(/^payment_paypal_\d+_\d+$/);
  });

  it('should handle different payment gateways', async () => {
    const paypalInput: CreatePaymentInput = {
      order_id: 1,
      payment_gateway: 'paypal',
      amount: 15.99
    };

    const result = await createPayment(paypalInput);

    expect(result.payment_gateway).toEqual('paypal');
    expect(result.qr_code_data).toMatch(/^payment_paypal_1_\d+$/);
  });

  it('should handle different amounts correctly', async () => {
    const highAmountInput: CreatePaymentInput = {
      order_id: 1,
      payment_gateway: 'stripe',
      amount: 99.99
    };

    const result = await createPayment(highAmountInput);

    expect(result.amount).toEqual(99.99);
    expect(typeof result.amount).toEqual('number');

    // Verify in database
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, result.id))
      .execute();

    expect(parseFloat(payments[0].amount)).toEqual(99.99);
  });
});