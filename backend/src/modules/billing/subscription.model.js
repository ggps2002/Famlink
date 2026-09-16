import mongoose, { mongo } from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema({
  email: {
    type: Schema.Types.String,
    required: true,
    unique: true, // Ensures uniqueness of email
  },
});

const Subscription = mongoose.model("subscription", userSchema);
export default Subscription;
