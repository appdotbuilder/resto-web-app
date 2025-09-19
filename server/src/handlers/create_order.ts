import { db } from '../db';
import { cartItemsTable, ordersTable, orderItemsTable, menuItemsTable } from '../db/schema';
import { type CreateOrderInput, type OrderWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export async function createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
  try {
    // 1. Fetch all cart items for the session with menu item details
    const cartItems = await db.select()
      .from(cartItemsTable)
      .innerJoin(menuItemsTable, eq(cartItemsTable.menu_item_id, menuItemsTable.id))
      .where(eq(cartItemsTable.session_id, input.session_id))
      .execute();

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // 2. Calculate total amount
    let totalAmount = 0;
    for (const item of cartItems) {
      const price = parseFloat(item.menu_items.price);
      totalAmount += price * item.cart_items.quantity;
    }

    // 3. Create order record
    const orderResult = await db.insert(ordersTable)
      .values({
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_email: input.customer_email,
        total_amount: totalAmount.toString(),
        notes: input.notes
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // 4. Create order items from cart items
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.cart_items.menu_item_id,
      quantity: item.cart_items.quantity,
      price_at_time: item.menu_items.price // Keep as string for insertion
    }));

    const orderItemResults = await db.insert(orderItemsTable)
      .values(orderItemsData)
      .returning()
      .execute();

    // 5. Clear the cart
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.session_id, input.session_id))
      .execute();

    // 6. Return the created order with items (fetch with menu item details)
    const orderWithItemsResult = await db.select()
      .from(orderItemsTable)
      .innerJoin(menuItemsTable, eq(orderItemsTable.menu_item_id, menuItemsTable.id))
      .where(eq(orderItemsTable.order_id, order.id))
      .execute();

    const items = orderWithItemsResult.map(result => ({
      id: result.order_items.id,
      order_id: result.order_items.order_id,
      menu_item_id: result.order_items.menu_item_id,
      quantity: result.order_items.quantity,
      price_at_time: parseFloat(result.order_items.price_at_time),
      created_at: result.order_items.created_at,
      menu_item: {
        id: result.menu_items.id,
        name: result.menu_items.name,
        description: result.menu_items.description,
        price: parseFloat(result.menu_items.price),
        category_id: result.menu_items.category_id,
        image_url: result.menu_items.image_url,
        is_available: result.menu_items.is_available,
        created_at: result.menu_items.created_at
      }
    }));

    return {
      id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      total_amount: parseFloat(order.total_amount),
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      payment_reference: order.payment_reference,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: items
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}