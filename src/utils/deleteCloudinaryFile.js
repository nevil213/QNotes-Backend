import { v2 as cloudinary } from 'cloudinary';
import { ApiResponse } from './ApiResponse.js';
import { ApiError } from './ApiError.js';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


export const deleteCloudinaryImage = async function (public_id) {

    if(!public_id){
        throw new ApiError(404, "public id of image not found")
    }
    
    // NOTE:  we are not checking whether user is authorized to delete cloudinary image or not!!

    await cloudinary.uploader.destroy(public_id).then(() => {
        // console.log("cloudinary image deleted successfully");
        return new ApiResponse(200, "", "cloudinary image deleted successfully");
    }).catch((error) => {
        console.log(error)
        throw new ApiError(400, "something went wrong while deleting cloudinary image");
    });
}

export const deleteCloudinaryVideo = async function (public_id) {

    if(!public_id){
        throw new ApiError(404, "public id of image not found")
    }
    
    // NOTE:  we are not checking whether user is authorized to delete cloudinary image or not!!

    await cloudinary.uploader.destroy(public_id, {resource_type: 'video'}).then(() => {
        // console.log("cloudinary image deleted successfully");
        return new ApiResponse(200, "", "cloudinary image deleted successfully");
    }).catch((error) => {
        console.log(error)
        throw new ApiError(400, "something went wrong while deleting cloudinary image");
    });
}