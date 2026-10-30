const express = require("express");

const Sale = require("../models/Sale");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Validate a YYYY-MM-DD date
const parseDateInput = (value) => {
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
};

// Format date as YYYY-MM-DD
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

// Generate daily sales and purchase data
const generateDailyTrends = (
    startDate,
    endDate,
    sales,
    purchases
) => {
    const dailyData = {};

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateKey = formatDate(currentDate);

        dailyData[dateKey] = {
            salesRevenueCents: 0,
            purchaseCostCents: 0
        };

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate daily sales revenue
    sales.forEach((sale) => {
        const dateKey = formatDate(new Date(sale.saleDate));

        if (dailyData[dateKey]) {
            dailyData[dateKey].salesRevenueCents += Math.round(
                Number(sale.totalAmount || 0) * 100
            );
        }
    });

    // Calculate daily purchase expenditure
    purchases.forEach((purchase) => {
        const dateKey = formatDate(new Date(purchase.createdAt));

        if (dailyData[dateKey]) {
            const purchaseCostCents = purchase.items.reduce(
                (total, item) => {
                    const quantity = Number(item.quantity || 0);

                    const priceCents = Math.round(
                        Number(item.purchasePrice || 0) * 100
                    );

                    return total + quantity * priceCents;
                },
                0
            );

            dailyData[dateKey].purchaseCostCents += purchaseCostCents;
        }
    });

    const labels = Object.keys(dailyData);

    return {
        labels,
        salesRevenue: labels.map(
            date => dailyData[date].salesRevenueCents / 100
        ),
        purchaseCost: labels.map(
            date => dailyData[date].purchaseCostCents / 100
        )
    };
};

// Show reports dashboard
router.get(
    "/",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const today = new Date();

            const defaultEnd = new Date(today);
            defaultEnd.setHours(23, 59, 59, 999);

            const defaultStart = new Date(today);
            defaultStart.setDate(defaultStart.getDate() - 29);
            defaultStart.setHours(0, 0, 0, 0);

            const startDate = req.query.startDate
                ? parseDateInput(req.query.startDate)
                : defaultStart;

            const endDate = req.query.endDate
                ? parseDateInput(req.query.endDate)
                : defaultEnd;

            if (!startDate || !endDate || startDate > endDate) {
                return res.status(400).send("Invalid date range.");
            }

            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);

            // Maximum report range: one year
            const maxRangeDays = 366;

            const rangeDays = Math.ceil(
                (endDate - startDate) / (24 * 60 * 60 * 1000)
            );

            if (rangeDays > maxRangeDays) {
                return res.status(400).send(
                    "Please select a date range of one year or less."
                );
            }

            // Fetch sales within selected date range
            const sales = await Sale.find({
                saleDate: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).sort({ saleDate: -1 });

            // Fetch purchases within selected date range
            const purchases = await Purchase.find({
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).sort({ createdAt: -1 });

            // Fetch current inventory
            const products = await Product.find().sort({ name: 1 });

            // Calculate total sales revenue in cents
            const totalRevenueCents = sales.reduce(
                (total, sale) => {
                    return total + Math.round(
                        Number(sale.totalAmount || 0) * 100
                    );
                },
                0
            );

            const totalRevenue = totalRevenueCents / 100;

            // Calculate total units sold
            const totalUnitsSold = sales.reduce(
                (total, sale) => {
                    return total + sale.items.reduce(
                        (sum, item) =>
                            sum + Number(item.quantity || 0),
                        0
                    );
                },
                0
            );

            // Calculate purchase expenditure in cents
            const totalPurchaseCostCents = purchases.reduce(
                (total, purchase) => {
                    const purchaseCents = purchase.items.reduce(
                        (sum, item) => {
                            const quantity = Number(item.quantity || 0);

                            const priceCents = Math.round(
                                Number(item.purchasePrice || 0) * 100
                            );

                            return sum + quantity * priceCents;
                        },
                        0
                    );

                    return total + purchaseCents;
                },
                0
            );

            const totalPurchaseCost =
                totalPurchaseCostCents / 100;

            // Inventory calculations
            const totalProducts = products.length;

            const totalStockUnits = products.reduce(
                (total, product) =>
                    total + Number(product.quantity || 0),
                0
            );

            const outOfStockProducts = products.filter(
                product => Number(product.quantity || 0) === 0
            );

            const lowStockProducts = products.filter(product => {
                const quantity = Number(product.quantity || 0);

                const threshold = Number(
                    product.lowStockThreshold ?? 5
                );

                return quantity > 0 && quantity <= threshold;
            });

            // Generate daily chart data
            const dailyTrends = generateDailyTrends(
                startDate,
                endDate,
                sales,
                purchases
            );

            return res.render("reports", {
                user: req.user,

                sales,
                purchases,
                products,

                totalRevenue,
                totalUnitsSold,
                totalPurchaseCost,

                totalSalesTransactions: sales.length,
                totalPurchaseTransactions: purchases.length,

                totalProducts,
                totalStockUnits,

                outOfStockProducts,
                lowStockProducts,

                dailyTrends,

                startDate: formatDate(startDate),
                endDate: formatDate(endDate)
            });

        } catch (error) {
            console.error("Reports error:", error);

            return res.status(500).send(
                "Unable to generate reports."
            );
        }
    }
);

module.exports = router;
