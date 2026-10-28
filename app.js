
const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const stockRoutes = require("./routes/stockRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const salesRoutes = require("./routes/salesRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const exportRoutes = require("./routes/exportRoutes");
const userRoutes = require("./routes/userRoutes");

dotenv.config();

const app = express();

app.use((req, res, next) => {
    console.log("Incoming request:", req.method, req.url);
    next();
});

connectDB();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.set("view engine", "ejs");
app.use(express.static("public"));

// CSRF configuration
if (!process.env.CSRF_SECRET) {
    throw new Error("CSRF_SECRET is missing from .env");
}

const {
    doubleCsrfProtection,
    generateCsrfToken
} = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    getSessionIdentifier: (req) =>
        req.cookies.token || "anonymous",
    cookieName: "csrf-token",
    cookieOptions: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    },
    getCsrfTokenFromRequest: (req) => req.body?._csrf
});

// Make token available to EJS views
app.use((req, res, next) => {
    res.locals.csrfToken = generateCsrfToken(req, res);
    next();
});

// Apply CSRF protection once
app.use(doubleCsrfProtection);

// Routes
app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/", categoryRoutes);
app.use("/", productRoutes);
app.use("/", supplierRoutes);
app.use("/", stockRoutes);
app.use("/", purchaseRoutes);
app.use("/sales", salesRoutes);
app.use("/reports", reportsRoutes);
app.use("/exports", exportRoutes);
app.use("/users", userRoutes);

app.get("/", (req, res) => {
    console.log("Home page requested");
    res.render("index");
});

// CSRF error handler
app.use((err, req, res, next) => {
    if (err.code === "EBADCSRFTOKEN") {
        return res.status(403).send(
            "Invalid or missing CSRF token. Refresh the page and try again."
        );
    }

    next(err);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
