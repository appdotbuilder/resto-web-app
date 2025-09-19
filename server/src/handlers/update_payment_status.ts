import { db } from '../db';
import { paymentsTable, ordersTable } from '../db/schema';
import { type UpdatePaymentStatusInput, type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export const updatePaymentStatus = async (input: UpdatePaymentStatusInput): Promise<Payment> => {
  try {
    // First, validate that the payment exists
    const existingPayment = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, input.id))
      .execute();

    if (existingPayment.length === 0) {
      throw new Error('Payment not found');
    }

    // Update the payment status with new values
    const updateValues: any = {
      status: input.status,
      updated_at: new Date()
    };

    // Add gateway_reference if provided
    if (input.gateway_reference !== undefined) {
      updateValues.gateway_reference = input.gateway_reference;
    }

    // Add paid_at if provided
    if (input.paid_at !== undefined) {
      updateValues.paid_at = input.paid_at;
    }

    const updatedPayments = await db.update(paymentsTable)
      .set(updateValues)
      .where(eq(paymentsTable.id, input.id))
      .returning()
      .execute();

    const updatedPayment = updatedPayments[0];

    // If payment status is 'paid', also update the associated order's payment_status
    if (input.status === 'paid') {
      await db.update(ordersTable)
        .set({ 
          payment_status: 'paid',
          updated_at: new Date()
        })
        .where(eq(ordersTable.id, updatedPayment.order_id))
        .execute();
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedPayment,
      amount: parseFloat(updatedPayment.amount)
    };
  } catch (error) {
    console.error('Payment status update failed:', error);
    throw error;
  }
};