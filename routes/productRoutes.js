const express = require("express");

const Product = require("../models/Product");
const Category = require("../models/Category");

const protect = require("../middleware/authMiddleware");

const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/products", protect, async (req, res) => {
    try {
        const products = await Product.find().populate("category").sort({ createdAt: -1 });

        res.render("products", { products, user: req.user });
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Failed to load products");

    }
});

router.get("/products/add", protect, allowedRoles("Admin", "Manager"), async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });

        res.render("add-product", { categories, user: req.user });

    }
    catch (error) {
        console.log(error);
        res.status(500).send("Failed to load add product page");
    }
});

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


            // Check duplicate SKU

            const existingProduct = await Product.findOne({
                sku
            });

            if (existingProduct) {

                return res.send("Product with this SKU already exists");

            }


            // Check category

            const existingCategory = await Category.findById(
                category
            );

            if (!existingCategory) {

                return res.status(400).send(
                    "Selected category does not exist"
                );

            }


            // Create product

            const product = new Product({

                name,
                description,
                category,
                price,
                quantity,
                sku

            });


            await product.save();


            res.redirect("/products");

        } catch (error) {

            console.log(error);

            res.status(500).send("Failed to add product");

        }

    }
);


router.get(
    "/products/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {

        try {

            const product = await Product.findById(
                req.params.id
            );

            if (!product) {

                return res.status(404).send(
                    "Product not found"
                );

            }


            const categories = await Category.find()
                .sort({ name: 1 });


            res.render("edit-product", {

                product,
                categories,
                user: req.user

            });

        } catch (error) {

            console.log(error);

            res.status(500).send(
                "Failed to load product"
            );

        }

    }
);


// ========================================
// UPDATE PRODUCT
// ========================================

router.post(
    "/products/edit/:id",
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


            // Check duplicate SKU

            const existingProduct = await Product.findOne({

                sku,

                _id: {
                    $ne: req.params.id
                }

            });


            if (existingProduct) {

                return res.send(
                    "Another product already uses this SKU"
                );

            }


            // Check category

            const existingCategory = await Category.findById(
                category
            );

            if (!existingCategory) {

                return res.status(400).send(
                    "Selected category does not exist"
                );

            }


            await Product.findByIdAndUpdate(
                req.params.id,
                {
                    name,
                    description,
                    category,
                    price,
                    quantity,
                    sku
                }
            );


            res.redirect("/products");

        } catch (error) {

            console.log(error);

            res.status(500).send(
                "Failed to update product"
            );

        }

    }
);


// ========================================
// DELETE PRODUCT
// ========================================

router.get(
    "/products/delete/:id",
    protect,
    allowedRoles("Admin"),
    async (req, res) => {

        try {

            await Product.findByIdAndDelete(
                req.params.id
            );

            res.redirect("/products");

        } catch (error) {

            console.log(error);

            res.status(500).send(
                "Failed to delete product"
            );

        }

    }
);


module.exports = router;