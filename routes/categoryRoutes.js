const express = require("express");

const Category = require("../models/Category");

const protect = require("../middleware/authMiddleware");

const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();


router.get("/categories", protect, async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.render("categories", { categories, user: req.user });
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Failed to load categories");
    }
})

router.get("/categories/add", protect, allowedRoles("Admin", "Manager"), (req, res) => {
    res.render("add-category", { user: req.user })
})


router.post("/categories/add", protect, allowedRoles("Admin", "Manager"), async (req, res) => {
    try {
        const { name, description } = req.body;
        const existingCategory = await Category.findOne({ name });

        if (existingCategory) {
            return res.send("Category already exists");
        }

        const category = new Category({ name, description });
        await category.save();
        res.redirect("/categories");
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Failed to add category");
    }
})

router.get(
    "/categories/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {

        try {

            const category = await Category.findById(
                req.params.id
            );

            if (!category) {

                return res.status(404).send("Category not found");

            }

            res.render("edit-category", {
                category,
                user: req.user
            });

        } catch (error) {

            console.log(error);

            res.status(500).send("Failed to load category");

        }

    }
);

router.post(
    "/categories/edit/:id",
    protect,
    allowedRoles("Admin", "Manager"),
    async (req, res) => {

        try {

            const { name, description } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).send("Category name is required");
            }

            const category = await Category.findById(req.params.id);

            if (!category) {
                return res.status(404).send("Category not found");
            }

            const duplicate = await Category.findOne({
                name: name.trim(),
                _id: { $ne: category._id }
            });

            if (duplicate) {
                return res.status(409).send("Category already exists");
            }

            category.name = name.trim();
            category.description = description?.trim() || "";

            await category.save();

            res.redirect("/categories");

        } catch (error) {

            console.log(error);

            res.status(500).send("Failed to update category");

        }

    }
);


router.post(
    "/categories/delete/:id",
    protect,
    allowedRoles("Admin"),
    async (req, res) => {
        try {
            const category = await Category.findByIdAndDelete(
                req.params.id
            );

            if (!category) {
                return res.status(404).send("Category not found");
            }

            res.redirect("/categories");
        } catch (error) {
            console.log(error);
            res.status(500).send("Failed to delete category");
        }
    }
);


module.exports = router;