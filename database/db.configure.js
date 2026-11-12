import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionString =
      process.env.MONGO_URI || process.env.mongoDbConnectionString;

    if (!connectionString) {
      throw new Error("MONGO_URI is missing from the environment");
    }

    await mongoose.connect(connectionString);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;
