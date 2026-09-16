import { useEffect, useState } from 'react'
import { Modal, Rate, Input, Button } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { deleteCardThunk, getSaveCardThunk } from '@features/subscription/store/cardSlice'
import { SwalFireDelete } from '@shared/ui/swalFire'
import { fireToastMessage } from '@shared/ui/toast'
import { submitReviewThunk } from '@features/dashboard/store/reviewSlice'
import { fetchComRequesterThunk } from '@features/booking/store/completedRequestSlice'
import useSocket from '@shared/realtime/useSocket'

export default function PayRevModelCom({ type, bookingId, pay, receiverId }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user } = useSelector(s => s.auth)
  const dispatch = useDispatch()
  const [rating, setRating] = useState(0) // State for rating
  const [reviewMessage, setReviewMessage] = useState('') // State for review message
  const { data } = useSelector(s => s.cardData) // This line accesses the data from the Redux store
  const [selectedCardId, setSelectedCardId] = useState(null) // State for storing selected card ID
  const { socket } = useSocket()
  useEffect(() => {
    const handleApi = async () => {
      await dispatch(getSaveCardThunk())
    }
    handleApi()
  }, [dispatch])

  const handleCardSelect = id => {
    const handleDelete = async () => {
      try {
        const { status, data } = await dispatch(deleteCardThunk(id)).unwrap()
        if (status === 200) {
          fireToastMessage({ success: true, message: data.message })
          await dispatch(getSaveCardThunk())
        }
      } catch (error) {
        fireToastMessage({ type: 'error', message: error.message })
      }
    }
    SwalFireDelete({
      handleDelete,
      title: 'Are you sure you want to delete this card info?'
    })
  }

  const showModal = () => {
    setIsModalOpen(true)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
  }

  const handleOk = async () => {
    setLoading(true)
    if (!rating || !reviewMessage) {
      fireToastMessage({
        type: 'error',
        message: 'Please fill in both Rating and Review Message'
      })
      setLoading(false)
      return // Exit function if validation fails
    } else {
      try {
        const { data, status } = await dispatch(
          submitReviewThunk({ bookingId, rating, msg: reviewMessage, userType: type })
        ).unwrap()

        if (status == 200) {
          fireToastMessage({ message: data.message })
          setIsModalOpen(false)
          setLoading(false)
          await new Promise(async resolve => {
            const updateContent = {
              bookingId,
              senderId: user._id,
              receiverId,
              content: 'Give review',
              type: 'Booking'
            }
            socket?.emit(
              'sendNotification',
              { content: updateContent },
              resolve
            )
            setLoading(false)
            window.location.reload()
            await fetchComRequesterThunk({ limit: 8, page: 1 })// Assuming resolve will be called after successful emit
          })
          setLoading(false)
        }
      } catch (err) {
        setLoading(false)
        fireToastMessage({ type: 'error', message: err.message })
      }
    }
  }

  return (
    <div>
      <button
        onClick={showModal}
        style={
          type == 'family'
            ? {
              border: '1px solid #34A853',
              color: '#FFFFFF',
              background: '#34A853'
            }
            : { border: 'none', color: '#AEC4FF', background: 'none' }
        }
        className='btn-content-btn1 hover:opacity-70 mt-2 py-1 rounded-3xl duration-700 ease-in-out Quicksand'
      >
        {

        }
        {type == 'family' ? 'Review' : 'Review'}
      </button>
      <PayRevModel
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        rating={rating}
        pay={pay}
        isLoading={loading}
        setRating={setRating}
        reviewMessage={reviewMessage}
        setReviewMessage={setReviewMessage}
        handleOk={handleOk}
        handleCancel={handleCancel}
        handleCardSelect={handleCardSelect}
        data={data} // Passing data from Redux to the PayRevModel component
        selectedCardId={selectedCardId} // Passing the selectedCardId state to the child
        setSelectedCardId={setSelectedCardId}
        type={type} // Passing setter for selectedCardId to the child
      />
    </div>
  )
}

function PayRevModel({
  isModalOpen,
  setIsModalOpen,
  rating,
  setRating,
  reviewMessage,
  setReviewMessage,
  handleOk,
  handleCancel,
  isLoading,
  data, // Receiving data prop here
  selectedCardId, // Receiving selectedCardId prop
  setSelectedCardId,
  handleCardSelect,
  pay,
  type // Receiving setter for selectedCardId
}) {
  return (
    <Modal
      className='overflow-auto'
      width={700}
      open={isModalOpen}
      footer={null}
      closeIcon={false}
      onCancel={handleCancel}
    >
      <div className='text-center'>
        <p className='Livvic-Bold lg:text-3xl text-2xl text-center Livvic-Bold'>
          Leave your feedback
        </p>

        {/* Rating Component */}
        <div className='my-4'>
          <Rate value={rating} onChange={setRating} />
        </div>

        {/* Review Message */}
        <div className='mb-4'>
          <p className='mb-2 Livvic-Bold text-lg text-start Livvic-Medium'>
            Write Comments
          </p>
          <Input.TextArea
            value={reviewMessage}
            className='p-4 rounded-2xl'
            style={{ resize: 'none' }}
            onChange={e => setReviewMessage(e.target.value)}
            placeholder='Write Comments'
            rows={4}
          />
        </div>

        {/* // When payment system acheive */}
        {/* {
                    type == 'family' &&
                    <div className='flex flex-wrap justify-between items-center gap-4'>
                        <p className='Livvic-Bold text-lg Quicksand'>Pay: ${pay}</p>
                        <App head="Payments" withDraw={true} payNow={true} />
                    </div>
                } */}

        {/* {type == 'family' && data?.data && data?.data.length > 0 ? (
                    <div className='h-52 overflow-auto'>
                        {data.data.map((v) => (
                            <div key={v.id} className="my-5 py-8 border rounded-2xl padd-card">
                                <div className="flex flex-wrap justify-between gap-4">
                                    <div>
                                        <img
                                            className="w-10 h-8 object-contain"
                                            src={v?.card?.brand === 'visa' ? visa : master}
                                            alt="card type"
                                        />
                                        <p className="mt-2 Livvic-Bold text-base Livvic">{v?.billing_details?.name}</p>
                                        <p className="text-base Belleza">**** **** **** {v?.card?.last4}</p>
                                    </div>
                                    <div>
                                        <button
                                            style={{ background: '#FCE4E4', color: '#EA5455' }}
                                            className="mb-2 py-2 rounded-full w-28 Belleza"
                                            onClick={() => handleCardSelect(v.id)}
                                        >
                                            Delete
                                        </button>
                                        <p style={{ color: '#6F6B7D' }} className="text-sm Belleza">
                                            Card expires at {v?.card?.exp_month}/{v?.card?.exp_year}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-x-2 pt-4">
                                    <input
                                        type="radio"
                                        name="selectedCard"
                                        value={v.id}
                                        onChange={() => setSelectedCardId(v.id)} // Set the selected card ID
                                        checked={selectedCardId === v.id} // Mark as checked if selected
                                    />
                                    <p className="font-normal text-sm Montserrat">Use as the payment method</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : type == 'family' && (
                    <div className="text-start">
                        <p>No cards available.</p>
                    </div>
                )} */}

        {/* // When payment system acheive */}

        <div className='my-4'>
          <Button
            onClick={handleOk}
            loading={isLoading}
            style={{ background: '#AEC4FF' }}
            className="py-2 rounded-full w-28 text-primary duration-700 ease-in-out Livvic-Medium"
          >
            {type == 'family' ? 'Review' : 'Review'}
          </Button>

        </div>
      </div>
    </Modal>
  )
}
