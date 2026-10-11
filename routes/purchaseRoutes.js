
const express = require("express");
const mongoose = require("mongoose");

const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const StockMovement = require("../models/StockMovement");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();


// ========================================
// VIEW PURCHASE HISTORY
// ========================================

router.get("/purchases", protect, async (req, res) => {
    try {
        const purchases = await Purchase.find()
            .populate("supplier")
            .populate("purchasedBy")
            .populate("items.product")
            .sort({ createdAt: -1 });

        res.render("purchases", {
            purchases,
            user: req.user
        });

    } catch (error) {
        console.error("Purchase history error:", error);
        res.status(500).send("Failed to load purchase history");
    }
});


// ========================================
// SHOW ADD PURCHASE FORM
// ========================================

router.get(
    "/purchases/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const suppliers = await Supplier.find().sort({ name: 1 });
            const products = await Product.find().sort({ name: 1 });

            res.render("add-purchase", {
                suppliers,
                products,
                user: req.user
            });

        } catch (error) {
            console.error("Add purchase page error:", error);
            res.status(500).send("Failed to load add purchase page");
        }
    }
);


// ========================================
// SAVE PURCHASE AND UPDATE STOCK
// ========================================

router.post(
    "/purchases/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        const updatedProducts = [];
        const createdMovements = [];
        let savedPurchase = null;

        try {
            const { supplier } = req.body;

            // Form fields must use product, quantity and purchasePrice.
            // Each field can contain one value or multiple values.
            const toArray = value =>
                Array.isArray(value) ? value : [value];

            const productIds = toArray(req.body.product);
            const quantities = toArray(req.body.quantity);
            const prices = toArray(req.body.purchasePrice);

            if (
                !supplier ||
                !mongoose.isValidObjectId(supplier) ||
                productIds.length === 0 ||
                productIds.some(id => !id) ||
                productIds.length !== quantities.length ||
                productIds.length !== prices.length
            ) {
                return res.status(400).send("Invalid purchase details");
            }

            // Validate supplier
            const existingSupplier = await Supplier.findById(supplier);

            if (!existingSupplier) {
                return res.status(400).send("Supplier not found");
            }

            const items = [];
            let totalAmount = 0;

            // Validate every item before changing stock
            for (let i = 0; i < productIds.length; i++) {
                const productId = productIds[i];
                const quantity = Number(quantities[i]);
                const purchasePrice = Number(prices[i]);

                if (
                    !mongoose.isValidObjectId(productId) ||
                    !Number.isSafeInteger(quantity) ||
                    quantity < 1 ||
                    !Number.isFinite(purchasePrice) ||
                    purchasePrice < 0
                ) {
                    return res.status(400).send(
                        "Invalid product, quantity or purchase price"
                    );
                }

                const existingProduct = await Product.findById(productId);

                if (!existingProduct) {
                    return res.status(400).send("Product not found");
                }

                items.push({
                    product: existingProduct._id,
                    quantity,
                    purchasePrice
                });

                totalAmount += quantity * purchasePrice;
            }

            if (!Number.isFinite(totalAmount)) {
                return res.status(400).send("Invalid purchase total");
            }

            // Create purchase record
            savedPurchase = await Purchase.create({
                supplier,
                items,
                totalAmount,
                purchasedBy: req.user._id
            });

            // Increase stock and record each Stock In movement
            for (const item of items) {
                const updatedProduct = await Product.findOneAndUpdate(
                    { _id: item.product },
                    { $inc: { quantity: item.quantity } },
                    { new: true, runValidators: true }
                );

                if (!updatedProduct) {
                    throw new Error("Product not found during stock update");
                }

                updatedProducts.push({
                    productId: updatedProduct._id,
                    quantity: item.quantity
                });

                const previousQuantity =
                    updatedProduct.quantity - item.quantity;

                const movement = await StockMovement.create({
                    product: updatedProduct._id,
                    type: "Stock In",
                    quantity: item.quantity,
                    previousQuantity,
                    newQuantity: updatedProduct.quantity,
                    reason: `Purchase ${savedPurchase._id}`,
                    performedBy: req.user._id
                });

                createdMovements.push(movement._id);
            }

            return res.redirect("/purchases");

        } catch (error) {
            console.error("Save purchase error:", error);

            // Attempt to undo changes if processing fails
            try {
                if (createdMovements.length > 0) {
                    await StockMovement.deleteMany({
                        _id: { $in: createdMovements }
                    });
                }

                for (const update of updatedProducts.reverse()) {
                    await Product.updateOne(
                        { _id: update.productId },
                        { $inc: { quantity: -update.quantity } }
                    );
                }

                if (savedPurchase) {
                    await Purchase.findByIdAndDelete(savedPurchase._id);
                }
            } catch (rollbackError) {
                console.error("Purchase rollback error:", rollbackError);
                return res.status(500).send(
                    "Purchase failed and rollback needs checking. Check stock and purchase history."
                );
            }

            return res.status(500).send("Failed to save purchase");
        }
    }
);


module.exports = router;
