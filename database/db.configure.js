import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.mongoDbConnectionString) {
      throw new Error("MONGO_URI is missing from the .env file");
    }

    await mongoose.connect(process.env.mongoDbConnectionString);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;
