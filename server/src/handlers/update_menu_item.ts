import { db } from '../db';
import { menuItemsTable } from '../db/schema';
import { type UpdateMenuItemInput, type MenuItem } from '../schema';
import { eq } from 'drizzle-orm';

export const updateMenuItem = async (input: UpdateMenuItemInput): Promise<MenuItem> => {
  try {
    // Build the update object with only provided fields
    const updateData: Partial<{
      name: string;
      description: string | null;
      price: string;
      category_id: number;
      image_url: string | null;
      is_available: boolean;
    }> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.price !== undefined) {
      updateData.price = input.price.toString(); // Convert number to string for numeric column
    }
    if (input.category_id !== undefined) {
      updateData.category_id = input.category_id;
    }
    if (input.image_url !== undefined) {
      updateData.image_url = input.image_url;
    }
    if (input.is_available !== undefined) {
      updateData.is_available = input.is_available;
    }

    // Update the menu item
    const result = await db.update(menuItemsTable)
      .set(updateData)
      .where(eq(menuItemsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Menu item not found');
    }

    // Convert numeric fields back to numbers before returning
    const menuItem = result[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Menu item update failed:', error);
    throw error;
  }
};