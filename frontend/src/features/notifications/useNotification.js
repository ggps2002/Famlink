import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { addNotification, markNotificationAsSeen, updateNotification } from '@features/notifications/store/notificationSlice'
import useSocket from '@shared/realtime/useSocket'

export const useNotifications = ({ userId }) => {
  const { socket } = useSocket()
  const dispatch = useDispatch()
  
  useEffect(() => {
    if (socket && userId) {
      socket.emit('userOnline', userId)
    }
  }, [socket, userId])
  // This will handle receiving new notifications in real time
  const handleNewNotification = useCallback(() => {
    socket?.on('newNotification', notification => {
      // console.log('New Notification:', notification)
      // Dispatch Redux action to add the notification to the store
      dispatch(updateNotification(notification))
    })
  }, [socket, dispatch])

  const handleRemoveNotification = useCallback(() => {
    socket?.on('removeNotification', notification => {
      // console.log('removeNotifcation:', notification)
      // Dispatch Redux action to add the notification to the store
      // dispatch(updateNotification(notification))
    })
  }, [socket, dispatch])

  // This will handle fetching previous notifications on component mount
  const handleGetNotification = useCallback(() => {
    if (!userId) return

    socket?.emit('getNotification', { userId })

    socket?.on('previousNotifications', notifications => {
      dispatch(addNotification(notifications)) // Dispatch to Redux to save notifications
    })
  }, [socket, userId, dispatch])

  const handleMarkAsSeen = useCallback(
    (notificationId) => {
      // console.log(notificationId)
      if (!socket || !notificationId) return;
      // console.log(`[useNotifications] Marking as seen: ${notificationId}`);
      socket.emit('notificationSeen', { notificationId });
      dispatch(markNotificationAsSeen(notificationId)); // Update Redux state
    },
    [socket, dispatch]
  );

  useEffect(() => {
    // Fetch previous notifications
    handleGetNotification()

    // Listen for new notifications in real time
    handleNewNotification()

    handleRemoveNotification()

    return () => {
      // Cleanup listeners on component unmount
      socket?.off('newNotification')
      socket?.off('previousNotifications')
      socket?.off('removeNotification')
    }
  }, [
    handleGetNotification,
    handleNewNotification,
    handleRemoveNotification,
    socket
  ])

  return { handleMarkAsSeen };
}