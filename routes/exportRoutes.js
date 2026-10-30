
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
router.use(allowedRoles("Admin", "Manager"));

// Escape CSV values and prevent formula injection
function escapeCSV(value) {
    let text = String(value ?? "");

    if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

// Protect Excel cells against formula injection
function safeExcelValue(value) {
    if (typeof value !== "string") {
        return value;
    }

    return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

// Validate YYYY-MM-DD date input
function parseDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return null;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

// Get and validate date range
function getDateRange(req) {
    const { startDate, endDate } = req.query;

    if (!startDate && !endDate) {
        return null;
    }

    const start = startDate ? parseDate(startDate) : null;
    const end = endDate ? parseDate(endDate) : null;

    if ((startDate && !start) || (endDate && !end)) {
        const error = new Error("Invalid date. Use YYYY-MM-DD.");
        error.statusCode = 400;
        throw error;
    }

    if (start) {
        start.setHours(0, 0, 0, 0);
    }

    if (end) {
        end.setHours(23, 59, 59, 999);
    }

    if (start && end && start > end) {
        const error = new Error("Start date cannot be after end date.");
        error.statusCode = 400;
        throw error;
    }

    if (start && end) {
        const days = (end - start) / (24 * 60 * 60 * 1000);

        if (days > 366) {
            const error = new Error(
                "Please select a date range of one year or less."
            );
            error.statusCode = 400;
            throw error;
        }
    }

    const range = {};

    if (start) range.$gte = start;
    if (end) range.$lte = end;

    return range;
}

// Download CSV or Excel report
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

    worksheet.addRow(headers.map(safeExcelValue));

    rows.forEach(row => {
        worksheet.addRow(row.map(safeExcelValue));
    });

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

// Export sales
router.get("/sales", async (req, res) => {
    try {
        const dateRange = getDateRange(req);

        // Assumes Sale uses saleDate; see note below.
        const filter = dateRange ? { saleDate: dateRange } : {};

        const sales = await Sale.find(filter)
            .populate("soldBy", "name")
            .populate("items.product", "name sku")
            .sort({ saleDate: -1 });

        const rows = [];

        sales.forEach(sale => {
            sale.items.forEach(item => {
                rows.push([
                    sale.saleDate
                        ? sale.saleDate.toISOString().slice(0, 10)
                        : "",
                    sale.soldBy?.name || "",
                    item.product?.name || "Deleted product",
                    item.product?.sku || "",
                    item.quantity,
                    item.sellingPrice,
                    Number(
                        (item.quantity * item.sellingPrice).toFixed(2)
                    ),
                    sale.totalAmount
                ]);
            });
        });

        return await downloadReport(
            req,
            res,
            [
                "Date",
                "Sold By",
                "Product",
                "SKU",
                "Quantity",
                "Selling Price",
                "Item Total",
                "Sale Total"
            ],
            rows,
            "sales-report"
        );
    } catch (error) {
        console.error("Sales export error:", error.message);

        if (!res.headersSent) {
            return res.status(error.statusCode || 500).send(
                error.statusCode
                    ? error.message
                    : "Could not export sales report."
            );
        }
    }
});

// Export purchases
router.get("/purchases", async (req, res) => {
    try {
        const dateRange = getDateRange(req);
        const filter = dateRange ? { createdAt: dateRange } : {};

        const purchases = await Purchase.find(filter)
            .populate("supplier", "name")
            .populate("purchasedBy", "name")
            .populate("items.product", "name sku")
            .sort({ createdAt: -1 });

        const rows = [];

        purchases.forEach(purchase => {
            purchase.items.forEach(item => {
                rows.push([
                    purchase.createdAt
                        ? purchase.createdAt.toISOString().slice(0, 10)
                        : "",
                    purchase.supplier?.name || "",
                    purchase.purchasedBy?.name || "",
                    item.product?.name || "Deleted product",
                    item.product?.sku || "",
                    item.quantity,
                    item.purchasePrice,
                    Number(
                        (item.quantity * item.purchasePrice).toFixed(2)
                    )
                ]);
            });
        });

        return await downloadReport(
            req,
            res,
            [
                "Date",
                "Supplier",
                "Purchased By",
                "Product",
                "SKU",
                "Quantity",
                "Purchase Price",
                "Item Total"
            ],
            rows,
            "purchases-report"
        );
    } catch (error) {
        console.error("Purchases export error:", error.message);

        if (!res.headersSent) {
            return res.status(error.statusCode || 500).send(
                error.statusCode
                    ? error.message
                    : "Could not export purchases report."
            );
        }
    }
});

// Export current inventory
router.get("/inventory", async (req, res) => {
    try {
        const products = await Product.find()
            .populate("category", "name")
            .sort({ name: 1 });

        const rows = products.map(product => {
            const quantity = Number(product.quantity || 0);
            const threshold = Number(product.lowStockThreshold ?? 5);

            const status = quantity === 0
                ? "Out of Stock"
                : quantity <= threshold
                    ? "Low Stock"
                    : "In Stock";

            return [
                product.name,
                product.sku,
                product.category?.name || "",
                product.price,
                quantity,
                threshold,
                status
            ];
        });

        return await downloadReport(
            req,
            res,
            [
                "Product",
                "SKU",
                "Category",
                "Price",
                "Quantity",
                "Low Stock Threshold",
                "Stock Status"
            ],
            rows,
            "inventory-report"
        );
    } catch (error) {
        console.error("Inventory export error:", error.message);

        if (!res.headersSent) {
            return res.status(500).send(
                "Could not export inventory report."
            );
        }
    }
});

module.exports = router;
