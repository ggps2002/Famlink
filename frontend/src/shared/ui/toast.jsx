import toast, { Toaster } from "react-hot-toast";



// Function to fire a toast message
export const fireToastMessage = ({
  message,
  type = "success",
  duration = 3000}) => {
  switch (type) {
    case "success":
      toast.success(message, { duration });
      break;
    case "error":
      toast.error(message, { duration });
      break;
    case "loading":
      toast.loading(message, { duration });
      break;
    case "custom":
      toast.custom(message, { duration });
      break;
    default:
      toast.success(message, { duration });
  }
};

// Default export of the Toaster component
const MyToastContainer = () => (
  <Toaster position="top-center" reverseOrder={false} />
);

export default MyToastContainer;
