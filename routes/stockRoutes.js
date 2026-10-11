
const express = require("express");

const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();


// ========================================
// VIEW STOCK MOVEMENT HISTORY
// ========================================

router.get("/stock", protect, async (req, res) => {
    try {
        const movements = await StockMovement.find()
            .populate("product", "name sku")
            .populate("performedBy", "name")
            .sort({ createdAt: -1 });

        const products = await Product.find()
            .sort({ name: 1 });

        res.render("stock", {
            movements,
            products,
            user: req.user
        });

    } catch (error) {
        console.log(error);
        res.status(500).send("Failed to load stock history");
    }
});


// ========================================
// SHOW STOCK ADJUSTMENT PAGE
// ========================================

router.get(
    "/stock/adjust",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const products = await Product.find()
                .sort({ name: 1 });

            res.render("adjust-stock", {
                products,
                user: req.user
            });

        } catch (error) {
            console.log(error);
            res.status(500).send("Failed to load products");
        }
    }
);


// ========================================
// PROCESS STOCK IN / STOCK OUT
// ========================================

router.post(
    "/stock/adjust",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const {
                productId,
                type,
                quantity,
                reason
            } = req.body;

            const amount = Number(quantity);

            if (
                !productId ||
                !["Stock In", "Stock Out"].includes(type) ||
                !Number.isSafeInteger(amount) ||
                amount <= 0 ||
                !reason ||
                !reason.trim()
            ) {
                return res.status(400).send(
                    "Please provide valid stock adjustment details"
                );
            }

            // Update stock atomically to prevent lost updates.
            const filter = {
                _id: productId
            };

            if (type === "Stock Out") {
                filter.quantity = { $gte: amount };
            } else {
                filter.quantity = { $lte: Number.MAX_SAFE_INTEGER - amount };
            }

            const update = type === "Stock In"
                ? { $inc: { quantity: amount } }
                : { $inc: { quantity: -amount } };

            const updatedProduct = await Product.findOneAndUpdate(
                filter,
                update,
                { new: true, runValidators: true }
            );

            if (!updatedProduct) {
                const productExists = await Product.exists({
                    _id: productId
                });

                if (!productExists) {
                    return res.status(404).send("Product not found");
                }

                return res.status(400).send(
                    type === "Stock Out"
                        ? "Insufficient stock for this operation"
                        : "Stock quantity is too large"
                );
            }

            const previousQuantity = type === "Stock In"
                ? updatedProduct.quantity - amount
                : updatedProduct.quantity + amount;

            try {
                await StockMovement.create({
                    product: updatedProduct._id,
                    type,
                    quantity: amount,
                    previousQuantity,
                    newQuantity: updatedProduct.quantity,
                    reason: reason.trim(),
                    performedBy: req.user._id
                });
            } catch (historyError) {
                // Roll back the quantity if saving the history fails.
                await Product.updateOne(
                    {
                        _id: updatedProduct._id,
                        quantity: updatedProduct.quantity
                    },
                    {
                        $inc: {
                            quantity: type === "Stock In"
                                ? -amount
                                : amount
                        }
                    }
                );

                throw historyError;
            }

            res.redirect("/stock");

        } catch (error) {
            console.log(error);
            res.status(500).send(`Stock adjustment failed: ${error.message}`)
        }
    }
);

module.exports = router;
