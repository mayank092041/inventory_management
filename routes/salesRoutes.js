const express = require("express");

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// 1. Display all sales
router.get("/", protect, async (req, res) => {
    try {
        const sales = await Sale.find()
            .populate("soldBy")
            .populate("items.product")
            .sort({ createdAt: -1 });
        res.render("sales", {
            sales,
            user: req.user,
        });


    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).send("Failed to load sales.");
    }
});

// 2. Display the Add Sale form
router.get(
    "/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const products = await Product.find().sort({ name: 1 });


            res.render("add-sale", {
                products,
                user: req.user,
            });
        } catch (error) {
            console.error("Error loading sale form:", error);
            res.status(500).send("Failed to load the sale form.");
        }


    }
);

// 3. Save a sale and reduce stock
router.post(
    "/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        const updatedProducts = [];
        const createdMovements = [];
        let savedSale = null;


        try {
            const productIds = Array.isArray(req.body.product)
                ? req.body.product
                : [req.body.product];

            const quantities = Array.isArray(req.body.quantity)
                ? req.body.quantity
                : [req.body.quantity];

            const sellingPrices = Array.isArray(req.body.sellingPrice)
                ? req.body.sellingPrice
                : [req.body.sellingPrice];

            // Validate the submitted form
            if (
                productIds.length === 0 ||
                productIds.some((id) => !id) ||
                productIds.length !== quantities.length ||
                productIds.length !== sellingPrices.length
            ) {
                return res.status(400).send("Please provide valid sale items.");
            }

            // Prevent the same product from appearing more than once
            if (new Set(productIds).size !== productIds.length) {
                return res.status(400).send("Duplicate products are not allowed.");
            }

            const items = [];
            let totalAmount = 0;

            // Validate products, quantities, and prices
            for (let i = 0; i < productIds.length; i++) {
                const productId = productIds[i];
                const quantity = Number(quantities[i]);
                const sellingPrice = Number(sellingPrices[i]);

                if (!/^[a-f\d]{24}$/i.test(productId)) {
                    return res.status(400).send("Invalid product ID.");
                }

                if (!Number.isSafeInteger(quantity) || quantity < 1) {
                    return res.status(400).send("Quantity must be a positive integer.");
                }

                if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
                    return res.status(400).send("Selling price must be greater than zero.");
                }

                const product = await Product.findById(productId);

                if (!product) {
                    return res.status(400).send("A selected product was not found.");
                }

                items.push({
                    product: product._id,
                    quantity,
                    sellingPrice,
                });

                totalAmount += quantity * sellingPrice;
            }

            if (!Number.isFinite(totalAmount)) {
                return res.status(400).send("Invalid sale total.");
            }

            // Save the sale record
            savedSale = await Sale.create({
                items,
                totalAmount,
                soldBy: req.user._id,
            });

            // Reduce stock and record each Stock Out movement
            for (const item of items) {
                const updatedProduct = await Product.findOneAndUpdate(
                    {
                        _id: item.product,
                        quantity: { $gte: item.quantity },
                    },
                    {
                        $inc: { quantity: -item.quantity },
                    },
                    {
                        new: true,
                        runValidators: true,
                    }
                );

                if (!updatedProduct) {
                    throw new Error(
                        "Insufficient stock or product no longer exists."
                    );
                }

                // Remember the stock change in case a later operation fails
                updatedProducts.push({
                    productId: item.product,
                    quantity: item.quantity,
                });

                const previousQuantity = updatedProduct.quantity + item.quantity;

                const movement = await StockMovement.create({
                    product: item.product,
                    type: "Stock Out",
                    quantity: item.quantity,
                    previousQuantity,
                    newQuantity: updatedProduct.quantity,
                    reason: `Sale ${savedSale._id}`,
                    performedBy: req.user._id,
                });

                createdMovements.push(movement._id);
            }

            // Sale completed successfully
            return res.redirect("/sales");
        } catch (error) {
            console.error("Error creating sale:", error);

            // Attempt to undo changes if an operation failed
            try {
                if (createdMovements.length > 0) {
                    await StockMovement.deleteMany({
                        _id: { $in: createdMovements },
                    });
                }

                for (const update of updatedProducts) {
                    await Product.updateOne(
                        { _id: update.productId },
                        { $inc: { quantity: update.quantity } }
                    );
                }

                if (savedSale) {
                    await Sale.deleteOne({ _id: savedSale._id });
                }
            } catch (rollbackError) {
                console.error("Sale rollback failed:", rollbackError);

                return res.status(500).send(
                    "The sale failed and automatic recovery was incomplete. Please check stock and movement records."
                );
            }

            if (error.message === "Insufficient stock or product no longer exists.") {
                return res.status(400).send(error.message);
            }

            return res.status(500).send("Failed to save the sale.");
        }


    }
);

module.exports = router;
