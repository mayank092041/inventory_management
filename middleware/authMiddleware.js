
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.redirect("/login");
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!decoded.userId) {
            res.clearCookie("token");
            return res.redirect("/login");
        }

        const user = await User.findById(decoded.userId);

        if (!user) {
            res.clearCookie("token");
            return res.redirect("/login");
        }

        req.user = user;
        next();

    } catch (error) {
        console.error("Authentication failed:", error.message);

        res.clearCookie("token");
        return res.redirect("/login");
    }
};

module.exports = protect;
