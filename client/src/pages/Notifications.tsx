import {
  Bell,
  Loader2,
  Trash2,
  Home as HomeIcon,
  ShoppingCart,
  Users,
  Clock,
  Pill,
  User,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Notifications() {
  const { user, loading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const [, navigate] = useLocation();

  // Fetch all notifications
  const {
    data: notifications,
    isLoading,
    refetch,
    error,
  } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30000,
    enabled: !!user,
  });

  // Delete notification mutation
  const deleteNotificationMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Mark as read mutation
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDelete = async (notificationId: number) => {
    try {
      await deleteNotificationMutation.mutateAsync({ id: notificationId });
    } catch (error) {
      alert("تعذر حذف الإشعار، حاول مجدداً");
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsReadMutation.mutateAsync({ id: notificationId });
    } catch (error) {
      alert("تعذر تحديث الإشعار، حاول مجدداً");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_status":
        return "📦";
      case "appointment_reminder":
        return "📅";
      case "medication_reminder":
        return "💊";
      case "promotion":
        return "🎉";
      default:
        return "ℹ️";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "order_status":
        return "bg-emerald-50 border-l-4 border-emerald-500";
      case "appointment_reminder":
        return "bg-purple-50 border-l-4 border-purple-500";
      case "medication_reminder":
        return "bg-green-50 border-l-4 border-green-500";
      case "promotion":
        return "bg-yellow-50 border-l-4 border-yellow-500";
      default:
        return "bg-gray-50 border-l-4 border-gray-500";
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case "order_status":
        return "حالة الطلب";
      case "appointment_reminder":
        return "تذكير الموعد";
      case "medication_reminder":
        return "تذكير الدواء";
      case "promotion":
        return "عرض ترويجي";
      default:
        return "إشعار عام";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#00c57d]" size={48} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">الإشعارات</h1>
            <Bell className="text-[#00c57d]" size={24} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="app-content">
        <div className="container py-6">
          {error ? (
            <p role="alert">{error.message}</p>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[#00c57d]" size={40} />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg ${getNotificationColor(
                    notification.type
                  )} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {notification.title}
                            </h3>
                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                              {getNotificationTypeLabel(notification.type)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(
                              notification.createdAt
                            ).toLocaleDateString("ar-SA", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-2 text-gray-400 hover:text-[#00c57d] transition-colors"
                              title="Mark as read"
                            >
                              <div className="w-3 h-3 bg-[#00c57d] rounded-full" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Bell size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">لا توجد إشعارات</p>
              <p className="text-sm">ستظهر الإشعارات هنا عند توفرها</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
