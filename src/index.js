// import mongoose from "mongoose";
// import { DB_NAME } from "./constants.js";


import "dotenv/config"
import connectDB from "./db/index.js"
import { app } from "./app.js";

connectDB()
.then(() => {
    app.on("error", (error) => {
        console.log("applcation is failed to run", error);
        throw error;
    })

    const port = process.env.PORT || 8000;

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

})
.catch((error) => {
    console.error("MONGODB connection failed: ", error);
});


/*
;( async ()=> {

    try {
        
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

        app.on("error", (error) => {
            console.error("Error: ", error);
            throw error            
        })

        app.listen(process.env.PORT, () => {
            console.log(`app is listening on ${process.env.PORT}`)
        })

    } catch (error) {
        console.error("Error: ", error);
        throw error
    }
})()
*/