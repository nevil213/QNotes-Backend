import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async function (buffer, path = "QNotes") {

    try {

        if(!buffer) return null;
        // console.log("buffer:", buffer);

        const response = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: "auto", folder: path },
                (error, result) => {
                    if (error){
                        console.log("Cloudinary upload error:", error);
                        return reject(error);
                    }
                    resolve(result);
                }
            );
            // console.log("uploadStream:", uploadStream);
            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
        
        // console.log("file uploaded successfully", response.url);

        // console.log("cloudinary response:", response);

        return response;

    } catch (error) {
        // console.log(error)W
        return null;
    }
}



export { uploadOnCloudinary }