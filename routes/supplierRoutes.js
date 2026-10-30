
const express = require("express");
const mongoose = require("mongoose");

const Supplier = require("../models/Supplier");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const isValidId = (id) => mongoose.isValidObjectId(id);

const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Display suppliers
router.get("/suppliers", protect, async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ createdAt: -1 });

        return res.render("suppliers", {
            suppliers,
            user: req.user
        });
    } catch (error) {
        console.error("Failed to load suppliers:", error.message);
        return res.status(500).send("Failed to load suppliers");
    }
});

// Display add supplier page
router.get(
    "/suppliers/add",
    protect,
    allowRoles("Admin", "Manager"),
    (req, res) => {
        res.render("add-supplier", { user: req.user });
    }
);

// Add supplier
router.post(
    "/suppliers/add",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const { name, company, email, phone, address } = req.body;

            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).send("Supplier name is required");
            }

            if (email && (
                typeof email !== "string" ||
                !isValidEmail(email.trim())
            )) {
                return res.status(400).send("Invalid email address");
            }

            const supplier = new Supplier({
                name: name.trim(),
                company: typeof company === "string" ? company.trim() : "",
                email: typeof email === "string" ? email.trim().toLowerCase() : "",
                phone: typeof phone === "string" ? phone.trim() : "",
                address: typeof address === "string" ? address.trim() : ""
            });

            await supplier.save();
            return res.redirect("/suppliers");
        } catch (error) {
            console.error("Failed to add supplier:", error.message);

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid supplier details");
            }

            if (error.code === 11000) {
                return res.status(409).send("Supplier already exists");
            }

            return res.status(500).send("Failed to add supplier");
        }
    }
);

// Display edit supplier page
router.get(
    "/suppliers/edit/:id",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid supplier ID");
            }

            const supplier = await Supplier.findById(req.params.id);

            if (!supplier) {
                return res.status(404).send("Supplier not found");
            }

            return res.render("edit-supplier", {
                supplier,
                user: req.user
            });
        } catch (error) {
            console.error("Failed to load supplier:", error.message);
            return res.status(500).send("Failed to load supplier");
        }
    }
);

// Update supplier
router.post(
    "/suppliers/edit/:id",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid supplier ID");
            }

            const { name, company, email, phone, address } = req.body;

            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).send("Supplier name is required");
            }

            if (email && (
                typeof email !== "string" ||
                !isValidEmail(email.trim())
            )) {
                return res.status(400).send("Invalid email address");
            }

            const supplier = await Supplier.findById(req.params.id);

            if (!supplier) {
                return res.status(404).send("Supplier not found");
            }

            supplier.name = name.trim();
            supplier.company = typeof company === "string" ? company.trim() : "";
            supplier.email = typeof email === "string" ? email.trim().toLowerCase() : "";
            supplier.phone = typeof phone === "string" ? phone.trim() : "";
            supplier.address = typeof address === "string" ? address.trim() : "";

            await supplier.save();
            return res.redirect("/suppliers");
        } catch (error) {
            console.error("Failed to update supplier:", error.message);

            if (error.name === "ValidationError") {
                return res.status(400).send("Invalid supplier details");
            }

            if (error.code === 11000) {
                return res.status(409).send("Supplier already exists");
            }

            return res.status(500).send("Failed to update supplier");
        }
    }
);

// Delete supplier (Admin only)
router.post(
    "/suppliers/delete/:id",
    protect,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            if (!isValidId(req.params.id)) {
                return res.status(400).send("Invalid supplier ID");
            }

            const supplier = await Supplier.findByIdAndDelete(req.params.id);

            if (!supplier) {
                return res.status(404).send("Supplier not found");
            }

            return res.redirect("/suppliers");
        } catch (error) {
            console.error("Failed to delete supplier:", error.message);
            return res.status(500).send("Failed to delete supplier");
        }
    }
);

module.exports = router;
