export default function capitalizeUsername(username) {
    // Split the username into words
    const words = username.split(' ');

    // Capitalize the first word and convert the rest to lowercase
    const capitalizedWords = words.map((word, index) => {
        if (index === 0) {
            // Capitalize the first word
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        } else {
            // Convert the rest of the words to lowercase
            return word.toLowerCase();
        }
    });

    // Join the words back together
    const capitalizedUsername = capitalizedWords.join(' ');

    return capitalizedUsername;
}