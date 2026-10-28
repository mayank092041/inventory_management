
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000
};

router.get("/register", (req, res) => {
    res.render("register");
});

router.get("/login", (req, res) => {
    res.render("login");
});

// Register a new user
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            password.length < 8
        ) {
            return res.status(400).send(
                "Enter a valid name, email, and password of at least 8 characters."
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).send("User already exists.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "Staff"
        });

        await user.save();

        return res.redirect("/login");
    } catch (error) {
        console.error("Registration failed:", error.message);

        if (error.code === 11000) {
            return res.status(409).send("User already exists.");
        }

        return res.status(500).send("Registration failed.");
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).send("Enter email and password.");
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured.");
            return res.status(500).send("Server configuration error.");
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(401).send("Invalid email or password.");
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).send("Invalid email or password.");
        }

        const token = jwt.sign(
            {
                userId: user._id.toString()
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.cookie("token", token, cookieOptions);

        return res.redirect("/dashboard");
    } catch (error) {
        console.error("Login failed:", error.message);
        return res.status(500).send("Login failed.");
    }
});

// Logout
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    });

    return res.redirect("/login");
});

module.exports = router;
