const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
    name:{
        type : String,
        required : true,
        trim : true
    },

    company : {
        type : String,
        trim : true
    },

    email : {
        type : String,
        trim : true,
        lowercase : true,
    },

    phone : {
        type : Number,
        requied : true,
        trim : true,
    },

    address : {
        type : String,
        trim : true
    },
    
    },
    {
        timestamps : true
    }
)

const Supplier = mongoose.model("Supplier", supplierSchema);
module.exports = Supplier;