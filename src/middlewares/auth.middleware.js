import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"


export const verifyJWT = asyncHandler( async (req, res, next) => {
try {

        // console.log("req.cookies: ", req.cookies)

        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
        if(!token){
            throw new ApiError(401, "Unauthorized access");
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if(!user.isEmailVerified){
            throw new ApiError(401, "Email not verified");
        }

        if(!user){
            //more in frontend
            throw new ApiError(401, "Invalid access token");
        }
    
        req.user = user;
    
        next();   
    
} catch (error) {
    // console.log(error);
    throw new ApiError(401, "Invalid access token");
}
})