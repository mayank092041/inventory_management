
const express = require("express");
const mongoose = require("mongoose");

const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// View purchase history
router.get("/purchases", protect, async (req, res) => {
    try {
        const purchases = await Purchase.find()
            .populate("supplier")
            .populate("purchasedBy")
            .populate("items.product")
            .sort({ createdAt: -1 });

        return res.render("purchases", {
            purchases,
            user: req.user
        });
    } catch (error) {
        console.error("Purchase history error:", error.message);
        return res.status(500).send("Failed to load purchase history");
    }
});

// Display add purchase form
router.get(
    "/purchases/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const suppliers = await Supplier.find().sort({ name: 1 });
            const products = await Product.find().sort({ name: 1 });

            return res.render("add-purchase", {
                suppliers,
                products,
                user: req.user
            });
        } catch (error) {
            console.error("Add purchase page error:", error.message);
            return res.status(500).send("Failed to load add purchase page");
        }
    }
);

// Save purchase and update stock in one transaction
router.post(
    "/purchases/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        const { supplier } = req.body;

        const toArray = (value) =>
            Array.isArray(value) ? value : [value];

        const productIds = toArray(req.body.product);
        const quantities = toArray(req.body.quantity);
        const prices = toArray(req.body.purchasePrice);

        if (
            typeof supplier !== "string" ||
            !mongoose.isValidObjectId(supplier) ||
            productIds.length === 0 ||
            productIds.length > 100 ||
            productIds.some(id => typeof id !== "string" ||
                !mongoose.isValidObjectId(id)) ||
            productIds.length !== quantities.length ||
            productIds.length !== prices.length
        ) {
            return res.status(400).send("Invalid purchase details");
        }

        const items = [];
        let totalAmount = 0;

        // Validate quantities and prices before starting transaction
        for (let i = 0; i < productIds.length; i++) {
            const quantityText = quantities[i];
            const priceText = prices[i];

            if (
                typeof quantityText !== "string" ||
                !/^\d+$/.test(quantityText.trim()) ||
                typeof priceText !== "string" ||
                !/^\d+(\.\d{1,2})?$/.test(priceText.trim())
            ) {
                return res.status(400).send(
                    "Enter valid whole quantities and prices with up to two decimal places"
                );
            }

            const quantity = Number(quantityText);
            const purchasePrice = Number(priceText);

            if (
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                !Number.isFinite(purchasePrice) ||
                purchasePrice < 0
            ) {
                return res.status(400).send(
                    "Quantity must be positive and price cannot be negative"
                );
            }

            const lineTotal = Math.round(
                quantity * purchasePrice * 100
            ) / 100;

            if (!Number.isSafeInteger(Math.round(lineTotal * 100))) {
                return res.status(400).send("Purchase amount is too large");
            }

            totalAmount += lineTotal;

            if (!Number.isSafeInteger(Math.round(totalAmount * 100))) {
                return res.status(400).send("Purchase total is too large");
            }

            items.push({
                product: productIds[i],
                quantity,
                purchasePrice
            });
        }

        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const existingSupplier = await Supplier.findById(supplier)
                    .session(session);

                if (!existingSupplier) {
                    const error = new Error("Supplier not found");
                    error.statusCode = 400;
                    throw error;
                }

                // Confirm all products exist
                const uniqueProductIds = [...new Set(productIds)];

                const existingProducts = await Product.find({
                    _id: { $in: uniqueProductIds }
                }).session(session);

                if (existingProducts.length !== uniqueProductIds.length) {
                    const error = new Error("One or more products were not found");
                    error.statusCode = 400;
                    throw error;
                }

                const [purchase] = await Purchase.create(
                    [{
                        supplier,
                        items,
                        totalAmount: Math.round(totalAmount * 100) / 100,
                        purchasedBy: req.user._id
                    }],
                    { session }
                );

                // Increase stock and record every movement
                for (const item of items) {
                    const updatedProduct = await Product.findOneAndUpdate(
                        {
                            _id: item.product,
                            quantity: {
                                $lte: Number.MAX_SAFE_INTEGER - item.quantity
                            }
                        },
                        {
                            $inc: { quantity: item.quantity }
                        },
                        {
                            new: true,
                            runValidators: true,
                            session
                        }
                    );

                    if (!updatedProduct) {
                        const error = new Error(
                            "Stock quantity would exceed the allowed limit"
                        );
                        error.statusCode = 400;
                        throw error;
                    }

                    const previousQuantity =
                        updatedProduct.quantity - item.quantity;

                    await StockMovement.create(
                        [{
                            product: updatedProduct._id,
                            type: "Stock In",
                            quantity: item.quantity,
                            previousQuantity,
                            newQuantity: updatedProduct.quantity,
                            reason: `Purchase ${purchase._id}`,
                            performedBy: req.user._id
                        }],
                        { session }
                    );
                }
            });

            return res.redirect("/purchases");
        } catch (error) {
            console.error("Save purchase error:", error.message);

            if (error.statusCode) {
                return res.status(error.statusCode).send(error.message);
            }

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid purchase details");
            }

            return res.status(500).send(
                "Failed to save purchase. Please try again."
            );
        } finally {
            await session.endSession();
        }
    }
);

module.exports = router;
