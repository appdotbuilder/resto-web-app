import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable } from '../db/schema';
import { type CreateMenuItemInput } from '../schema';
import { createMenuItem } from '../handlers/create_menu_item';
import { eq } from 'drizzle-orm';

describe('createMenuItem', () => {
  let testCategoryId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test category first (required for foreign key)
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();
    
    testCategoryId = categoryResult[0].id;
  });

  afterEach(resetDB);

  it('should create a menu item with all fields', async () => {
    const testInput: CreateMenuItemInput = {
      name: 'Test Menu Item',
      description: 'A delicious test item',
      price: 12.99,
      category_id: testCategoryId,
      image_url: 'https://example.com/image.jpg',
      is_available: true
    };

    const result = await createMenuItem(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Menu Item');
    expect(result.description).toEqual('A delicious test item');
    expect(result.price).toEqual(12.99);
    expect(typeof result.price).toEqual('number');
    expect(result.category_id).toEqual(testCategoryId);
    expect(result.image_url).toEqual('https://example.com/image.jpg');
    expect(result.is_available).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a menu item with nullable fields', async () => {
    const testInput: CreateMenuItemInput = {
      name: 'Simple Item',
      description: null,
      price: 5.50,
      category_id: testCategoryId,
      image_url: null,
      is_available: true
    };

    const result = await createMenuItem(testInput);

    expect(result.name).toEqual('Simple Item');
    expect(result.description).toBeNull();
    expect(result.price).toEqual(5.50);
    expect(result.category_id).toEqual(testCategoryId);
    expect(result.image_url).toBeNull();
    expect(result.is_available).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a menu item with default availability', async () => {
    const testInput: CreateMenuItemInput = {
      name: 'Default Item',
      description: 'Item with default availability',
      price: 8.75,
      category_id: testCategoryId,
      image_url: null,
      is_available: true // This will be the default from Zod
    };

    const result = await createMenuItem(testInput);

    expect(result.name).toEqual('Default Item');
    expect(result.is_available).toEqual(true);
    expect(result.price).toEqual(8.75);
    expect(typeof result.price).toEqual('number');
  });

  it('should save menu item to database', async () => {
    const testInput: CreateMenuItemInput = {
      name: 'DB Test Item',
      description: 'Testing database persistence',
      price: 15.25,
      category_id: testCategoryId,
      image_url: 'https://example.com/test.png',
      is_available: false
    };

    const result = await createMenuItem(testInput);

    // Query the database to verify the item was saved
    const menuItems = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, result.id))
      .execute();

    expect(menuItems).toHaveLength(1);
    const savedItem = menuItems[0];
    
    expect(savedItem.name).toEqual('DB Test Item');
    expect(savedItem.description).toEqual('Testing database persistence');
    expect(parseFloat(savedItem.price)).toEqual(15.25); // Database stores as string
    expect(savedItem.category_id).toEqual(testCategoryId);
    expect(savedItem.image_url).toEqual('https://example.com/test.png');
    expect(savedItem.is_available).toEqual(false);
    expect(savedItem.created_at).toBeInstanceOf(Date);
  });

  it('should handle decimal prices correctly', async () => {
    const testInput: CreateMenuItemInput = {
      name: 'Decimal Price Item',
      description: 'Testing decimal price handling',
      price: 9.95,
      category_id: testCategoryId,
      image_url: null,
      is_available: true
    };

    const result = await createMenuItem(testInput);

    expect(result.price).toEqual(9.95);
    expect(typeof result.price).toEqual('number');

    // Verify in database
    const menuItems = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, result.id))
      .execute();

    expect(parseFloat(menuItems[0].price)).toEqual(9.95);
  });

  it('should throw error for invalid category_id', async () => {
    const testInput: CreateMenuItemInput = {
      name: 'Invalid Category Item',
      description: 'This should fail',
      price: 10.00,
      category_id: 999999, // Non-existent category
      image_url: null,
      is_available: true
    };

    await expect(createMenuItem(testInput)).rejects.toThrow(/foreign key/i);
  });
});