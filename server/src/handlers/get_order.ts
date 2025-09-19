import { db } from '../db';
import { ordersTable, orderItemsTable, menuItemsTable } from '../db/schema';
import { type OrderWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export async function getOrder(orderId: number): Promise<OrderWithItems | null> {
  try {
    // First, get the order
    const orderResult = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (orderResult.length === 0) {
      return null;
    }

    const order = orderResult[0];

    // Get order items with their menu item details
    const orderItemsResult = await db.select()
      .from(orderItemsTable)
      .innerJoin(menuItemsTable, eq(orderItemsTable.menu_item_id, menuItemsTable.id))
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    // Transform the joined results into the expected format
    const items = orderItemsResult.map(result => ({
      ...result.order_items,
      price_at_time: parseFloat(result.order_items.price_at_time), // Convert numeric to number
      menu_item: {
        ...result.menu_items,
        price: parseFloat(result.menu_items.price) // Convert numeric to number
      }
    }));

    // Return the complete order with items
    return {
      ...order,
      total_amount: parseFloat(order.total_amount), // Convert numeric to number
      items
    };
  } catch (error) {
    console.error('Get order failed:', error);
    throw error;
  }
}