/** Turns a camelCase field name into a readable label: `startDate` → `Start Date`. */
export const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, " $1") // add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()); // capitalize first letter
};
