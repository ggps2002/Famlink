import mongoose from 'mongoose'

const { Schema } = mongoose

const notificationSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },
    chatId:{
      type: Schema.Types.ObjectId,
      ref: 'chats',
    },
    content: {
      type: Schema.Types.String,
    },
    type: {
      type: Schema.Types.String,
      enum: ['Message', 'Post', 'Verification', 'Booking']
    },
    seen: {
      type: Boolean,
      default: false,
      required: true
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'communities'
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'communities'
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'bookings'
    },
    seenAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
)

const Notification = mongoose.model('notifications', notificationSchema)

export default Notification
