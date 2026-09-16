/**
 * The fixed answer sets for the nanny-share questionnaire, one per step.
 *
 * These are wire format, not copy: the `val` of each option is written to the
 * database as-is and read back to preselect the answer when a member edits
 * their share. Rewording an existing option orphans every record that stored
 * the old wording, so add options rather than editing them.
 *
 * They lived in Config/helpFunction.jsx among the date and currency helpers,
 * which is why the questionnaire was hard to find: nothing in that filename
 * suggested it held the questions.
 */

export const step2Data = [
  { name: "My home", val: "My home" },
  { name: "Other family’s home", val: "Other family’s home" },
  { name: "Rotating between homes", val: "Rotating between homes" },
  { name: "Neutral location", val: "Neutral location" },
];

export const step3Data = [
  {
    name: "Montessori Attachment parenting RIE",
    val: "Montessori Attachment parenting RIE",
  },
  { name: "Authoritative Permissive", val: "Authoritative Permissive" },
  { name: "Strict", val: "Strict" },
  { name: "Flexible", val: "Flexible" },
];

export const step4Data = [
  { name: "Childcare Light housekeeping", val: "Childcare Light housekeeping" },
  { name: "Meal preparation", val: "Meal preparation" },
  { name: "Transportation", val: "Transportation" },
  { name: "Educational activities", val: "Educational activities" },
  { name: "Outdoor play Errands", val: "Outdoor play Errands" },
  { name: "Grocery shopping", val: "Grocery shopping" },
];

export const step5Data = [
  {
    name: "$10 - $15 per hour (Each family pays $5 - $7.50)",
    val: "$10 - $15 per hour (Each family pays $5 - $7.50)",
  },
  {
    name: "$15 - $20 per hour (Each family pays $7.50 - $10)",
    val: "$15 - $20 per hour (Each family pays $7.50 - $10)",
  },
  {
    name: "$20 - $25 per hour (Each family pays $10 - $12.50)",
    val: "$20 - $25 per hour (Each family pays $10 - $12.50)",
  },
  {
    name: "$25 - $30 per hour (Each family pays $12.50 - $15)",
    val: "$25 - $30 per hour (Each family pays $12.50 - $15)",
  },
  {
    name: "$30 - $35 per hour (Each family pays $15 - $17.50)",
    val: "$30 - $35 per hour (Each family pays $15 - $17.50)",
  },
  {
    name: "$35 - $40 per hour (Each family pays $17.50 - $20)",
    val: "$35 - $40 per hour (Each family pays $17.50 - $20)",
  },
  {
    name: "$40+ per hour (Each family pays $20+)",
    val: "$40+ per hour (Each family pays $20+)",
  },
];

export const step6Data = [
  { name: "No pets", val: "No pets" },
  { name: "Dog(s)", val: "Dog(s)" },
  { name: "Cat(s)", val: "Cat(s)" },
  { name: "Small animals", val: "Small animals" },
  { name: "Birds", val: "Birds" },
];

export const step7Data = [
  { name: "Regular meetings", val: "Regular meetings" },
  { name: "Group chat", val: "Group chat" },
  { name: "Shared calendar", val: "Shared calendar" },
  { name: "Email updates", val: "Email updates" },
  { name: "Phone calls", val: "Phone calls" },
];

export const step8Data = [
  { name: "Family members", val: "Family members" },
  { name: "Backup nanny service", val: "Backup nanny service" },
  { name: "Friends or neighbors", val: "Friends or neighbors" },
  { name: "Local daycare", val: "Local daycare" },
  { name: "No backup options", val: "No backup options" },
];

export const step9Data = [
  { name: "Very involved", val: "Very involved" },
  { name: "Moderately involved", val: "Moderately involved" },
  { name: "Minimal involvement", val: "Minimal involvement" },
];

export const step10Data = [
  { name: "Nap times", val: "Nap times" },
  { name: "Outdoor play", val: "Outdoor play" },
  { name: "Educational activities", val: "Educational activities" },
  { name: "Structured meal times", val: "Structured meal times" },
  { name: "Storytime", val: "Storytime" },
  { name: "Arts and crafts", val: "Arts and crafts" },
];

export const step11Data = [
  { name: "Screen time limits", val: "Screen time limits" },
  { name: "Dietary restrictions", val: "Dietary restrictions" },
  { name: "Behavior expectations", val: "Behavior expectations" },
  { name: "Hygiene practices", val: "Hygiene practices" },
  { name: "Chore responsibilities", val: "Chore responsibilities" },
];

export const step12Data = [
  { name: "Food allergies", val: "Food allergies" },
  { name: "Environmental allergies", val: "Environmental allergies" },
  { name: "Asthma Medication needs", val: "Asthma Medication needs" },
  { name: "None", val: "None" },
];

export const step13Data = [
  { name: "Very flexible", val: "Very flexible" },
  { name: "Somewhat flexible", val: "Somewhat flexible" },
  { name: "Not flexible", val: "Not flexible" },
];

export const prefer = [
  { name: "Full-time" },
  { name: "Part-time" },
  { name: "Occasional" },
  { name: "Flexible" },
];

export const hourlyData = [
  { name: "$10 - $15 per hour" },
  { name: "$15 - $20 per hour" },
  { name: "$20 - $25 per hour" },
  { name: "$25 - $30 per hour" },
  { name: "$30 - $35 per hour" },
  { name: "$35+ per hour" },
];
