import { Router } from "express";
import { changeCurrentPassword, loginUser, logOutUser, refreshAccessToken, registerUser, getCurrentUser, updateUserAvatar, updateAccountDetails, updateUserCoverImage, removeCoverImage, getWatchHistory, verifyEmail, resendVerificationEmail, initiateForgetPassword, forgetPassword, removeAvatarImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        },
    ]
),registerUser)

router.route("/refresh-access-token").post(refreshAccessToken)
router.route("/verify-email").post(verifyEmail);
router.route("/resend-verification-email").post(resendVerificationEmail);
router.route("/initiate-forget-password").post(initiateForgetPassword);
router.route("/forget-password").post(forgetPassword);
router.route("/login").post(loginUser)

// secure routes
router.route("/logout").post(verifyJWT, logOutUser)
router.route("/change-password").patch(verifyJWT, changeCurrentPassword)
router.route("/get-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)
router.route("/update-avatar").patch(
    verifyJWT, 
    upload.single("avatar"),
    updateUserAvatar)
router.route("/update-coverimage").patch(
    verifyJWT,
    upload.single("coverImage"),
    updateUserCoverImage)
router.route("/delete-coverimage").delete(verifyJWT, removeCoverImage);
router.route("/delete-avatar").delete(verifyJWT, removeAvatarImage);
// from here testing remain for user
router.route("/watch-history").get(verifyJWT, getWatchHistory)



export default router;