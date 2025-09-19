import { db } from '../db';
import { cartItemsTable, menuItemsTable } from '../db/schema';
import { type AddToCartInput, type CartItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function addToCart(input: AddToCartInput): Promise<CartItem> {
  try {
    // First verify that the menu item exists and is available
    const menuItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, input.menu_item_id))
      .execute();

    if (menuItem.length === 0) {
      throw new Error(`Menu item with id ${input.menu_item_id} not found`);
    }

    if (!menuItem[0].is_available) {
      throw new Error(`Menu item with id ${input.menu_item_id} is not available`);
    }

    // Check if the item already exists in the cart for this session
    const existingCartItems = await db.select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.session_id, input.session_id),
          eq(cartItemsTable.menu_item_id, input.menu_item_id)
        )
      )
      .execute();

    if (existingCartItems.length > 0) {
      // Update existing cart item quantity
      const existingItem = existingCartItems[0];
      const newQuantity = existingItem.quantity + input.quantity;

      const updatedItems = await db.update(cartItemsTable)
        .set({ quantity: newQuantity })
        .where(eq(cartItemsTable.id, existingItem.id))
        .returning()
        .execute();

      return updatedItems[0];
    } else {
      // Create new cart item
      const newCartItems = await db.insert(cartItemsTable)
        .values({
          session_id: input.session_id,
          menu_item_id: input.menu_item_id,
          quantity: input.quantity
        })
        .returning()
        .execute();

      return newCartItems[0];
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
}