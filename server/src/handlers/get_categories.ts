import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type Category } from '../schema';

export const getCategories = async (): Promise<Category[]> => {
  try {
    // Fetch all categories from the database
    const results = await db.select()
      .from(categoriesTable)
      .execute();

    // Return the categories as-is (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
};