import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Search,
  ShoppingCart,
  Clock,
  Users,
  Pill,
  ChevronRight,
  Star,
  MapPin,
  Home as HomeIcon,
  User,
  LogIn,
  Heart,
} from "lucide-react";
import { useState } from "react";
import ProductModal from "@/components/ProductModal";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query)}`);
    }
  };

  // Fetch products and doctors
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = trpc.products.list.useQuery({
    limit: 10,
    offset: 0,
  });

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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">GO Pharmacy</h1>
            <div className="flex items-center gap-3">
              {!user ? (
                <a
                  href={getLoginUrl()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00c57d] hover:bg-[#00a86a] text-white rounded-lg font-semibold transition-colors"
                >
                  <LogIn size={18} />
                  <span>تسجيل الدخول</span>
                </a>
              ) : (
                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
                >
                  <User size={18} />
                  <span>{user.name}</span>
                </button>
              )}
              <button
                aria-label="السلة"
                onClick={() => navigate("/cart")}
                className="relative"
              >
                <ShoppingCart className="text-[#00c57d]" size={24} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Input
              type="text"
              placeholder="ابحث عن أدوية أو منتجات"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSearch(searchQuery);
              }}
              aria-label="بحث المنتجات"
              className="pl-10 pr-4 py-3 rounded-full border-gray-300 bg-gray-100"
            />
            <Search
              className="absolute left-3 top-3.5 text-[#00c57d]"
              size={20}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="app-content">
        <div className="container py-6">
          <div className="bg-white rounded-xl p-5 mb-6">
            <h2 className="text-xl font-bold">GO Pharmacy — تجربة خاصة</h2>
            <p>
              تصفح منتجات خيالية وجرب طلباً محاكياً. الاستشارات والوصفات
              والخدمات الطبية غير متاحة.
            </p>
          </div>
          {/* Featured Products */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                المنتجات المميزة
              </h2>
              <button
                onClick={() => navigate("/products")}
                className="text-[#00c57d] flex items-center gap-1 hover:gap-2 transition-all"
              >
                <span className="text-sm font-semibold">عرض الكل</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {productsError ? (
              <p role="alert">{productsError.message}</p>
            ) : productsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[#00c57d]" size={32} />
              </div>
            ) : products && products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 overflow-x-auto pb-4">
                {products.map(product => (
                  <div
                    key={product.id}
                    className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      onClick={() => handleProductClick(product)}
                      className="bg-gradient-to-br from-gray-100 to-gray-200 h-32 mb-2 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <Pill className="text-[#00c57d]" size={40} />
                    </div>
                    <div className="p-3">
                      <h3
                        onClick={() => handleProductClick(product)}
                        className="font-semibold text-gray-900 text-sm line-clamp-2 cursor-pointer hover:text-[#00c57d] transition-colors"
                      >
                        {product.name}
                      </h3>
                      <p className="text-[#00c57d] font-bold text-sm mt-1">
                        {product.price} JD
                      </p>
                      {product.requiresPrescription && (
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded mt-1 inline-block">
                          يلزم وصفة
                        </span>
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleProductClick(product);
                        }}
                        className="w-full mt-2 bg-[#00c57d] hover:bg-[#00a86a] text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <ShoppingCart size={14} />
                        شراء
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                لا توجد منتجات
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
