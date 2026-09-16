import express from "express";
import NannyShare from "../src/modules/nannyShare/nannyShare.model.js";
import { authMiddleware } from "../src/shared/auth/middlewareAuth.js";
import User from "../src/modules/user/user.model.js";
import { geocodeZip } from "../src/shared/integrations/googleMaps.js";
import { sendAutoEmail } from "../src/shared/email/email.js";
import {
  PUBLIC_USER_SELECT,
  USER_IDENTITY_SELECT,
  withPublicUser,
  withPublicUsers,
} from "../src/modules/user/user.privacy.js";

const router = express.Router();

// POST a new Nanny Share job
// POST a new Nanny Share job
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only Parents & Admins can post jobs
    if (!["Admin"].includes(user.type)) {
      return res.status(403).json({ message: "Access denied. Unauthorized user." });
    }

    const data = req.body;

    // Validation (basic required fields)
    // const requiredFields = [
    //   "nannyShareType",
    //   "careDescription",
    //   "flexible",
    //   "hosting",
    //   "hourlyRateSplit",
    //   "prefferedCommunication",
    //   "backupAvailable",
    //   "involvement",
    // ];

    // for (const field of requiredFields) {
    //   if (!data[field]) {
    //     return res.status(400).json({ message: `Missing required field: ${field}` });
    //   }
    // }

    const nannySharePost = new NannyShare({
      ...data,
      user: userId,
    });

    await nannySharePost.save();

    res.status(201).json({
      message: "Nanny Share job posted successfully",
      job: nannySharePost,
    });
  } catch (error) {
    console.error("Error posting nanny share:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


// DELETE a Nanny Share job by ID (only if it belongs to the current user)
router.delete("/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const jobId = req.params.id;

  try {
    const job = await NannyShare.findById(jobId);

    if (!job) {
      return res.status(404).json({ message: "Nanny Share job not found" });
    }

    // Check if the job belongs to the logged-in user
    if (job.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this job" });
    }

    await NannyShare.findByIdAndDelete(jobId);

    res.status(200).json({ message: "Nanny Share job deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

router.patch("/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const jobId = req.params.id;
  const updateData = req.body;

  try {
    const job = await NannyShare.findById(jobId);

    if (!job) {
      return res.status(404).json({ message: "Nanny Share job not found" });
    }

    // Check ownership
    if (job.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this job" });
    }

    // Update only the provided fields
    Object.keys(updateData).forEach((key) => {
      job[key] = updateData[key];
    });

    await job.save();

    const updatedJob = await NannyShare.findById(jobId).populate({
      path: "user",
      select: USER_IDENTITY_SELECT,
    });
    res.status(200).json({
      message: "Nanny Share job updated successfully",
      job: updatedJob,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const {
      minChildren = 0,
      maxChildren = 0,
      minAge = 0,
      maxAge = 0,
      minRate = 0,
      maxRate = 100,
      nannyShareTypes,
      page = 1,
      limit = 10,
      location,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const currentUser = await User.findById(req.userId).select("location type");

    if (currentUser?.type === "Nanny") {
      return res.status(400).json({ message: "You aren't authorized" });
    }

    if (!currentUser?.location?.coordinates) {
      return res.status(400).json({ message: "User location not found" });
    }

    const [lng, lat] = currentUser.location.coordinates;
    const radiusInMiles = location ? parseFloat(location) : 5;
    const radiusInKm = radiusInMiles * 1.60934;
    const radiusInRadians = radiusInKm / 6378.1;

    let nearbyUsers = null;

    if (location) {
      // Step 1: Get nearby users
      nearbyUsers = await User.find({
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusInRadians],
          },
        },
      }).select("_id");
    }

    const nearbyUserIds = nearbyUsers?.map((u) => u._id);

    let query = {}; // initialize empty

    if (nearbyUserIds) {
      // Step 2: Get all matching shares (basic DB filter)
      query.$and = query.$and || [];

      query.$and.push({
        user: { $in: nearbyUserIds },
      });

      query.$and.push({
        $or: [
          {
            "hourlyBudget.min": {
              $exists: true,
              $gte: Number(minRate),
              $lte: Number(maxRate),
            },
          },
          {
            hourlyBudgetSpecify: {
              $exists: true,
              $gte: Number(minRate),
              $lte: Number(maxRate),
            },
          },
        ],
      });
    }
    // ✅ Only apply numberOfChildren filter if both > 0
    if (Number(minChildren) < Number(maxChildren)) {
      query.numberOfChildren = {
        $gte: Number(minChildren),
        $lte: Number(maxChildren),
      };
    }

    const standardTypes = [
      "full-time care",
      "part-time care",
      "pickup/drop-off (carpool style)",
      "after-school care",
      "summer/seasonal",
      "weekend nanny share"
    ];

    if (Array.isArray(nannyShareTypes) && nannyShareTypes.length > 0) {
      query.$and = query.$and || [];

      const selectedStandard = nannyShareTypes
        .map((t) => t.toLowerCase())
        .filter((t) => standardTypes.includes(t));

      const includesOther = nannyShareTypes.includes("Other");

      const orConditions = [];

      // ✅ Standard types
      if (selectedStandard.length > 0) {
        orConditions.push({
          nannyShareType: { $in: selectedStandard },
        });
      }

      // ✅ Other types (custom values)
      if (includesOther) {
        orConditions.push({
          nannyShareType: { $nin: standardTypes },
        });
      }

      if (orConditions.length > 0) {
        query.$and.push({ $or: orConditions });
      }
    }

    const allMatchingShares = await NannyShare.find(query)
      .populate("user", PUBLIC_USER_SELECT)
      .sort({ createdAt: -1 });

    // Step 3: Filter by children's ages
    let fullyFiltered = allMatchingShares;

    // ✅ Only apply children age filter if both minAge & maxAge > 0
    if (Number(maxAge) > 0) {
      fullyFiltered = allMatchingShares.filter((share) => {
        if (!share.childrenAges || share.childrenAges.length === 0) return false;

        // Convert ["2 yrs", "5 yrs"] → [2, 5]
        const parsedAges = share.childrenAges
          .map((ageStr) => {
            const match = ageStr.match(/(\d+(\.\d+)?)/); // match integer or decimal
            return match ? Number(match[1]) : null;
          })
          .filter((n) => n !== null);

        if (parsedAges.length === 0) return false;

        return parsedAges.some(
          (age) => age >= Number(minAge) && age <= Number(maxAge)
        );

      });
    }


    const totalRecords = fullyFiltered.length;
    const totalPages = Math.ceil(totalRecords / limitNumber);
    const paginatedData = fullyFiltered.slice(skip, skip + limitNumber);

    return res.status(200).json({
      status: 200,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      },
      data: withPublicUsers(paginatedData),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

router.get('/allData', authMiddleware, async (req, res) => {
  console.log("user id", req.userId);
  try {
    // Ensure only admins can access this route
    const adminUser = await User.findById(req.userId).select("name email imageUrl zipCode location type");
    if (!adminUser || adminUser.type !== "Admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    // Pagination setup
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Fetch paginated nanny shares with related user fields
    const nannyShares = await NannyShare.find({})
      .populate("user", "name email imageUrl zipCode location")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await NannyShare.countDocuments({});
    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json({
      admin: adminUser, // include logged-in admin user details
      data: nannyShares, // paginated nanny shares
      pagination: {
        totalRecords: totalCount,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("❌ Error in /allData route:", error);
    return res.status(500).json({
      message: "Failed to fetch nanny shares",
      error: error.message,
    });
  }
});



// Share detail. Was unauthenticated and served the poster's email address plus
// their full stored location (street address and exact coordinates) to anyone
// who had an id. The dashboard already calls this with a token.
router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const nannyShare = await NannyShare.findById(id).populate({
      path: "user",
      select: PUBLIC_USER_SELECT,
    });

    if (!nannyShare) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json({ data: withPublicUser(nannyShare) });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

router.get("/nanny-share-opportunities/city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const { page = 1, limit = 6 } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Match exact city (case-insensitive)
    const cityRegex = new RegExp(`\\b${city}\\b`, "i");

    // Get users ONLY from that city
    const usersInCity = await User.find({
      "location.format_location": cityRegex,
    }).select("_id");

    const userIds = usersInCity.map((u) => u._id);

    const totalRecords = await NannyShare.countDocuments({
      user: { $in: userIds },
    });

    const nannyShares = await NannyShare.find({
      user: { $in: userIds },
    })
      .populate("user", PUBLIC_USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const totalPages = Math.ceil(totalRecords / limitNumber);

    res.status(200).json({
      status: 200,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      },
      // Public city page — the poster's location has to be an area here.
      data: withPublicUsers(nannyShares),
    });
  } catch (err) {
    console.error("Error fetching nanny shares:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

router.post("/send-questionnaire-email", async (req, res) => {
  const { email, name, id } = req.body;

  const firstName = name.split(" ")[0];
  const year = new Date().getFullYear();

  const intakeFormUrl = `https://famlink.care/find-nanny-share/nanny-share-questionnaire/${id}`; // 🔁 Replace with your actual URL

  const htmlContent = `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

<head>
	<title></title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0"><!--[if mso]>
<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:DontUseAdvancedTypographyReadingMail/></w:WordDocument>
<o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml>
<![endif]-->
	<style>
		* { box-sizing: border-box; }
		body { margin: 0; padding: 0; }
		a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
		#MessageViewBody a { color: inherit; text-decoration: none; }
		p { line-height: inherit }
		.desktop_hide, .desktop_hide table { mso-hide: all; display: none; max-height: 0px; overflow: hidden; }
		.image_block img+div { display: none; }
		sup, sub { font-size: 75%; line-height: 0; }
		@media (max-width:520px) {
			.social_block.desktop_hide .social-table { display: inline-block !important; }
			.mobile_hide { display: none; }
			.row-content { width: 100% !important; }
			.stack .column { width: 100%; display: block; }
			.mobile_hide { min-height: 0; max-height: 0; max-width: 0; overflow: hidden; font-size: 0px; }
			.desktop_hide, .desktop_hide table { display: table !important; max-height: none !important; }
		}
	</style>
</head>

<body class="body" style="background-color: #FFFFFF; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #FFFFFF;">
		<tbody>
			<tr>
				<td>
					<table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 500px; margin: 0 auto;" width="500">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="col-pad" style="padding-bottom:5px;padding-top:5px;">
																<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
																	<tr>
																		<td class="pad" style="width:100%;">
																			<div class="alignment" align="center">
																				<div style="max-width: 500px;"><img src="https://res.cloudinary.com/dkrgywbux/image/upload/v1775046872/1_Famlink_2_njtahg.png" style="display: block; height: auto; border: 0; width: 100%;" width="500" alt title height="auto"></div>
																			</div>
																		</td>
																	</tr>
																</table>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ffffff;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; background-color: #ffffff; width: 500px; margin: 0 auto;" width="500">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="col-pad" style="padding-bottom:5px;padding-top:5px;">
																<table class="paragraph_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
																	<tr>
																		<td class="pad">
																			<div style="color:#101112;direction:ltr;font-family:Arial, Helvetica Neue, Helvetica, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:1.2;text-align:left;mso-line-height-alt:19px;">
																				<p style="margin: 0; margin-bottom: 16px;">Hi ${firstName},</p>
																				<p style="margin: 0; margin-bottom: 16px;">Thanks for sharing a quick snapshot of your childcare needs.</p>
																				<p style="margin: 0; margin-bottom: 16px;">To start matching you with compatible families (same neighborhood, similar schedules, aligned budget), we use a short intake form. Once you complete it, our team can begin looking for nanny share options for you.</p>
																		<p style="margin: 0; font-weight: bold;">👉 Fill out your nanny share intake form here (3-5 minutes)<br>&nbsp;</p>
																			</div>
																		</td>
																	</tr>
																</table>
																<table class="button_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
																	<tr>
																		<td class="pad">
																			<div class="alignment" align="center"><!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${intakeFormUrl}" style="height:41px;width:231px;v-text-anchor:middle;" arcsize="147%" fillcolor="#FFAEE1">
<v:stroke dashstyle="Solid" weight="0px" color="#FFAEE1"/>
<w:anchorlock/>
<v:textbox inset="0px,0px,0px,0px">
<center dir="false" style="color:#001243;font-family:sans-serif;font-size:16px">
<![endif]--><a href="${intakeFormUrl}" target="_blank" style="text-decoration: none;"><span class="button" style="background-color: #FFAEE1; border-bottom: 0px solid transparent; border-left: 0px solid transparent; border-radius: 60px; border-right: 0px solid transparent; border-top: 0px solid transparent; color: #001243; display: inline-block; font-family: Arial, Helvetica Neue, Helvetica, sans-serif; font-size: 16px; font-weight: 400; mso-border-alt: none; text-align: center; width: auto; word-break: keep-all; letter-spacing: normal;"><span class="btn-pad" style="word-break: break-word; padding-left: 20px; padding-right: 20px; padding-top: 5px; padding-bottom: 5px; display: block;"><span style="word-break: break-word; line-height: 32px;"><strong>Complete my intake form</strong></span></span></span></a><!--[if mso]></center></v:textbox></v:roundrect><![endif]--></div>
																		</td>
																	</tr>
																</table>
																<table class="paragraph_block block-3" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
																	<tr>
																		<td class="pad">
																			<div style="color:#101112;direction:ltr;font-family:Arial, Helvetica Neue, Helvetica, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:1.2;text-align:left;mso-line-height-alt:19px;">
																				<p style="margin: 0; margin-bottom: 16px;">After you submit it, we'll review your answers and follow up with potential matches or next steps within 1-2 business days.</p>
																				<p style="margin: 0;">Warmly,</p>
																				<p style="margin: 0;font-weight: bold;">Famlink Team</p>
																			</div>
																		</td>
																	</tr>
																</table>
																<table class="social_block block-4" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
																	<tr>
																		<td class="pad">
																			<div class="alignment" align="center">
																				<table class="social-table" width="106px" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; display: inline-block;">
																					<tr>
																						<td style="padding:0 0 0 0px;"><a href="https://www.facebook.com/profile.php?id=61573842520549" target="_blank"><img src="https://res.cloudinary.com/dkrgywbux/image/upload/v1775046963/2_facebook2x_wnlkg2.png" width="32" height="auto" alt="Facebook" title="facebook" style="display: block; height: auto; border: 0;"></a></td>
																						<td style="padding:0 0 0 5px;"><a href="https://www.linkedin.com/company/famlink-care/" target="_blank"><img src="https://res.cloudinary.com/dkrgywbux/image/upload/v1775046973/3_linkedin2x_x7kiev.png" width="32" height="auto" alt="Linkedin" title="linkedin" style="display: block; height: auto; border: 0;"></a></td>
																						<td style="padding:0 0 0 5px;"><a href="https://www.instagram.com/famlink.care?igsh=Njl6MWw3bWo4cDc2&utm_source=qr" target="_blank"><img src="https://res.cloudinary.com/dkrgywbux/image/upload/v1775046985/4_instagram2x_dx9bq2.png" width="32" height="auto" alt="Instagram" title="instagram" style="display: block; height: auto; border: 0;"></a></td>
																					</tr>
																				</table>
																			</div>
																		</td>
																	</tr>
																</table>
																<table class="paragraph_block block-5" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
																	<tr>
																		<td class="pad">
																			<div style="color:#101112;direction:ltr;font-family:Arial, Helvetica Neue, Helvetica, sans-serif;font-size:14px;font-weight:400;letter-spacing:0px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
                                      <p style="margin: 0;"><span style="word-break: break-word; color: #6a6a6a;">©Famlink ${year} - All rights reserved</span></p>
																			</div>
																		</td>
																	</tr>
																</table>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
		</tbody>
	</table>
</body>
</html>`;

  try {
    await sendAutoEmail('"Famlink Team" <system@famlink.care>', email, 'One more step from nanny share matches', htmlContent)
    res.status(200).json({ message: "Questionnaire email sent successfully" });
  } catch (error) {
    console.error("Error sending questionnaire email:", error);
    res.status(500).json({ error: "Failed to send questionnaire email" });
  }
});

export default router;