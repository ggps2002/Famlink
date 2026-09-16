import Swal from "sweetalert2";
import check from '@/assets/images/Checkmark.png'
import deleteIcon from '@/assets/images/deleteIcon.png'
import '@/App.css';

const SwalFireSuccess = ({ handleConfirm, title }) => {
    Swal.fire({
        title: title || "Card added successfully",
        imageUrl: check,
        imageAlt: "Custom image",
        showCancelButton: true,
        cancelButtonText: "Undo",
        confirmButtonColor: "#AEC4FF",
        confirmButtonText: "Confirm",
        cancelButtonColor: "#FFFFFF",
        reverseButtons: true,
        customClass: {
            popup: "custom-popup",
            confirmButton: "custom-button",
            cancelButton: "custom-cancel-button"
        }
    }).then((result) => {
        if (result.isConfirmed) {
            handleConfirm(); // Call handleConfirm if confirmed
        } else if (result.isDismissed) {
            Swal.close(); // Explicitly close the alert (optional as SweetAlert auto-closes on cancel)
        }
    });
};

const SwalFireDelete = ({ handleDelete, title }) => {
    Swal.fire({
        title: title || "Are you sure you want to delete this?", // Default message
        imageUrl: deleteIcon,
        imageAlt: "Custom image",
        showCancelButton: true,
        cancelButtonText: "Undo",
        confirmButtonText: "Delete",
        confirmButtonColor: "#FF4D4F", // Red color for the delete action
        cancelButtonColor: "#FFFFFF", // White color for the cancel button
        reverseButtons: true, // Place confirm button on the left and cancel on the right
        customClass: {
            popup: "custom-popup",
            confirmButton: "custom-button",
            cancelButton: "custom-cancel-button", 
            image: "custom-image"// Custom styles for cancel button
        }
    }).then((result) => {
        if (result.isConfirmed) {
            handleDelete(); // Call handleDelete if confirmed
        } else if (result.isDismissed) {
            Swal.close(); // Explicitly close the alert if dismissed
        }
    });
};


export { SwalFireSuccess, SwalFireDelete };
