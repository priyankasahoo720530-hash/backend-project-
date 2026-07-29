import { Router } from "express";
import { registerUser,loginUser,logOutUser,refreshAccessToken,changePassword, updateAvatar, getCurrentUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import jwt from "jsonwebtoken";
import verifyJWT from "../middlewares/auth.middleware.js";
const userRouter = Router()

userRouter.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

userRouter.route("/login").post(loginUser)

userRouter.route("/logout").post(verifyJWT,logOutUser)

userRouter.route("/refresh-token").post(refreshAccessToken)

userRouter.route("/password-update").post(verifyJWT,changePassword)

userRouter.route("/avatar-update").post(verifyJWT,upload.single("avatar"),updateAvatar)

userRouter.route("/profile").get(verifyJWT,getCurrentUser)

export default userRouter
