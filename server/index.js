// index.js
import express from "express"
import cors from "cors"
import "dotenv/config"
import cron from "node-cron"
import pkg from "@prisma/client"
import PDFDocument from "pdfkit"

const { PrismaClient } = pkg
const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(express.json())

// ─── Overdue check function ───────────────────────────────
async function checkOverdueOrders() {
  const now = new Date()
  const overdue = await prisma.purchaseOrder.findMany({
    where: {
      expectedDate: { lt: now },
      status: { notIn: ["Delivered", "Cancelled"] }
    },
    include: { supplier: true }
  })
  if (overdue.length > 0) {
    console.log(`[Overdue Check] ${overdue.length} overdue order(s):`)
    overdue.forEach(o => {
      console.log(`  - PO ${o.poNumber.slice(0, 8).toUpperCase()} from ${o.supplier.name} (expected ${o.expectedDate.toLocaleDateString()})`)
    })
  } else {
    console.log("[Overdue Check] No overdue orders.")
  }
  return overdue
}

// Run check on server start
checkOverdueOrders()

// Run check every day at 8am
cron.schedule("0 8 * * *", () => {
  console.log("[Cron] Running daily overdue check...")
  checkOverdueOrders()
})

// ─── Suppliers ───────────────────────────────────────────
app.get("/api/suppliers", async (req, res) => {
  const suppliers = await prisma.supplier.findMany()
  res.json(suppliers)
})

app.post("/api/suppliers", async (req, res) => {
  const { name, contact, email, category, paymentTerms } = req.body
  const supplier = await prisma.supplier.create({
    data: { name, contact, email, category, paymentTerms }
  })
  res.json(supplier)
})

app.delete("/api/suppliers/:id", async (req, res) => {
  const { id } = req.params
  await prisma.supplier.delete({ where: { id: Number(id) } })
  res.json({ message: "Supplier deleted" })
})

// ─── Purchase Orders ──────────────────────────────────────
app.get("/api/orders", async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query

    const where = {}

    // Filter by status
    if (status && status !== "All") {
      where.status = status
    }

    // Filter by supplier name
    if (search) {
      where.supplier = {
        name: {
          contains: search,
          mode: "insensitive",
        },
      }
    }

    // Filter by date range
    if (startDate || endDate) {
      where.expectedDate = {}

      if (startDate) {
        where.expectedDate.gte = new Date(startDate)
      }

      if (endDate) {
        where.expectedDate.lte = new Date(endDate)
      }
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, lineItems: true },
      orderBy: { createdAt: "desc" },
    })

    const now = new Date()

    const ordersWithOverdue = orders.map(o => ({
      ...o,
      isOverdue:
        o.expectedDate &&
        new Date(o.expectedDate) < now &&
        !["Delivered", "Cancelled"].includes(o.status),
    }))

    res.json(ordersWithOverdue)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

app.post("/api/orders", async (req, res) => {
  const { supplierId, expectedDate, lineItems } = req.body
  const order = await prisma.purchaseOrder.create({
    data: {
      supplierId: Number(supplierId),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      lineItems: {
        create: lineItems.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost)
        }))
      }
    },
    include: { supplier: true, lineItems: true }
  })
  res.json(order)
})

app.patch("/api/orders/:id/status", async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  const order = await prisma.purchaseOrder.update({
    where: { id: Number(id) },
    data: { status }
  })
  res.json(order)
})

app.delete("/api/orders/:id", async (req, res) => {
  const { id } = req.params
  await prisma.lineItem.deleteMany({ where: { orderId: Number(id) } })
  await prisma.purchaseOrder.delete({ where: { id: Number(id) } })
  res.json({ message: "Order deleted" })
})

// ─── Dashboard API ───────────────────────────────────────
app.get("/api/dashboard", async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: { supplier: true, lineItems: true }
    })

    const totalOrders = orders.length
    const totalSpend = orders.reduce((sum, order) => {
      return sum + order.lineItems.reduce((s, item) => s + item.quantity * item.unitCost, 0)
    }, 0)

    // On-time delivery
    const deliveredOrders = orders.filter(o => o.status === "Delivered")
    const onTimeOrders = deliveredOrders.filter(o => {
      if (!o.expectedDate || !o.updatedAt) return false
      return new Date(o.updatedAt) <= new Date(o.expectedDate)
    })
    const onTimeRate = deliveredOrders.length
      ? (onTimeOrders.length / deliveredOrders.length) * 100
      : 0

    // Supplier performance stats
    const supplierStats = {}
    orders.forEach(order => {
      const supplierName = order.supplier.name
      if (!supplierStats[supplierName]) {
        supplierStats[supplierName] = { totalOrders: 0, totalSpend: 0, onTimeOrders: 0, leadTimes: [] }
      }

      const orderTotal = order.lineItems.reduce((s, item) => s + item.quantity * item.unitCost, 0)
      supplierStats[supplierName].totalOrders += 1
      supplierStats[supplierName].totalSpend += orderTotal
      if (order.status === "Delivered" && order.updatedAt && order.expectedDate) {
        supplierStats[supplierName].onTimeOrders += new Date(order.updatedAt) <= new Date(order.expectedDate) ? 1 : 0
      }
      if (order.createdAt && order.expectedDate) {
        const leadTime = (new Date(order.expectedDate) - new Date(order.createdAt)) / (1000 * 60 * 60 * 24)
        supplierStats[supplierName].leadTimes.push(leadTime)
      }
    })

    // Average lead time per supplier
    for (const supplier in supplierStats) {
      const times = supplierStats[supplier].leadTimes
      supplierStats[supplier].averageLeadTime = times.length
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 0
      delete supplierStats[supplier].leadTimes
    }

    // Monthly trends
    const orderVolumeByMonth = {}
    const spendByMonth = {}
    orders.forEach(order => {
      const month = new Date(order.createdAt).toISOString().slice(0, 7) // YYYY-MM
      orderVolumeByMonth[month] = (orderVolumeByMonth[month] || 0) + 1
      const orderTotal = order.lineItems.reduce((s, item) => s + item.quantity * item.unitCost, 0)
      spendByMonth[month] = (spendByMonth[month] || 0) + orderTotal
    })

    res.json({
      totalOrders,
      totalSpend,
      onTimeRate: Number(onTimeRate.toFixed(1)),
      supplierStats,
      orderVolumeByMonth,
      spendByMonth
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Dashboard error" })
  }
})

// ─── PDF Export ─────────────────────────────────────────
app.get("/api/orders/:id/pdf", async (req, res) => {
  const { id } = req.params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: Number(id) },
    include: { supplier: true, lineItems: true }
  })
  if (!order) return res.status(404).json({ error: "Order not found" })

  const doc = new PDFDocument()
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename=PO-${order.poNumber}.pdf`)
  doc.pipe(res)

  doc.fontSize(18).text(`Purchase Order: ${order.poNumber}`, { underline: true })
  doc.moveDown()
  doc.fontSize(14).text(`Supplier: ${order.supplier.name}`)
  doc.text(`Expected Date: ${order.expectedDate ? order.expectedDate.toDateString() : "N/A"}`)
  doc.moveDown()
  doc.text("Line Items:")
  order.lineItems.forEach(item => {
    doc.text(`${item.description} — Qty: ${item.quantity}, Unit: $${item.unitCost.toFixed(2)}, Total: $${(item.quantity * item.unitCost).toFixed(2)}`)
  })

  doc.moveDown()
  const total = order.lineItems.reduce((s, item) => s + item.quantity * item.unitCost, 0)
  doc.text(`Total: $${total.toFixed(2)}`, { bold: true })
  doc.end()
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))