import mongoose from "mongoose";

const { Schema } = mongoose;

// Leads captured by the Resource Center lead magnets (Category 4.2): a
// top-of-funnel visitor who downloads a free guide/template gives us their
// email, neighborhood, and care timeline in exchange. These feed the
// drip-email matching sequence.
//
// Deliberately separate from src/modules/lead/lead.model.js — that model records outbound leads
// surfaced for the Slack triage hub and is constrained to scraper sources
// (FB/Nextdoor/…). This one is inbound, first-party, and consented.
const resourceLeadSchema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },

  name: { type: String, trim: true, default: "" },

  // Free-text neighborhood/area the visitor typed (e.g. "Rockridge, Oakland").
  neighborhood: { type: String, trim: true, default: "" },

  // When they need care, e.g. "Within 1 month". Used to prioritise follow-up.
  careTimeline: { type: String, trim: true, default: "" },

  // Slug of the lead magnet requested, e.g. "nanny-share-agreement".
  resource: { type: String, required: true, trim: true },

  createdAt: { type: Date, default: Date.now },
});

const ResourceLead = mongoose.model("resourceLeads", resourceLeadSchema);

export default ResourceLead;
