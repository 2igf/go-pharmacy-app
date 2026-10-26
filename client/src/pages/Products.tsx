import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  ArrowLeft,
  ShoppingCart,
  Home,
  Users,
  Calendar,
  Pill,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import ProductModal from "@/components/ProductModal";

const CATEGORIES = [
  { value: "all", label: "جميع الفئات" },
  { value: "medications", label: "الأدوية" },
  { value: "natural_products", label: "منتجات طبيعية" },
  { value: "skincare", label: "العناية بالبشرة" },
  { value: "baby_care", label: "العناية بالأطفال" },
  { value: "medical_supplies", label: "مستلزمات طبية" },
];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState(
    new URLSearchParams(location.search).get("search") ?? ""
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch products
  const {
    data: products,
    isLoading,
    error,
  } = trpc.products.list.useQuery({
    limit: 100,
    offset: 0,
  });

  const filteredProducts =
    products?.filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.manufacturer
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }) || [];

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price_low":
        return Number(a.price) - Number(b.price);
      case "price_high":
        return Number(b.price) - Number(a.price);
      case "name":
        return String(a.name).localeCompare(String(b.name));
      default:
        return 0;
    }
  });

  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 text-[#00c57d] hover:bg-green-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              العودة
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            الأدوية والمنتجات
          </h1>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="ابحث عن أدوية..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 rounded-full bg-gray-100 border-0 text-right"
              />
              <Button
                aria-label="بحث المنتجات"
                onClick={() =>
                  document
                    .querySelector<HTMLInputElement>('input[type="text"]')
                    ?.focus()
                }
                size="icon"
                className="rounded-full bg-[#00c57d] hover:bg-[#00a86a]"
              >
                <Search className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="text-right bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="text-right bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">الاسم: أ-ي</SelectItem>
                  <SelectItem value="price_low">السعر: الأقل أولاً</SelectItem>
                  <SelectItem value="price_high">
                    السعر: الأعلى أولاً
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="app-content pb-24">
        <div className="container mx-auto px-4 py-6">
          {error ? (
            <p role="alert">{error.message}</p>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#00c57d]" />
            </div>
          ) : sortedProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedProducts.map(product => (
                <Card
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsModalOpen(true);
                  }}
                  className="hover:shadow-lg transition-shadow h-full flex flex-col border border-gray-200 rounded-lg overflow-hidden cursor-pointer"
                >
                  {/* Product Image */}
                  <div className="bg-gradient-to-br from-[#00c57d] to-[#00a86a] h-32 flex items-center justify-center hover:opacity-90 transition-opacity">
                    <Pill className="text-white" size={40} />
                  </div>

                  <CardContent className="pt-3 flex-1 flex flex-col">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-1 text-gray-900 hover:text-[#00c57d] transition-colors">
                      {product.name}
                    </h3>
                    {product.manufacturer && (
                      <p className="text-xs text-gray-600 mb-2">
                        {product.manufacturer}
                      </p>
                    )}
                    {product.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                        {product.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-auto mb-3">
                      <span className="text-lg font-bold text-[#00c57d]">
                        {product.price} JD
                      </span>
                      {product.requiresPrescription && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs border-0">
                          وصفة
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedProduct(product);
                        setIsModalOpen(true);
                      }}
                      className="w-full bg-[#00c57d] hover:bg-[#00a86a] text-white h-8 text-sm"
                    >
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      أضف للسلة
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-semibold">
                لم يتم العثور على منتجات
              </p>
              <p className="text-gray-500 text-sm mt-2">
                جرب البحث عن منتجات أخرى أو غير الفئة
              </p>
            </div>
          )}
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
