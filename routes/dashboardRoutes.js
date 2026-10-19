
const Product = require("../models/Product");
const express = require("express");
const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/dashboard", protect, async (req, res) => {
    try {
        const products = await Product.find({
            $expr: {
                $lte: [
                    "$quantity",
                    { $ifNull: ["$lowStockThreshold", 5] }
                ]
            }
        }).sort({ quantity: 1 });

        const lowStockCount = products.filter(
            product => product.quantity > 0
        ).length;

        const outOfStockCount = products.filter(
            product => product.quantity === 0
        ).length;

        res.render("dashboard", {
            user: req.user,
            lowStockProducts: products,
            lowStockCount,
            outOfStockCount
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send(`Failed to load dashboard ${error.message}`);
    }
});

module.exports = router;
