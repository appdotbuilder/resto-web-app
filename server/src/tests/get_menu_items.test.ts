import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, menuItemsTable } from '../db/schema';
import { type MenuFilterInput } from '../schema';
import { getMenuItems } from '../handlers/get_menu_items';

describe('getMenuItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  const createTestData = async () => {
    // Create test categories
    const categories = await db.insert(categoriesTable)
      .values([
        { name: 'Appetizers', description: 'Starter dishes' },
        { name: 'Main Course', description: 'Main dishes' },
        { name: 'Desserts', description: 'Sweet treats' }
      ])
      .returning()
      .execute();

    // Create test menu items
    const menuItems = await db.insert(menuItemsTable)
      .values([
        {
          name: 'Caesar Salad',
          description: 'Fresh lettuce with caesar dressing',
          price: '12.99',
          category_id: categories[0].id,
          is_available: true
        },
        {
          name: 'Grilled Chicken',
          description: 'Juicy grilled chicken breast',
          price: '18.50',
          category_id: categories[1].id,
          is_available: true
        },
        {
          name: 'Chocolate Cake',
          description: 'Rich chocolate dessert',
          price: '8.99',
          category_id: categories[2].id,
          is_available: false // Not available
        },
        {
          name: 'Fish and Chips',
          description: 'Crispy fish with french fries',
          price: '16.75',
          category_id: categories[1].id,
          is_available: true
        },
        {
          name: 'Spring Rolls',
          description: 'Crispy vegetable spring rolls',
          price: '9.25',
          category_id: categories[0].id,
          is_available: true
        }
      ])
      .returning()
      .execute();

    return { categories, menuItems };
  };

  it('should return all available menu items with categories when no filter is provided', async () => {
    await createTestData();

    const results = await getMenuItems();

    // Should return 4 available items (excluding unavailable chocolate cake)
    expect(results).toHaveLength(4);
    
    // Verify structure and data types
    results.forEach(item => {
      expect(item.id).toBeDefined();
      expect(typeof item.name).toBe('string');
      expect(typeof item.price).toBe('number');
      expect(item.is_available).toBe(true);
      expect(item.category).toBeDefined();
      expect(item.category.id).toBeDefined();
      expect(typeof item.category.name).toBe('string');
      expect(item.created_at).toBeInstanceOf(Date);
    });

    // Verify specific items are included
    const itemNames = results.map(item => item.name);
    expect(itemNames).toContain('Caesar Salad');
    expect(itemNames).toContain('Grilled Chicken');
    expect(itemNames).toContain('Fish and Chips');
    expect(itemNames).toContain('Spring Rolls');
    expect(itemNames).not.toContain('Chocolate Cake'); // Not available
  });

  it('should filter by category_id correctly', async () => {
    const { categories } = await createTestData();

    const filter: MenuFilterInput = {
      category_id: categories[0].id, // Appetizers
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(2); // Caesar Salad and Spring Rolls
    results.forEach(item => {
      expect(item.category_id).toBe(categories[0].id);
      expect(item.category.name).toBe('Appetizers');
    });
  });

  it('should search by name correctly', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      search: 'chicken',
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Grilled Chicken');
  });

  it('should search by description correctly', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      search: 'crispy',
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(2); // Fish and Chips, Spring Rolls
    const names = results.map(item => item.name);
    expect(names).toContain('Fish and Chips');
    expect(names).toContain('Spring Rolls');
  });

  it('should filter by minimum price correctly', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      min_price: 15.00,
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(2); // Grilled Chicken (18.50), Fish and Chips (16.75)
    results.forEach(item => {
      expect(item.price).toBeGreaterThanOrEqual(15.00);
    });
  });

  it('should filter by maximum price correctly', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      max_price: 10.00,
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(1); // Spring Rolls (9.25)
    results.forEach(item => {
      expect(item.price).toBeLessThanOrEqual(10.00);
    });
    expect(results[0].name).toBe('Spring Rolls');
  });

  it('should filter by price range correctly', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      min_price: 10.00,
      max_price: 17.00,
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(2); // Caesar Salad (12.99), Fish and Chips (16.75)
    results.forEach(item => {
      expect(item.price).toBeGreaterThanOrEqual(10.00);
      expect(item.price).toBeLessThanOrEqual(17.00);
    });
  });

  it('should show unavailable items when available_only is false', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      available_only: false
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(5); // All items including unavailable ones
    const names = results.map(item => item.name);
    expect(names).toContain('Chocolate Cake'); // Should include unavailable item
  });

  it('should combine multiple filters correctly', async () => {
    const { categories } = await createTestData();

    const filter: MenuFilterInput = {
      category_id: categories[1].id, // Main Course
      min_price: 17.00,
      search: 'chicken',
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Grilled Chicken');
    expect(results[0].price).toBe(18.50);
    expect(results[0].category.name).toBe('Main Course');
  });

  it('should return empty array when no items match filters', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      search: 'nonexistent item',
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(0);
  });

  it('should handle case-insensitive search correctly', async () => {
    await createTestData();

    const filter: MenuFilterInput = {
      search: 'CAESAR',
      available_only: true
    };

    const results = await getMenuItems(filter);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Caesar Salad');
  });

  it('should return correct numeric types for price fields', async () => {
    await createTestData();

    const results = await getMenuItems();

    results.forEach(item => {
      expect(typeof item.price).toBe('number');
      expect(item.price).toBeGreaterThan(0);
    });

    // Verify specific price conversion
    const caesarSalad = results.find(item => item.name === 'Caesar Salad');
    expect(caesarSalad?.price).toBe(12.99);
  });
});