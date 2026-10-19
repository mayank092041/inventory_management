const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");


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
dotenv.config();

const app = express();

connectDB();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/",categoryRoutes);
app.use("/",productRoutes);
app.use("/",supplierRoutes);
app.use("/",stockRoutes);
app.use("/",purchaseRoutes);
app.use("/sales",salesRoutes);
app.use("/reports", reportsRoutes);
app.use("/exports", exportRoutes);

app.get("/", (req, res) => {
    console.log("Home page requested");
    res.render("index");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});