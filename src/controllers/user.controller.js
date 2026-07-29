import {asyncHandler} from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { Subscription } from "../models/subscription.model.js";

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

const refreshAccessToken = asyncHandler(async(req,res) =>{
   const incomingRefreshToken = req.cookies?.refreshToken  ;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    const decodedToken = await jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedToken._id)
     if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

    const {accessToken,refreshToken : newRefreshToken} = await generateTokens(user)

    const option = {
        httpOnly:true ,
        secure : false
    }

    return  res
    .status(200)
    .cookie("accessToken",accessToken,option)
    .cookie("refreshToken",newRefreshToken,option)
    .json( new ApiResponse(
        200,
        {accessToken,newRefreshToken},
        "access token refreshed"
    ))

})

const changePassword = asyncHandler(async(req,res) =>{
    const{username,oldPassword,newPassword} = req.body
  console.log(req.user)
   // const user = await User.findOne({username})
   const user = await User.findById(req.user?._id)

     console.log("Old Password:", oldPassword);
      console.log("Stored Password:", user.password)

    if(!(await user?.isPasswordCorrect(oldPassword))) {
        throw new ApiError(400, "Invalid password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    res
    .status(200)
    .json(new ApiResponse(200,{user},"password changed"))
})

const getCurrentUser = asyncHandler(async(req,res) =>{
    const user = req.user
    return res
    .status(200)
    .json(new ApiResponse(
        200,{user},"current user fetched successfully"
    ))
})

const updateAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
            throw new ApiError(400 , "Avatar file is missing")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
           $set : {avatar : avatar.url}
        },
        {
            new : true
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200,{},"done"))

})
//delete old avatar


    /* const x = await User.aggregate([
    {
        $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders"
        }
    },
    {
        $unwind: "$orders"
    },
    {
        $match: {
        "orders.status": "Delivered",
        "orders.category": "Electronics",
        city: { $in: ["Bhubaneswar", "Delhi"] }
        }
    },
    {
        $group: {
        _id: "$name",
        city: { $first: "$city" },
        totalSpent: { $sum: "$orders.amount" },
        numberOfOrders: { $sum: 1 }
        }
    },
    {
        $match: {
        totalSpent: { $gt: 2000 }
        }
    },
    {
        $sort: {
        totalSpent: -1
        }
    },
    {
        $project: {
        _id: 0,
        user: "$_id",
        city: 1,
        totalSpent: 1,
        numberOfOrders: 1
        }
    },
    {
        $limit: 2
    }
    ]);*/



 const getUserChannelProfile = asyncHandler(async (req,res) =>{
      const {username}  = req.params
      if(!username?.trim()){
        throw new ApiError(400 , "username is missing")
      }

      const channel = await User.aggregate([
        {
            $match : {
                username : username
            }
        },
        {
            $lookup : {
               from:  "subscription" ,
               localField : "_id",
               foreignField : "channel",
               as:"subscribers"
            }
        },
        {
          $lookup :  { from:  "subscription" ,
               localField : "_id",
               foreignField : "subscriber",
               as:"subscribedTo"}
        },
        {
            $addFields : {
                subscriberCount : {$size : "$subscribers"},
                 subscriptionCount : {$size : "$subscribedTo"},
                 isSubscribed : {
                    $cond : {
                        if: {$in : [req.user?._id, "$subscribers.subscriber"]},
                        then: true ,
                        else : false
                    }
                 }
            }
        },
        {
            $project : {
                fullname : 1 ,
                username : 1,
                subscriberCount : 1 ,
                subscriptionCount : 1,
                isSubscribed : 1 ,
                avatar : 1,
                coverImage : 1,
                email : 1
            }
        }

      ])

      return res
      .status(200)
      .json (
        new ApiResponse(200,channel[0],"user channel fetched successfully")
      )


 })


export {loginUser,registerUser,logOutUser,refreshAccessToken
    ,changePassword,getCurrentUser,updateAvatar,getUserChannelProfile
}


