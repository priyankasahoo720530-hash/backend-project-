import {asyncHandler} from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const generateTokens = async (user) =>{
             const accessToken = await user.generateAccessToken()
            const refreshToken =await user.generateRefreshToken()

            user.refreshToken = refreshToken ;
            await user.save({validateBeforeSave : false})

            return {accessToken,refreshToken}
}

const registerUser = asyncHandler(async (req, res) => {
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


const loginUser = asyncHandler(async (req, res) => {
    //take inputs from user
    //where email or username and pssword is compulsory
    //check the database for existing email or username
    //if exists then check for corresponding password
    //if password correct then generate tokens
    //send cookie
    //then  login user


    const {username,email,password} = req.body ;
    if(!(username || email)){
       throw new ApiError(400 , "username or email is required")
    }

    const user = await User.findOne(
       { $or : [{email},{username}]}
    )

    if(!user){
        throw new ApiError(404,"user does not exist")
    }

    const correctPass = await user.isPasswordCorrect(password)
    if(!correctPass){
        throw new ApiError(401,"invalid user credential")
    }

    const {accessToken,refreshToken} = await generateTokens(user)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    return res
    .status(200)
    .cookie("accessToken",accessToken,{httpOnly : true, secure :true})
    .cookie("refreshToken",refreshToken,{httpOnly : true, secure :true})
    .json(
        new ApiResponse(200,{
            user:loggedInUser,
            accessToken,
            refreshToken},"user logged in successfully")
    )

    })

const logOutUser = asyncHandler(async(req,res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
      {
            $unset : {
                refreshToken : 1
            }
      },
      {
            new : true
      }
    )

    return res
    .status(200)
    .clearCookie("accessToken",{
        httpOnly: true,
        secure: true
    })
    .clearCookie("refreshToken",{
        httpOnly: true,
        secure: true
    })
    .json(
        new ApiResponse(200,{},"user logged out")
    )
})


export {loginUser,registerUser,logOutUser}


