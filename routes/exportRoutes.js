
const express = require("express");
const ExcelJS = require("exceljs");

const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Purchase = require("../models/Purchase");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Protect all export routes
router.use(protect);
router.use((req, res, next) => {
  const referer = req.get("Referer");

  if (!referer || !referer.startsWith("http://localhost:3000/reports")) {
    return res.status(403).send(
      "Please download reports from the Reports page."
    );
  }

  next();
});

// Convert values safely for CSV
function escapeCSV(value) {
  let text = String(value ?? "");

  // Prevent spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

// Download CSV or Excel file
async function downloadReport(req, res, headers, rows, filename) {
  const format = req.query.format || "csv";

  if (!["csv", "xlsx"].includes(format)) {
    return res.status(400).send("Invalid format. Use csv or xlsx.");
  }

  if (format === "csv") {
    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.csv"`
    );

    return res.send("\uFEFF" + csv);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  worksheet.addRow(headers);
  rows.forEach(row => worksheet.addRow(row));

  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.columns.forEach(column => {
    column.width = 20;
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
}

// Optional date filtering
function getDateRange(req) {
  const { startDate, endDate } = req.query;

  if (!startDate && !endDate) return {};

  const filter = {};

  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new Error("Invalid start date.");
    }
    start.setHours(0, 0, 0, 0);
    filter.$gte = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      throw new Error("Invalid end date.");
    }
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }

  return filter;
}

// Export sales
router.get("/sales", async (req, res) => {
  try {
    const dateRange = getDateRange(req);
    const filter = Object.keys(dateRange).length
      ? { saleDate: dateRange }
      : {};

    const sales = await Sale.find(filter)
      .populate("soldBy", "name")
      .populate("items.product", "name sku")
      .sort({ saleDate: -1 });

    const rows = [];

    sales.forEach(sale => {
      sale.items.forEach(item => {
        rows.push([
          sale.saleDate?.toISOString().slice(0, 10) || "",
          sale.soldBy?.name || "",
          item.product?.name || "Deleted product",
          item.product?.sku || "",
          item.quantity,
          item.sellingPrice,
          item.quantity * item.sellingPrice,
          sale.totalAmount
        ]);
      });
    });

    await downloadReport(
      req, res,
      ["Date", "Sold By", "Product", "SKU", "Quantity",
       "Selling Price", "Item Total", "Sale Total"],
      rows,
      "sales-report"
    );
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Export purchases
router.get("/purchases", async (req, res) => {
  try {
    const dateRange = getDateRange(req);
    const filter = Object.keys(dateRange).length
      ? { createdAt: dateRange }
      : {};

    const purchases = await Purchase.find(filter)
      .populate("supplier", "name")
      .populate("purchasedBy", "name")
      .populate("items.product", "name sku")
      .sort({ createdAt: -1 });

    const rows = [];

    purchases.forEach(purchase => {
      purchase.items.forEach(item => {
        rows.push([
          purchase.createdAt?.toISOString().slice(0, 10) || "",
          purchase.supplier?.name || "",
          purchase.purchasedBy?.name || "",
          item.product?.name || "Deleted product",
          item.product?.sku || "",
          item.quantity,
          item.purchasePrice,
          item.quantity * item.purchasePrice
        ]);
      });
    });

    await downloadReport(
      req, res,
      ["Date", "Supplier", "Purchased By", "Product", "SKU",
       "Quantity", "Purchase Price", "Item Total"],
      rows,
      "purchases-report"
    );
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Export current inventory
router.get("/inventory", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name")
      .sort({ name: 1 });

    const rows = products.map(product => [
      product.name,
      product.sku,
      product.category?.name || "",
      product.price,
      product.quantity,
      product.lowStockThreshold ?? 5,
      product.quantity === 0
        ? "Out of Stock"
        : product.quantity <= (product.lowStockThreshold ?? 5)
          ? "Low Stock"
          : "In Stock"
    ]);

    await downloadReport(
      req, res,
      ["Product", "SKU", "Category", "Price", "Quantity",
       "Low Stock Threshold", "Stock Status"],
      rows,
      "inventory-report"
    );
  } catch (error) {
    res.status(500).send("Could not export inventory report.");
  }
});

module.exports = router;
