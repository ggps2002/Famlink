import mongoose from "mongoose";

const { Schema } = mongoose;

const leadSchema = new Schema({
  source: {
    type: Schema.Types.String,
    enum: ["FB", "Nextdoor", "BPN", "Peanut", "Craigslist"],
    required: true,
  },

  urgency: {
    type: Schema.Types.String,
  },

  userType: {
    type: Schema.Types.String,
  },

  directLink: {
    type: Schema.Types.String,
    required: true,
  },

  zone: {
    type: Schema.Types.String,
    default: "In-Zone",
  },

  // --- NEW ADVANCED AI FIELDS ---
  incomingMessage: { type: Schema.Types.String },
  leadType: { type: Schema.Types.String },
  locationStatus: { type: Schema.Types.String },
  city: { type: Schema.Types.String },
  careArrangement: { type: Schema.Types.String },
  potentialShareType: { type: Schema.Types.String },
  sharePotential: { type: Schema.Types.String },
  nannyStatus: { type: Schema.Types.String },
  leadTemperature: { type: Schema.Types.String },
  conversionPath: { type: Schema.Types.String },
  priorityTier: { type: Schema.Types.String },
  childAge: { type: Schema.Types.String },

  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const Lead = mongoose.model("leads", leadSchema);

export default Lead;
