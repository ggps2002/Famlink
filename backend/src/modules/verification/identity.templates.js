// The two emails an ID review can produce.
//
// Kept out of the service so the decision logic reads as a state machine rather
// than as prose, and so the wording can be reviewed as wording. Plain text,
// matching what these have always sent.

const signOff = "Best regards,\nFamyLink\nSupport Team\n";

export const approvedEmail = (name) => ({
  subject: "Your Verification Request Has Been Approved",
  body:
    `Dear ${name},\n\n` +
    "We are pleased to inform you that your verification request for the National ID has been successfully approved.\n\n" +
    "Thank you for your patience and cooperation during the process. If you have any questions, feel free to contact our support team.\n\n" +
    signOff,
});

// Deliberately gives a reason and a way forward. A member who is told only
// "reverted" has no idea whether to resubmit or to appeal.
export const revertedEmail = (name) => ({
  subject: "Your Verification Request Has Been Reverted",
  body:
    `Dear ${name},\n\n` +
    "We regret to inform you that your verification request for the National ID has been reverted. This action was taken due to incomplete or missing documentation required for the verification process.\n\n" +
    "If you believe this is a mistake or if you need further assistance, please reach out to our support team or submit the required documents to proceed with your verification.\n\n" +
    "Thank you for your understanding.\n\n" +
    signOff,
});
