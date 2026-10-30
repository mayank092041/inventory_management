
const express = require("express");
const mongoose = require("mongoose");

const Category = require("../models/Category");
const Product = require("../models/Product");

const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const isValidId = (id) => mongoose.isValidObjectId(id);

// Display categories
router.get("/categories", protect, async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });

        res.render("categories", {
            categories,
            user: req.user
        });
    } catch (error) {
        console.error("Failed to load categories:", error.message);
        res.status(500).send("Failed to load categories");
    }
});

// Display add category page
router.get(
    "/categories/add",
    protect,
    allowedRoles("Admin", "Manager"),
    (req, res) => {
        res.render("add-category", { user: req.user });
    }
);

// Add category
router.post(
    "/categories/add",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const { name, description } = req.body;

            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).send("Category name is required");
            }

            const normalizedName = name.trim();

            const existingCategory = await Category.findOne({
                name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
            });

            if (existingCategory) {
                return res.status(409).send("Category already exists");
            }

            const category = new Category({
                name: normalizedName,
                description: typeof description === "string"
                    ? description.trim()
                    : ""
            });

            await category.save();
            return res.redirect("/categories");
        } catch (error) {
            console.error("Failed to add category:", error.message);

            if (error.code === 11000) {
                return res.status(409).send("Category already exists");
            }

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid category details");
            }

            return res.status(500).send("Failed to add category");
        }
    }
);

// Display edit category page
router.get(
    "/categories/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid category ID");
            }

            const category = await Category.findById(req.params.id);

            if (!category) {
                return res.status(404).send("Category not found");
            }

            return res.render("edit-category", {
                category,
                user: req.user
            });
        } catch (error) {
            console.error("Failed to load category:", error.message);
            return res.status(500).send("Failed to load category");
        }
    }
);

// Update category
router.post(
    "/categories/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid category ID");
            }

            const { name, description } = req.body;

            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).send("Category name is required");
            }

            const category = await Category.findById(req.params.id);

            if (!category) {
                return res.status(404).send("Category not found");
            }

            const normalizedName = name.trim();

            const duplicate = await Category.findOne({
                name: {
                    $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                    $options: "i"
                },
                _id: { $ne: category._id }
            });

            if (duplicate) {
                return res.status(409).send("Category already exists");
            }

            category.name = normalizedName;
            category.description = typeof description === "string"
                ? description.trim()
                : "";

            await category.save();
            return res.redirect("/categories");
        } catch (error) {
            console.error("Failed to update category:", error.message);

            if (error.code === 11000) {
                return res.status(409).send("Category already exists");
            }

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid category details");
            }

            return res.status(500).send("Failed to update category");
        }
    }
);

// Delete category (Admin only)
router.post(
    "/categories/delete/:id",
    protect,
    allowedRoles("Admin"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid category ID");
            }

            // Prevent deleting a category used by products
            const productUsingCategory = await Product.exists({
                category: req.params.id
            });

            if (productUsingCategory) {
                return res.status(409).send(
                    "Cannot delete this category because products are using it"
                );
            }

            const category = await Category.findByIdAndDelete(req.params.id);

            if (!category) {
                return res.status(404).send("Category not found");
            }

            return res.redirect("/categories");
        } catch (error) {
            console.error("Failed to delete category:", error.message);
            return res.status(500).send("Failed to delete category");
        }
    }
);

module.exports = router;
