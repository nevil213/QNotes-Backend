import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"
import { deleteCloudinaryImage } from "../utils/deleteCloudinaryFile.js";
import { verificationMail } from "../Emails/register.email.js";
import { forgetPasswordMail } from "../Emails/forgetPassword.email.js";
import { AVATAR_PATH, COVER_IMAGE_PATH } from "../constants.js";

const generateAccessAndRefreshToken = async (userid) => {
    try {
            const user = await User.findById(userid);

            // console.log("user from func:", user);
            
            const accessToken = user.generateAccessToken();
            // console.log(accessToken);
            const refreshToken = user.generateRefreshToken();
            
            user.refreshToken = refreshToken;
            
            await user.save({ validateBeforeSave: false });
            
            return { accessToken, refreshToken }
            
    }
    catch (error) {
        // console.log(error);
        throw new ApiError(500, `Something went wrong while generatin access token and refresh token`)
    }
}
    
const registerUser = asyncHandler( async (req, res, next) => {

    try {
   
            const { username, email, fullname, password } = req.body;

            if(!username || username === ""){
                    throw new ApiError(400, "username should not be empty")
            }
            else if(!email || email === ""){
                    throw new ApiError(400, "email should not be empty")
            }
            else if(!password || password === ""){
                    throw new ApiError(400, "password should not be empty")
            }
            else if(!fullname || fullname === ""){
                    throw new ApiError(400, "full name should not be empty")
            }
                    
    let user = await User.findOne({email});
    
    let userForReturn;
    
    const otp = Math.floor(100000 + Math.random() * 900000);

    const otpExpiry = new Date(Date.now() + 15*60*1000) 

    if(user){
        if(user.isEmailVerified){
            throw new ApiError(400, "user with this email already exist");
        }
        else{
            
            let checkForUsername = await User.findOne({
                username,
                email: {
                    $ne: email
                } });

            if(checkForUsername){
                throw new ApiError(400, "different user with this username, already exists");
            }

            if(user.avatar){
                const publicId = user.avatar.split("/").pop().split(".")[0];
                await deleteCloudinaryImage(AVATAR_PATH + publicId);
            }
            if(user.coverImage){
                const publicId = user.coverImage.split("/").pop().split(".")[0];
                await deleteCloudinaryImage(COVER_IMAGE_PATH + publicId);
            }

            let avatarBuffer;

            // console.log(req.files)
            // console.log(req.files.avatar)
            
            if(req.files && Array.isArray(req.files.avatar)){
                avatarBuffer = await req.files.avatar[0].buffer;
            }

            let coverImageBuffer;

            // console.log(req.files?.coverImage[0]?.legth)
            
            if(req.files && Array.isArray(req.files.coverImage)){
                coverImageBuffer = await req.files.coverImage[0].buffer;
            }
            
            let avatarResponse;
            if(avatarBuffer){
                avatarResponse = await uploadOnCloudinary(avatarBuffer, "QNotes/user/avatar");
            }
            
            let coverImageResponse;

            if(coverImageBuffer){

                // console.log("coverImageLocalPath: ", coverImageLocalPath)
                
                coverImageResponse = await uploadOnCloudinary(coverImageBuffer, "QNotes/user/coverimage");
            }
            
            // console.log("coverImageResponse: ", coverImageResponse)

            user.username = username.toLowerCase();
            user.password = password;
            user.fullname = fullname;
            user.avatar = avatarResponse?.url || "";
            user.coverImage = coverImageResponse?.url || "";
            user.otp = otp;
            user.otpExpiry = otpExpiry;
            await user.save({validateBeforeSave: false});
            
            userForReturn = user.toObject();            
        }
    }
    else{            

                let checkForUsername = await User.findOne({
                username,
                email: {
                    $ne: email
                } });

            if(checkForUsername){
                throw new ApiError(400, "different user with this username, already exists");
            }
            let avatarLocalPath;
            
            if(req.files && Array.isArray(req.files.avatar)){
                avatarLocalPath = req.files.avatar[0].path;
            }
            
            let coverImageLocalPath;
                        
            if(req.files && Array.isArray(req.files.coverImage)){
                coverImageLocalPath = req.files.coverImage[0].path;
            }
            
            let avatarResponse;
            if(avatarLocalPath){
                avatarResponse = await uploadOnCloudinary(avatarLocalPath, "QNotes/user/avatar");
            }
            
            let coverImageResponse;

            if(coverImageLocalPath){
                
                coverImageResponse = await uploadOnCloudinary(coverImageLocalPath, "QNotes/user/coverimage");
            }
                       
            const user = await User.create({
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                password,
                otp,
                otpExpiry,
                avatar: avatarResponse?.url || "",
                coverImage: coverImageResponse?.url || "",
                fullname
            });
            
            // console.log("MONGODB user: ", user);
        
        if(!user){
            throw new ApiError(500, "something went wrong while creating user")
        }
        // const createdUser = await User.findOne({email: createUser.email}).select("-password -refreshToken");
        userForReturn = user.toObject();
    }

    delete userForReturn.password;
    delete userForReturn.refreshToken;
        
        
    const token = jwt.sign({email, otp}, process.env.JWT_SECRET, { expiresIn: '15m' })

    // TODO: need to change this link to frontend link

    const verificationUrl = `http://${process.env.DOMAIN}:${process.env.PORT}/api/v1/user/verifyEmail/?token=${token}`

    await verificationMail(otp, email, verificationUrl);

    return res.status(201).json(
        new ApiResponse(201, userForReturn, "user created successfully")
    );

    } catch (error) {

        next(error);
    }
})


const verifyEmail = asyncHandler(async (req, res) => {

    const { token } = req.query;
    
    let email, otp;
    
    if(token){
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        email = payload.email;
        otp = payload.otp;
    }
    else{
        const { email: bodyEmail, otp: bodyOtp } = req.body;
        if(bodyEmail && bodyOtp){
            email = bodyEmail
            otp = bodyOtp
        }
    }
    

    if(!(token) && !(email && otp)){
        throw new ApiError(400, "for email verifications either token or email and otp required")
    }

    const user = await User.findOne({email});

    if(!user){
        throw new ApiError(404, "user not found")
    }

    if((user.otpExpiry) < Date.now()){
        throw new ApiError(400, "otp has been expired")
    }
    
    if(user.isEmailVerified){
        return res.status(200).json(
            new ApiResponse(200, "", "email is already verified")
        )
    }

    let userForReturn;

    if(user.otp == otp){
        user.isEmailVerified = true
        user.otp = undefined
        user.otpExpiry = undefined
        user.save({ validateBeforeSave: false });
        userForReturn = user.toObject();
        delete userForReturn.password;
        delete userForReturn.refreshToken;        
    }
    else{
        throw new ApiError(401, "invalid verification link or otp")
    }
    return res.status(200).json(
        new ApiResponse(200, userForReturn, "email verification success")
    )

})

const resendVerificationEmail = asyncHandler( async (req, res) => {
    const { email } = req.body;

    if(!email){
        throw new ApiError(400, "email is required");
    }

    const user = await User.findOne({email});

    if(!user){
        throw new ApiError(404, "user not found");
    }

    if(user.isEmailVerified){
        throw new ApiError(400, "user is already verified");
    }

    const { otp, token } = await user.createOtpAndToken();

    // TODO: need to change this link to frontend link

    const verificationUrl = `http://${process.env.DOMAIN}:${process.env.PORT}/api/v1/user/verifyEmail/?token=${token}`

    await verificationMail(otp, email, verificationUrl);

    return res.status(200).json(
        new ApiResponse(200, "", "otp resend successfully")
    )
    
})


const initiateForgetPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if(!email){
        throw new ApiError(400, "email is required");
    }

    const user = await User.findOne({ email });

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const { otp, token } = await user.createOtpAndToken();

    if(!otp || !token) {
        throw new ApiError(500, "Failed to generate OTP or token");
    }


    // TODO: need to change this link to frontend link

    const forgetPasswordUrl = `http://${process.env.DOMAIN}:${process.env.PORT}/api/v1/user/forget-password/?token=${token}`;

    await forgetPasswordMail(otp, email, forgetPasswordUrl);

    return res.status(200).json(
        new ApiResponse(200, "", "forget password mail sent successfully")
    )

});

const forgetPassword = asyncHandler(async (req, res) => {
    const { token } = req.query;

    const { newPassword } = req.body;

    let email, otp;

    if(token){
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        email = decoded.email;
        otp = decoded.otp;
    }
    else{
        const { email: bodyEmail, otp: bodyOtp } = req.body;
        email = bodyEmail;
        otp = bodyOtp;
    }

    if(!email || !otp){
        throw new ApiError(400, "Email and OTP are required");
    }

    // console.log(email, otp)

    const user = await User.findOne({email});
    if(!user){
        throw new ApiError(404, "User not found");
    }

    if(user.otpExpiry < Date.now()){
        throw new ApiError(400, "OTP has expired");
    }

    if(user.otp != otp){
        throw new ApiError(400, "Invalid OTP");
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    const userForReturn = user.toObject();
    delete userForReturn.password;
    delete userForReturn.refreshToken;

    return res.status(200).json(
        new ApiResponse(200, userForReturn, "OTP or token verified & password changed successfully")
    );
});
            

const loginUser = asyncHandler( async (req, res) => {

    const { username, email, password } = req.body;


    if((!username && !email)){
        throw new ApiError(400, "either username or email required");
    }

    const user = await User.findOne({
        $or: [{email}, {username}]
    })
    
    if(!user){
        throw new ApiError(404, "user doesn't exists")
    }
    
    const isAuthorized = await user.isPasswordCorrect(password)
    
    if(!isAuthorized){
        throw new ApiError(401, "invalid user credentials")
    }

    if(!user.isEmailVerified){
        throw new ApiError(400, "Please first verify your email")
    }

    // console.log("user_id: ", user._id)

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "user logged in successfully"
        )
    );

})

const logOutUser = asyncHandler( async (req, res, next) => {
    
    await User.findByIdAndUpdate(req.user._id,
        {
            // $set: {
            //     refreshToken: null
            // }
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true  // if we take reference of this to variable, will get new instance of after updation. without this default is old instance one
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(
        new ApiResponse(200, "", "user logged out successfully")
    )
})

const refreshAccessToken = asyncHandler ( async (req, res, next) => {
    
    const incomingRefreshToken = req.cookies?.refreshToken
    
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized access");
    }

    try {
        const refreshTokenContent = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(refreshTokenContent?._id);
        
        if(!user){
            throw new ApiError(401, "invalid refresh token");
        }
    
        if(user.refreshToken != incomingRefreshToken){
            throw new ApiError(401, "Refresh token is invalid or used");
        }
    
        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken },
                "access token refreshed successfully"
            )
        );
    } catch (error) {
        throw new ApiError(401, "invalid refresh token");
    }

})

const changeCurrentPassword = asyncHandler ( async (req, res) => {
    
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if(!(oldPassword && newPassword && confirmPassword)){
        throw new ApiError(400, "old password, new password and confirm password are required");
    }

    if(newPassword !== confirmPassword){
        throw new ApiError(400, "new password and confirm password should be same");
    }

    const user = await User.findById(req.user?._id);

    // const isAuthorized = await bcrypt.compare(oldPassword, user.password);

    const isAuthorized = await user.isPasswordCorrect(oldPassword)
    
    if(!isAuthorized){
        throw new ApiError(401, "password is not correct");
    }

    user.password = newPassword;

    user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, "", "Password changed successfully")
    )

})

const getCurrentUser = asyncHandler ( async (req, res) => {
    
    // if(!req.user){
    //     throw new ApiError(401, "unauthorized access")
    // }

    return res.status(200).json(
        new ApiResponse(200, req.user, "user fetched successfully")
    );
})

const updateAccountDetails = asyncHandler( async (req, res, next) => {
    const { fullname } = req.body;

try {
        if(!(fullname)){
            throw new ApiError(400, "fullname is required");
        }
        const olduser = await User.findById(req.user?._id);
    
        if(!olduser.isEmailVerified){
            throw new ApiError(400, "please verify email first")
        }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    fullname: fullname
                }
            },
            {
                new: true
            }
        ).select("-password -refreshToken");
    
        const accessToken = await user.generateAccessToken();
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res.status(200).cookie("accessToken", accessToken, options ).json(
            new ApiResponse(
                200,
                user,
                "Account details updated successfully"
            )
        )
} catch (error) {
    next(error)
}

} ) 

const updateUserAvatar = asyncHandler( async (req, res) => {
    const avatarBuffer = req.file?.buffer;

    // console.log(req.file);

    if(!avatarBuffer){
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarBuffer, "QNotes/user/avatar");

    if(!avatar.url){
        throw new ApiError(400, "avatar uploading failed");
    }

    const oldUser = await User.findById(req.user?._id);

    if(oldUser.avatar){
        // http://res.cloudinary.com/cac-backend-project/image/upload/v12344/abcd.jpg // abcd is public id
        const imagePublicId = oldUser.avatar.split("/").pop().split(".")[0];

        await deleteCloudinaryImage(AVATAR_PATH + imagePublicId)
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res.status(200).json(
        new ApiResponse(200, user, "user avatar updated successfully")
    );

});

const updateUserCoverImage = asyncHandler( async (req, res) => {
    const coverImageBuffer = req.file?.buffer;

    if(!coverImageBuffer){
        throw new ApiError(400, "Cover Image file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageBuffer, "QNotes/user/coverimage");

    if(!coverImage.url){
        throw new ApiError(400, "Cover Image uploading failed");
    }

    const oldUser = await User.findById(req.user?._id);

    if(oldUser.coverImage){
        
        let imagePublicId = oldUser?.coverImage.split("/");
        imagePublicId = imagePublicId[imagePublicId.length - 1];
        imagePublicId = imagePublicId.split(".");
        imagePublicId = imagePublicId[0];

        await deleteCloudinaryImage(COVER_IMAGE_PATH + imagePublicId);
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res.status(200).json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    );

});

const removeCoverImage = asyncHandler( async (req, res, next) => {
    const user = await User.findById(req.user?._id);

    if(user.coverImage){
        try {
                    let imagePublicId = user.coverImage.split("/");
                    imagePublicId = imagePublicId[imagePublicId.length - 1];
                    imagePublicId = imagePublicId.split(".");
                    imagePublicId = imagePublicId[0];

                    await deleteCloudinaryImage(COVER_IMAGE_PATH + imagePublicId);

                    user.coverImage = undefined;
            
                    await user.save();
            
                    return res.status(200).json(
                        new ApiResponse(200, "", "cover image removed successfully")
                    );
        } catch (error) {
            // throw new ApiError(500, "something went wrong while removing cover image")
            next(error);
        }
    }

    throw new ApiError(404, "cover image is already unset");
})

const removeAvatarImage = asyncHandler( async (req, res) => {
    const user = await User.findById(req.user?._id);

    if(user.avatar){
        try {
                    let imagePublicId = user.avatar.split("/");
                    imagePublicId = imagePublicId[imagePublicId.length - 1];
                    imagePublicId = imagePublicId.split(".");
                    imagePublicId = imagePublicId[0];
            
                    // console.log("imagePublicId: ", imagePublicId)
                    imagePublicId = AVATAR_PATH + imagePublicId;
                    await deleteCloudinaryImage(imagePublicId);

                    user.avatar = undefined;

                    await user.save();
            
                    return res.status(200).json(
                        new ApiResponse(200, "", "avatar image removed successfully")
                    );
        } catch (error) {
            throw new ApiError(500, "something went wrong while removing avatar image")
        }
    }

    throw new ApiError(404, "avatar image is already unset");
})

// const getUserProfile = asyncHandler( async (req, res) => {
//     const { username } = req.params;

//     if(!username?.trim()){
//         throw new ApiError(400, "username is required");
//     }
    
//     const channel = await User.aggregate([
//         {
//             $match: {
//                 username: username?.toLowerCase()
//             }
//         },
//         {
//             $lookup: {
//                 from: "subscriptions",
//                 localField: "_id",
//                 foreignField: "channel",
//                 as: "subscribers"
//             }
//         },
//         {
//             $lookup: {
//                 from: "subscription",
//                 localField: "_id",
//                 foreignField: "subscriber",
//                 as: "subscribedTo"
//             }
//         },
//         {
//             $addFields: {
//                 subscriberCount: {
//                     // $sum: {
//                     //     subscribers: 1
//                     // }
//                     $size: "$subscribers"
//                 },
//                 subscribedToCount: {
//                     // $sum: {
//                     //     subscribedTo: 1
//                     // }
//                     $size: "$subscribedTo"
//                 },
//                 isSubscribed: {
//                     $cond: {
//                         if: {$in: [req.user?._id, "$subscribers.subscriber"]},
//                         then: true,
//                         else: false
//                     }
//                 }
//             }
//         },
//         {
//             $project: {
//                 fullname: 1,
//                 username: 1,
//                 subscriberCount: 1,
//                 subscribedToCount: 1,
//                 isSubscribed: 1,
//                 avatar: 1,
//                 coverImage: 1,
//                 email: 1,
//                 createdAt: 1
//             }
//         }
//     ]);

//     if(!channel?.length){
//         throw new ApiError(404, "channel not found");
//     }

//     return res
//     .status(200)
//     .json(
//         new ApiResponse(200, channel[0], "user channel fetched successfully")
//     )
// })

const getWatchHistory = asyncHandler( async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: req.user?._id
            }
        },
        {
            $lookup: {
                from: "notes",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        avatar: 1,
                                        username: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    if (!user){
        throw new ApiError(404, "no history found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "watch history fetch successfully")
    )
})



// const summarizeDifferentNotes = asyncHandler( async (req, res) => {

// })

// const generateNotes = asyncHandler( async (req, res) => {
//     const userId = req.user._id;
//     const audioId = req.params.audioId;
//     const { title, description } = req.body;

//     if(!title || !description){
//         throw new ApiError(400, "title and description are required");
//     }
    
//     if(!audioId){
//         throw new ApiError(400, "audioId is required");
//     }

// });



export { registerUser, loginUser, logOutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, removeCoverImage, removeAvatarImage, getWatchHistory, verifyEmail, resendVerificationEmail, initiateForgetPassword, forgetPassword };