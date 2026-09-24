import { Radio } from "antd";
import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useDispatch } from "react-redux";
import { resetForm } from "@shared/store/formValueSlice";
import CustomButton from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { User, Users } from "lucide-react";

export default function JoinNow() {
  const navigate = useNavigate();
  const [value, setValue] = useState(1);
  const dispatch = useDispatch();
  const onRadioChange = (radioValue) => {
    setValue(radioValue); // Set radio value when changed
  };

  const handleGoBack = () => {
    navigate("/"); // Navigate back in history
  };

  const handleCreateAccount = () => {
    dispatch(resetForm());
    if (value === 1) {
      navigate("/find-nanny-share"); // Navigate to the hire component if selected
    } else if (value == 2) {
      navigate("/caregiver/nannyshare"); //Navigate to caregiver onboarding
    } else {
      navigate("/communitySign");
    }
  };
  return (
    // <div className="padd-res">
    //   <div
    //     className="px-4 py-4 rounded-3xl"
    //     style={
    //       value === 1
    //         ? {
    //             background:
    //               "linear-gradient(174.22deg, rgba(158, 220, 225, 0.5) 0%, rgba(218, 244, 239, 0.4) 69.71%, rgba(239, 236, 230, 0.3) 100%)",
    //           }
    //         : value === 2
    //         ? {
    //             background: "linear-gradient(to bottom, #FFEE8C, #fdf8ea)",
    //           }
    //         : value === 3
    //         ? {
    //             background:
    //               "linear-gradient(174.22deg, rgba(183, 214, 255, 0.5) 0%, rgba(229, 241, 255, 0.4) 69.71%, rgba(248, 249, 255, 0.3) 100%)",
    //           }
    //         : {}
    //     }
    //   >
    //     <div className="flex justify-end">
    //       <button onClick={handleGoBack}>
    //         <CloseOutlined style={{ fontSize: "24px" }} />
    //       </button>
    //     </div>
    //     <div className="step-content text-center">
    //       <div className="flex justify-center w-full">
    //         <p className="px-3 width-form font-normal uppercase Livvic offer-font">
    //           Tell us what {`you're`} looking for
    //         </p>
    //       </div>

    //       <div className="flex flex-wrap justify-center gap-12 my-10">
    //         <div
    //           className="bg-white px-4 py-4 rounded-3xl w-60"
    //           onClick={() => onRadioChange(1)}
    //         >
    //           <div className="flex justify-between">
    //             <div className="flex items-center gap-2">
    //               <img src={hire} alt="hire" />
    //               <p className="text-xl Livvic-Bold Livvic">Parents</p>
    //             </div>

    //             <Radio checked={value === 1}></Radio>
    //           </div>
    //           <div className="mt-4">
    //             <p className="mt-2 text-black text-start leading-tight">
    //               I am looking to hire / find nanny share
    //             </p>
    //           </div>
    //         </div>

    //         <div
    //           className="bg-white px-4 py-4 rounded-3xl w-60"
    //           onClick={() => onRadioChange(2)}
    //         >
    //           <div className="flex justify-between">
    //             <div className="flex items-center gap-2">
    //               <img src={job} alt="job" />
    //               <p className="text-xl Livvic-Bold Livvic">Caregivers</p>
    //             </div>

    //             <Radio checked={value === 2}></Radio>
    //           </div>
    //           <div className="mt-4">
    //             <p className="mt-2 text-black text-start">
    //               I am looking to find a job.
    //             </p>
    //           </div>
    //         </div>
    //       </div>
    //     </div>
    //     <div className="text-center">
    //       <button
    //         style={{ background: "#85D1F1" }}
    //         className="mx-auto my-0 px-6 py-2 rounded-full font-normal text-base transition hover:-translate-y-1 duration-700 delay-150 ease-in-out hover:scale-110"
    //         onClick={handleCreateAccount}
    //       >
    //         Create Account
    //       </button>
    //       <p className="mt-2 mb-10 font-normal text-base already-acc">
    //         Already have an account?{" "}
    //         <NavLink
    //           to="/login"
    //           onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    //         >
    //           <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
    //             Log in
    //           </span>
    //         </NavLink>
    //       </p>
    //     </div>
    //   </div>
    // </div>
    <div className="p-6">
      <SEOMetaData
        title="Join Famlink | Find Caregivers or Jobs"
        description="Sign up on Famlink to connect as a parent seeking childcare or a caregiver looking for job opportunities in your area."
      />

      <div>
        <h1 className="onboarding-head text-center">
          Tell us who you are
        </h1>
        <div className="mt-12 flex justify-center flex-wrap gap-6">
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Card 1 - Parent */}
            <div
              className="onboarding-box cursor-pointer min-w-72 box-border flex flex-col"
              style={{ border: value === 1 && "2px solid #AEC4FF"}}
              onClick={() => onRadioChange(1)}
            >
              <Radio checked={value === 1} />
              <div className="h-32 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-[#EBF0FF] flex items-center justify-center shadow-sm transition-transform hover:scale-105">
                  <User size={48} className="text-[#0D134C]" />
                </div>
              </div>
              <h2 className="onboarding-subHead mt-4">I'm a Parent</h2>
              <div className="mt-2">
                <p className="onboarding-para">- Looking for a nanny or another family for a share.</p>
                <p className="onboarding-para">- Already have a nanny and want to add a share.</p>
              </div>
            </div>

            {/* Card 2 - Caregiver */}
            <div
              className="onboarding-box cursor-pointer min-w-72 box-border flex flex-col"
              style={{ border: value === 2 && "2px solid #AEC4FF" }}
              onClick={() => onRadioChange(2)}
            >
              <Radio checked={value === 2} />
              <div className="h-32 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-[#EBF0FF] flex items-center justify-center shadow-sm transition-transform hover:scale-105">
                  <Users size={48} className="text-[#0D134C]" />
                </div>
              </div>
              <h2 className="onboarding-subHead mt-4">I'm a Caregiver</h2>
              <div className="mt-2">
                <p className="onboarding-para">- Looking for a nanny share position.</p>
                <p className="onboarding-para">- Already work with a family and want to add a share.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 text-center">
          <p className="onboarding-foot">
            Already have a account?{" "}
            <NavLink
              to="/login"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <span className="onboarding-foot-action">Log In</span>
            </NavLink>
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-24 justify-center">
        <CustomButton
          btnText={"Back"}
          className=" w-full sm:w-auto border-2 border-[#EEEEEE] px-20"
          action={handleGoBack}
        />
        <CustomButton
          btnText={"Continue"}
          className="bg-[#AEC4FF] w-full sm:w-auto px-16"
          action={handleCreateAccount}
        />
      </div>
    </div>
  );
}
