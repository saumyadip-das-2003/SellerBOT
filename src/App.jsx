import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
} from "react-router-dom"
import { Toaster } from "react-hot-toast"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import { AuthProvider } from "./context/AuthContext.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import DeliveryZones from "./pages/DeliveryZones.jsx"
import Login from "./pages/Login.jsx"
import NewOrder from "./pages/NewOrder.jsx"
import Products from "./pages/Products.jsx"
import Sales from "./pages/Sales.jsx"

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/delivery-zones", label: "Delivery Zones" },
  { to: "/new-order", label: "New Order" },
  { to: "/sales", label: "Sales" },
]

function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#1D9E75]">SellerBot</p>
            <h1 className="text-2xl font-semibold tracking-normal">
              AI POS for F-commerce sellers
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/delivery-zones" element={<DeliveryZones />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/sales" element={<Sales />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
