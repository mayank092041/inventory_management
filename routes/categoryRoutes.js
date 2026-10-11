const express = require("express");

const Category = require("../models/Category");

const protect = require("../middleware/authMiddleware");

const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const app = express();
app.set('view engine', 'ejs');

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

            await Category.findByIdAndUpdate(
                req.params.id,
                {
                    name,
                    description
                }
            );

            res.redirect("/categories");

        } catch (error) {

            console.log(error);

            res.status(500).send("Failed to update category");

        }

    }
);

router.get(
    "/categories/delete/:id",
    protect,
    allowedRoles("Admin"),
    async (req, res) => {

        try {

            await Category.findByIdAndDelete(
                req.params.id
            );

            res.redirect("/categories");

        } catch (error) {

            console.log(error);

            res.status(500).send("Failed to delete category");

        }

    }
);


module.exports = router;