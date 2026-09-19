/**
 * Email bodies owned by the nanny share module.
 *
 * Lifted verbatim from Routes/nannyShare.js during the module migration — the
 * markup is unchanged, including the table-based layout and the MSO
 * conditional comments, which are what make it render in Outlook. The only
 * difference is that the three interpolations are now named parameters instead
 * of variables that happened to be in scope inside a route handler.
 */

/**
 * "One more step from nanny share matches" — the nudge that carries a family
 * from the short snapshot form into the full six-step intake questionnaire.
 *
 * @param {object} params
 * @param {string} params.firstName  the recipient's first name only
 * @param {string} params.intakeFormUrl  their personal intake form link
 * @param {number} params.year  rendered into the footer's copyright line
 */
export const questionnaireEmail = ({ firstName, intakeFormUrl, year }) => `<!DOCTYPE html>
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
