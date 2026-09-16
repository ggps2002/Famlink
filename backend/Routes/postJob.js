import express from "express";
import { authMiddleware } from "../src/shared/auth/middlewareAuth.js";
import User from "../src/modules/user/user.model.js";
import postJob from "../src/modules/job/postJob.model.js";
import _ from "lodash";
import Booking from "../src/modules/booking/booking.model.js";
import {
  PUBLIC_USER_SELECT,
  USER_IDENTITY_SELECT,
  toPublicUser,
} from "../src/modules/user/user.privacy.js";

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
  const { userId } = req;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Optional: Only allow specific user types
    if (!["Parents", "Admin"].includes(user.type)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized user." });
    }

    const { jobType, ...jobData } = req.body;
    console.log(req.body)
    if (!jobType) {
      return res
        .status(400)
        .json({ message: "Missing required field: jobType" });
    }

    // Construct job object dynamically
    const specificJobData = jobData[jobType];
    if (!specificJobData) {
      return res
        .status(400)
        .json({ message: `Missing job data for type: ${jobType}` });
    }

    // Merge jobType, userId, and all fields from the specific job data
    const postData = {
      jobType,
      user: userId,
      [jobType]: specificJobData, // 🧠 Nest the job data correctly
    };

    const jobPost = new postJob(postData);
    await jobPost.save();

    return res.status(201).json({
      message: `${jobType} job posted successfully`,
      job: jobPost,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const { userId } = req;
  const { id } = req.params;

  try {
    // Check if the job exists and belongs to the current user
    const job = await postJob.findById(id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Match userId from token with job.user
    if (job.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized. You can only delete your own jobs." });
    }

    await postJob.findByIdAndDelete(id);

    return res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

router.patch("/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const jobId = req.params.id;
  const updateData = req.body;

  try {
    const post = await postJob.findById(jobId).populate({
      path: "user",
      select: "email name imageUrl noOfChildren location age gender reviews",
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.user._id.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this post" });
    }

    const jobType = post.jobType;

    if (updateData) {
      _.merge(post[jobType], updateData);
    }

    await post.save();

    // Calculate averageRating
    let averageRating = 0;
    if (post.user.reviews && Array.isArray(post.user.reviews)) {
      const totalRating = post.user.reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      averageRating =
        post.user.reviews.length > 0
          ? (totalRating / post.user.reviews.length).toFixed(1)
          : 0;
    }

    const { _id, user, createdAt, updatedAt } = post;

    return res.status(200).json({
      message: "Post updated successfully",
      data: {
        _id,
        jobType,
        user: {
          ...user.toObject(),
          averageRating,
        },
        createdAt,
        updatedAt,
        [jobType]: post[jobType],
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update post job",
      error: error.message,
    });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const {
      jobType,
      minChildren = 0,
      maxChildren = 5,
      minAge = 0,
      maxAge = 18,
      minRate = 0,
      maxRate = 100,
      preferredSchedule,
      page = 1,
      location,
      limit = 10,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const currentUser = await User.findById(req.userId).select("location zipCode type");

    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    if (currentUser.type === "Parents") {
      return res.status(403).json({ message: "You are not authorized to view job posts." });
    }

    let nearbyUsers = [];
    let nearbyUserIds = [];

    // Step 1: Determine users within radius or same zip
    if (currentUser.location?.coordinates?.length === 2) {
      const [lng, lat] = currentUser.location.coordinates;
      const radiusInMiles = location ? parseFloat(location) : 5;
      const radiusInKm = radiusInMiles * 1.60934;
      const radiusInRadians = radiusInKm / 6378.1;

      nearbyUsers = await User.find({
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusInRadians],
          },
        },
      }).select("_id zipCode location noOfChildren");

      if (process.env.NODE_ENV === "development") {
        console.log("Used location radius search:", { lng, lat, radiusInMiles });
      }
    } else if (currentUser.zipCode) {
      nearbyUsers = await User.find({
        zipCode: currentUser.zipCode,
      }).select("_id zipCode location noOfChildren");

      if (process.env.NODE_ENV === "development") {
        console.log("Used fallback zipCode match:", currentUser.zipCode);
      }
    } else {
      return res.status(400).json({
        message: "User must have either location coordinates or a zip code to search jobs.",
      });
    }

    nearbyUserIds = nearbyUsers.map((u) => u._id.toString());

    if (!nearbyUserIds.length) {
      return res.status(404).json({ message: "No nearby users found." });
    }

    // Step 2: Build base query
    const query = {
      user: { $in: nearbyUserIds },
    };

    const jobTypesArray = [
      "nanny",
      "privateEducator",
      "houseManager",
      "specializedCaregiver",
      "swimInstructor",
      "musicInstructor",
      "sportsCoaches",
    ];

    const selectedJobTypes = jobType
      ? Array.isArray(jobType)
        ? jobType
        : jobType.split(",")
      : jobTypesArray;

    query.$or = selectedJobTypes.flatMap((type) => [
      {
        [`${type}.hourlyRate.min`]: {
          $exists: true,
          $gte: Number(minRate),
          $lte: Number(maxRate),
        },
      },
      {
        [`${type}.hourlyRate`]: {
          $type: "number",
          $gte: Number(minRate),
          $lte: Number(maxRate),
        },
      },
    ]);

    // Step 3: Optional preferred schedule filter
    const preferredSchedules = preferredSchedule
      ? Array.isArray(preferredSchedule)
        ? preferredSchedule
        : preferredSchedule.split(",")
      : [];

    if (preferredSchedules.length > 0) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: selectedJobTypes.flatMap((type) =>
          preferredSchedules.map((schedule) => ({
            [`${type}.preferredSchedule`]: schedule,
          }))
        ),
      });
    }

    // Step 4: Fetch posts
    const posts = await postJob
      .find(query)
      .populate("user", PUBLIC_USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .exec();

    // Step 5: Filter based on user noOfChildren
    const filteredPosts = posts.filter((post) => {
      const user = post.user;
      if (!user || !user.noOfChildren || !user.noOfChildren.info) return false;

      const childAges = Object.values(user.noOfChildren.info)
        .map((age) => Number(age))
        .filter((age) => !isNaN(age));

      if (!childAges.length) return false;

      const minChildAge = Math.min(...childAges);
      const maxChildAge = Math.max(...childAges);
      const childrenCount = user.noOfChildren.length || childAges.length;

      return (
        childrenCount >= Number(minChildren) &&
        childrenCount <= Number(maxChildren) &&
        minChildAge >= Number(minAge) &&
        maxChildAge <= Number(maxAge)
      );
    });

    // Step 6: Clean and enrich posts
    const cleanedPosts = filteredPosts.map((post) => {
      const cleaned = post.toObject();

      jobTypesArray.forEach((type) => {
        if (type !== post.jobType) {
          delete cleaned[type];
        }
      });

      let averageRating = 0;
      if (cleaned.user && Array.isArray(cleaned.user.reviews)) {
        const totalRating = cleaned.user.reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        averageRating =
          cleaned.user.reviews.length > 0
            ? (totalRating / cleaned.user.reviews.length).toFixed(1)
            : 0;
      }

      // The poster is another member here: area, not address.
      cleaned.user = { ...toPublicUser(cleaned.user), averageRating };

      return cleaned;
    });

    const totalRecords = await postJob.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNumber);

    return res.status(200).json({
      status: 200,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
      },
      data: cleanedPosts,
    });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching jobs.",
      error: err.message,
    });
  }
});

router.get("/job-seeker-opportunities/:zipCode", async (req, res) => {
  const { zipCode } = req.params;

  try {
    // Step 1: Get all users in the zipCode.
    //
    // Ids only. This route is open to the internet and the titles below are
    // built from `userMap`, so anything put in it is published: the job title
    // stays "Music Instructor – Local Family" and never names a household or
    // an address. (It read a non-existent top-level `format_location` before,
    // which happened to be undefined every time — this makes that deliberate
    // rather than a bug someone later "fixes" into a leak.)
    const users = await User.find({ zipCode }).select("_id");

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = "Local Family";
    });

    const userIds = Object.keys(userMap);

    // Step 2: Fetch all job posts by those users
    const jobs = await postJob.find({ user: { $in: userIds } });

    const formatted = jobs.map((job) => {
      const jobType = job.jobType;
      const jobData = job[jobType] || {}; // e.g., job["musicInstructor"]

      // Title based on job type
      const jobTypeName = jobType
        .replace(/([A-Z])/g, " $1") // camelCase to spaced
        .replace(/^./, (c) => c.toUpperCase()); // Capitalize first letter

      const title = `${jobTypeName} – ${userMap[job.user.toString()]}`;

      // Rate extraction
      const min = jobData.hourlyRate?.min || null;
      const max = jobData.hourlyRate?.max || null;

      let rate = "Rate not specified";
      if (min && max && min !== max) {
        rate = `$${min}–$${max}/hour`;
      } else if (min) {
        rate = `$${min}/hour`;
      }

      const type = jobData.preferredSchedule || null;

      return {
        title,
        rate,
        type,
        action: "View Details – Sign Up Required",
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("Error fetching job seeker opportunities:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



router.get("/user-jobs", authMiddleware, async (req, res) => {
  const userId = req.userId;
  console.log("job creator", userId);
  try {
    const jobs = await postJob
      .find({ user: userId })
      .populate({
        path: "user",
        select: "email name imageUrl noOfChildren location",
      })
      .sort({ createdAt: -1 });

    if (!jobs.length) {
      return res.status(404).json({ message: "No jobs found for this user" });
    }

    const filteredJobs = jobs.map((job) => {
      const { jobType, _id, user, createdAt, updatedAt } = job;
      return {
        _id,
        jobType,
        user,
        createdAt,
        updatedAt,
        [jobType]: job[jobType],
      };
    });

    res.status(200).json({ data: filteredJobs });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// GET /count
router.get("/count", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.type !== "Admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const totalJobs = await postJob.countDocuments();

    return res.status(200).json({ totalJobs });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

router.get("/all-jobs", async (req, res) => {
  console.log("📥 GET /postJob/fetchAllJobs called");
  try {
    // Unauthenticated route — this must never carry more than the public
    // projection, and even that only because the formatter below reduces it to
    // a card. See Services/utils/userPrivacy.js.
    const jobs = await postJob.find()
      .populate({ path: "user", select: PUBLIC_USER_SELECT })
      .sort({ createdAt: -1 })
      .lean()

    const formattedJobs = jobs.map((job) => {
      const jobDetails = job[job.jobType];
      if (!jobDetails) return null;

      const hourlyRate =
        typeof jobDetails.hourlyRate === "number"
          ? jobDetails.hourlyRate
          : parseFloat(jobDetails?.hourlyRate?.min?.toString() || "0");

      // Area, not address: `format_location` as stored starts with a street
      // number, and this route is open to the internet.
      const user = toPublicUser(job.user) || {};

      return {
        id: job._id,
        title: job.jobType,
        description: jobDetails?.jobDescription || "",
        familyId: user._id || "",
        location: user.location?.format_location || "",
        hourlyRate,
        schedule: jobDetails?.preferredSchedule || "",
        requirements:
          jobDetails?.specificRequirements?.otherPreferences || "",
        childrenAges: user.noOfChildren || "",
        isActive: true,
        createdAt: job.createdAt,
        family: {
          firstName: (user.name || "").split(" ")[0] || "",
          // Initial only. A full family surname next to a neighborhood, a rate
          // and a childcare schedule, on a route anyone can call, identifies a
          // specific household.
          lastName: ((user.name || "").split(" ")[1] || "").charAt(0),
          city: user.location?.city || "",
          state: user.location?.state || "",
        },
      };
    }).filter(Boolean);

    res.status(200).json({ jobs: formattedJobs });
  } catch (error) {
    console.error("🔥 Error fetching jobs:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/admin-job", authMiddleware, async (req, res) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.type !== "Admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Only Admins can view all jobs." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    const totalJobs = await postJob.countDocuments(filter);

    const jobs = await postJob
      .find(filter)
      .populate({
        path: "user",
        select: "email name imageUrl noOfChildren location",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // ✅ Use lean to return plain JS objects

    // ✅ Get all jobIds
    const jobIds = jobs.map((job) => job._id);

    // ✅ Fetch all bookings related to those jobs
    const bookings = await Booking.find({ jobId: { $in: jobIds } })
      .populate("requestBy", "name email")
      .lean();

    // ✅ Create a map for quick lookup
    const bookingMap = {};
    bookings.forEach((b) => {
      bookingMap[b.jobId.toString()] = b;
    });

    // ✅ Merge booking into each job
    const mergedJobs = jobs.map((job) => {
      const jobId = job._id.toString();
      const booking = bookingMap[jobId] || null;

      const { jobType, user, createdAt, updatedAt } = job;

      return {
        _id: job._id,
        jobType,
        user,
        createdAt,
        updatedAt,
        [jobType]: job[jobType],
        booking: booking
          ? {
            status: booking.status,
            isPaid: booking.isPaid,
            startAt: booking.startAt,
            totalPayment: booking.totalPayment,
            requestBy: booking.requestBy,
            completedAt: booking.completedAt,
            rejectedAt: booking.rejectedAt,
          }
          : null,
      };
    });

    res.status(200).json({
      data: mergedJobs,
      pagination: {
        total: totalJobs,
        page,
        limit,
        totalPages: Math.ceil(totalJobs / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const job = await postJob.findById(id).populate({
      path: "user",
      select: PUBLIC_USER_SELECT,
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const hired = await Booking.findOne({
      jobId: id,
      status: "completed",
    })

    const userObj = toPublicUser(job.user);

    // Populate each review with user details
    let enrichedReviews = [];
    if (Array.isArray(userObj.reviews) && userObj.reviews.length > 0) {
      const userIds = userObj.reviews.map((r) => r.userId);
      // A review byline needs a name and an avatar. It was also handing out the
      // reviewer's email address.
      const reviewers = await User.find({ _id: { $in: userIds } }).select(
        USER_IDENTITY_SELECT
      );

      const reviewerMap = new Map(
        reviewers.map((user) => [user._id.toString(), user])
      );

      enrichedReviews = userObj.reviews.map((review) => {
        const reviewer = reviewerMap.get(review.userId.toString());
        return {
          ...review,
          reviewer: reviewer || null,
        };
      });
    }

    // Calculate averageRating and count reviews per star
    const totalRating = enrichedReviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    const averageRating =
      enrichedReviews.length > 0 ? (totalRating / enrichedReviews.length).toFixed(1) : 0;

    // Count reviews by star rating
    const reviewCounts = enrichedReviews.reduce((acc, review) => {
      acc[review.rating] = (acc[review.rating] || 0) + 1;
      return acc;
    }, {});

    // Convert to array format for frontend
    const reviewCountsByStars = Array.from({ length: 5 }, (_, i) => ({
      stars: 5 - i,
      count: reviewCounts[5 - i] || 0,
    }));


    const { jobType, _id, createdAt, updatedAt } = job;

    const data = {
      _id,
      jobType,
      hired: hired ? true : false,
      user: {
        ...userObj,
        averageRating,
        reviews: enrichedReviews,
        reviewCountsByStars, // 👈 Include here
      },
      createdAt,
      updatedAt,
      [jobType]: job[jobType],
    };


    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});


export default router;
