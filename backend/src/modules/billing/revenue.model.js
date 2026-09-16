import mongoose from "mongoose";

const revenueSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  stripeCustomerId: { type: String, required: true },
  subscriptionId: { type: String, required: true },
  amount: { type: Number, required: true }, // in cents
  currency: { type: String, default: "usd" },
  paidAt: { type: Date, default: Date.now },
  type: { type: String, enum: ["initial", "renewal"], default: "initial" },
});

export default mongoose.model("Revenue", revenueSchema);

