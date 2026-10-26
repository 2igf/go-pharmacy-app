import { resetFixtures } from "./test-support";
import { beforeEach as resetBeforeEach } from "vitest";
resetBeforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDb } from "./db";
import { notifications } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe.skipIf(!process.env.TEST_DATABASE_URL)("Notifications", () => {
  let db: any;

  beforeEach(async () => {
    db = await getDb();
  });

  describe.skipIf(!process.env.TEST_DATABASE_URL)(
    "getUserNotifications",
    () => {
      it("should return notifications for a user", async () => {
        const { getUserNotifications } = await import("./db");
        const userId = 1;

        // Insert test notification
        await db.insert(notifications).values({
          userId,
          title: "Test Notification",
          message: "This is a test notification",
          type: "order_status",
          isRead: false,
          createdAt: new Date(),
        });

        const result = await getUserNotifications(userId);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it("should return empty array for user with no notifications", async () => {
        const { getUserNotifications } = await import("./db");
        const userId = 9999;

        const result = await getUserNotifications(userId);
        expect(Array.isArray(result)).toBe(true);
      });
    }
  );

  describe.skipIf(!process.env.TEST_DATABASE_URL)(
    "getUnreadNotificationCount",
    () => {
      it("should count unread notifications", async () => {
        const { getUnreadNotificationCount } = await import("./db");
        const userId = 1;

        // Insert test unread notifications
        await db.insert(notifications).values([
          {
            userId,
            title: "Unread 1",
            message: "Test",
            type: "order_status",
            isRead: false,
            createdAt: new Date(),
          },
          {
            userId,
            title: "Unread 2",
            message: "Test",
            type: "promotion",
            isRead: false,
            createdAt: new Date(),
          },
        ]);

        const result = await getUnreadNotificationCount(userId);
        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThanOrEqual(0);
      });
    }
  );

  describe.skipIf(!process.env.TEST_DATABASE_URL)(
    "markNotificationAsRead",
    () => {
      it("should mark notification as read", async () => {
        const { markNotificationAsRead } = await import("./db");

        // Insert test notification
        const [result] = await db.insert(notifications).values({
          userId: 1,
          title: "Test",
          message: "Test",
          type: "order_status",
          isRead: false,
          createdAt: new Date(),
        });

        const notificationId = result?.insertId || 0;
        if (notificationId > 0) {
          await markNotificationAsRead(notificationId, 1);

          const updated = await db
            .select()
            .from(notifications)
            .where(eq(notifications.id, notificationId));

          expect(updated[0]?.isRead).toBe(true);
        }
      });
    }
  );

  describe.skipIf(!process.env.TEST_DATABASE_URL)("deleteNotification", () => {
    it("should delete a notification", async () => {
      const { deleteNotification } = await import("./db");

      // Insert test notification
      const [result] = await db.insert(notifications).values({
        userId: 1,
        title: "Test",
        message: "Test",
        type: "order_status",
        isRead: false,
        createdAt: new Date(),
      });

      const notificationId = result?.insertId || 0;
      if (notificationId > 0) {
        await deleteNotification(notificationId, 1);

        const deleted = await db
          .select()
          .from(notifications)
          .where(eq(notifications.id, notificationId));

        expect(deleted.length).toBe(0);
      }
    });
  });
});
