import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createCategoryInputSchema,
  createMenuItemInputSchema,
  updateMenuItemInputSchema,
  menuFilterInputSchema,
  addToCartInputSchema,
  updateCartItemInputSchema,
  getCartInputSchema,
  createOrderInputSchema,
  updateOrderStatusInputSchema,
  createPaymentInputSchema,
  updatePaymentStatusInputSchema
} from './schema';

// Import handlers
import { getCategories } from './handlers/get_categories';
import { createCategory } from './handlers/create_category';
import { getMenuItems } from './handlers/get_menu_items';
import { createMenuItem } from './handlers/create_menu_item';
import { updateMenuItem } from './handlers/update_menu_item';
import { getCart } from './handlers/get_cart';
import { addToCart } from './handlers/add_to_cart';
import { updateCartItem } from './handlers/update_cart_item';
import { removeFromCart } from './handlers/remove_from_cart';
import { clearCart } from './handlers/clear_cart';
import { createOrder } from './handlers/create_order';
import { getOrder } from './handlers/get_order';
import { getOrders } from './handlers/get_orders';
import { updateOrderStatus } from './handlers/update_order_status';
import { createPayment } from './handlers/create_payment';
import { getPayment } from './handlers/get_payment';
import { updatePaymentStatus } from './handlers/update_payment_status';
import { checkPaymentStatus } from './handlers/check_payment_status';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Category routes
  getCategories: publicProcedure
    .query(() => getCategories()),
  createCategory: publicProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input }) => createCategory(input)),

  // Menu item routes
  getMenuItems: publicProcedure
    .input(menuFilterInputSchema.optional())
    .query(({ input }) => getMenuItems(input)),
  createMenuItem: publicProcedure
    .input(createMenuItemInputSchema)
    .mutation(({ input }) => createMenuItem(input)),
  updateMenuItem: publicProcedure
    .input(updateMenuItemInputSchema)
    .mutation(({ input }) => updateMenuItem(input)),

  // Cart routes
  getCart: publicProcedure
    .input(getCartInputSchema)
    .query(({ input }) => getCart(input)),
  addToCart: publicProcedure
    .input(addToCartInputSchema)
    .mutation(({ input }) => addToCart(input)),
  updateCartItem: publicProcedure
    .input(updateCartItemInputSchema)
    .mutation(({ input }) => updateCartItem(input)),
  removeFromCart: publicProcedure
    .input(z.object({ cartItemId: z.number() }))
    .mutation(({ input }) => removeFromCart(input.cartItemId)),
  clearCart: publicProcedure
    .input(getCartInputSchema)
    .mutation(({ input }) => clearCart(input)),

  // Order routes
  createOrder: publicProcedure
    .input(createOrderInputSchema)
    .mutation(({ input }) => createOrder(input)),
  getOrder: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(({ input }) => getOrder(input.orderId)),
  getOrders: publicProcedure
    .query(() => getOrders()),
  updateOrderStatus: publicProcedure
    .input(updateOrderStatusInputSchema)
    .mutation(({ input }) => updateOrderStatus(input)),

  // Payment routes
  createPayment: publicProcedure
    .input(createPaymentInputSchema)
    .mutation(({ input }) => createPayment(input)),
  getPayment: publicProcedure
    .input(z.object({ paymentId: z.number() }))
    .query(({ input }) => getPayment(input.paymentId)),
  updatePaymentStatus: publicProcedure
    .input(updatePaymentStatusInputSchema)
    .mutation(({ input }) => updatePaymentStatus(input)),
  checkPaymentStatus: publicProcedure
    .input(z.object({ paymentId: z.number() }))
    .query(({ input }) => checkPaymentStatus(input.paymentId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();