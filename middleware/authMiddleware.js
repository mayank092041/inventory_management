const jwt = require("jsonwebtoken");
const User = require("../models/user");
const protect = async (req, res, next) => {

    try {

        const token = req.cookies.token;

        if (!token) {
            return res.redirect("/login");
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        const user = await User.findById(decoded.userId);

        if(!user){
            res.clearCookie("token");
            return res.redirect("/login");
        }
        console.log("Decoded token:", decoded);
        req.user = user;

        next();

    } catch (error) {

        console.log("Authentication failed");
        console.log("Error:", error.message);

        res.clearCookie("token");

        return res.redirect("/login");
    }
};

module.exports = protect;