
const express = require("express");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// View stock movement history
router.get("/stock", protect, async (req, res) => {
    try {
        const movements = await StockMovement.find()
            .populate("product", "name sku")
            .populate("performedBy", "name")
            .sort({ createdAt: -1 });

        const products = await Product.find().sort({ name: 1 });

        return res.render("stock", {
            movements,
            products,
            user: req.user
        });
    } catch (error) {
        console.error("Failed to load stock history:", error.message);
        return res.status(500).send("Failed to load stock history");
    }
});

// Display stock adjustment page
router.get(
    "/stock/adjust",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const products = await Product.find().sort({ name: 1 });

            return res.render("adjust-stock", {
                products,
                user: req.user
            });
        } catch (error) {
            console.error("Failed to load products:", error.message);
            return res.status(500).send("Failed to load products");
        }
    }
);

// Process Stock In / Stock Out
router.post(
    "/stock/adjust",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        const { productId, type, quantity, reason } = req.body;

        if (
            typeof productId !== "string" ||
            !mongoose.isValidObjectId(productId)
        ) {
            return res.status(400).send("Invalid product ID");
        }

        if (!["Stock In", "Stock Out"].includes(type)) {
            return res.status(400).send("Invalid stock adjustment type");
        }

        // Reject empty, fractional, negative, or unsafe quantities
        if (
            typeof quantity !== "string" ||
            !/^\d+$/.test(quantity.trim())
        ) {
            return res.status(400).send("Quantity must be a positive whole number");
        }

        const amount = Number(quantity);

        if (!Number.isSafeInteger(amount) || amount <= 0) {
            return res.status(400).send("Invalid stock quantity");
        }

        if (typeof reason !== "string" || !reason.trim()) {
            return res.status(400).send("Please provide a reason");
        }

        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const filter = { _id: productId };

                if (type === "Stock Out") {
                    filter.quantity = { $gte: amount };
                } else {
                    filter.quantity = {
                        $lte: Number.MAX_SAFE_INTEGER - amount
                    };
                }

                const update = type === "Stock In"
                    ? { $inc: { quantity: amount } }
                    : { $inc: { quantity: -amount } };

                const updatedProduct = await Product.findOneAndUpdate(
                    filter,
                    update,
                    {
                        returnDocument: "after",
                        runValidators: true,
                        session
                    }
                );

                if (!updatedProduct) {
                    const exists = await Product.exists({
                        _id: productId
                    }).session(session);

                    if (!exists) {
                        const error = new Error("Product not found");
                        error.statusCode = 404;
                        throw error;
                    }

                    const error = new Error(
                        type === "Stock Out"
                            ? "Insufficient stock for this operation"
                            : "Stock quantity is too large"
                    );
                    error.statusCode = 400;
                    throw error;
                }

                const previousQuantity = type === "Stock In"
                    ? updatedProduct.quantity - amount
                    : updatedProduct.quantity + amount;

                await StockMovement.create(
                    [{
                        product: updatedProduct._id,
                        type,
                        quantity: amount,
                        previousQuantity,
                        newQuantity: updatedProduct.quantity,
                        reason: reason.trim(),
                        performedBy: req.user._id
                    }],
                    { session }
                );
            });

            return res.redirect("/stock");
        } catch (error) {
            console.error("Stock adjustment failed:", error.message);

            if (error.statusCode) {
                return res.status(error.statusCode).send(error.message);
            }

            return res.status(500).send(
                "Stock adjustment failed. No changes were committed."
            );
        } finally {
            await session.endSession();
        }
    }
);

module.exports = router;
