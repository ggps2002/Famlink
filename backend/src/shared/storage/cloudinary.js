import {v2 as cloudinary} from 'cloudinary';
import 'dotenv/config'

cloudinary.config({ 
  cloud_name: 'dkrgywbux', 
  api_key: '873844415141351', 
  api_secret: process.env.CLOUDINARY_SECRET 
});

export default cloudinary
