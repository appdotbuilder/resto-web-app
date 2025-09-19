import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable } from '../db/schema';
import { type UpdateMenuItemInput, type CreateCategoryInput } from '../schema';
import { updateMenuItem } from '../handlers/update_menu_item';
import { eq } from 'drizzle-orm';

describe('updateMenuItem', () => {
  let testCategoryId: number;
  let testMenuItemId: number;

  beforeEach(async () => {
    await createDB();

    // Create a test category first
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();

    testCategoryId = categoryResult[0].id;

    // Create a test menu item
    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        name: 'Original Item',
        description: 'Original description',
        price: '15.99',
        category_id: testCategoryId,
        image_url: 'https://example.com/original.jpg',
        is_available: true
      })
      .returning()
      .execute();

    testMenuItemId = menuItemResult[0].id;
  });

  afterEach(resetDB);

  it('should update all fields of a menu item', async () => {
    const updateInput: UpdateMenuItemInput = {
      id: testMenuItemId,
      name: 'Updated Item',
      description: 'Updated description',
      price: 25.99,
      category_id: testCategoryId,
      image_url: 'https://example.com/updated.jpg',
      is_available: false
    };

    const result = await updateMenuItem(updateInput);

    expect(result.id).toEqual(testMenuItemId);
    expect(result.name).toEqual('Updated Item');
    expect(result.description).toEqual('Updated description');
    expect(result.price).toEqual(25.99);
    expect(typeof result.price).toBe('number');
    expect(result.category_id).toEqual(testCategoryId);
    expect(result.image_url).toEqual('https://example.com/updated.jpg');
    expect(result.is_available).toBe(false);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update only specific fields and leave others unchanged', async () => {
    const updateInput: UpdateMenuItemInput = {
      id: testMenuItemId,
      name: 'Partially Updated',
      price: 19.99
    };

    const result = await updateMenuItem(updateInput);

    expect(result.id).toEqual(testMenuItemId);
    expect(result.name).toEqual('Partially Updated');
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.price).toEqual(19.99);
    expect(typeof result.price).toBe('number');
    expect(result.category_id).toEqual(testCategoryId); // Unchanged
    expect(result.image_url).toEqual('https://example.com/original.jpg'); // Unchanged
    expect(result.is_available).toBe(true); // Unchanged
  });

  it('should update nullable fields to null', async () => {
    const updateInput: UpdateMenuItemInput = {
      id: testMenuItemId,
      description: null,
      image_url: null
    };

    const result = await updateMenuItem(updateInput);

    expect(result.id).toEqual(testMenuItemId);
    expect(result.name).toEqual('Original Item'); // Unchanged
    expect(result.description).toBeNull();
    expect(result.price).toEqual(15.99); // Unchanged
    expect(result.category_id).toEqual(testCategoryId); // Unchanged
    expect(result.image_url).toBeNull();
    expect(result.is_available).toBe(true); // Unchanged
  });

  it('should save updated item to database', async () => {
    const updateInput: UpdateMenuItemInput = {
      id: testMenuItemId,
      name: 'Database Updated',
      price: 29.99,
      is_available: false
    };

    await updateMenuItem(updateInput);

    // Query the database to verify changes were persisted
    const items = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, testMenuItemId))
      .execute();

    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.name).toEqual('Database Updated');
    expect(parseFloat(item.price)).toEqual(29.99);
    expect(item.is_available).toBe(false);
    expect(item.description).toEqual('Original description'); // Unchanged
    expect(item.category_id).toEqual(testCategoryId); // Unchanged
  });

  it('should throw error when menu item does not exist', async () => {
    const updateInput: UpdateMenuItemInput = {
      id: 99999, // Non-existent ID
      name: 'Non-existent Item'
    };

    await expect(updateMenuItem(updateInput))
      .rejects
      .toThrow(/menu item not found/i);
  });

  it('should handle foreign key constraint for category_id', async () => {
    const updateInput: UpdateMenuItemInput = {
      id: testMenuItemId,
      category_id: 99999 // Non-existent category ID
    };

    await expect(updateMenuItem(updateInput))
      .rejects
      .toThrow(/violates foreign key constraint|foreign key/i);
  });

  it('should update availability status correctly', async () => {
    // Initially available
    expect((await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, testMenuItemId)).execute())[0].is_available).toBe(true);

    // Update to unavailable
    await updateMenuItem({
      id: testMenuItemId,
      is_available: false
    });

    const unavailableItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, testMenuItemId))
      .execute();

    expect(unavailableItem[0].is_available).toBe(false);

    // Update back to available
    const result = await updateMenuItem({
      id: testMenuItemId,
      is_available: true
    });

    expect(result.is_available).toBe(true);
  });
});