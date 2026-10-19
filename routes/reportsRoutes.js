
const express = require("express");
const Sale = require("../models/Sale");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Show reports dashboard
router.get(
    "/",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            // Default report period: last 30 days
            const today = new Date();

            const defaultEnd = new Date(today);
            defaultEnd.setHours(23, 59, 59, 999);

            const defaultStart = new Date(today);
            defaultStart.setDate(defaultStart.getDate() - 29);
            defaultStart.setHours(0, 0, 0, 0);

            const startDate = req.query.startDate
                ? new Date(req.query.startDate)
                : defaultStart;

            const endDate = req.query.endDate
                ? new Date(req.query.endDate)
                : defaultEnd;

            // Validate the selected dates
            if (
                isNaN(startDate.getTime()) ||
                isNaN(endDate.getTime()) ||
                startDate > endDate
            ) {
                return res.status(400).send("Invalid date range.");
            }

            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);

            // Get sales within the selected date range
            const sales = await Sale.find({
                saleDate: {
                    $gte: startDate,
                    $lte: endDate,
                },
            }).sort({ saleDate: -1 });

            // Get purchases within the selected date range
            const purchases = await Purchase.find({
                createdAt: {
                    $gte: startDate,
                    $lte: endDate,
                },
            }).sort({ createdAt: -1 });

            // Get all products for inventory analysis
            const products = await Product.find().sort({ name: 1 });

            // Calculate sales statistics
            const totalRevenue = sales.reduce(
                (total, sale) => total + Number(sale.totalAmount || 0),
                0
            );

            const totalUnitsSold = sales.reduce((total, sale) => {
                return (
                    total +
                    sale.items.reduce(
                        (itemTotal, item) =>
                            itemTotal + Number(item.quantity || 0),
                        0
                    )
                );
            }, 0);

            // Calculate purchase expenditure
            // Assumes each purchase item contains quantity and purchasePrice.
            const totalPurchaseCost = purchases.reduce((total, purchase) => {
                const purchaseAmount = purchase.items.reduce(
                    (itemTotal, item) =>
                        itemTotal +
                        Number(item.quantity || 0) *
                        Number(item.purchasePrice || 0),
                    0
                );

                return total + purchaseAmount;
            }, 0);

            // Inventory statistics
            const totalProducts = products.length;

            const totalStockUnits = products.reduce(
                (total, product) =>
                    total + Number(product.quantity || 0),
                0
            );

            const outOfStockProducts = products.filter(
                (product) => Number(product.quantity || 0) === 0
            );

            // Default low-stock rule: quantity from 1 to 5
            const lowStockProducts = products.filter((product) => {
                const quantity = Number(product.quantity || 0);
                const threshold = Number(product.lowStockThreshold ?? 5);

                return quantity > 0 && quantity <= threshold;
            });

            // Format dates for the HTML date inputs
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");

                return `${year}-${month}-${day}`;
            };

            res.render("reports", {
                user: req.user,
                sales,
                purchases,
                products,
                totalRevenue,
                totalUnitsSold,
                totalPurchaseCost,
                totalProducts,
                totalStockUnits,
                outOfStockProducts,
                lowStockProducts,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
            });
        } catch (error) {
            console.error("Reports error:", error);
            res.status(500).send("Unable to generate reports.");
        }
    }
);

module.exports = router;
