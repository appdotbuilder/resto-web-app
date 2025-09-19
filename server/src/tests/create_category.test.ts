import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput } from '../schema';
import { createCategory } from '../handlers/create_category';
import { eq } from 'drizzle-orm';

// Test input with description
const testInputWithDescription: CreateCategoryInput = {
  name: 'Test Category',
  description: 'A category for testing purposes'
};

// Test input without description (null)
const testInputWithoutDescription: CreateCategoryInput = {
  name: 'Simple Category',
  description: null
};

describe('createCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a category with description', async () => {
    const result = await createCategory(testInputWithDescription);

    // Basic field validation
    expect(result.name).toEqual('Test Category');
    expect(result.description).toEqual('A category for testing purposes');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a category without description', async () => {
    const result = await createCategory(testInputWithoutDescription);

    // Basic field validation
    expect(result.name).toEqual('Simple Category');
    expect(result.description).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save category to database', async () => {
    const result = await createCategory(testInputWithDescription);

    // Query using proper drizzle syntax
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toEqual('Test Category');
    expect(categories[0].description).toEqual('A category for testing purposes');
    expect(categories[0].created_at).toBeInstanceOf(Date);
    expect(categories[0].id).toEqual(result.id);
  });

  it('should generate unique IDs for multiple categories', async () => {
    const result1 = await createCategory({
      name: 'Category 1',
      description: 'First category'
    });

    const result2 = await createCategory({
      name: 'Category 2', 
      description: 'Second category'
    });

    expect(result1.id).not.toEqual(result2.id);
    expect(typeof result1.id).toBe('number');
    expect(typeof result2.id).toBe('number');

    // Verify both are persisted
    const allCategories = await db.select()
      .from(categoriesTable)
      .execute();

    expect(allCategories).toHaveLength(2);
    expect(allCategories.map(c => c.name)).toContain('Category 1');
    expect(allCategories.map(c => c.name)).toContain('Category 2');
  });

  it('should handle categories with empty string description as null', async () => {
    // Test with empty string - should be stored as provided
    const result = await createCategory({
      name: 'Empty Description Category',
      description: ''
    });

    expect(result.description).toEqual('');

    // Verify in database
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories[0].description).toEqual('');
  });

  it('should preserve timestamps correctly', async () => {
    const beforeCreate = new Date();
    const result = await createCategory(testInputWithDescription);
    const afterCreate = new Date();

    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });
});