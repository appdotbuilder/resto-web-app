import { db } from '../db';
import { menuItemsTable, categoriesTable } from '../db/schema';
import { type MenuFilterInput, type MenuItemWithCategory } from '../schema';
import { eq, and, gte, lte, ilike, or, type SQL } from 'drizzle-orm';

export async function getMenuItems(filter?: MenuFilterInput): Promise<MenuItemWithCategory[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Apply filters if provided
    if (filter) {
      // Filter by category
      if (filter.category_id !== undefined) {
        conditions.push(eq(menuItemsTable.category_id, filter.category_id));
      }

      // Search in name or description
      if (filter.search) {
        const searchTerm = `%${filter.search}%`;
        const nameSearch = ilike(menuItemsTable.name, searchTerm);
        const descSearch = ilike(menuItemsTable.description, searchTerm);
        conditions.push(or(nameSearch, descSearch)!);
      }

      // Price range filters
      if (filter.min_price !== undefined) {
        conditions.push(gte(menuItemsTable.price, filter.min_price.toString()));
      }

      if (filter.max_price !== undefined) {
        conditions.push(lte(menuItemsTable.price, filter.max_price.toString()));
      }

      // Available only filter (defaults to true)
      if (filter.available_only) {
        conditions.push(eq(menuItemsTable.is_available, true));
      }
    } else {
      // If no filter provided, default to showing only available items
      conditions.push(eq(menuItemsTable.is_available, true));
    }

    // Build the final where condition
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Execute query with join
    const results = await db.select()
      .from(menuItemsTable)
      .innerJoin(categoriesTable, eq(menuItemsTable.category_id, categoriesTable.id))
      .where(whereCondition)
      .execute();

    // Transform results to match MenuItemWithCategory schema
    return results.map(result => ({
      id: result.menu_items.id,
      name: result.menu_items.name,
      description: result.menu_items.description,
      price: parseFloat(result.menu_items.price), // Convert numeric to number
      category_id: result.menu_items.category_id,
      image_url: result.menu_items.image_url,
      is_available: result.menu_items.is_available,
      created_at: result.menu_items.created_at,
      category: {
        id: result.categories.id,
        name: result.categories.name,
        description: result.categories.description,
        created_at: result.categories.created_at
      }
    }));
  } catch (error) {
    console.error('Failed to fetch menu items:', error);
    throw error;
  }
}