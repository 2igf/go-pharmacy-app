import {
  Loader2,
  Star,
  ShoppingCart,
  Heart,
  Home as HomeIcon,
  Users,
  Clock,
  Pill,
  User,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProductDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Get product ID from URL
  const params = new URLSearchParams(window.location.search);
  const [, routeParams] = useRoute("/product/:id");
  const productId = Number(routeParams?.id ?? params.get("id") ?? 0);

  // Fetch product details
  const {
    data: product,
    isLoading,
    error,
  } = trpc.products.byId.useQuery(
    { id: productId },
    { enabled: productId > 0 }
  );

  // Add to cart mutation
  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المنتج إلى السلة");
      setQuantity(1);
    },
    onError: error => {
      toast.error(error.message || "فشل إضافة المنتج إلى السلة");
    },
  });

  const handleAddToCart = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      await addToCartMutation.mutateAsync({
        productId,
        quantity,
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#00c57d]" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <main className="p-6" role="alert">
        {error.message}
      </main>
    );
  }

  if (!product) {
    return (
      <div className="app-container">
        <div className="app-header">
          <div className="container py-4">
            <button
              onClick={() => navigate("/products")}
              className="flex items-center gap-2 text-[#00c57d] hover:text-[#00a86a]"
            >
              <ChevronLeft size={24} />
              <span>العودة</span>
            </button>
          </div>
        </div>
        <div className="app-content">
          <div className="container py-12 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">المنتج غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/products")}
              className="flex items-center gap-2 text-[#00c57d] hover:text-[#00a86a]"
            >
              <ChevronLeft size={24} />
              <span>العودة</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">تفاصيل المنتج</h1>
            <div className="w-6" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="app-content">
        <div className="container py-6">
          {/* Product Image */}
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg h-64 mb-6 flex items-center justify-center">
            <Pill className="text-[#00c57d]" size={80} />
          </div>

          {/* Product Info */}
          <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {product.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">{product.category}</p>
              </div>
            </div>

            {/* Price */}
            <div className="mb-4">
              <p className="text-3xl font-bold text-[#00c57d]">
                {product.price} JD
              </p>
              <p className="text-sm text-gray-600 mt-1">
                سعر محاكاة — لا دفع حقيقي
              </p>
            </div>

            {/* Stock Status */}
            <div className="mb-4">
              {product.stock > 0 ? (
                <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  متوفر ({product.stock} وحدة)
                </span>
              ) : (
                <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">
                  غير متوفر
                </span>
              )}
            </div>

            {/* Prescription Required */}
            {product.requiresPrescription && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle
                  className="text-orange-600 flex-shrink-0 mt-0.5"
                  size={18}
                />
                <div>
                  <p className="font-semibold text-orange-900 text-sm">
                    يلزم وصفة طبية
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    محظور في النسخة التجريبية
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">الوصف</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {product.description || "لا توجد وصفة متاحة لهذا المنتج"}
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">الكمية</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-gray-900 w-8 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity(Math.min(99, product.stock, quantity + 1))
                  }
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={
                product.requiresPrescription ||
                product.stock === 0 ||
                addToCartMutation.isPending
              }
              className="w-full bg-[#00c57d] hover:bg-[#00a86a] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 mb-3"
            >
              <ShoppingCart size={20} />
              {addToCartMutation.isPending
                ? "جاري الإضافة..."
                : "أضف إلى السلة"}
            </Button>
          </div>

          {/* Additional Info */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">معلومات إضافية</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">الفئة</span>
                <span className="font-semibold text-gray-900">
                  {product.category}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">التوفر</span>
                <span className="font-semibold text-gray-900">
                  {product.stock > 0 ? "متوفر" : "غير متوفر"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">الشحن</span>
                <span className="font-semibold text-gray-900">
                  مجاني فوق 50 دولار
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
