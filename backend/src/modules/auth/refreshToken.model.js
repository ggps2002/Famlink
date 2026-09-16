import mongoose from "mongoose";

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId, // Typically used to reference User documents
        ref: 'users', // If this references the User model
        required: true
    },
    token: {
        type: String,
        required: true,
        index: true // Indexing token for faster lookups
    },
    expiry: {
        type: Date,
        required: true
    },
});

// Define the model
export const RefreshToken = mongoose.model("RefreshToken", RefreshTokenSchema);
