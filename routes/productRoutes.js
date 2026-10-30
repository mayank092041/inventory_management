
const express = require("express");

const Product = require("../models/Product");
const Category = require("../models/Category");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Validate MongoDB ObjectId
const isValidId = (id) => /^[a-f\d]{24}$/i.test(id);

// Validate and parse a non-negative whole number
const parseNonNegativeInteger = (value, fieldName) => {
    if (
        typeof value !== "string" ||
        !/^\d+$/.test(value.trim())
    ) {
        throw new Error(`${fieldName} must be a non-negative whole number`);
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid ${fieldName}`);
    }

    return parsed;
};

// Display all products
router.get("/products", protect, async (req, res) => {
    try {
        const products = await Product.find()
            .populate("category")
            .sort({ createdAt: -1 });

        return res.render("products", {
            products,
            user: req.user
        });
    } catch (error) {
        console.error("Failed to load products:", error.message);
        return res.status(500).send("Failed to load products");
    }
});

// Display add product page
router.get(
    "/products/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const categories = await Category.find().sort({ name: 1 });

            return res.render("add-product", {
                categories,
                user: req.user
            });
        } catch (error) {
            console.error("Failed to load add product page:", error.message);
            return res.status(500).send("Failed to load add product page");
        }
    }
);

// Add product
router.post(
    "/products/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const {
                name,
                description,
                category,
                price,
                quantity,
                sku
            } = req.body;

            // Validate SKU
            if (typeof sku !== "string" || !sku.trim()) {
                return res.status(400).send("SKU is required");
            }

            const normalizedSku = sku.trim().toUpperCase();

            // Validate product name
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).send("Product name is required");
            }

            // Validate price
            const parsedPrice = Number(price);

            if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                return res.status(400).send("Price must be greater than zero");
            }

            // Validate quantity
            let parsedQuantity;

            try {
                parsedQuantity = parseNonNegativeInteger(
                    quantity,
                    "Quantity"
                );
            } catch (error) {
                return res.status(400).send(error.message);
            }

            // Validate low stock threshold (default 5)
            let lowStockThreshold;

            try {
                lowStockThreshold =
                    req.body.lowStockThreshold === undefined ||
                    req.body.lowStockThreshold === ""
                        ? 5
                        : parseNonNegativeInteger(
                            req.body.lowStockThreshold,
                            "Low stock threshold"
                        );
            } catch (error) {
                return res.status(400).send(error.message);
            }

            // Validate category ID
            if (
                typeof category !== "string" ||
                !isValidId(category)
            ) {
                return res.status(400).send("Invalid category");
            }

            const existingCategory = await Category.findById(category);

            if (!existingCategory) {
                return res.status(400).send("Selected category does not exist");
            }

            // Check duplicate SKU
            const existingProduct = await Product.findOne({
                sku: normalizedSku
            });

            if (existingProduct) {
                return res.status(409).send("Product with this SKU already exists");
            }

            const product = new Product({
                name: name.trim(),
                description:
                    typeof description === "string"
                        ? description.trim()
                        : "",
                category,
                price: parsedPrice,
                quantity: parsedQuantity,
                lowStockThreshold,
                sku: normalizedSku
            });

            await product.save();

            return res.redirect("/products");
        } catch (error) {
            console.error("Failed to add product:", error.message);

            if (error.code === 11000) {
                return res.status(409).send("Product with this SKU already exists");
            }

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid product details");
            }

            return res.status(500).send("Failed to add product");
        }
    }
);

// Display edit product page
router.get(
    "/products/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid product ID");
            }

            const product = await Product.findById(req.params.id);

            if (!product) {
                return res.status(404).send("Product not found");
            }

            const categories = await Category.find().sort({ name: 1 });

            return res.render("edit-product", {
                product,
                categories,
                user: req.user
            });
        } catch (error) {
            console.error("Failed to load product:", error.message);
            return res.status(500).send("Failed to load product");
        }
    }
);

// Update product
router.post(
    "/products/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid product ID");
            }

            const {
                name,
                description,
                category,
                price,
                quantity,
                sku
            } = req.body;

            // Validate SKU
            if (typeof sku !== "string" || !sku.trim()) {
                return res.status(400).send("SKU is required");
            }

            const normalizedSku = sku.trim().toUpperCase();

            // Validate product name
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).send("Product name is required");
            }

            // Validate price
            const parsedPrice = Number(price);

            if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                return res.status(400).send("Price must be greater than zero");
            }

            // Validate quantity
            let parsedQuantity;

            try {
                parsedQuantity = parseNonNegativeInteger(
                    quantity,
                    "Quantity"
                );
            } catch (error) {
                return res.status(400).send(error.message);
            }

            // Validate low stock threshold (default 5)
            let lowStockThreshold;

            try {
                lowStockThreshold =
                    req.body.lowStockThreshold === undefined ||
                    req.body.lowStockThreshold === ""
                        ? 5
                        : parseNonNegativeInteger(
                            req.body.lowStockThreshold,
                            "Low stock threshold"
                        );
            } catch (error) {
                return res.status(400).send(error.message);
            }

            // Validate category ID
            if (
                typeof category !== "string" ||
                !isValidId(category)
            ) {
                return res.status(400).send("Invalid category");
            }

            const existingCategory = await Category.findById(category);

            if (!existingCategory) {
                return res.status(400).send("Selected category does not exist");
            }

            // Check whether another product uses this SKU
            const existingProduct = await Product.findOne({
                sku: normalizedSku,
                _id: { $ne: req.params.id }
            });

            if (existingProduct) {
                return res.status(409).send("Another product already uses this SKU");
            }

            const updatedProduct = await Product.findByIdAndUpdate(
                req.params.id,
                {
                    name: name.trim(),
                    description:
                        typeof description === "string"
                            ? description.trim()
                            : "",
                    category,
                    price: parsedPrice,
                    quantity: parsedQuantity,
                    lowStockThreshold,
                    sku: normalizedSku
                },
                {
                    runValidators: true,
                    returnDocument: "after"
                }
            );

            if (!updatedProduct) {
                return res.status(404).send("Product not found");
            }

            return res.redirect("/products");
        } catch (error) {
            console.error("Failed to update product:", error.message);

            if (error.code === 11000) {
                return res.status(409).send("Another product already uses this SKU");
            }

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid product details");
            }

            return res.status(500).send("Failed to update product");
        }
    }
);

// Delete product (Admin only)
router.post(
    "/products/delete/:id",
    protect,
    allowedRoles("Admin"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid product ID");
            }

            const product = await Product.findByIdAndDelete(req.params.id);

            if (!product) {
                return res.status(404).send("Product not found");
            }

            return res.redirect("/products");
        } catch (error) {
            console.error("Failed to delete product:", error.message);
            return res.status(500).send("Failed to delete product");
        }
    }
);

module.exports = router;
