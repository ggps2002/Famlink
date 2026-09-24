import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * One visitor's answers to the onboarding forms — the family match form, the
 * caregiver questionnaires, and the family nanny-share questionnaire — written
 * before (and while) they create an account.
 *
 * This replaces the Google Sheet those forms used to write to. The record keeps
 * the sheet's shape on purpose: `fields` holds the answers under the same
 * column names the forms always sent ("Name", "Number of children", …), so the
 * forms, the login-from-record flow and the admin console's "Form responses"
 * view read it exactly as they read a sheet row.
 *
 * `recordId` is the UUID the browser generates when the first form is sent and
 * carries in the URL through the rest of onboarding. It is the only handle a
 * visitor has before they have an account.
 */
const onboardingRecordSchema = new Schema(
  {
    recordId: { type: String, required: true, unique: true, index: true },

    // Answers keyed by column name. Mixed because the forms send different
    // columns and add new ones without a schema change — exactly as the sheet
    // took whatever it was sent.
    fields: { type: Schema.Types.Mixed, default: {} },

    // Copied out of fields.Email so the admin console can join records to
    // accounts ("who answered but never signed up") with an indexed query.
    email: { type: String, lowercase: true, trim: true, index: true, default: "" },
  },
  { timestamps: true, minimize: false }
);

export default mongoose.models.onboardingrecords ||
  mongoose.model("onboardingrecords", onboardingRecordSchema);
