import { medicationKnowledgeRouter } from "./medication-knowledge/router";
import { manualRemindersRouter } from "./customer-reminders/router";
import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./auth";
import { platformRouter } from "./platform";
import { pharmaciesRouter } from "./domains/pharmacies";
import { fulfillmentRouter } from "./domains/fulfillment";
import { productsRouter } from "./domains/catalog";
import { cartRouter, ordersRouter } from "./domains/shopping";
import { adminRouter } from "./domains/administration";
import { addressesRouter, notificationsRouter } from "./domains/account";
import {
  doctorsRouter,
  appointmentsRouter,
  medicationRemindersRouter,
  prescriptionsRouter,
} from "./domains/medical";

/** Stable API composition. Installed web/Android clients retain their procedure paths. */
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  manualReminders: manualRemindersRouter,
  medicationKnowledge: medicationKnowledgeRouter,
  platform: platformRouter,
  pharmacies: pharmaciesRouter,
  fulfillment: fulfillmentRouter,
  products: productsRouter,
  cart: cartRouter,
  orders: ordersRouter,
  admin: adminRouter,
  addresses: addressesRouter,
  notifications: notificationsRouter,
  doctors: doctorsRouter,
  appointments: appointmentsRouter,
  medicationReminders: medicationRemindersRouter,
  prescriptions: prescriptionsRouter,
});

export type AppRouter = typeof appRouter;
