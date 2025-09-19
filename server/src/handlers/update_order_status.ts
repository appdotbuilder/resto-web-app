import { db } from '../db';
import { ordersTable } from '../db/schema';
import { type UpdateOrderStatusInput, type Order } from '../schema';
import { eq } from 'drizzle-orm';

export const updateOrderStatus = async (input: UpdateOrderStatusInput): Promise<Order> => {
  try {
    // First, verify the order exists
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.id))
      .execute();

    if (existingOrders.length === 0) {
      throw new Error(`Order with id ${input.id} not found`);
    }

    // Update the order status and updated_at timestamp
    const result = await db.update(ordersTable)
      .set({
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const order = result[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Order status update failed:', error);
    throw error;
  }
};