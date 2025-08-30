import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async function (localFilePath, path = "QNotes", shouldDelete = true) {

    try {

        if(!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto", folder: path
        });
        
        // console.log("file uploaded successfully", response.url);

        if(shouldDelete) fs.unlinkSync(localFilePath);

        // console.log("cloudinary response:", response);

        return response;

    } catch (error) {
        // console.log(error)
        fs.unlinkSync(localFilePath); //remove file from local
        return null;
    }
}



export { uploadOnCloudinary }