// Function to convert a string to camelCase
export function toCamelCase(str) {
    return str
        .replace(/[^a-zA-Z\s]/g, '') // Remove non-alphabetic characters (except spaces)
        .replace(/[-()]/g, ' ') // Replace hyphens and parentheses with spaces
        .trim() // Remove leading and trailing whitespace
        .split(/\s+/) // Split by spaces (including multiple spaces)
        .map((word, index) =>
            index === 0
                ? word.toLowerCase() // First word in lowercase
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() // Capitalize subsequent words
        )
        .join(''); // Join words into a single camelCase string
}

// Function to filter roles that are true
export function trueVal({ rolesData }) {
    // Check if rolesData is defined and is an object
    if (!rolesData || typeof rolesData !== 'object') {
        console.warn("Invalid rolesData:", rolesData);
        return {}; // Return an empty object if rolesData is invalid
    }

    const trueRoles = Object.entries(rolesData)
        .filter(([key, value]) => value === true) // Keep only those with value: true
        .reduce((acc, [key]) => {
            acc[key] = true; // Rebuild the object with true values
            return acc;
        }, {});

    return trueRoles; // Return the filtered object
}
export const cleanFormData = (formData) => {
    return Object.entries(formData)
        .reduce((acc, [key, value]) => {
            if (value?.otherPreferences) {
                acc[key] = value; // Keep the entire entry if otherPreferences is defined
            } else {
                acc[key] = { option: value?.option }; // Only keep the option array if otherPreferences is undefined
            }
            return acc;
        }, {});
};
export const cleanFormData1 = (formData, val) => {
    return Object.entries(formData).reduce((acc, [key, value]) => {
        // Check if otherPreferences is undefined, null, or has no values
        const eqCon = val ? val : 'otherPreferences'
        if (key !== eqCon || (value && value.length > 0)) {
            acc[key] = value;
        }
        return acc;
    }, {});
};

export const formatSentence = (str) => {
    return str
        .replace(/([A-Z])/g, ' $1') // Insert space before each uppercase letter
        .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize the first letter of each word
        .trim(); // Remove any leading or trailing spaces
};

/**
 * "part-time care" → "Part-time care".
 *
 * Distinct from `formatSentence` above, which also splits camelCase and Title-
 * Cases every word. This one only raises the first character, for answers that
 * are already written as prose: Tailwind's `capitalize` would turn "meal prep
 * for child" into "Meal Prep For Child", and `first-letter:uppercase` cannot be
 * used where a "✔" shares the text node, because ::first-letter then targets
 * the tick.
 */
export const sentenceCase = (value) => {
    const text = String(value ?? "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
};

export const customFormat = (str) => {
    let formatted = formatSentence(str)
        .replace('Yes I Have A', '') // Remove 'I have a'
        .replace('Yes I Have', '')
        .replace('Yes I Can', '')
        .replace('Yes, But', '')
        .replace('Yes,', '')
        .replace('.', '')
        .replace('No I Am', 'I am')// Make 'I have' lowercase for other instances
        .replace('I Have Hands On', 'I have hands-on')
        .replace('And', ',')// Adjust hands-on
        .replace('Handson', 'hands-on') // Correct 'hands-on'
        .replace('Cpr', 'CPR')
        .replace('Certifications', 'certification'); // Adjust plural to singular

    // Apply specific custom rules
    if (formatted.startsWith('Yes')) {
        return formatted.replace('Yes, I have', 'Yes').trim() + ','; // Remove 'I have' and add a comma
    } else if (formatted.startsWith('No')) {
        return formatted.replace('No ', 'No ') + '.'; // Add a period for 'No' case
    }
    return formatted.trim(); // Trim any extra spaces
};

export function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
    });
}

export function formatTimeDate(isoString, timeZone) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',

        // timeZoneName: 'short'
    });
}

export function timeAgo(isoString) {
  const now = new Date();
  const past = new Date(isoString);

  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 10) return "Now";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? "1 min ago" : `${diffInMinutes} mins ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? "1 hour ago" : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays === 0) return "Today";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 14) return "1 week ago";
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? "1 month ago" : `${diffInMonths} months ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return diffInYears === 1 ? "1 year ago" : `${diffInYears} years ago`;
}
