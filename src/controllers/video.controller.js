import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { uploadOnCloudinary,deleteFromCloudinary } from "../utils/cloudnary.js"
import { upload } from "../middlewares/multer.middleware.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    let match = {
        isPublished : true
    } ;

     if(userId){
        match.owner = new mongoose.Types.ObjectId(userId)
     }
        if (query) {
    match.$or = [
        {
        title: {
            $regex: query,
            $options: "i"
        }
        },
        {
        description: {
            $regex: query,
            $options: "i"
        }
        }
    ];
    }

    let sort ={}
    if(sortBy){
        sort[sortBy] = sortType === "asc" ? 1 : -1
    }else{
        sort["createdAt"] = -1 ;
    }

    const aggregate = Video.aggregate([

        {
            $match : match
        },

        {
            $lookup : {
                from : "users",
                localField : "owner" ,
                foreignField : "_id" ,
                as : "owner",
                pipeline : [
                    {
                        $project : {
                            fullname : 1,
                            username : 1,
                            avatar : 1
                        }
                    }
                ]
            }
        },
        {
            $addFields : {
                owner : {
                    $first : "$owner"
                }
            }
        },

        {
            $sort : sort
        },
        {
            $project : {
                title : 1,
                description : 1,
                thumbnail : 1,
                videoFile : 1,
                views : 1,
                duration : 1,
                createdAt : 1,
                owner : 1
            }
        }

    ])

    const options = {
        page : Number(page),
        limit : Number(limit)
    }

    const videoes = await Video.aggregatePaginate(aggregate,options)

    res.status(200)
    .json(
        new ApiResponse(200,
            videoes,
            "video fetched successfully"
        )
    )

}
)



const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body

   if([title,description].some(field=>
       field?.trim() === ""
   )){
    throw new ApiError(409,"each field is required")
   }

  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path ;
  const videoFileLocalPath = req.files?.videoFile?.[0]?.path ;

    if([thumbnailLocalPath,videoFileLocalPath].some(field=>
       !field
   )){
    throw new ApiError(409,"thumbnail and videofile are required")
   }

   const thumbnail = await uploadOnCloudinary(thumbnailLocalPath) ;
   const videoFile = await uploadOnCloudinary(videoFileLocalPath)
   if(!thumbnail || !videoFile){
    throw new ApiError(500 , "can't upload video")
   }


   const video = await Video.create({
       title ,
       description,
       videoFile : videoFile?.url,
       thumbnail : thumbnail?.url ,
        thumbnailPublicId  : thumbnail.public_id ,
        videoPublicId : videoFile.public_id,
        owner : req.user._id,
        duration : videoFile.duration ,

   })
   res.status(200)
   .json(
      new ApiResponse(200,{video},"video uploaded successfully")
   )
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const video = await Video.findById(videoId)

    const oldThumbnail = video.thumbnailPublicId ;

    const localThumbnailPath = req.file?.path ;

    if(!localThumbnailPath){
        throw new ApiError(409,"upload a thumbnail")
    }

    const thumbnail = await uploadOnCloudinary(localThumbnailPath) ;

     if(!thumbnail){
    throw new ApiError(500 , "can't upload video")
   }

   const update = await Video.findByIdAndUpdate(
      videoId ,
     {
        $set : {thumbnail : thumbnail.url}
     },
     {
        new : true
     }
   )

   if(!upload){
    throw new ApiError(500 , "can't update thumbnail")
   }

   await deleteFromCloudinary(oldThumbnail)

    res.status(200)
   .json(
      new ApiResponse(200,{},"thumbnail updated successfully")
   )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate ID format
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    // 2. Fetch video document
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3. Delete files from Cloudinary
    if (video.thumbnailPublicId) {
        await deleteFromCloudinary(video.thumbnailPublicId, "image");
    }

    if (video.videoPublicId) {
        await deleteFromCloudinary(video.videoPublicId, "video");
    }

    // 4. Delete document from Database
    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Toggle the boolean status
    video.isPublished = !video.isPublished;
    await video.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video publish status toggled successfully"));
});

export {
    getAllVideos,
    publishAVideo,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
