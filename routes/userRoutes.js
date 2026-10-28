
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const allowedRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Only logged-in Admins can access these routes
router.use(protect);
router.use(allowedRoles("Admin"));

// View all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.render("users", { users });
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not load users.");
  }
});

// Create a user
router.post("/add", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).send("All fields are required.");
    }

    if (password.length < 8) {
      return res.status(400).send(
        "Password must contain at least 8 characters."
      );
    }

    const validRoles = ["Admin", "Manager", "Staff"];

    if (!validRoles.includes(role)) {
      return res.status(400).send("Invalid role.");
    }

    const existingUser = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (existingUser) {
      return res.status(409).send("Email already exists.");
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role
    });

    res.redirect("/users");
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).send("Email already exists.");
    }

    res.status(500).send("Could not create user.");
  }
});

// Update a user's role
router.post("/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["Admin", "Manager", "Staff"];

    if (!validRoles.includes(role)) {
      return res.status(400).send("Invalid role.");
    }
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).send("Invalid user ID.");
    }
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Prevent an Admin from removing their own Admin role
    if (user.role === "Admin" && role !== "Admin") {
      const adminCount = await User.countDocuments({
        role: "Admin"
      });

      if (adminCount <= 1) {
        return res.status(400).send(
          "At least one Admin account must remain."
        );
      }
    }

    user.role = role;
    await user.save();

    res.redirect("/users");
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not update user role.");
  }
});

module.exports = router;
