import { db } from '../db';
import { cartItemsTable } from '../db/schema';
import { type GetCartInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function clearCart(input: GetCartInput): Promise<boolean> {
  try {
    // Delete all cart items for the given session_id
    const result = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.session_id, input.session_id))
      .execute();

    // Return true regardless of how many items were deleted
    // (clearing an empty cart is still a successful operation)
    return true;
  } catch (error) {
    console.error('Cart clearing failed:', error);
    throw error;
  }
}