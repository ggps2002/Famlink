import cloudinary from "./cloudinary.js";

async function uploadImage(buffer, email, img) {
    try {
        const public_id = `${img}${email.replace(/[^a-z0-9]/gi, '_')}`;
        
        // Return a new promise to properly handle the asynchronous operation
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: 'auto', public_id: public_id },
                (error, result) => {
                    if (error) {
                        reject(error); // Reject the promise if there's an error
                    } else {
                        resolve(result.secure_url); // Resolve the promise with the secure URL
                    }
                }
            ).end(buffer);
        });
    } catch (error) {
        throw error; // Throw the error to be caught by the caller
    }
}

export default uploadImage;