
const express = require("express");
const mongoose = require("mongoose");

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Display all sales
router.get("/", protect, async (req, res) => {
    try {
        const sales = await Sale.find()
            .populate("soldBy")
            .populate("items.product")
            .sort({ createdAt: -1 });

        return res.render("sales", {
            sales,
            user: req.user
        });
    } catch (error) {
        console.error("Error fetching sales:", error.message);
        return res.status(500).send("Failed to load sales");
    }
});

// Display Add Sale form
router.get(
    "/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const products = await Product.find().sort({ name: 1 });

            return res.render("add-sale", {
                products,
                user: req.user
            });
        } catch (error) {
            console.error("Error loading sale form:", error.message);
            return res.status(500).send("Failed to load sale form");
        }
    }
);

// Create sale and reduce stock in one transaction
router.post(
    "/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        const toArray = (value) =>
            Array.isArray(value) ? value : [value];

        const productIds = toArray(req.body.product);
        const quantities = toArray(req.body.quantity);
        const sellingPrices = toArray(req.body.sellingPrice);

        // Validate submitted form fields
        if (
            productIds.length === 0 ||
            productIds.length > 100 ||
            productIds.some(
                id => typeof id !== "string" ||
                    !mongoose.isValidObjectId(id)
            ) ||
            productIds.length !== quantities.length ||
            productIds.length !== sellingPrices.length
        ) {
            return res.status(400).send("Please provide valid sale items");
        }

        // Prevent duplicate product entries
        const normalizedIds = productIds.map(id => id.toLowerCase());

        if (new Set(normalizedIds).size !== normalizedIds.length) {
            return res.status(400).send("Duplicate products are not allowed");
        }

        const items = [];
        let totalCents = 0;

        // Validate quantities and prices before changing anything
        for (let i = 0; i < productIds.length; i++) {
            const quantityText = quantities[i];
            const priceText = sellingPrices[i];

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
            const sellingPrice = Number(priceText);

            if (
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                !Number.isFinite(sellingPrice) ||
                sellingPrice <= 0
            ) {
                return res.status(400).send(
                    "Quantity must be positive and selling price must be greater than zero"
                );
            }

            const priceCents = Math.round(sellingPrice * 100);

            if (!Number.isSafeInteger(priceCents)) {
                return res.status(400).send("Selling price is too large");
            }

            const lineCents = quantity * priceCents;

            if (
                !Number.isSafeInteger(lineCents) ||
                !Number.isSafeInteger(totalCents + lineCents)
            ) {
                return res.status(400).send("Sale total is too large");
            }

            totalCents += lineCents;

            items.push({
                product: productIds[i],
                quantity,
                sellingPrice: priceCents / 100
            });
        }

        const totalAmount = totalCents / 100;
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Check that all selected products exist
                const existingProducts = await Product.find({
                    _id: { $in: productIds }
                }).session(session);

                if (existingProducts.length !== productIds.length) {
                    const error = new Error(
                        "One or more selected products were not found"
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // Save sale inside the transaction
                const [sale] = await Sale.create(
                    [{
                        items,
                        totalAmount,
                        soldBy: req.user._id
                    }],
                    { session }
                );

                // Reduce stock and record each Stock Out movement
                for (const item of items) {
                    const updatedProduct = await Product.findOneAndUpdate(
                        {
                            _id: item.product,
                            quantity: { $gte: item.quantity }
                        },
                        {
                            $inc: { quantity: -item.quantity }
                        },
                        {
                            new: true,
                            runValidators: true,
                            session
                        }
                    );

                    if (!updatedProduct) {
                        const error = new Error(
                            "Insufficient stock for one or more products"
                        );
                        error.statusCode = 400;
                        throw error;
                    }

                    const previousQuantity =
                        updatedProduct.quantity + item.quantity;

                    await StockMovement.create(
                        [{
                            product: updatedProduct._id,
                            type: "Stock Out",
                            quantity: item.quantity,
                            previousQuantity,
                            newQuantity: updatedProduct.quantity,
                            reason: `Sale ${sale._id}`,
                            performedBy: req.user._id
                        }],
                        { session }
                    );
                }
            });

            return res.redirect("/sales");
        } catch (error) {
            console.error("Error creating sale:", error.message);

            if (error.statusCode) {
                return res.status(error.statusCode).send(error.message);
            }

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid sale details");
            }

            return res.status(500).send(
                "Failed to save sale. Please try again."
            );
        } finally {
            await session.endSession();
        }
    }
);

module.exports = router;
