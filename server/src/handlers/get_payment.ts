import { db } from '../db';
import { paymentsTable, ordersTable } from '../db/schema';
import { type PaymentWithOrder } from '../schema';
import { eq } from 'drizzle-orm';

export async function getPayment(paymentId: number): Promise<PaymentWithOrder | null> {
  try {
    // Query payment with joined order data
    const results = await db.select()
      .from(paymentsTable)
      .innerJoin(ordersTable, eq(paymentsTable.order_id, ordersTable.id))
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Extract payment and order data from joined result
    const result = results[0];
    const payment = result.payments;
    const order = result.orders;

    // Convert numeric fields to numbers and construct response
    return {
      id: payment.id,
      order_id: payment.order_id,
      payment_gateway: payment.payment_gateway,
      qr_code_data: payment.qr_code_data,
      qr_code_url: payment.qr_code_url,
      amount: parseFloat(payment.amount), // Convert numeric to number
      status: payment.status,
      gateway_reference: payment.gateway_reference,
      expires_at: payment.expires_at,
      paid_at: payment.paid_at,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
      order: {
        id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        total_amount: parseFloat(order.total_amount), // Convert numeric to number
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        payment_reference: order.payment_reference,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at
      }
    };
  } catch (error) {
    console.error('Payment retrieval failed:', error);
    throw error;
  }
}