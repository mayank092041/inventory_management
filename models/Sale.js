const mongoose = require("mongoose")

const saleSchema = new mongoose.Schema({
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        sellingPrice: {
            type: Number,
            required: true,
            min: 1,
        },

    },
    ],
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    soldBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    saleDate: {
        type: Date,
        default: Date.now,
    },
},{
    timestamps : true
})

module.exports = mongoose.model("Sale",saleSchema);