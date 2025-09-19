import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded'
]);

export const qrPaymentStatusEnum = pgEnum('qr_payment_status', [
  'pending',
  'paid',
  'failed',
  'expired'
]);

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Menu items table
export const menuItemsTable = pgTable('menu_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  category_id: integer('category_id').references(() => categoriesTable.id).notNull(),
  image_url: text('image_url'), // Nullable by default
  is_available: boolean('is_available').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Cart items table (session-based)
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  session_id: text('session_id').notNull(),
  menu_item_id: integer('menu_item_id').references(() => menuItemsTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  customer_name: text('customer_name').notNull(),
  customer_phone: text('customer_phone'), // Nullable by default
  customer_email: text('customer_email'), // Nullable by default
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').default('pending').notNull(),
  payment_status: paymentStatusEnum('payment_status').default('pending').notNull(),
  payment_method: text('payment_method'), // Nullable by default
  payment_reference: text('payment_reference'), // Nullable by default
  notes: text('notes'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').references(() => ordersTable.id).notNull(),
  menu_item_id: integer('menu_item_id').references(() => menuItemsTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  price_at_time: numeric('price_at_time', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Payments table for QR code payments
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').references(() => ordersTable.id).notNull(),
  payment_gateway: text('payment_gateway').notNull(),
  qr_code_data: text('qr_code_data').notNull(),
  qr_code_url: text('qr_code_url'), // Nullable by default
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: qrPaymentStatusEnum('status').default('pending').notNull(),
  gateway_reference: text('gateway_reference'), // Nullable by default
  expires_at: timestamp('expires_at'), // Nullable by default
  paid_at: timestamp('paid_at'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  menuItems: many(menuItemsTable)
}));

export const menuItemsRelations = relations(menuItemsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [menuItemsTable.category_id],
    references: [categoriesTable.id]
  }),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable)
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  menuItem: one(menuItemsTable, {
    fields: [cartItemsTable.menu_item_id],
    references: [menuItemsTable.id]
  })
}));

export const ordersRelations = relations(ordersTable, ({ many }) => ({
  items: many(orderItemsTable),
  payments: many(paymentsTable)
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id]
  }),
  menuItem: one(menuItemsTable, {
    fields: [orderItemsTable.menu_item_id],
    references: [menuItemsTable.id]
  })
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [paymentsTable.order_id],
    references: [ordersTable.id]
  })
}));

// TypeScript types for the table schemas
export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type MenuItem = typeof menuItemsTable.$inferSelect;
export type NewMenuItem = typeof menuItemsTable.$inferInsert;

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;

export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  categories: categoriesTable,
  menuItems: menuItemsTable,
  cartItems: cartItemsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  payments: paymentsTable
};