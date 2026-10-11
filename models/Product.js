const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        lowStockThreshold: {
            type: Number,
            required: true,
            min: 0,
            default: 5,
        },
        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true
        }
    },
    {
        timestamps: true,
    }
)

const product = mongoose.model("Product", productSchema);
module.exports = product;