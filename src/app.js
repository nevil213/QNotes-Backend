import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));
app.use(cookieParser());




// import routes
import userRoute from "./routes/user.route.js"
import noteRoute from "./routes/note.route.js"
import playlistRoute from "./routes/playlist.route.js";
import clapRoute from "./routes/clap.route.js"

// declaration of routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/note", noteRoute);
app.use("/api/v1/playlist", playlistRoute);
app.use("/api/v1/clap", clapRoute)


export { app };