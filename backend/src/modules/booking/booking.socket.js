import { Server } from "socket.io";
import User from "../../modules/user/user.model.js";
import Booking from "../../modules/booking/booking.model.js";
import { PUBLIC_USER_SELECT, toPublicUser } from "../../modules/user/user.privacy.js";


const bookingSocket = (io) => {
    io.on("connection", (socket) => {
        console.log(`User: ${socket.handshake.query.userId} connected`);


        // Handler for 'status' event to retrieve bookings by nannyId or familyId
        socket.on("status", async ({ nannyId, familyId }, callback) => {
            const userId = socket.handshake.query.userId; // Get the current user ID from the socket connection
            if (!nannyId && !familyId) {
                return callback({ success: false, message: 'Either nannyId or familyId must be provided' });
            }

            try {
                // Build the query based on which ID is provided
                const query = {
                    status: 'pending',
                    $or: []
                };

                if (nannyId) {
                    query.$or.push({ nannyId });
                }
                if (familyId) {
                    query.$or.push({ familyId });
                }

                // Exclude bookings where requestBy matches nannyId or familyId
                if (nannyId) {
                    query.$and = query.$and || [];
                    query.$and.push({ requestBy: { $ne: nannyId } });
                }
                if (familyId) {
                    query.$and = query.$and || [];
                    query.$and.push({ requestBy: { $ne: familyId } });
                }

                // Find bookings based on the query
                const bookings = await Booking.find(query).populate('nannyId familyId', PUBLIC_USER_SELECT); // Populate user details

                if (!bookings.length) {
                    return callback({ success: false, message: 'No bookings found for the specified IDs' });
                }

                // Prepare the response (mimicking the API response structure)
                const response = bookings.map(booking => {
                    // Determine the user role based on the requestBy field
                    let userRole = null;
                    if (booking.requestBy.toString() === userId) {
                        userRole = 'requester';
                    } else {
                        userRole = 'receiver';
                    }

                    // The counterparty is coarsened before the booking goes
                    // out: this payload is both returned to the caller AND
                    // broadcast to the other party's room below.
                    const plain = booking.toObject();
                    for (const key of ["nannyId", "familyId"]) {
                        if (plain[key] && typeof plain[key] === "object") {
                            plain[key] = toPublicUser(plain[key]);
                        }
                    }

                    return {
                        status: booking.status,
                        userRole,
                        booking: plain, // Include full booking details
                    };
                });

                // Send back a response to the requesting client
                callback({
                    success: true,
                    message: 'Bookings retrieved successfully',
                    bookings: response,
                });
                // Broadcast the updated status to relevant users
                const targetIds = [nannyId, familyId].filter(Boolean); // Remove any null/undefined IDs
                targetIds.forEach(id => {
                    io.to(id).emit("bookingStatusUpdate", response); // Broadcast the update to the target users
                });
            } catch (error) {
                console.error(error);
                callback({ success: false, message: error.message });
            }
        });

        socket.on("disconnect", () => {
            console.log(`User: ${socket.handshake.query.userId} disconnected`);
        });
    });
};


export default bookingSocket;