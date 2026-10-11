const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema({
    product : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Product",
        required : true
    },

    type : {
        type : String,
        enum : ["Stock In", "Stock Out"],
        required : true
    },

    quantity : {
        type : Number,
        required : true,
        min : 1
    },
    
    previousQuantity : {
        type : Number,
        required : true,
        min : 0
    },

    newQuantity : {
        type : Number,
        required : true,
        min : 0
    },

    reason : {
        type : String,
        requires : true,
        trim : true,
    },

    performedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true,
    }
    },
    {
        timestamps : true
    }
);

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

module.exports = StockMovement;