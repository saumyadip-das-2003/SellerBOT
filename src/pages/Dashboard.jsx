import { useEffect, useMemo, useState } from "react"
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore"
import { AlertTriangle, MapPin, PackagePlus, Plus, Settings, Truck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import {
  getPaymentBreakdown,
  getSalesByZone,
  getThisMonthSales,
  getTodaysSales,
  getTopProducts,
  getUnpaidOrders,
  getYesterdaysSales,
  getOrderDateValue,
} from "../utils/analytics.js"

function Dashboard() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const ordersQuery = query(collection(db, "users", currentUser.uid, "orders"), orderBy("createdAt", "desc"))
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() })))
      setLoading(false)
    }, (error) => {
      toast.error(error.message || "Could not load dashboard orders.")
      setLoading(false)
    })
    const unsubscribeProducts = onSnapshot(collection(db, "users", currentUser.uid, "products"), (snapshot) => {
      setProducts(snapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() })))
    })
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snap) => setShop(snap.data() || {}))
    return () => {
      unsubscribeOrders()
      unsubscribeProducts()
    }
  }, [currentUser?.uid])

  const today = useMemo(() => getTodaysSales(orders), [orders])
  const yesterday = useMemo(() => getYesterdaysSales(orders), [orders])
  const month = useMemo(() => getThisMonthSales(orders), [orders])
  const unpaid = useMemo(() => getUnpaidOrders(orders), [orders])
  const topProducts = useMemo(() => getTopProducts(orders), [orders])
  const zones = useMemo(() => getSalesByZone(orders).slice(0, 5), [orders])
  const payments = useMemo(() => getPaymentBreakdown(orders), [orders])
  const recentOrders = orders.slice(0, 5)
  const lowStock = products.filter((product) => Number(product.stock ?? 999) < 5)
  const yesterdayCompare = yesterday.revenue ? Math.round(((today.revenue - yesterday.revenue) / yesterday.revenue) * 100) : today.revenue > 0 ? 100 : 0
  const unpaidTotal = unpaid.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
  const topUnits = Math.max(1, ...topProducts.map((item) => item.units))
  const topZoneRevenue = Math.max(1, ...zones.map((item) => item.revenue))

  if (loading) return <p className="rounded-lg bg-white p-8 text-center text-slate-600">Loading dashboard...</p>

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {shop?.logoURL ? <img className="h-16 w-16 rounded-full object-cover" src={shop.logoURL} alt="Shop logo" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1D9E75] text-xl font-bold text-white">{initials(shop?.shopName)}</div>}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
            <h2 className="text-3xl font-semibold text-slate-950">Welcome back, {shop?.ownerName || currentUser?.displayName || "Seller"}!</h2>
            <p className="mt-1 text-slate-600">{shop?.shopName || "SellerBot Shop"}</p>
          </div>
        </div>
      </div>

      {unpaid.length > 0 && <div className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-900 sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold">Warning: You have {unpaid.length} unpaid orders totaling ৳{unpaidTotal}</p><button className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => navigate("/sales?status=Unpaid")}>View Unpaid Orders</button></div>}
      {lowStock.slice(0, 3).map((product) => <div key={product.id} className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-900"><AlertTriangle className="h-4 w-4" />{product.name} is running low ({product.stock} left)</div>)}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Today's Sales" value={`৳${today.revenue}`} detail={`${today.count} orders`} compare={`${yesterdayCompare >= 0 ? "↑" : "↓"} ${Math.abs(yesterdayCompare)}% vs yesterday`} />
        <Metric title="This Month" value={`৳${month.revenue}`} detail={`${month.count} orders this month`} />
        <Metric title="Total Orders" value={orders.length} detail={`৳${orders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)} all time revenue`} />
        <button className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-orange-300" onClick={() => navigate("/sales?status=Unpaid")}><p className="text-sm text-slate-500">Pending Payments</p><p className="mt-2 text-3xl font-bold text-orange-600">{unpaid.length}</p><p className="mt-1 text-sm text-slate-600">৳{unpaidTotal} unpaid</p></button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent Orders" action={<Link className="text-sm font-semibold text-[#1D9E75]" to="/sales">View All</Link>}><RecentOrders orders={recentOrders} /></Panel>
        <Panel title="Top Products"><BarList items={topProducts} max={topUnits} labelKey="name" value={(item) => `${item.units} units · ৳${item.revenue}`} width={(item) => (item.units / topUnits) * 100} /></Panel>
        <Panel title="Sales by Zone"><BarList items={zones} max={topZoneRevenue} labelKey="zone" value={(item) => `${item.count} orders · ৳${item.revenue}`} width={(item) => (item.revenue / topZoneRevenue) * 100} /></Panel>
        <Panel title="Payment Method Breakdown"><div className="flex flex-wrap gap-2">{payments.map((item) => <span key={item.method} className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{item.method}: {item.count} orders</span>)}</div></Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction icon={Plus} label="New Order" to="/new-order" />
        <QuickAction icon={PackagePlus} label="Add Product" to="/products" />
        <QuickAction icon={MapPin} label="Manage Zones" to="/delivery-zones" />
        <QuickAction icon={Settings} label="Shop Settings" to="/shop-settings" />
      </div>
    </section>
  )
}

function Metric({ title, value, detail, compare }) { return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{detail}</p>{compare && <p className="mt-2 text-sm font-semibold text-[#1D9E75]">{compare}</p>}</div> }
function Panel({ title, action, children }) { return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3>{action}</div>{children}</div> }
function RecentOrders({ orders }) { if (!orders.length) return <p className="text-sm text-slate-500">No recent orders.</p>; return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-2">Order#</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t"><td className="py-2 font-semibold">{order.orderNumber}</td><td>{order.customerName}</td><td>৳{order.grandTotal}</td><td>{order.paymentStatus}</td><td>{getOrderDateValue(order).toLocaleDateString("en-GB")}</td></tr>)}</tbody></table></div> }
function BarList({ items, labelKey, value, width }) { if (!items.length) return <p className="text-sm text-slate-500">No data yet.</p>; return <div className="space-y-3">{items.map((item) => <div key={item[labelKey]}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{item[labelKey]}</span><span className="text-slate-600">{value(item)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#1D9E75]" style={{ width: `${Math.max(6, width(item))}%` }} /></div></div>)}</div> }
function QuickAction({ icon: Icon, label, to }) { return <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1D9E75] hover:text-[#1D9E75]" to={to}><Icon className="h-4 w-4" />{label}</Link> }
function initials(name = "SB") { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() }

export default Dashboard
