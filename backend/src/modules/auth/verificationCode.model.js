import mongoose from 'mongoose'

const { Schema } = mongoose

const verifySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },
    frontsideImage: {
      type: Schema.Types.String, // Array of strings for multiple images
      required: true // Ensures at least one image is provided
    },
    backsideImage: {
      type: Schema.Types.String, // Array of strings for multiple images
      required: true // Ensures at least one image is provided
    }
  },
  { timestamps: true }
)

const Verify = mongoose.model('verified', verifySchema)
export default Verify
