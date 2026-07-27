import asyncHandeler from "../utils/asyncHandeler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandeler(async (req, res) => {
    //get user details from frontend
    //validation
    //check if user already exist 
    //check for images , check for avatar 
    //upload t cloudinary
    //create user object - create entry in db
    //remove password and refresh token field from response 
    //check for user creation 
    //return response 

    const { username, email, fullname, password } = req.body

    console.log(req.body)


    if (
        [fullname, username, email, password].some((field) =>
            field?.trim() === ""
        )
    ) {
        throw new ApiError(409, "each field is required")
    };

    const userExist = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (userExist) {
        throw new ApiError(409, "user with email or username already exists")
    }


    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImgLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    let coverImg;

    if (coverImgLocalPath) {
        coverImg = await uploadOnCloudinary(coverImgLocalPath)
    }

    if (!avatar) {
        throw new ApiError(400, "avatar required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar?.url,
        coverImage: coverImg?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!userCreated) {
        throw new ApiError(500, "something went wrong registering")
    }

    return res.status(201).json(
        new ApiResponse(200, userCreated)
    )


})



export default registerUser