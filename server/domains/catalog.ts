import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import {
  getDb,
  getProducts,
  getProductsByCategory,
  getProductById,
  searchProducts,
} from "../db";
import { products } from "../../drizzle/schema";

export const productsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).max(100000).default(0),
      })
    )
    .query(async ({ input }) => {
      return await getProducts(input.limit, input.offset);
    }),

  byCategory: publicProcedure
    .input(
      z.object({
        category: z.enum([
          "medications",
          "medical_supplies",
          "natural_products",
          "skincare",
          "baby_care",
          "pet_care",
        ]),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).max(100000).default(0),
      })
    )
    .query(async ({ input }) => {
      return await getProductsByCategory(
        input.category,
        input.limit,
        input.offset
      );
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      return await getProductById(input.id);
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      return await searchProducts(input.query, input.limit);
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        price: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
        category: z.enum([
          "medications",
          "medical_supplies",
          "natural_products",
          "skincare",
          "baby_care",
          "pet_care",
        ]),
        description: z.string().max(5000).optional(),
        stock: z
          .string()
          .regex(/^\d{1,6}$/)
          .optional(),
        requiresPrescription: z.boolean().optional(),
        image: z
          .string()
          .max(2048)
          .refine(
            v => !v || /^https:\/\//.test(v),
            "Image must be an HTTPS URL"
          )
          .optional(),
        manufacturer: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Only admins can create products");
      }
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const [result] = await db.insert(products).values({
        name: input.name,
        price: input.price,
        category: input.category,
        description: input.description || null,
        stock: input.stock ? parseInt(input.stock) : 0,
        requiresPrescription: input.requiresPrescription || false,
        image: input.image || null,
        manufacturer: input.manufacturer || null,
      });
      return { id: result?.insertId || 0 };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().trim().min(1).max(255).optional(),
        price: z
          .string()
          .regex(/^\d{1,8}(\.\d{1,2})?$/)
          .optional(),
        category: z
          .enum([
            "medications",
            "medical_supplies",
            "natural_products",
            "skincare",
            "baby_care",
            "pet_care",
          ])
          .optional(),
        description: z.string().max(5000).optional(),
        stock: z
          .string()
          .regex(/^\d{1,6}$/)
          .optional(),
        requiresPrescription: z.boolean().optional(),
        image: z
          .string()
          .max(2048)
          .refine(
            v => !v || /^https:\/\//.test(v),
            "Image must be an HTTPS URL"
          )
          .optional(),
        manufacturer: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Only admins can update products");
      }
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const updateData: Partial<typeof products.$inferInsert> = {};
      if (input.name) updateData.name = input.name;
      if (input.price) updateData.price = input.price;
      if (input.category) updateData.category = input.category;
      if (input.description !== undefined)
        updateData.description = input.description || null;
      if (input.stock !== undefined) updateData.stock = parseInt(input.stock);
      if (input.requiresPrescription !== undefined)
        updateData.requiresPrescription = input.requiresPrescription;
      if (input.image !== undefined) updateData.image = input.image || null;
      if (input.manufacturer !== undefined)
        updateData.manufacturer = input.manufacturer || null;

      await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, input.id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Only admins can delete products");
      }
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      await db
        .update(products)
        .set({ isActive: false })
        .where(eq(products.id, input.id));
      return { success: true };
    }),
});
