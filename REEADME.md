# PO Tracker

A full-stack purchase order and supplier management tool built with React, Node.js, Express, PostgreSQL, and Prisma.

## Features
- Supplier directory — add, view, delete suppliers
- Purchase order creation with dynamic line items
- Order status workflow (Draft → Sent → Confirmed → In Transit → Delivered)
- Overdue delivery alerts with daily cron job
- Supplier performance dashboard with charts
- Search and filter on orders
- PDF export for purchase orders
- Toast notifications

## Tech Stack
- **Frontend:** React, Tailwind CSS, Vite
- **Backend:** Node.js, Express
- **Database:** PostgreSQL + Prisma ORM
- **Other:** node-cron, Recharts

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL running locally

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/po-tracker.git
cd po-tracker

# Install server dependencies
cd server && npm install

# Set up environment variables
echo 'DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/po_tracker"' > .env

# Run database migrations
npx prisma migrate dev

# Start the backend
npm run dev

# In a new terminal tab — install and start frontend
cd ../client && npm install && npm run dev
```

Open http://localhost:5173 in your browser.