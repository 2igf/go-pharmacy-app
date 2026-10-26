import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { BetaLayout, Page } from "./components/BetaLayout";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderTracking from "./pages/OrderTracking";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Notifications from "./pages/Notifications";
import BetaAdmin from "./pages/BetaAdmin";
import NotFound from "./pages/NotFound";
function Unavailable() {
  return (
    <Page title="الخدمة غير متاحة">
      <p>الخدمات الطبية والتوصيل غير متاحة في البيتا. لا تدخل بيانات مرضى.</p>
    </Page>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <BetaLayout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/products" component={Products} />
              <Route path="/product/:id" component={ProductDetail} />
              <Route path="/product" component={ProductDetail} />
              <Route path="/login" component={Login} />
              <Route path="/cart" component={Cart} />
              <Route path="/checkout" component={Checkout} />
              <Route path="/order/:id" component={OrderTracking} />
              <Route path="/order" component={OrderTracking} />
              <Route path="/profile" component={Profile} />
              <Route path="/addresses" component={Profile} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/admin" component={BetaAdmin} />
              <Route path="/admin-panel" component={BetaAdmin} />
              {[
                "/doctors",
                "/appointments",
                "/reminders",
                "/pharmacy",
                "/delivery",
              ].map(path => (
                <Route key={path} path={path} component={Unavailable} />
              ))}
              <Route component={NotFound} />
            </Switch>
          </BetaLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
