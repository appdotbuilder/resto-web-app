import { z } from 'zod';

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Menu item schema
export const menuItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  category_id: z.number(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  created_at: z.coerce.date()
});

export type MenuItem = z.infer<typeof menuItemSchema>;

// Cart item schema
export const cartItemSchema = z.object({
  id: z.number(),
  session_id: z.string(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  created_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Order status enum
export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled'
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  customer_name: z.string(),
  customer_phone: z.string().nullable(),
  customer_email: z.string().nullable(),
  total_amount: z.number(),
  status: orderStatusSchema,
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']),
  payment_method: z.string().nullable(),
  payment_reference: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order item schema
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  price_at_time: z.number(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Payment schema for QR code payments
export const paymentSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  payment_gateway: z.string(),
  qr_code_data: z.string(),
  qr_code_url: z.string().nullable(),
  amount: z.number(),
  status: z.enum(['pending', 'paid', 'failed', 'expired']),
  gateway_reference: z.string().nullable(),
  expires_at: z.coerce.date().nullable(),
  paid_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

// Input schemas for creating categories
export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

// Input schemas for creating menu items
export const createMenuItemInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  price: z.number().positive(),
  category_id: z.number(),
  image_url: z.string().nullable(),
  is_available: z.boolean().default(true)
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemInputSchema>;

// Input schemas for updating menu items
export const updateMenuItemInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  category_id: z.number().optional(),
  image_url: z.string().nullable().optional(),
  is_available: z.boolean().optional()
});

export type UpdateMenuItemInput = z.infer<typeof updateMenuItemInputSchema>;

// Input schemas for menu filtering and searching
export const menuFilterInputSchema = z.object({
  category_id: z.number().optional(),
  search: z.string().optional(),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().positive().optional(),
  available_only: z.boolean().default(true)
});

export type MenuFilterInput = z.infer<typeof menuFilterInputSchema>;

// Input schemas for cart operations
export const addToCartInputSchema = z.object({
  session_id: z.string().min(1),
  menu_item_id: z.number(),
  quantity: z.number().int().positive()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

export const updateCartItemInputSchema = z.object({
  id: z.number(),
  quantity: z.number().int().positive()
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

export const getCartInputSchema = z.object({
  session_id: z.string().min(1)
});

export type GetCartInput = z.infer<typeof getCartInputSchema>;

// Input schemas for order creation
export const createOrderInputSchema = z.object({
  session_id: z.string().min(1),
  customer_name: z.string().min(1),
  customer_phone: z.string().nullable(),
  customer_email: z.string().email().nullable(),
  notes: z.string().nullable()
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// Input schemas for order updates
export const updateOrderStatusInputSchema = z.object({
  id: z.number(),
  status: orderStatusSchema
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// Input schemas for payment processing
export const createPaymentInputSchema = z.object({
  order_id: z.number(),
  payment_gateway: z.string().min(1),
  amount: z.number().positive()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

export const updatePaymentStatusInputSchema = z.object({
  id: z.number(),
  status: z.enum(['pending', 'paid', 'failed', 'expired']),
  gateway_reference: z.string().nullable(),
  paid_at: z.coerce.date().nullable()
});

export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusInputSchema>;

// Response schemas for extended data with relations
export const menuItemWithCategorySchema = menuItemSchema.extend({
  category: categorySchema
});

export type MenuItemWithCategory = z.infer<typeof menuItemWithCategorySchema>;

export const cartItemWithMenuItemSchema = cartItemSchema.extend({
  menu_item: menuItemSchema
});

export type CartItemWithMenuItem = z.infer<typeof cartItemWithMenuItemSchema>;

export const orderWithItemsSchema = orderSchema.extend({
  items: z.array(orderItemSchema.extend({
    menu_item: menuItemSchema
  }))
});

export type OrderWithItems = z.infer<typeof orderWithItemsSchema>;

export const paymentWithOrderSchema = paymentSchema.extend({
  order: orderSchema
});

export type PaymentWithOrder = z.infer<typeof paymentWithOrderSchema>;