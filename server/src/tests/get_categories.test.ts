import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { getCategories } from '../handlers/get_categories';

describe('getCategories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no categories exist', async () => {
    const result = await getCategories();

    expect(result).toEqual([]);
  });

  it('should return all categories from database', async () => {
    // Create test categories
    const testCategories = [
      { name: 'Appetizers', description: 'Starter dishes' },
      { name: 'Main Courses', description: 'Primary meals' },
      { name: 'Desserts', description: null }
    ];

    // Insert test data
    await db.insert(categoriesTable)
      .values(testCategories)
      .execute();

    const result = await getCategories();

    // Should return all categories
    expect(result).toHaveLength(3);
    
    // Verify each category has the correct structure
    result.forEach(category => {
      expect(category.id).toBeDefined();
      expect(typeof category.id).toBe('number');
      expect(typeof category.name).toBe('string');
      expect(category.description === null || typeof category.description === 'string').toBe(true);
      expect(category.created_at).toBeInstanceOf(Date);
    });

    // Verify specific category data
    const appetizers = result.find(c => c.name === 'Appetizers');
    expect(appetizers).toBeDefined();
    expect(appetizers!.description).toBe('Starter dishes');

    const mainCourses = result.find(c => c.name === 'Main Courses');
    expect(mainCourses).toBeDefined();
    expect(mainCourses!.description).toBe('Primary meals');

    const desserts = result.find(c => c.name === 'Desserts');
    expect(desserts).toBeDefined();
    expect(desserts!.description).toBe(null);
  });

  it('should handle categories with null descriptions', async () => {
    // Create categories with null descriptions
    await db.insert(categoriesTable)
      .values([
        { name: 'Beverages', description: null },
        { name: 'Specials', description: null }
      ])
      .execute();

    const result = await getCategories();

    expect(result).toHaveLength(2);
    
    result.forEach(category => {
      expect(category.description).toBe(null);
      expect(category.name).toBeDefined();
      expect(category.id).toBeDefined();
      expect(category.created_at).toBeInstanceOf(Date);
    });
  });

  it('should return categories ordered by database insertion order', async () => {
    // Insert categories in specific order
    const firstCategory = await db.insert(categoriesTable)
      .values({ name: 'First Category', description: 'First' })
      .returning()
      .execute();

    const secondCategory = await db.insert(categoriesTable)
      .values({ name: 'Second Category', description: 'Second' })
      .returning()
      .execute();

    const result = await getCategories();

    expect(result).toHaveLength(2);
    
    // Verify IDs are in insertion order
    expect(result[0].id).toBe(firstCategory[0].id);
    expect(result[1].id).toBe(secondCategory[0].id);
    expect(result[0].name).toBe('First Category');
    expect(result[1].name).toBe('Second Category');
  });

  it('should handle large number of categories', async () => {
    // Create many categories
    const manyCategories = Array.from({ length: 50 }, (_, i) => ({
      name: `Category ${i + 1}`,
      description: i % 2 === 0 ? `Description ${i + 1}` : null
    }));

    await db.insert(categoriesTable)
      .values(manyCategories)
      .execute();

    const result = await getCategories();

    expect(result).toHaveLength(50);
    
    // Verify all categories are properly structured
    result.forEach((category, index) => {
      expect(category.name).toBe(`Category ${index + 1}`);
      expect(category.id).toBeDefined();
      expect(category.created_at).toBeInstanceOf(Date);
      
      // Check alternating description pattern
      if (index % 2 === 0) {
        expect(category.description).toBe(`Description ${index + 1}`);
      } else {
        expect(category.description).toBe(null);
      }
    });
  });
});