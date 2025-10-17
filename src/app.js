import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();

// Improved CORS handling for multiple origins
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN.split(',');
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({limit: "100mb"}));
app.use(express.urlencoded({extended: true, limit: "100mb"}));
app.use(express.static("public"));
app.use(cookieParser());

// Add a root route handler
app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to QNotes API - Audio to Notes AI Service",
        apiDocsPath: "/api/v1"
    });
});

// import routes
import userRoute from "./routes/user.route.js"
import noteRoute from "./routes/note.route.js"
import playlistRoute from "./routes/playlist.route.js";
import clapRoute from "./routes/clap.route.js"
import quizRoute from "./routes/quiz.route.js"
import { errorHandler } from "./middlewares/errorHandler.js";

// declaration of routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/note", noteRoute);
app.use("/api/v1/quiz", quizRoute)
app.use("/api/v1/playlist", playlistRoute);
app.use("/api/v1/clap", clapRoute)

app.use(errorHandler)

export { app };