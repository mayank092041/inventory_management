const express = require("express")

const Supplier = require("../models/Supplier")

const protect = require("../middleware/authMiddleware")

const allowRoles = require("../middleware/roleMiddleware")

const router = express.Router()


router.get("/suppliers", protect, async(req,res)=>{
    try{
        const suppliers = await Supplier.find().sort({createdAt : -1})

        res.render("suppliers",{
            suppliers,user : req.user
        })
    }
    catch(error){
        console.log(error);
        return res.send("Failed to load suppliers")
    }
})


router.get("/suppliers/add", protect, allowRoles("Admin","Manager"),(req,res)=>{
    res.render("add-supplier",{
        user : req.user,
    })
})

router.post("/suppliers/add", protect, allowRoles("Admin","Manager"),async(req,res)=>{
    try{
        const {name,company,email,phone,address} = req.body;

        const supplier = new Supplier({name,company,email,phone,address})
        await supplier.save();

        res.redirect("/suppliers");
    }
    catch(error){
        console.log(error);
        res.status(500).send("Failed to add supplier");
    }
})

router.get("/suppliers/edit/:id", protect,allowRoles("Admin","Manager"), async(req,res)=>{
    try{
        const supplier = await Supplier.findById(
            req.params.id
        );

        if(!supplier){
            return res.status(400).send("Supplier not found");
        }

        res.render("edit-supplier",{
            supplier, user:req.user
        })
    }
    catch(error){
        console.log(error);
        res.status(500).send("Failed to load supplier");
    }
})


router.post(
    "/suppliers/edit/:id",
    protect,
    allowRoles("Admin", "Manager"),
    async (req, res) => {
        try {
            const {
                name,
                company,
                email,
                phone,
                address
            } = req.body;

            const supplier = await Supplier.findById(
                req.params.id
            );

            if (!supplier) {
                return res.status(404).send("Supplier not found");
            }

            supplier.name = name;
            supplier.company = company;
            supplier.email = email;
            supplier.phone = phone;
            supplier.address = address;

            await supplier.save();

            res.redirect("/suppliers");

        } catch (error) {
            console.log(error);
            res.status(500).send("Failed to update supplier");
        }
    }
);

router.post("/suppliers/delete/:id", protect, allowRoles("Admin","Manager"), async(req,res)=>{
    try{
        const supplier = await Supplier.findByIdAndDelete(req.params.id);

        if(!supplier){
            return res.status(404).send("Supplier not found")
        }
        res.redirect("/suppliers");
    }
    catch(error){
        console.log(error);
        res.status(500).send("Failed to delete supplier")
    }
})

module.exports = router;