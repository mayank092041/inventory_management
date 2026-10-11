const app = require('express');
const bcrypts = require('bcryptjs');

const User = require("../models/user");
const jwt = require('jsonwebtoken');

const router = app.Router();


router.get("/register",(req,res)=>{
    res.render("register");
});

router.get("/login",(req,res)=>{
    res.render("login");
})
router.post("/register",async(req,res)=>{
    try{
        const {name,email,password,role} = req.body;
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.send("User already exists");
        }
        const hashedPassword = await bcrypts.hash(password, 10);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role: role || "Staff"
        });

        await user.save();

        res.send("Registration successful");
    }
    catch(err){
        console.log(err);
        res.status(500).send("Registration failed");

    }
});
router.post("/login",async(req,res)=>{
    try{
        const {email, password} = req.body;
        const user = await User.findOne({email});
        if(!user){
            return res.send("invalid email or password");
        }

        const passwordMatch = await bcrypts.compare(password,user.password);

        if(!passwordMatch){
            return res.send("Invalid email or password");
        }
         const token = jwt.sign(
            {
                userId: user._id,
                role: user.role
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "1h"
            }
        );
         res.cookie("token", token);


        // Login successful
        res.redirect("/dashboard");

    }
    catch(error){
        console.log(error);

        res.status(500).send("Login failed");
    }
})
router.get("/logout", (req, res) => {

    res.clearCookie("token");

    res.redirect("/login");

});
module.exports = router;