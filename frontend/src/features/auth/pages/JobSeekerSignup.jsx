import { CloseOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { Button, Form } from "antd";
import Avatar from "react-avatar";
import { CameraIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HireStep4 from "@features/hire/components/step4";
import HireStep3 from "@features/hire/components/step3";
import { fireToastMessage } from "@shared/ui/toast";
import NannyNoStep2 from "@features/hire/components/NannyShareNo/step2";
import { setAddSer } from "@features/auth/store/additionalServicesSlice";
import { useDispatch, useSelector } from "react-redux";
import FamilyExperienceForm from "@features/hire/components/familyExpForm";
import { clearFamilyExp, updateFamilyExp } from "@features/auth/store/familyExperienceSlice";
import HireStep1 from "@features/hire/components/step1";
import { InputDa, InputTextArea } from "@shared/ui/Input";
import Step5 from "@features/hire/components/step5";
import { cleanFormData1, toCamelCase } from "@shared/lib/toCamelCase";
import { addOrUpdateAdditionalInfo, updateForm } from "@shared/store/formValueSlice";
import { registerThunk, userCheckThunk } from "@features/auth/store/authSlice";
import { api } from "@shared/api/client";
import CustomButton from "@shared/ui/Button";
import Onboarding_step1 from "@features/onboarding/components/Onboarding_step1";
import Onboarding_step2 from "@features/onboarding/components/Onboarding_step2";
import Onboarding_step3 from "@features/onboarding/components/Onboarding_step3";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { fullNameFrom } from "@shared/lib/formName";

export default function Job() {
  const [step, setStep] = useState(0);
  const [bool, setBool] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const jobStepFormRef = useRef(null);
  const { familyExp } = useSelector((s) => s.familyExp);
  const val = useSelector((s) => s.form);
  const v = useSelector((s) => s.additionalSer);
  const [image, setImage] = useState(null); // Default image
  const [file, setFile] = useState(null);
  const handleImageChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const imageUrl = URL.createObjectURL(selectedFile);
      setImage(imageUrl); // Preview the image
      setFile(selectedFile); // Store the file for upload
      const reader = new FileReader();
      reader.onloadend = () => {
        dispatch(
          updateForm({
            imageFile: reader.result, // base64 string
          })
        );
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  // Access the inner object using v.value
  const innerObject = v.value;
  const hasNannyOrBabysitter = innerObject.nanny || innerObject.babysitter;

  // Count other true values (excluding nanny and babysitter)
  let trueCount = Object.entries(innerObject).reduce((count, [key, value]) => {
    if (key !== "nanny" && key !== "babysitter" && value === true) {
      return count + 1;
    }
    return count;
  }, 0);

  // Add +1 if at least nanny or babysitter is selected
  if (hasNannyOrBabysitter) {
    trueCount += 1;
  }
  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Initialize the state in the parent component
  const [daysState, setDaysState] = useState(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { checked: false, start: null, end: null };
      return acc;
    }, {})
  );

  // This function will update the state when passed down to HireStep3
  const updateDaysState = (updatedDaysState) => {
    setDaysState(updatedDaysState);
  };
  const handleGoBack = () => {
    navigate("/joinNow"); // Navigate back in history
  };
  const handleBack = () => {
    if (step === 0) {
      navigate("/joinNow");
    } else if (step == 4) {
      setStep((prev) => prev - 2);
    } else {
      // Move to the previous step
      setStep((prevStep) => prevStep - 1);
    }
  };
  const Register = async (textAreaValue) => {
    const beforeAddInfo = val.additionalInfo;
    const updatedAddInfo = [...beforeAddInfo];
    updatedAddInfo.push({ key: "jobDescription", value: textAreaValue });

    const result = await dispatch(
      registerThunk({ ...val, additionalInfo: updatedAddInfo, type: "Nanny" })
    );

    if (result.payload.status === 200) {
      fireToastMessage({
        success: true,
        message: "Your account was created successfully",
      });
      navigate("/login");
      window.location.reload();
    } else {
      fireToastMessage({ type: "error", message: result.payload.message });
    }
  };
  const step1Data = [
    {
      name: "Nanny",
      subText: "Full-time, part-time, or live-in care.",
    },
    {
      name: "Babysitter",
      subText: "Occasional or regular childcare.",
    },
    {
      name: "Private Educator/Tutor",
      val: "privateEducator",
      subText: "Full-time, part-time, or live-in care.",
    },
    {
      name: "Specialized Caregiver",
      subText: "Occasional or regular childcare.",
    },
    {
      name: "Sports Coach",
      val: "sportsCoaches",
      subText: "Full-time, part-time, or live-in care.",
    },
    {
      name: "Music Instructor",
      subText: "Occasional or regular childcare.",
    },
    {
      name: "Swim Instructor",
      subText: "Full-time, part-time, or live-in care.",
    },
    {
      name: "House Manager",
      subText: "Occasional or regular childcare.",
    },
  ];

  const handleNext = async () => {
    if (step === 0) {
      jobStepFormRef.current
        .validateFields()
        .then((values) => {
          // Check if the 'option' field has at least one selection
          if (Array.isArray(values.option) && values.option.length > 0) {
            // If form is valid, submit it and move to the next step
            const allOptions = [
              "nanny",
              "privateEducator",
              "specializedCaregiver",
              "sportsCoaches",
              "musicInstructor",
              "swimInstructor",
              "houseManager",
              "babysitter",
            ];

            // Initialize all values to false
            const optionsObject = allOptions.reduce((acc, option) => {
              acc[option] = false;
              return acc;
            }, {});

            // Set the values from values.option to true
            values.option.forEach((option) => {
              if (option in optionsObject) {
                optionsObject[option] = true; // Set the selected options to true
              }
            });

            // Ensure nanny is always set to true

            dispatch(setAddSer(optionsObject));
            const cleanData = cleanFormData1(values);
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "interestedPosi",
                value: cleanData,
              })
            );
            const trueData = cleanData?.option?.filter(
              (v) => v == "nanny" || v == "babysitter"
            );

            if (trueData.length == 0) {
              setBool(true);
              setStep((prevStep) => prevStep + 5);
            } else {
              setStep((prevStep) => prevStep + 1);
            }
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (step === 1) {
      jobStepFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option && values.ageGroupsExp.length > 0) {
            const selectedDays = Object.entries(daysState).filter(
              ([day, { checked }]) => checked
            );

            // if (selectedDays.length === 0) {
            //   fireToastMessage({
            //     type: "error",
            //     message: "At least one day must be selected.",
            //   });
            //   return;
            // }

            let allValid = true; // Flag to check if all selected days have valid start and end times
            let invalidDays = [];

            // Loop through selected days to ensure each has a valid start and end time
            selectedDays.forEach(([day, { start, end }]) => {
              if (!start || !end) {
                allValid = false;
                invalidDays.push(day); // Collect days with missing start or end times
              } else if (start.isSame(end)) {
                allValid = false;
                invalidDays.push(day); // Collect days where start and end are the same
              } else if (end.isBefore(start)) {
                // Error if end time is before start time
                allValid = false;
                invalidDays.push(day); // Collect days where end is before start
              }
            });

            if (!allValid) {
              fireToastMessage({
                type: "error",
                message: `The following selected days have invalid start or end times: ${invalidDays.join(
                  ", "
                )}`,
              });
              return;
            }

            //Additional checks for overlapping times (uncomment if needed)
            if (selectedDays.length >= 2) {
              let overlapping = false;

              // Compare each selected day's start and end times
              for (let i = 0; i < selectedDays.length; i++) {
                const [day1, { start: start1, end: end1 }] = selectedDays[i];

                for (let j = i + 1; j < selectedDays.length; j++) {
                  const [day2, { start: start2, end: end2 }] = selectedDays[j];

                  // Ensure no overlapping times
                  if (
                    (start1.isBefore(end2) && end1.isAfter(start2)) || // Check overlap between two days
                    start1.isSame(end2) ||
                    start2.isSame(end1)
                  ) {
                    // console.log(`Error: Time overlap between ${day1} and ${day2}`);
                    overlapping = true;
                    break;
                  }
                }
                if (overlapping) break;
              }

              if (overlapping) {
                return;
              }
            }

            //If all checks pass, proceed with submission
            const checkedDays = Object.entries(daysState)
              .filter(([day, data]) => data.checked) // Keep only those with checked: true
              .reduce((acc, [day, data]) => {
                // Convert start and end times to string (ISO format or any preferred format)
                const start = data.start.toISOString(); // Assuming start is a date object
                const end = data.end.toISOString(); // Assuming end is a date object

                acc[day] = {
                  ...data,
                  start, // Replace the start time with a string
                  end, // Replace the end time with a string
                };
                return acc;
              }, {});
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "specificDaysAndTime",
                value: checkedDays,
              })
            );

            const cleanData = {
              option: values.option,
            };
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "interestedChildcare",
                value: cleanData,
              })
            );

            if (values.ageGroupsExp) {
              const cleanData = {
                option: values.ageGroupsExp,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "ageGroupsExp",
                  value: cleanData,
                })
              );
            }

            if (values.availability) {
              const cleanData = {
                option: values.availability,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "avaiForWorking",
                  value: cleanData,
                })
              );
            }

            if (values.experience) {
              const cleanData = {
                option: values.experience,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "experience",
                  value: cleanData,
                })
              );
            }

            const salaryKeys = [
              "firstChild",
              "secChild",
              "thirdChild",
              "fourthChild",
              "fiveOrMoreChild",
            ];

            // Extract numeric values safely
            const numericValues = salaryKeys
              .map((key) => Number(values[key]))
              .filter((v) => !isNaN(v));

            const range = {
              min: Math.min(...numericValues),
              max: Math.max(...numericValues),
            };

            dispatch(
              addOrUpdateAdditionalInfo({
                key: "salaryExp",
                value: salaryKeys.reduce((acc, key) => {
                  acc[key] = values[key];
                  return acc;
                }, {}),
              })
            );

            dispatch(
              addOrUpdateAdditionalInfo({ key: "salaryRange", value: range })
            );

            jobStepFormRef.current.resetFields();
            setStep((prevStep) => prevStep + 1);
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message:
                "Select Employment Type and Age Group Experience to proceed.",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (step === 2) {
      jobStepFormRef.current
        .validateFields()
        .then((values) => {
          // Check if the preferredLocation (or whatever your field is) has been set
          if (values.backgroundCheck) {
            const cleanData = {
              option: values.backgroundCheck,
            };
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "backgroundCheck",
                value: cleanData,
              })
            );

            // Check if the preferredLocation (or whatever your field is) has been set
            if (values.ageGroupsOfChildren.length === 0) {
              fireToastMessage({
                type: "error",
                message:
                  "Select at least one option from age groups of Children",
              });
            } else if (values.keyResponsibilities.length === 0) {
              fireToastMessage({
                type: "error",
                message: "Select at least one option from key responsibilities",
              });
            } else {
              dispatch(updateFamilyExp({ values }));
            }
            // If form is valid, submit it and move to the next step
            if (
              values.ageGroupsOfChildren.length !== 0 &&
              values.keyResponsibilities.length !== 0
            ) {
              //set step to view exp
              setStep((prev) => prev + 1);
            } else {
              setStep((prevStep) => prevStep + 2);
            }

            jobStepFormRef.current.resetFields();

            // Move to the next step
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Specify your stand towards background checks",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (step === 3) {
      dispatch(
        addOrUpdateAdditionalInfo({ key: "FamilyExp", value: familyExp })
      );
      dispatch(clearFamilyExp());
      setStep((prevStep) => prevStep + 1);
    } else if (step === 4) {
      jobStepFormRef.current
        .validateFields()
        .then((values) => {
          const hasAtLeastOneValue = Object.values(values).some(
            (value) =>
              value !== null &&
              value !== undefined &&
              value !== "" &&
              value !== false &&
              (!Array.isArray(value) || value.length > 0) // handle arrays too
          );
          if (hasAtLeastOneValue) {
            const hasAtLeastOneTrue = Object.values(values).some(
              (value) => value === true
            );
            if (hasAtLeastOneTrue) {
              // If form is valid, submit it and move to the next step

              const keyMapping = {
                nanny: "Positive Reinforcement",
                setClearRulesAndExpectations:
                  "Set Clear Rules And Expectations",
                discussionAndProblemSolving: "Discussion And Problem Solving",
                flexibleApproachForEveryChild:
                  "Flexible Approach For Every Child",
                logicalConsequences: "Logical Consequences",
                redirecting: "Redirecting",
                timeoutMethod: "Timeout Method",
                pleaseSpecify: "Please Specify",
              };

              // Filter keys where the value is true and map them to their human-readable equivalents
              const trueKeys = Object.keys(values)
                .filter((key) => values[key] === true)
                .map((key) => keyMapping[key]);

              const va = {
                option: trueKeys,
                pleaseSpecify: values.pleaseSpecify,
              };

              const cleanData = cleanFormData1(va, "pleaseSpecify");
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "approachToDisciplineAndChildBehavior",
                  value: cleanData,
                })
              );
            }
            if (values.cookFor) {
              const cleanData = {
                option: values.cookFor,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "cookFor",
                  value: cleanData,
                })
              );
            }

            if (values.helpWithHousekeeping) {
              const cleanData = {
                option: values.helpWithHousekeeping,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "helpWithHousekeeping",
                  value: cleanData,
                })
              );
            }

            if (values.certification) {
              const cleanData = {
                option: values.certification,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "certification",
                  value: cleanData,
                })
              );
            }

            if (values.usePerTransport) {
              const cleanData = {
                option: values.usePerTransport,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "usePerTransport",
                  value: cleanData,
                })
              );
            }

            if (values.watchChildWhenTheyAreSick) {
              const cleanData = {
                option: values.watchChildWhenTheyAreSick,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "watchChildWhenTheyAreSick",
                  value: cleanData,
                })
              );
            }

            if (values.references) {
              const cleanData = {
                option: values.references,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "references",
                  value: cleanData,
                })
              );
            }

            if (values.language) {
              const cleanData = {
                option: values.language,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "language",
                  value: cleanData,
                })
              );
            }

            if (values.resOrPreAboutWorkEnv) {
              const cleanData = {
                option: values.resOrPreAboutWorkEnv,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "resOrPreAboutWorkEnv",
                  value: cleanData,
                })
              );
            }

            if (values.preferredMetOfTran) {
              const cleanData = {
                option: values.preferredMetOfTran,
              };
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "preferredMetOfTran",
                  value: cleanData,
                })
              );
            }
            jobStepFormRef.current.resetFields();

            setStep((prev) => prev + 1);
          } else {
            fireToastMessage({
              type: "error",
              message: "Answer atleast one question to proceed",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (step === 5) {
      jobStepFormRef.current
        .validateFields()
        .then(async (values) => {
          const dob = `${values.month} ${values.date} ${values.year}`;

          if (!values.zipCode) {
            fireToastMessage({
              type: "error",
              message: "Please fill zip code field",
            });
            return;
          }

          // if (!values.verifiedEmail) {
          //   fireToastMessage({
          //     type: "error",
          //     message: "Please verify your email before proceeding",
          //   });
          //   setLoading(false);
          //   return;
          // }

          // if (values.verifiedEmail !== values.email) {
          //   fireToastMessage({
          //     type: "error",
          //     message:
          //       "Please verify your newly entered email before proceeding",
          //   });
          //   setLoading(false);
          //   return;
          // }

          // if (!values.remember) {
          //   fireToastMessage({
          //     type: "error",
          //     message: "Please check Terms & Condition",
          //   });
          //   setLoading(false);
          //   return;
          // }

          const fullName = fullNameFrom(values);
          dispatch(
            updateForm({
              name: fullName,
              email: values.email,
              password: values.password,
              zipCode: values.zipCode,
              dob: dob,
            })
          );

          try {
            setLoading(true);
            await dispatch(userCheckThunk({ email: values.email })).unwrap();
            setLoading(false);
            setStep((prevStep) => prevStep + 1);
          } catch (err) {
            setLoading(false);
            fireToastMessage({
              type: "error",
              message: err.message,
            });
          }
        })
        .catch((errorInfo) => {
          try {
            const fieldName = errorInfo?.errorFields?.[0]?.name?.[0];
            if (fieldName === "remember") {
              fireToastMessage({
                type: "error",
                message: "Please check Terms & Condition",
              });
            } else if (
              ["email", "name", "password", "confirm"].includes(fieldName)
            ) {
              // Do nothing for these
            } else if (["month", "date", "year"].includes(fieldName)) {
              fireToastMessage({
                type: "error",
                message: `Please set ${fieldName}`,
              });
            } else if (fieldName === "zipCode") {
              fireToastMessage({
                type: "error",
                message: "Please fill zip code field",
              });
            } else {
              fireToastMessage({
                type: "error",
                message: "Please set correct zip code field",
              });
            }
          } catch (err) {
            fireToastMessage({
              type: "error",
              message: "Please set correct zip code field",
            });
          }
        });
    } else if (step == 6) {
      if (form.getFieldValue(["describeSkills"])?.length > 0) {
        if (bool || trueCount > 1) {
          await dispatch(
            addOrUpdateAdditionalInfo({
              key: "jobDescription",
              value: form.getFieldValue(["describeSkills"]),
            })
          );
          setStep((prevStep) => prevStep + 1);
        } else {
          Register(form.getFieldValue(["describeSkills"]));
        }
      } else {
        fireToastMessage({
          type: "error",
          message: "Please write the job description",
        });
      }
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <HireStep4
            formRef={jobStepFormRef}
            head={
              <>
                What type of position are
                <br /> you interested in?
              </>
            }
            data={step1Data}
            checkBox={true}
            inputName={"Type here..."}
            textAreaHead={"Other Preferences"}
          />
        );
      case 1:
        return (
          // <HireStep4
          //   formRef={jobStepFormRef}
          //   head={"What type of childcare are you interested in providing?"}
          //   data={step2Data}
          //   inputName={"Type here..."}
          //   textAreaHead={"Other Preferences"}
          //   // subHead1={"What type of childcare are you interested in providing?"}
          // />
          <Onboarding_step1
            formRef={jobStepFormRef}
            daysState={daysState}
            setDaysState={setDaysState}
          />
        );
      case 2:
        return (
          // <HireStep4
          //   formRef={jobStepFormRef}
          //   head={"What is your availability?"}
          //   data={step3Data}
          //   inputNot={true}
          //   // subHead1={"What is your availability?"}
          // />
          <Onboarding_step2 formRef={jobStepFormRef} />
        );
      case 3:
        return (
          <div>
            <p className="mt-5 mb-10 px-3 text-center leading-6 Livvic-Bold offer-font">
              Experience Entry for Nanny and Babysitter
            </p>
            {familyExp?.map((d, i) => (
              <div key={i} className="bg-white mb-4 p-4 rounded-3xl">
                <p className="mb-4 Livvic-Bold text-2xl Livvic">Family {i + 1}</p>
                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {d?.typeOfCareProvided && (
                    <div>
                      <p className="text-xl">Type of Care Provided</p>
                      <p>{d.typeOfCareProvided}</p>
                    </div>
                  )}
                  {d?.durationOfEmployment && (
                    <div>
                      <p className="text-xl">Duration of Employment</p>
                      <p>{d.durationOfEmployment}</p>
                    </div>
                  )}

                  {d?.numberOfChildren && (
                    <div>
                      <p className="text-xl">Number of Children</p>
                      <p>{d.numberOfChildren}</p>
                    </div>
                  )}
                  {d?.ageGroupsOfChildren && (
                    <div>
                      <p className="text-xl">Age Group(s) of Children</p>
                      {d.ageGroupsOfChildren.map((a) => (
                        <p key={a}>{a}</p>
                      ))}
                      {d.specify && <p>Specify: {d.specify}</p>}
                    </div>
                  )}

                  {d?.keyResponsibilities && (
                    <div>
                      <p className="text-xl">Key Responsibilities</p>
                      {d.keyResponsibilities.map((a) => (
                        <p key={a}>{a}</p>
                      ))}
                      {d.specify1 && <p>Specify: {d.specify1}</p>}
                    </div>
                  )}
                  {d?.locationOfWork && (
                    <div>
                      <p className="text-xl">Location of Work</p>
                      <p>{d.locationOfWork}</p>
                    </div>
                  )}
                  {d?.reasonForLeavingOptional && (
                    <div>
                      <p className="text-xl">Reason for Leaving</p>
                      <p>
                        {d.reasonForLeavingOptional
                          ? d.reasonForLeavingOptional
                          : "No defined"}
                      </p>
                    </div>
                  )}
                  {d?.referencesAvailable && (
                    <div>
                      <p className="text-xl">References Available</p>
                      <p>{d.referencesAvailable}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      case 4:
        return (
          // <HireStep3
          //   daysState={daysState}
          //   setDaysState={updateDaysSt ate}
          //   head={"Specific availability"}
          //   // subHead={"Specific availability"}
          // />

          <Onboarding_step3 formRef={jobStepFormRef} />
        );
      case 5:
        return (
          <HireStep1
            formRef={jobStepFormRef}
            head={"Welcome, Let’s create your account"}
            type="Nanny"
            handleNext={() => setStep((prev) => prev + 1)}
          />
        );
      case 6:
        return (
          <div>
            <p className="px-3 width-form  mx-auto text-center Livvic-Bold text-4xl">
              Please describe any additional skills or hobbies that might be
              relevant to your job application.
            </p>
            <div className="relative w-24 mx-auto mt-6">
              {/* Profile Picture */}
              {image ? (
                <img
                  src={image}
                  alt="Profile"
                  className="rounded-full w-32 h-32 object-cover"
                />
              ) : (
                <Avatar
                  className="rounded-full text-black"
                  size="96"
                  color={"#AEC4FF"}
                  name={"Image"
                    ?.split(" ") // Split by space
                    .slice(0, 2) // Take first 1–2 words
                    .join(" ")}
                />
              )}

              <label className="right-0 bottom-0 absolute flex justify-center items-center bg-gray-200 rounded-full w-8 h-8 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <CameraIcon alt="cameraIcons" />
              </label>
            </div>
            <div
              // style={{ marginBottom: "-40px" }}
              className="flex justify-center mt-10"
            >
              <Form form={form} name="validateOnly" autoComplete="off">
                <InputTextArea
                  rows={8}
                  name={toCamelCase("Describe Skills")}
                  head={"Describe Skills"}
                  placeholder={
                    "Write a brief description about you and what you do..."
                  }
                  labelText={"Additional skills"}
                />
              </Form>
            </div>
          </div>
        );
      case 7:
        return (
          <>
            {(() => {
              if (v.value.privateEducator) {
                return navigate("/tutorJob");
              } else if (v.value.specializedCaregiver) {
                return navigate("/specialCaregiverJob");
              } else if (v.value.sportsCoaches) {
                return navigate("/sportCoachJob");
              } else if (v.value.musicInstructor) {
                return navigate("/musicJob");
              } else if (v.value.swimInstructor) {
                return navigate("/swimJob");
              } else if (v.value.houseManager) {
                return navigate("/houseManagerJob");
              }
              return null; // If none of the conditions are true, return null or some default component
            })()}
          </>
        );
    }
  };
  return (
    <div className="padd-res pb-28">
      <SEOMetaData
        title="Join as a Nanny or Caregiver | Create Your Profile"
        description="Sign up as a nanny, babysitter, tutor, or specialized caregiver. Complete your profile, share experience, availability, and skills to connect with families looking for trusted childcare."
      />{" "}
      {/* add padding bottom */}
      <div className="px-4 py-4 rounded-3xl">
        <div className="flex justify-center">
          <div className="flex flex-col w-full">{renderStepContent()}</div>
        </div>
      </div>
      {/* Fixed Button Container */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
        <div className="flex justify-center py-4 space-x-4">
          <CustomButton
            action={() => handleBack()}
            btnText={"Back"}
            className="border border-[#FFFFFF] text-[#555555]"
          />

          {step != 0 &&
            step != 1 &&
            step != 2 &&
            step != 4 &&
            step != 5 &&
            step != 6 && (
              <CustomButton
                action={() => handleBack()}
                btnText={"Add Family Experience"}
                className="border border-[#FFFFFF] text-[#555555]"
              />
            )}

          <CustomButton
            btnText={"Continue"}
            action={() => handleNext()}
            className="bg-[#AEC4FF] text-primary"
            isLoading={loading}
            loadingBtnText="Loading..."
          />

          {step != 0 &&
            step != 1 &&
            step != 2 &&
            step != 4 &&
            step != 3 &&
            step != 5 &&
            step != 6 && (
              <CustomButton
                btnText={"Add Family Experience"}
                action={() => handleNext()}
                className="bg-[#AEC4FF] text-primary"
              />
            )}
          {step != 0 && step != 1 && step != 5 && step != 3 && step != 6 && (
            <CustomButton
              action={() =>
                step === 2
                  ? setStep((prevStep) => prevStep + 2)
                  : setStep((prevStep) => prevStep + 1)
              }
              btnText={"Skip for now"}
              className="border border-[#FFFFFF] text-[#555555]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
