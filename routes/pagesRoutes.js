const express = require('express');

const router = express.Router();

router.get("/",(req,res)=>{
    console.log("Home page requested");
    res.send("Inventory Management System is working!");
})

module.exports = router;