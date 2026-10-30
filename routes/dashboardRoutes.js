
const express = require("express");

const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/dashboard", protect, async (req, res) => {
    try {
        // Get total number of products
        const totalProducts = await Product.countDocuments();

        // Get low-stock and out-of-stock products
        const lowStockProducts = await Product.find({
            $expr: {
                $lte: [
                    "$quantity",
                    { $ifNull: ["$lowStockThreshold", 5] }
                ]
            }
        })
            .populate("category", "name")
            .sort({ quantity: 1 })
            .limit(10);

        // Count low-stock products (excluding out-of-stock)
        const lowStockCount = await Product.countDocuments({
            quantity: { $gt: 0 },
            $expr: {
                $lte: [
                    "$quantity",
                    { $ifNull: ["$lowStockThreshold", 5] }
                ]
            }
        });

        // Count out-of-stock products
        const outOfStockCount = await Product.countDocuments({
            quantity: 0
        });

        // Calculate total inventory value
        const inventoryResult = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    inventoryValue: {
                        $sum: {
                            $multiply: ["$price", "$quantity"]
                        }
                    },
                    totalUnits: {
                        $sum: "$quantity"
                    }
                }
            }
        ]);

        const inventoryValue = inventoryResult[0]?.inventoryValue || 0;
        const totalUnits = inventoryResult[0]?.totalUnits || 0;

        // Get recent stock movements
        const recentMovements = await StockMovement.find()
            .populate("product", "name sku")
            .populate("performedBy", "name")
            .sort({ createdAt: -1 })
            .limit(5);

        return res.render("dashboard", {
            user: req.user,
            totalProducts,
            lowStockProducts,
            lowStockCount,
            outOfStockCount,
            inventoryValue,
            totalUnits,
            recentMovements
        });

    } catch (error) {
        console.error("Dashboard error:", error.message);
        return res.status(500).send("Failed to load dashboard");
    }
});

module.exports = router;
