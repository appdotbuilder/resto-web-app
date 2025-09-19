import { db } from '../db';
import { ordersTable, orderItemsTable, menuItemsTable } from '../db/schema';
import { type OrderWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export async function getOrders(): Promise<OrderWithItems[]> {
  try {
    // First, get all orders with basic order data
    const orders = await db.select()
      .from(ordersTable)
      .orderBy(ordersTable.created_at)
      .execute();

    // For each order, get its items with menu item details
    const ordersWithItems: OrderWithItems[] = [];

    for (const order of orders) {
      // Get order items with menu item details for this order
      const orderItems = await db.select()
        .from(orderItemsTable)
        .innerJoin(menuItemsTable, eq(orderItemsTable.menu_item_id, menuItemsTable.id))
        .where(eq(orderItemsTable.order_id, order.id))
        .execute();

      // Transform the order with items
      const orderWithItems: OrderWithItems = {
        ...order,
        total_amount: parseFloat(order.total_amount), // Convert numeric to number
        items: orderItems.map(result => ({
          id: result.order_items.id,
          order_id: result.order_items.order_id,
          menu_item_id: result.order_items.menu_item_id,
          quantity: result.order_items.quantity,
          price_at_time: parseFloat(result.order_items.price_at_time), // Convert numeric to number
          created_at: result.order_items.created_at,
          menu_item: {
            ...result.menu_items,
            price: parseFloat(result.menu_items.price), // Convert numeric to number
          }
        }))
      };

      ordersWithItems.push(orderWithItems);
    }

    return ordersWithItems;
  } catch (error) {
    console.error('Get orders failed:', error);
    throw error;
  }
}