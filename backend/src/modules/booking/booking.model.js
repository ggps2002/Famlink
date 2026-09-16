import mongoose from 'mongoose'

const { Schema } = mongoose

const bookingSchema = new Schema({
  requestBy: {
    type: Schema.Types.ObjectId,
    ref: 'users', // Reference to the family in the users collection
    required: true
  },
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'PostJob', // Reference to the family in the users collection
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'withdraw', 'rejected', 'completed'],
    default: 'pending'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  },
  completedBy: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  },
  familyReview: {
    type: Boolean,
    default: false
  },
  nannyReview: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  totalPayment: {
    type: Schema.Types.Number
  }
})

const Booking = mongoose.model('Booking', bookingSchema)
export default Booking
