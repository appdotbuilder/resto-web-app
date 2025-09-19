import { db } from '../db';
import { ordersTable, paymentsTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export const createPayment = async (input: CreatePaymentInput): Promise<Payment> => {
  try {
    // 1. Validate that the order exists and is payable
    const existingOrder = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.order_id))
      .execute();

    if (existingOrder.length === 0) {
      throw new Error(`Order with id ${input.order_id} not found`);
    }

    const order = existingOrder[0];

    // Check if order is in a payable state
    if (order.status === 'cancelled' || order.status === 'completed') {
      throw new Error(`Cannot create payment for order with status: ${order.status}`);
    }

    // Check if payment is already completed
    if (order.payment_status === 'paid') {
      throw new Error('Order has already been paid');
    }

    // 2. Generate QR code data (simulate payment gateway integration)
    const qrCodeData = `payment_${input.payment_gateway}_${input.order_id}_${Date.now()}`;
    
    // 3. Set expiration time for the payment (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 4. Create payment record with QR code information
    const result = await db.insert(paymentsTable)
      .values({
        order_id: input.order_id,
        payment_gateway: input.payment_gateway,
        qr_code_data: qrCodeData,
        qr_code_url: null,
        amount: input.amount.toString(), // Convert number to string for numeric column
        status: 'pending',
        gateway_reference: null,
        expires_at: expiresAt,
        paid_at: null
      })
      .returning()
      .execute();

    // 5. Return payment details with numeric conversion
    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
};