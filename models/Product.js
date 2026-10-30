
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },

        price: {
            type: Number,
            required: true,
            min: 0.01
        },

        quantity: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: "Quantity must be a non-negative integer"
            }
        },

        lowStockThreshold: {
            type: Number,
            required: true,
            min: 0,
            default: 5,
            validate: {
                validator: Number.isSafeInteger,
                message: "Low stock threshold must be a non-negative integer"
            }
        },

        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
            maxlength: 50
        }
    },
    {
        timestamps: true
    }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
