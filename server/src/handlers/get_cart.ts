import { db } from '../db';
import { cartItemsTable, menuItemsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type GetCartInput, type CartItemWithMenuItem } from '../schema';

export const getCart = async (input: GetCartInput): Promise<CartItemWithMenuItem[]> => {
  try {
    // Query cart items with joined menu item details
    const results = await db.select()
      .from(cartItemsTable)
      .innerJoin(menuItemsTable, eq(cartItemsTable.menu_item_id, menuItemsTable.id))
      .where(eq(cartItemsTable.session_id, input.session_id))
      .execute();

    // Transform the joined results to match the expected schema
    return results.map(result => ({
      id: result.cart_items.id,
      session_id: result.cart_items.session_id,
      menu_item_id: result.cart_items.menu_item_id,
      quantity: result.cart_items.quantity,
      created_at: result.cart_items.created_at,
      menu_item: {
        id: result.menu_items.id,
        name: result.menu_items.name,
        description: result.menu_items.description,
        price: parseFloat(result.menu_items.price), // Convert numeric to number
        category_id: result.menu_items.category_id,
        image_url: result.menu_items.image_url,
        is_available: result.menu_items.is_available,
        created_at: result.menu_items.created_at
      }
    }));
  } catch (error) {
    console.error('Get cart failed:', error);
    throw error;
  }
};