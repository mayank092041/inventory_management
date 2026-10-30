const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("Database connected");
        console.log("MongoDB Host:", mongoose.connection.host);
        console.log(
            "Retry Writes:",
            mongoose.connection.client.options.retryWrites
        );
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;