import { useState, useEffect } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"

const API = "http://localhost:4000"

const STATUSES = ["Draft", "Sent", "Confirmed", "In Transit", "Delivered", "Cancelled"]

const statusColors = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Confirmed: "bg-purple-100 text-purple-700",
  "In Transit": "bg-yellow-100 text-yellow-700",
  Delivered: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
}

export default function App() {
  // --- State ---
  const [page, setPage] = useState("dashboard")
  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [supplierForm, setSupplierForm] = useState({
    name: "", contact: "", email: "", category: "", paymentTerms: ""
  })
  const [orderForm, setOrderForm] = useState({
    supplierId: "",
    expectedDate: "",
    lineItems: [{ description: "", quantity: 1, unitCost: 0 }]
  })
  const [dashboard, setDashboard] = useState(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [toast, setToast] = useState(null)
  const [filters, setFilters] = useState({
    search: "",
    status: "All",
    startDate: "",
    endDate: ""
  })

  // --- Toast helper ---
  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // --- Effects ---
  useEffect(() => {
    fetchSuppliers()
    fetchDashboard()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [filters])
  // --- Data fetching ---
  async function fetchSuppliers() {
    const res = await fetch(`${API}/api/suppliers`)
    setSuppliers(await res.json())
  }

  async function fetchOrders() {
    setLoadingOrders(true)
    const params = new URLSearchParams(filters)
    const res = await fetch(`${API}/api/orders?${params}`)
    setOrders(await res.json())
    setLoadingOrders(false)
  }

  async function fetchDashboard() {
    setLoadingDashboard(true)
    const res = await fetch(`${API}/api/dashboard`)
    setDashboard(await res.json())
    setLoadingDashboard(false)
  }

  // --- Supplier CRUD ---
  async function addSupplier(e) {
    e.preventDefault()
    if (!supplierForm.name) return

    await fetch(`${API}/api/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(supplierForm)
    })

    setSupplierForm({ name: "", contact: "", email: "", category: "", paymentTerms: "" })
    fetchSuppliers()
    showToast("Supplier added 🎉")
  }

  async function deleteSupplier(id) {
    await fetch(`${API}/api/suppliers/${id}`, { method: "DELETE" })
    fetchSuppliers()
    showToast("Supplier deleted 🗑️")
  }

  // --- Order CRUD ---
  async function createOrder(e) {
    e.preventDefault()
    if (!orderForm.supplierId) return

    await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderForm)
    })

    setOrderForm({
      supplierId: "",
      expectedDate: "",
      lineItems: [{ description: "", quantity: 1, unitCost: 0 }]
    })
    fetchOrders()
    showToast("Order created ✅")
  }

  async function updateStatus(id, status) {
    await fetch(`${API}/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    })
    fetchOrders()
    showToast(`Status updated to ${status}`)
  }

  async function deleteOrder(id) {
    await fetch(`${API}/api/orders/${id}`, { method: "DELETE" })
    fetchOrders()
    showToast("Order deleted 🗑️")
  }

  // --- Line item helpers ---
  function addLineItem() {
    setOrderForm(f => ({
      ...f,
      lineItems: [...f.lineItems, { description: "", quantity: 1, unitCost: 0 }]
    }))
  }

  function removeLineItem(i) {
    setOrderForm(f => ({
      ...f,
      lineItems: f.lineItems.filter((_, idx) => idx !== i)
    }))
  }

  function updateLineItem(i, field, value) {
    setOrderForm(f => ({
      ...f,
      lineItems: f.lineItems.map((item, idx) =>
        idx === i ? { ...item, [field]: field === "quantity" || field === "unitCost" ? Number(value) : value } : item
      )
    }))
  }

  // --- Utility functions ---
  function orderTotal(order) {
    return order.lineItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  }

  function exportPDF(order) {
    const doc = new jsPDF()
    doc.text(`PO #${order.poNumber.slice(0, 8).toUpperCase()}`, 14, 20)
    doc.text(`Supplier: ${order.supplier.name}`, 14, 30)

    autoTable(doc, {
      startY: 40,
      head: [["Item", "Qty", "Unit Cost", "Total"]],
      body: order.lineItems.map(item => [
        item.description,
        item.quantity,
        `$${item.unitCost.toFixed(2)}`,
        `$${(item.quantity * item.unitCost).toFixed(2)}`
      ])
    })

    doc.save(`PO-${order.poNumber.slice(0, 8)}.pdf`)
  }

  function SupplierChart({ data }) {
    const chartData = Object.entries(data).map(([name, stats]) => ({
      name,
      spend: stats.totalSpend,
    }))

    return (
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="spend" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex gap-6">
        <span className="font-bold text-gray-800">PO Tracker</span>
        <button
          onClick={() => setPage("dashboard")}
          className={`text-sm ${page === "dashboard" ? "text-blue-600 font-medium" : "text-gray-500 hover:text-gray-800"}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setPage("suppliers")}
          className={`text-sm ${page === "suppliers" ? "text-blue-600 font-medium" : "text-gray-500 hover:text-gray-800"}`}
        >
          Suppliers
        </button>
        <button
          onClick={() => setPage("orders")}
          className={`text-sm ${page === "orders" ? "text-blue-600 font-medium" : "text-gray-500 hover:text-gray-800"}`}
        >
          Purchase Orders
        </button>
      </nav>

      <div className="max-w-5xl mx-auto p-8">
        {/* ── Dashboard Page ── */}
        {page === "dashboard" && (
          loadingDashboard ? (
            <p className="text-gray-400">Loading dashboard...</p>
          ) : (
            dashboard && (
              <div>
                <h1 className="text-xl font-bold text-gray-800 mb-6">Dashboard</h1>

                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-xs text-gray-400">Total Orders</p>
                    <p className="text-xl font-bold">{dashboard.totalOrders}</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-xs text-gray-400">Total Spend</p>
                    <p className="text-xl font-bold">${dashboard.totalSpend.toFixed(2)}</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-xs text-gray-400">On-Time Delivery</p>
                    <p className="text-xl font-bold">{dashboard.onTimeRate}%</p>
                  </div>
                </div>

                {/* Supplier Spend Chart */}
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-600 mb-4">Spend by Supplier</p>
                  <SupplierChart data={dashboard.supplierStats} />
                </div>
              </div>
            )
          )
        )}

        {/* ── Suppliers Page ── */}
        {page === "suppliers" && (
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-6">Supplier Directory</h1>

            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
              <h2 className="text-sm font-medium text-gray-600 mb-4">Add Supplier</h2>
              <form onSubmit={addSupplier} className="grid grid-cols-2 gap-3">
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2"
                  placeholder="Supplier name *"
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                />
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Contact person"
                  value={supplierForm.contact}
                  onChange={e => setSupplierForm({ ...supplierForm, contact: e.target.value })}
                />
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Email"
                  value={supplierForm.email}
                  onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                />
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Category"
                  value={supplierForm.category}
                  onChange={e => setSupplierForm({ ...supplierForm, category: e.target.value })}
                />
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Payment terms"
                  value={supplierForm.paymentTerms}
                  onChange={e => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                />
                <button
                  type="submit"
                  className="col-span-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
                >
                  Add Supplier
                </button>
              </form>
            </div>

            {suppliers.length === 0 ? (
              <p className="text-gray-400 text-sm">No suppliers yet.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Contact</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Category</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Payment Terms</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                        <td className="px-4 py-3 text-gray-500">{s.contact || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{s.email || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{s.category || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{s.paymentTerms || "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteSupplier(s.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* ── Orders Page ── */}
        {page === "orders" && (
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-6">Purchase Orders</h1>

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 grid grid-cols-4 gap-3">
              <input
                placeholder="Search supplier..."
                className="border rounded-lg px-3 py-2 text-sm"
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="All">All Status</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="date"
                className="border rounded-lg px-3 py-2 text-sm"
                value={filters.startDate}
                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              />
              <input
                type="date"
                className="border rounded-lg px-3 py-2 text-sm"
                value={filters.endDate}
                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>

            {/* Create Purchase Order Form */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
              <h2 className="text-sm font-medium text-gray-600 mb-4">Create Purchase Order</h2>
              <form onSubmit={createOrder} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={orderForm.supplierId}
                    onChange={e => setOrderForm({ ...orderForm, supplierId: e.target.value })}
                  >
                    <option value="">Select supplier *</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input
                    type="date"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={orderForm.expectedDate}
                    onChange={e => setOrderForm({ ...orderForm, expectedDate: e.target.value })}
                  />
                </div>

                {/* Line items */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-500">Line items</span>
                    <button type="button" onClick={addLineItem} className="text-xs text-blue-600 hover:text-blue-800">
                      + Add item
                    </button>
                  </div>
                  <div className="grid grid-cols-12 gap-2 mb-1">
                    <span className="text-xs text-gray-400 col-span-6">Description</span>
                    <span className="text-xs text-gray-400 col-span-2">Quantity</span>
                    <span className="text-xs text-gray-400 col-span-3">Unit cost ($)</span>
                    <span className="col-span-1"></span>
                  </div>
                  {orderForm.lineItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                      <input
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-6"
                        placeholder="Description"
                        value={item.description}
                        onChange={e => updateLineItem(i, "description", e.target.value)}
                      />
                      <input
                        type="number"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => updateLineItem(i, "quantity", e.target.value)}
                      />
                      <input
                        type="number"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-3"
                        placeholder="Unit cost"
                        value={item.unitCost}
                        onChange={e => updateLineItem(i, "unitCost", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeLineItem(i)}
                        className="text-red-400 hover:text-red-600 text-xs col-span-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
                >
                  Create Purchase Order
                </button>
              </form>
            </div>

            {/* Orders List */}
            {loadingOrders ? (
              <p className="text-gray-400 text-sm">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No purchase orders found.
                <br />
                Try adjusting filters or create a new order.
              </p>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-gray-800">{order.supplier.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">
                            PO# {order.poNumber.slice(0, 8).toUpperCase()}
                          </p>
                          {order.isOverdue && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${statusColors[order.status]}`}
                          value={order.status}
                          onChange={e => updateStatus(order.id, e.target.value)}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => deleteOrder(order.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Delete
                        </button>

                        <button
                          onClick={() => exportPDF(order)}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                        >
                          Export PDF
                        </button>
                      </div>
                    </div>

                    {/* Line items table */}
                    <table className="w-full text-xs text-gray-500 mb-2">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-1 font-medium">Item</th>
                          <th className="text-right py-1 font-medium">Qty</th>
                          <th className="text-right py-1 font-medium">Unit cost</th>
                          <th className="text-right py-1 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.lineItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-50">
                            <td className="py-1">{item.description}</td>
                            <td className="text-right py-1">{item.quantity}</td>
                            <td className="text-right py-1">${item.unitCost.toFixed(2)}</td>
                            <td className="text-right py-1">
                              ${(item.quantity * item.unitCost).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Footer */}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">
                        {order.expectedDate
                          ? `Expected: ${new Date(order.expectedDate).toLocaleDateString()}`
                          : "No delivery date set"}
                      </span>
                      <span className="font-medium text-gray-700">
                        Total: ${orderTotal(order).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div className="fixed bottom-5 right-5 bg-black text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
} // end of App function

// The export was already at the top as default, so no extra export needed