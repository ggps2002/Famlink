  import mongoose from "mongoose";
  const { Schema } = mongoose;

  const postJobSchema = new Schema(
    {
      jobType: {
        type: String,
        required: true,
        enum: [
          "nanny",
          "privateEducator",
          "houseManager",
          "specializedCaregiver",
          "swimInstructor",
          "musicInstructor",
          "sportsCoaches",
        ],
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },

      // --- Nanny ---
      nanny: {
        preferredSchedule: String,
        specificDays: Schema.Types.Mixed,
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        specificRequirements: {
          availability: [String],
          certifications: [String],
          drivingAbility: [String],
          languageSkills: [String],
          otherPreferences: String,
        },
        expectationsCaregiver: {
          cooking: String,
          educationalActivities: String,
          errandsAndGroceryShopping: String,
          houseManagementCleaning: String,
          transportation: String,
          otherPreferences: String,
        },
        jobDescription: String,
      },

      // --- Private Educator ---
      privateEducator: {
        preferredSchedule: String,
        subjects: {
          computerScience: [String],
          foreignLanguages: [String],
          languageArts: [String],
          math: [String],
          sciences: [String],
          socialStudies: [String],
          specializedCourses: [String],
          testPreparation: [String],
          otherPreferences: String,
        },
        gradeLevel: String,
        require: String,
        sessionTime: String,
        sessionSpecify: String,
        mode: String,
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        goal: [String],
        goalSpecify: String,
        style: [String],
        specificDays: Schema.Types.Mixed,
        specialRequirements: String,
        jobDescription: String,
      },

      // --- Specialized Caregiver ---
      specializedCaregiver: {
        preferredSchedule: String,
        specificDuties: [String],
        specificDutiesSpecify: String,
        specificCare: [String],
        specificCareSpecify: String,
        duration: [String],
        durationSpecify: String,
        expAndQua: [String],
        expAndQuaSpecify: String,
        availability: String,
        availabilitySpecify: String,
        addSkills: [String],
        addSkillsSpecify: String,
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        personalFit: [String],
        personalFitSpecify: String,
        specificDays: Schema.Types.Mixed,
        jobDescription: String,
      },

      // --- Sports Coaches ---
      sportsCoaches: {
        preferredSchedule: String,
        typeOf: [String],
        typeSpecify: String,
        skillsLevel: String,
        require: String,
        sessionTime: String,
        mode: String,
        goal: [String],
        style: [String],
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        specificDays: Schema.Types.Mixed,
        specialRequirements: String,
        jobDescription: String,
      },

      // --- Music Instructor ---
      musicInstructor: {
        preferredSchedule: String,
        typeOf: [String],
        typeSpecify: String,
        skillsLevel: String,
        require: String,
        sessionTime: String,
        mode: String,
        goal: [String],
        style: [String],
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        specificDays: Schema.Types.Mixed,
        specialRequirements: String,
        jobDescription: String,
      },

      // --- Swim Instructor ---
      swimInstructor: {
        preferredSchedule: String,
        skillsLevel: String,
        require: String,
        sessionTime: String,
        mode: String,
        goal: [String],
        style: [String],
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        specificDays: Schema.Types.Mixed,
        specialRequirements: String,
        jobDescription: String,
      },

      // --- House Manager ---
      houseManager: {
        preferredSchedule: String,
        specificDuties: [String],
        require: String,
        cookingSkills: [String],
        requireAssistance: String,
        hourlyRate: Schema.Types.Mixed,
        hourlyRateSpecify: String,
        specificDays: Schema.Types.Mixed,
        specialRequirements: String,
        jobDescription: String,
      },
    },
    {
      timestamps: true,
    }
  );

  // 🧠 Pre-validation middleware
  //
  // Synchronous, and it signals failure by THROWING. Mongoose 9 removed
  // callback-style middleware — hooks are called with the operation's arguments
  // rather than a `next`, so the old `function (next)` form threw "next is not a
  // function" before it ever reached a real check. Every one of the validations
  // below was silently unreachable as a result.
  postJobSchema.pre("validate", function () {
    const jobType = this.jobType;
    const field = this[jobType];

    if (!field) {
      throw new mongoose.Error.ValidationError(
        new Error(`Missing required section for job type: ${jobType}`)
      );
    }

    const requiredFieldsMap = {
      nanny: [
        "preferredSchedule",
        "hourlyRate",
        "specificRequirements.availability",
        "specificRequirements.certifications",
        "specificRequirements.drivingAbility",
        "specificRequirements.languageSkills",
        "expectationsCaregiver.cooking",
        "expectationsCaregiver.educationalActivities",
        "expectationsCaregiver.errandsAndGroceryShopping",
        "expectationsCaregiver.houseManagementCleaning",
        "expectationsCaregiver.transportation",
        "jobDescription",
      ],
      privateEducator: [
        "preferredSchedule",
        "subjects.computerScience",
        "subjects.foreignLanguages",
        "subjects.languageArts",
        "subjects.math",
        "subjects.sciences",
        "subjects.socialStudies",
        "subjects.specializedCourses",
        "subjects.testPreparation",
        "gradeLevel",
        "require",
        "sessionTime",
        "mode",
        "hourlyRate",
        "goal",
        "style",
        "jobDescription",
      ],
      specializedCaregiver: [
        "preferredSchedule",
        "specificDuties",
        "specificCare",
        "duration",
        "expAndQua",
        "availability",
        "addSkills",
        "hourlyRate",
        "personalFit",
        "jobDescription",
      ],
      sportsCoaches: [
        "preferredSchedule",
        "typeOf",
        "skillsLevel",
        "require",
        "sessionTime",
        "mode",
        "goal",
        "style",
        "hourlyRate",
        "jobDescription",
      ],
      musicInstructor: [
        "preferredSchedule",
        "typeOf",
        "skillsLevel",
        "require",
        "sessionTime",
        "mode",
        "goal",
        "style",
        "hourlyRate",
        "jobDescription",
      ],
      swimInstructor: [
        "preferredSchedule",
        "skillsLevel",
        "require",
        "sessionTime",
        "mode",
        "goal",
        "style",
        "hourlyRate",
        "jobDescription",
      ],
      houseManager: [
        "preferredSchedule",
        "specificDuties",
        "require",
        "preferredSchedule",
        "cookingSkills",
        "requireAssistance",
        "hourlyRate",
        "jobDescription",
      ],
    };

    const requiredFields = requiredFieldsMap[jobType];

    const getValue = (obj, path) => {
      return path.split(".").reduce((acc, part) => acc && acc[part], obj);
    };

    for (const path of requiredFields) {
      const value = getValue(field, path);
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        value === ""
      ) {
        throw new mongoose.Error.ValidationError(
          new Error(`Missing required field: ${jobType}.${path}`)
        );
      }
    }

    // 🧹 Clean up unused jobType fields
    const allJobTypes = Object.keys(requiredFieldsMap);
    for (const type of allJobTypes) {
      if (type !== jobType) {
        this[type] = undefined;
      }
    }
  });

  export default mongoose.model("PostJob", postJobSchema);
