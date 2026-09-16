
import { Progress } from "antd"
import star from '../../../assets/images/star1.png'

export default function Prog({ num, pro, color}) {
    return (
        <div className='flex items-center gap-2 w-72'>
            <p className="Livvic-SemiBold text-sm">{num}</p>
            <img src={star} alt="star" />
            <Progress  percent={pro} trailColor='#E9ECEF' strokeColor={"#FEA500"} showInfo={false} />
        </div>
    )
}