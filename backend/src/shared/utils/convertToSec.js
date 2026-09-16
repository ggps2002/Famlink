export const convertToSeconds = (timeString) => {
    // Extract numerical value and unit from the time string
    const timeValue = parseInt(timeString.replace(/\D/g, ""));
    const timeUnit = timeString.replace(/\d/g, "").toLowerCase();
  
    switch (timeUnit) {
      case "s": // seconds
        return timeValue;
      case "m": // minutes
        return timeValue * 60;
      case "h": // hours
        return timeValue * 3600;
      case "d": // days
        return timeValue * 86400;
      case "w": // weeks
        return timeValue * 604800;
      case "y": // years
        return timeValue * 31536000;
      default:
        throw new Error("Invalid time unit. Use 's', 'm', 'h', 'd', 'w', or 'y'.");
    }
  };