import { useEffect, useMemo, useRef, useState } from "react"
import { deleteDoc, doc, getDoc, onSnapshot, collection, orderBy, query, updateDoc } from "firebase/firestore"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { Eye, FileDown, ImageDown, Plus, Printer, Trash2, X } from "lucide-react"
import toast from "react-hot-toast"
import { useNavigate, useSearchParams } from "react-router-dom"
import InvoiceTemplate from "../components/InvoiceTemplate.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { exportToCSV, getOrderDateValue } from "../utils/analytics.js"

const pageSize = 20
const paymentStatuses = ["All", "Paid", "Unpaid", "Partial"]
const paymentMethods = ["All", "COD", "bKash", "Nagad", "Rocket", "Other"]

function Sales() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invoiceRef = useRef(null)
  const [orders, setOrders] = useState([])
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [invoiceOrder, setInvoiceOrder] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ from: "", to: "", status: searchParams.get("status") || "All", method: "All", search: "" })

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const ordersQuery = query(collection(db, "users", currentUser.uid, "orders"), orderBy("createdAt", "desc"))
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        setOrders(snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() })))
        setLoading(false)
      },
      (error) => {
        toast.error(error.message || "Could not load sales.")
        setLoading(false)
      },
    )
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snap) => setShop(snap.data() || {}))
    return unsubscribe
  }, [currentUser?.uid])

  const filteredOrders = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return orders.filter((order) => {
      const date = getOrderDateValue(order)
      if (filters.from && date < new Date(`${filters.from}T00:00:00`)) return false
      if (filters.to && date > new Date(`${filters.to}T23:59:59`)) return false
      if (filters.status !== "All" && order.paymentStatus !== filters.status) return false
      if (filters.method !== "All" && order.paymentMethod !== filters.method) return false
      if (search) {
        const haystack = [order.customerName, order.phone, order.orderNumber].join(" ").toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [orders, filters])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const start = (page - 1) * pageSize
  const paginatedOrders = filteredOrders.slice(start, start + pageSize)

  useEffect(() => setPage(1), [filters])

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }))
  const clearFilters = () => setFilters({ from: "", to: "", status: "All", method: "All", search: "" })

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete ${order.orderNumber}? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "orders", order.id))
      toast.success("Order deleted.")
    } catch (error) {
      toast.error(error.message || "Could not delete order.")
    }
  }

  const markAsPaid = async (order) => {
    try {
      await updateDoc(doc(db, "users", currentUser.uid, "orders", order.id), { paymentStatus: "Paid" })
      setSelectedOrder((current) => ({ ...current, paymentStatus: "Paid" }))
      toast.success("Order marked as paid.")
    } catch (error) {
      toast.error(error.message || "Could not update order.")
    }
  }

  const downloadPDF = async (order = selectedOrder || invoiceOrder) => {
    setInvoiceOrder(order)
    await waitFrame()
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 })
    const pdf = new jsPDF("p", "mm", "a4")
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, pdfHeight)
    pdf.save(`SellerBot-Invoice-${order.orderNumber}.pdf`)
  }

  const downloadImage = async (order = selectedOrder || invoiceOrder) => {
    setInvoiceOrder(order)
    await waitFrame()
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 })
    const link = document.createElement("a")
    link.download = `SellerBot-Invoice-${order.orderNumber}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">Orders</p>
          <h2 className="text-3xl font-semibold text-slate-950">Sales History</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white" onClick={() => navigate("/new-order")}><Plus className="h-4 w-4" />New Order</button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold" onClick={() => exportToCSV(filteredOrders)}><FileDown className="h-4 w-4" />Export CSV</button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
        <Field label="From" type="date" value={filters.from} onChange={(value) => updateFilter("from", value)} />
        <Field label="To" type="date" value={filters.to} onChange={(value) => updateFilter("to", value)} />
        <Select label="Payment Status" value={filters.status} options={paymentStatuses} onChange={(value) => updateFilter("status", value)} />
        <Select label="Payment Method" value={filters.method} options={paymentMethods} onChange={(value) => updateFilter("method", value)} />
        <Field label="Search" value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder="Name, phone, order #" />
        <button className="mt-6 h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold" onClick={clearFilters}>Clear Filters</button>
      </div>

      {loading ? <p className="rounded-lg bg-white p-8 text-center text-slate-600">Loading sales...</p> : filteredOrders.length === 0 ? <EmptyState onCreate={() => navigate("/new-order")} /> : <SalesTable orders={paginatedOrders} onDelete={deleteOrder} onInvoice={setInvoiceOrder} onView={setSelectedOrder} />}

      {filteredOrders.length > 0 && <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p>Showing {start + 1}-{Math.min(start + pageSize, filteredOrders.length)} of {filteredOrders.length} orders</p><div className="flex gap-2"><button className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>}

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onImage={downloadImage} onPDF={downloadPDF} onPaid={markAsPaid} />}
      {invoiceOrder && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><div className="mx-auto max-w-4xl rounded-lg bg-white p-4"><div className="mb-3 flex justify-end"><button className="rounded-md border px-3 py-2" onClick={() => setInvoiceOrder(null)}>Close</button></div><InvoiceTemplate ref={invoiceRef} order={invoiceOrder} shop={shop} /></div></div>}
      <div className="pointer-events-none fixed -left-[9999px] top-0"><InvoiceTemplate ref={invoiceRef} order={invoiceOrder || selectedOrder || {}} shop={shop} /></div>
    </section>
  )
}

function SalesTable({ orders, onDelete, onInvoice, onView }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Order #", "Date", "Customer Name", "Phone", "Zone", "Items", "Grand Total", "Payment Method", "Payment Status", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t"><td className="px-4 py-3 font-semibold">{order.orderNumber}</td><td className="px-4 py-3">{formatDate(order)}</td><td className="px-4 py-3">{order.customerName}</td><td className="px-4 py-3">{order.phone}</td><td className="px-4 py-3">{order.zone}</td><td className="px-4 py-3">{order.products?.length || 0}</td><td className="px-4 py-3 font-semibold">৳{order.grandTotal || 0}</td><td className="px-4 py-3">{order.paymentMethod}</td><td className="px-4 py-3"><StatusBadge status={order.paymentStatus} /></td><td className="px-4 py-3"><div className="flex gap-2"><Action icon={Eye} label="View" onClick={() => onView(order)} /><Action icon={Printer} label="Invoice" onClick={() => onInvoice(order)} /><Action icon={Trash2} label="Delete" danger onClick={() => onDelete(order)} /></div></td></tr>)}</tbody></table></div>
}

function OrderModal({ order, onClose, onImage, onPDF, onPaid }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><section className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-semibold">Order Details</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div><div className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Detail label="Order" value={order.orderNumber} /><Detail label="Customer" value={order.customerName} /><Detail label="Phone" value={order.phone} /><Detail label="Zone" value={order.zone} /><Detail label="Payment" value={`${order.paymentMethod || ""} / ${order.paymentStatus || ""}`} /><Detail label="Parsed by" value={order.parsedBy || "manual"} /></div><div><p className="font-semibold">Full Address</p><p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3">{order.address}</p></div><div><p className="font-semibold">Products</p>{(order.products || []).map((p, i) => <p key={i} className="rounded-md bg-slate-50 p-2">{p.productName} x {p.quantity} · ৳{p.unitPrice} · Total ৳{p.totalPrice}</p>)}</div><Detail label="Transaction ID" value={order.transactionId || ""} /><Detail label="Notes" value={order.notes || ""} /><p className="text-xl font-bold text-[#1D9E75]">Grand Total: ৳{order.grandTotal || 0}</p></div><div className="mt-6 flex flex-wrap gap-3"><button className="rounded-md bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white" onClick={() => onPDF(order)}>Download Invoice PDF</button><button className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={() => onImage(order)}>Download Invoice Image</button>{order.paymentStatus === "Unpaid" && <button className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800" onClick={() => onPaid(order)}>Mark as Paid</button>}<button className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={onClose}>Close</button></div></section></div>
}

function EmptyState({ onCreate }) { return <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><h3 className="text-lg font-semibold">No sales recorded yet</h3><button className="mt-4 rounded-md bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white" onClick={onCreate}>Create your first order</button></div> }
function Field({ label, value, onChange, type = "text", placeholder = "" }) { return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><input className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label> }
function Select({ label, value, options, onChange }) { return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label> }
function StatusBadge({ status }) { const color = status === "Paid" ? "bg-emerald-50 text-emerald-800" : status === "Partial" ? "bg-yellow-50 text-yellow-800" : "bg-red-50 text-red-800"; return <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${color}`}>{status || "Unpaid"}</span> }
function Action({ icon: Icon, label, onClick, danger = false }) { return <button className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${danger ? "text-red-700 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"}`} onClick={onClick}><Icon className="h-4 w-4" />{label}</button> }
function Detail({ label, value }) { return <p><span className="font-semibold">{label}: </span>{value}</p> }
function formatDate(order) { return getOrderDateValue(order).toLocaleDateString("en-GB") }
function waitFrame() { return new Promise((resolve) => requestAnimationFrame(() => resolve())) }

export default Sales


