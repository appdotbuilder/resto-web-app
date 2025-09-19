import { db } from '../db';
import { cartItemsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function removeFromCart(cartItemId: number): Promise<boolean> {
  try {
    // Delete the cart item by ID
    const result = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();

    // Check if any rows were affected (item was found and deleted)
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
}