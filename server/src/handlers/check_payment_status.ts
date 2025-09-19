import { db } from '../db';
import { paymentsTable } from '../db/schema';
import { type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export async function checkPaymentStatus(paymentId: number): Promise<Payment | null> {
  try {
    // 1. Fetch payment record from database
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (payments.length === 0) {
      return null;
    }

    const payment = payments[0];

    // 2. Query payment gateway for current status (simulated)
    // In a real implementation, this would make an API call to the payment gateway
    // For now, we'll simulate checking if payment has expired or been paid
    const currentGatewayStatus = await simulateGatewayStatusCheck(payment);

    // 3. Update local payment record if status changed
    let updatedPayment = payment;
    if (currentGatewayStatus !== payment.status) {
      const updateValues: any = {
        status: currentGatewayStatus,
        updated_at: new Date()
      };

      // Set paid_at timestamp when payment becomes paid
      if (currentGatewayStatus === 'paid' && payment.status !== 'paid') {
        updateValues.paid_at = new Date();
      }

      const updatedRecords = await db.update(paymentsTable)
        .set(updateValues)
        .where(eq(paymentsTable.id, paymentId))
        .returning()
        .execute();

      updatedPayment = updatedRecords[0];
    }

    // 4. Return updated payment information with proper numeric conversions
    return {
      ...updatedPayment,
      amount: parseFloat(updatedPayment.amount) // Convert numeric field back to number
    };
  } catch (error) {
    console.error('Payment status check failed:', error);
    throw error;
  }
}

// Simulates checking payment status with an external gateway
async function simulateGatewayStatusCheck(payment: any): Promise<'pending' | 'paid' | 'failed' | 'expired'> {
  // Check if payment has expired
  if (payment.expires_at && new Date() > payment.expires_at) {
    return 'expired';
  }

  // Simulate random status updates for demonstration
  // In real implementation, this would be an API call to the payment gateway
  const randomOutcome = Math.random();
  
  // If already paid or failed, don't change status
  if (payment.status === 'paid' || payment.status === 'failed' || payment.status === 'expired') {
    return payment.status;
  }

  // Simulate payment completion (30% chance) or keep as pending
  if (randomOutcome < 0.3) {
    return 'paid';
  } else if (randomOutcome < 0.05) {
    return 'failed';
  }

  return payment.status;
}