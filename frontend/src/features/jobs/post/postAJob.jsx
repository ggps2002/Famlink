import { useState, useRef, useEffect } from "react";
import { Form, Radio } from "antd";
import CustomStepper from "@shared/ui/Stepper";
import { toCamelCase } from "@shared/lib/toCamelCase";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { NannyJob } from "@features/jobs/post/nanny";
import { PrivateEducatorJob } from "@features/jobs/post/private-educator";
import { SpecializedCaregiverJob } from "@features/jobs/post/specialized-caregiver";
import { SportsCoachesJob } from "@features/jobs/post/sports-coaches";
import { MusicInstructorJob } from "@features/jobs/post/music-instructor";
import { SwimInstructorJob } from "@features/jobs/post/swim-instructor";
import { HouseManagerJob } from "@features/jobs/post/house-manager";
import CustomButton from "@shared/ui/Button";

const App = () => {
  const navigate = useNavigate();
  const stepRef = useRef(null);
  const formRef = useRef(null);
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRadio, setSelectedRadio] = useState("nanny"); // Default selected radio

  const handleGoBack = () => {
    navigate(-1);
  };

  const data = [
    { name: "Nanny", subHead: "Childcare & supervision services" },
    { name: "Private Educator", subHead: "Personalized academic support." },
    {
      name: "Specialized Caregiver",
      subHead: "Doula, night nurse, special needs care.",
    },
    {
      name: "Sports Coaches",
      subHead: "Coaches for soccer, basketball, tennis, and more.",
    },
    {
      name: "Music Instructor",
      subHead: "Lessons for various musical instruments.",
    },
    { name: "Swim Instructor", subHead: "Swimming lessons and water safety." },
    {
      name: "House Manager",
      subHead: "Help with maintaining an organized home.",
    },
  ];

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [form, formRef]);
  
  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [form, formRef]);

  if (currentStep === 1) {
    if (selectedRadio === "nanny") return <NannyJob />;
    else if (selectedRadio === "privateEducator") return <PrivateEducatorJob />;
    else if (selectedRadio === "specializedCaregiver")
      return <SpecializedCaregiverJob />;
    else if (selectedRadio === "sportsCoaches") return <SportsCoachesJob />;
    else if (selectedRadio === "musicInstructor") return <MusicInstructorJob />;
    else if (selectedRadio === "swimInstructor") return <SwimInstructorJob />;
    else if (selectedRadio === "houseManager") return <HouseManagerJob />;
  }
  return (
    <div className="lg:px-5 Quicksand">
      {/* Stepper Component */}
      <div className="lg:px-10 px-2">
        <CustomStepper
          stepCount={6}
          currentStep={currentStep}
          onChange={setCurrentStep}
          ref={stepRef}
        />
      </div>

      <div className="lg:mx-10 mx-2 my-10 px-4">
        <div className="pb-16 pt-8">
          <div className="flex justify-end lg:mr-6">
            <button onClick={handleGoBack}>
              <X className="text-2xl" />
            </button>
          </div>
          <p className="onboarding-head text-center">
            What type of services are
            <br /> you looking for?
          </p>

          <div className="flex justify-center items-start mt-4">
            <Form form={form} name="validateOnly" autoComplete="off">
              <Form.Item
                name="option"
                rules={[
                  {
                    required: true,
                    message: "Please select at least one option.",
                  },
                ]}
              >
                <Radio.Group
                  value={selectedRadio}
                  onChange={(e) => setSelectedRadio(e.target.value)}
                  className="grid grid-cols-1 gap-x-6 md:grid-cols-1 lg:grid-cols-2 justify-center mx-auto"
                >
                  {/* Dynamic Radio Buttons */}
                  {data.map((v, i) => {
                    const val = toCamelCase(v.name); // 'nanny', 'privateEducator', etc.
                    const isChecked = selectedRadio === val;

                    return (
                      <Form.Item name="option" key={i}>
                        <div className="flex gap-4 px-4 py-2 items-start">
                          <label className="flex items-center gap-2 cursor-pointer mt-1">
                            <input
                              type="radio"
                              className="sr-only"
                              checked={isChecked}
                              onChange={() => setSelectedRadio(val)}
                            />
                            <div
                              className={`w-5 h-5 rounded-full border-4 transition-colors duration-200 ${
                                isChecked
                                  ? "border-[#AEC4FF]"
                                  : "border-[#EEEEEE]"
                              }`}
                            />
                          </label>

                          <div className="bg-white rounded-3xl py-1">
                            <p className="Livvic-SemiBold text-lg text-primary leading-tight">
                              {v.name}
                            </p>
                            <p className="Livvic-Medium text-sm">{v.subHead}</p>
                          </div>
                        </div>
                      </Form.Item>
                    );
                  })}
                </Radio.Group>
              </Form.Item>
            </Form>
          </div>

          <div className="flex flex-col items-center">
            <div className="mt-4 flex gap-2">
              {/* <CustomButton
                className="mx-auto bg-[#AEC4FF] text-white lg:w-48 w-24 lg:py-2 py-1 border-none rounded-full font-normal text-base transition hover:-translate-y-1 duration-700 delay-150 ease-in-out hover:scale-110 px-0 Livvic"
                onClick={() => stepRef.current?.next()}
              >
                Continue
              </CustomButton> */}
              <CustomButton
                btnText={"Continue"}
                action={() => {
                  setCurrentStep(prev => prev + 1);
                  stepRef.current?.next()
                }}
                className="bg-blue-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
