import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    
    try {

        const mongodbConnectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    
        console.log(`MongoDB connected !! with DB HOST: ${mongodbConnectionInstance.connections[0].host}`);
        // console.log(mongodbConnectionInstance);
        
    } catch (error) {
        console.error("MongoDB connection failed: ", error);
        process.exit(1);
    }

}

export default connectDB