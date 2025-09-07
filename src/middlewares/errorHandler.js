import { ApiError } from "../utils/ApiError.js";
const errorHandler = (err, req, res, next) => {
    // If the error is an instance of ApiError, use its properties
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: err.success,
            message: err.message,
            data: err.data,
            errors: err.errors,
        });
    }

    // For any other unhandled errors, send a generic 500 response
    console.error(err); // Log the full error for debugging
    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
};

export { errorHandler };