import { Form, Checkbox, Select, Spin, Input, Modal } from "antd";
import { InputDa, InputPassword, InputDOB } from "@shared/ui/Input";
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { fireToastMessage } from "@shared/ui/toast";
import document from "../../../assets/documents/Terms_and_Conditions.pdf";
import PropTypes from "prop-types";
import Autocomplete from "react-google-autocomplete";
import { api } from "@shared/api/client";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { useDispatch } from "react-redux";
import { userCheckThunk } from "@features/auth/store/authSlice";
import { updateForm } from "@shared/store/formValueSlice";
import CustomButton from "@shared/ui/Button";
import { useNavigate } from "react-router-dom";
import { registerThunk } from "@features/auth/store/authSlice";

export default function HireStep1({ formRef, head, comm, handleNext, initialData, recordId }) {
  const { Option } = Select;
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const dispatch = useDispatch();

  const parseChildAgesToYears = (agesString) => {
    if (!agesString) return { length: 0, info: {} };

    const agesArray = agesString.split(",").map((a) => a.trim());

    const info = {};

    agesArray.forEach((ageStr, index) => {
      let value = 0;

      if (ageStr.includes("year")) {
        value = parseFloat(ageStr);
      } else if (ageStr.includes("month")) {
        const months = parseFloat(ageStr);
        value = +(months / 12).toFixed(2); // convert to years
      }

      info[`Child${index + 1}`] = value;
    });

    return {
      length: agesArray.length,
      info,
    };
  };

  useEffect(() => {
    if (initialData && formRef?.current) {
      formRef.current.setFieldsValue({
        name: initialData.Name || "",
        email: initialData.Email || "",
      });
    }
  }, [formRef, initialData]);

  function LoginPage() {
    const onSuccess = async (credentialResponse) => {
      const decoded = jwtDecode(credentialResponse.credential);
      try {
        const res = await dispatch(
          userCheckThunk({ email: decoded.email })
        ).unwrap();

        if (res.message === "Email already exists") {
          fireToastMessage({ message: res.message, type: "error" });
          return;
        }

        const loc = {
          type: "Point",
          coordinates: [coordinates?.lng, coordinates?.lat],
          format_location: coordinates?.formatted,
        };

        form.setFieldsValue({
          location: JSON.stringify(loc),
          zipCode,
        });
        // if (coordinates || zipCode) {
        //   fireToastMessage({
        //     message: "Address and Zip Code is required!",
        //     type: "error",
        //   });
        //   return;
        // }
        dispatch(
          updateForm({
            name: decoded.name,
            email: decoded.email,
            imageUrl: decoded.picture,
            registeredVia: "google",
            location: JSON.stringify(loc),
            zipCode,
          })
        );

        if (initialData) {
          try {

            // parse children ages if needed
            const parsedChildAges = parseChildAgesToYears(initialData["Child age(s)"]);

            const signupPayload = {
              registeredVia: "google",
              name: decoded.name,
              email: decoded.email,
              imageUrl: decoded.picture,
              type: "Parents",
              sheetId: recordId,
              services: [
                "Nanny"
              ],
              noOfChildren: parsedChildAges || "",
              location: JSON.stringify(loc),
              zipCode,
            };

            const { data } = await dispatch(
              registerThunk(signupPayload)
            ).unwrap();

            fireToastMessage({
              success: true,
              message: data?.message || "Account created successfully",
            });

            navigate(`/login?recordId=${recordId}&email=${encodeURIComponent(decoded.email)}`);
            window.location.reload();
            return;
          } catch (err) {
            console.error("Register from recordId error:", err);
            fireToastMessage({
              type: "error",
              message: "We couldn’t complete your signup. Please make sure your ZIP code and address are added, then try again.",
            });
            setLoading(false);
            return;
          }
        }

        handleNext();
      } catch (err) {
        fireToastMessage({
          message: err.message || "Something went wrong",
          type: "error",
        });
      }
    };

    return <GoogleLogin onSuccess={onSuccess} onError={() => { }} />;
  }

  useEffect(() => {
    const getCurrentLocation = async () => {
      if (!location) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_KEY
              }`
            );
            const data = await response.json();

            if (data.status === "OK") {
              const address = data.results[0].formatted_address;
              const components = data.results[0].address_components;

              const zipObj = components.find((comp) =>
                comp.types.includes("postal_code")
              );
              const zip = zipObj ? zipObj.long_name : "";

              if (!zip) {
                fireToastMessage({
                  message:
                    "Zip code is not available for the selected location. Please try another location.",
                  type: "error",
                });
                return;
              }

              const { lat, lng } = data.results[0].geometry.location;
              setCoordinates({
                lat,
                lng,
                formatted: address,
              });

              const location = {
                type: "Point",
                coordinates: [lng, lat],
                format_location: address,
              };

              if (lat && lng) {
                setCoordinates({
                  lat,
                  lng,
                  formatted: address,
                });
              }

              if (!zip && lat && lng) {
                const geocodeRes = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_KEY
                  }`
                );
                const geocodeData = await geocodeRes.json();
                const altZip = geocodeData.results[0]?.address_components?.find(
                  (c) => c.types.includes("postal_code")
                )?.long_name;

                if (altZip) {
                  setZipCode(altZip);
                  form.setFieldsValue({
                    location: JSON.stringify(location),
                    zipCode: altZip,
                  });
                  dispatch(
                    updateForm({
                      location: JSON.stringify(location),
                      zipCode: altZip,
                    })
                  );
                } else {
                  fireToastMessage({
                    message: "No ZIP code found. Try again.",
                    type: "error",
                  });
                  return;
                }
              }

              setLocation(address);
              setZipCode(zip);

              form.setFieldsValue({
                location: JSON.stringify(location),
                zipCode: zip,
              });

              dispatch(
                updateForm({
                  location: JSON.stringify(location),
                  zipCode: zip,
                })
              );
            }
          } catch (error) {
            fireToastMessage({
              message: "Failed to fetch location details.",
              type: "error",
            });
          }
        });
      }
    };

    getCurrentLocation();
  }, []);

  const onFinish = (value) => {
    return null;
  };

  if (formRef) {
    formRef.current = form;
  }

  HireStep1.propTypes = {
    formRef: PropTypes.shape({ current: PropTypes.any }),
    head: PropTypes.node,
    comm: PropTypes.any,
  };

  const handleZipValidation = async (zip) => {
    if (!zip) return;

    setLoading(true);
    try {
      // ✅ Use AllOrigins proxy to bypass CORS
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        `https://api.zippopotam.us/us/${zip}`
      )}`;

      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Invalid ZIP");

      // Extract and parse the real ZIP data from proxy response
      const wrappedData = await res.json();
      const data = JSON.parse(wrappedData.contents);

      const finalZip = data["post code"];
      if (finalZip) {
        setZipCode(finalZip);
        form.setFieldsValue({
          zipCode: finalZip,
        });
      } else {
        throw new Error("Invalid structure");
      }
    } catch (err) {
      setZipCode("");
      form.setFieldsValue({ zipCode: "" });
      fireToastMessage({
        type: "error",
        message: "Invalid ZIP code. Please enter a valid U.S. ZIP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setIsTermsModalOpen(false);
  };

  const handleTermsDecline = () => {
    setTermsAccepted(false);
    setIsTermsModalOpen(false);
    fireToastMessage({
      message: "You must accept the Terms & Conditions and Privacy Policy to continue",
      type: "error",
    });
    navigate(-1);
  };

  return (
    <div>
      {/* Terms and Conditions Modal */}
      <Modal
        open={isTermsModalOpen}
        onCancel={() => setIsTermsModalOpen(false)}
        footer={null}
        centered
        width={600}
        maskClosable={false}
        closable={false}
        maskStyle={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
        className="terms-modal"
      >
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl Livvic-Bold text-gray-800 mb-2">
              Terms & Conditions
            </h2>
            <p className="text-gray-600 Livvic-Medium">
              Please review and accept our terms to continue
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto border border-gray-200">
            <div className="text-sm text-gray-700 space-y-3">
              <p className="Livvic-SemiBold">
                By using our service, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Provide accurate and truthful information</li>
                <li>Maintain the confidentiality of your account</li>
                <li>Use the platform in accordance with all applicable laws</li>
                <li>Respect the privacy and rights of other users</li>
                <li>Not engage in any fraudulent or harmful activities</li>
              </ul>
              <p className="mt-4">
                For complete terms and conditions, please{" "}
                <a
                  href={document}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  click here to view the full document
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center mb-6">
            <Checkbox
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span className="ml-2 text-sm text-gray-700">
              I have read and agree to the Terms & Conditions and Privacy Policy
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTermsDecline}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 Livvic-SemiBold hover:bg-gray-50 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={handleTermsAccept}
              disabled={!termsAccepted}
              className={`flex-1 px-6 py-3 rounded-lg Livvic-SemiBold transition-colors ${termsAccepted
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              Accept & Continue
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col items-center">
        {/* <div
          className="flex gap-2 cursor-pointer bg-gray-100 justify-center Livvic-SemiBold text-sm text-primary w-96 py-4 mb-4 rounded-[6px]"
          onClick={handleGoogleSignup}
        >
          <img src="/google-icon.svg" alt="google" /> Continue with Google
        </div> */}
        <LoginPage />
        <div className="flex items-center my-3 w-96">
          <div className="flex-grow h-px bg-gray-300" />
          <span className="mx-4 text-sm text-gray-500">or</span>
          <div className="flex-grow h-px bg-gray-300" />
        </div>
      </div>
      <p className="px-3 w-full text-center text-primary Livvic-Bold text-4xl">
        <p className="px-3 w-full text-center text-primary Livvic-Bold text-4xl">
          {head.includes("Let’s create") || head.includes("Let's create") ? (
            <>
              {head.split(/Let[’']s create/)[0]}Let’s create
              <br />
              {head.split(/Let[’']s create/)[1]}
            </>
          ) : (
            head
          )}
        </p>
      </p>

      <div className="flex justify-center my-10">
        <Form
          form={form}
          name="validateOnly"
          autoComplete="off"
          onFinish={onFinish}
        >
          <div className="flex flex-col w-full gap-y-6">
            {/* First & Last Name */}
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <div className="w-full">
                <InputDa
                  type={"text"}
                  name={"firstName"}
                  placeholder={"Enter your first name"}
                  labelText={"First name"}
                />
              </div>
              <div className="w-full">
                <InputDa
                  type={"text"}
                  name={"lastName"}
                  placeholder={"Enter your last name"}
                  labelText={"Last name"}
                />
              </div>
            </div>

            <InputDa
              type={"email"}
              name={"email"}
              emailVer={true}
              form={form}
              placeholder={"Enter your email"}
              labelText={"Your email"}
            />

            {/* Hidden field to store verified email */}
            <Form.Item name="verifiedEmail" hidden>
              <Input type="hidden" />
            </Form.Item>
          </div>

          <div className="w-full">
            {" "}
            <InputPassword />
          </div>

          <div className="gap-y-6">
            <InputDOB />

            <div>
              <div className="relative">
                <Form.Item
                  name="zipCode"
                  rules={[{ required: true, message: "ZIP code is required" }]}
                >
                  <Spin spinning={loading} size="small">
                    <Input
                      name="zipCode"
                      placeholder="Enter ZIP code"
                      value={zipCode}
                      onChange={(e) => {
                        const zip = e.target.value;
                        setZipCode(zip);
                        form.setFieldsValue({ zipCode: zip });
                        dispatch(updateForm({ zipCode: zip }));
                      }}
                      onBlur={(e) => handleZipValidation(e.target.value.trim())}
                      className="px-4 pt-7 pb-2 border border-[#EEEEEE] rounded-[10px]"
                      maxLength={10}
                    />
                  </Spin>
                </Form.Item>
                <label
                  htmlFor="zip code"
                  className="absolute left-4 top-2 text-sm text-gray-500 bg-white px-1 z-10"
                >
                  Zip Code
                </label>
              </div>
            </div>
          </div>

          <div>
            {/* Address */}
            <div className="relative">
              <Form.Item
                name="location"
                // initialValue={user?.location}
                rules={[{ required: true, message: "Address is required" }]}
              >
                <Spin spinning={loading} size="small">
                  <Autocomplete
                    className="peer"
                    apiKey={import.meta.env.VITE_GOOGLE_KEY}
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      padding: "1.7rem 0.75rem 0.75rem 0.75rem",
                      border: "1px solid #D6DDEB",
                    }}
                    value={location || ""}
                    onPlaceSelected={async (place) => {
                      const address = place.formatted_address;
                      const components = place?.address_components || [];

                      const zipObj = components.find((comp) =>
                        comp.types.includes("postal_code")
                      );
                      const zip = zipObj ? zipObj.long_name : "";

                      // if (!zip) {
                      //   fireToastMessage({
                      //     message:
                      //       "Zip code is not available for the selected location. Please try another location.",
                      //     type: "error",
                      //   });
                      //   setLocation("");
                      //   setZipCode("");
                      //   form.setFieldsValue({ location: "", zipCode: "" });
                      //   return;
                      // }

                      const lat = place?.geometry?.location?.lat();
                      const lng = place?.geometry?.location?.lng();

                      const location = {
                        type: "Point",
                        coordinates: [lng, lat],
                        format_location: address,
                      };

                      if (lat && lng) {
                        setCoordinates({
                          lat,
                          lng,
                          formatted: address,
                        });
                      }

                      if (!zip && lat && lng) {
                        const geocodeRes = await fetch(
                          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_KEY
                          }`
                        );
                        const geocodeData = await geocodeRes.json();
                        const altZip =
                          geocodeData.results[0]?.address_components?.find(
                            (c) => c.types.includes("postal_code")
                          )?.long_name;

                        if (altZip) {
                          setZipCode(altZip);
                          form.setFieldsValue({
                            location: JSON.stringify(location),
                            zipCode: altZip,
                          });
                          dispatch(
                            updateForm({
                              location: JSON.stringify(location),
                              zipCode: altZip,
                            })
                          );
                        } else {
                          fireToastMessage({
                            message: "No ZIP code found. Try again.",
                            type: "error",
                          });
                          return;
                        }
                      }

                      setLocation(address);
                      setZipCode(zip);

                      form.setFieldsValue({
                        location: JSON.stringify(location),
                        zipCode: zip,
                      });

                      dispatch(
                        updateForm({
                          location: JSON.stringify(location),
                          zipCode: zip,
                        })
                      );

                      setLoading(false);
                    }}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setLoading(e.target.value.length > 0);
                    }}
                    onBlur={() => setLoading(false)}
                    options={{
                      types: ["geocode"],
                      componentRestrictions: { country: "us" },
                    }}
                  />
                </Spin>
              </Form.Item>
              <label
                htmlFor="address"
                className="absolute left-4 top-2 text-sm text-gray-500 bg-white px-1 z-10"
              >
                Address
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-start gap-x-6">
            {comm && (
              <div className="flex flex-col">
                <p className="mb-2 text-xl capitalize text-start Livvic">
                  As an
                </p>
                <Form.Item
                  name="type"
                  rules={[{ required: true, message: "Please select a role" }]}
                >
                  <Select className="width-b" placeholder="As a">
                    <Option key="Parents" value="Parents">
                      Parents
                    </Option>
                    <Option key="Nanny" value="Nanny">
                      Nanny
                    </Option>
                  </Select>
                </Form.Item>
              </div>
            )}
          </div>

          <p className="font-normal text-base text-center already-acc">
            Already have an account?{" "}
            <NavLink
              to="/login"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <span className="underline cursor-pointer">Log in</span>
            </NavLink>
          </p>

          {/* <Form.Item
            className="mx-auto mt-3 mb-0 w-60 line1-20"
            name="remember"
            valuePropName="checked"
            rules={[{ required: true, message: "" }]}
          >
            <Checkbox>
              By proceeding you agree to the{" "}
              <a
                href={document}
                target="_blank"
                className="underline cursor-pointer text-center"
              >
                Terms & Conditions
              </a>
            </Checkbox>
          </Form.Item> */}
          <div className="text-xs md:text-sm text-gray-400 text-center mt-2">
            By signing in, you agree to our{" "}
            <a
              href={document}
              target="_blank"
              rel="noopener noreferrer"
              className="underline cursor-pointer text-primary hover:underline"
            >
              Terms & Conditions
            </a>
            {" "}and{" "}
            <a
              href="#"
              className="underline cursor-pointer text-primary hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Privacy Policy
            </a>
            .
          </div>
        </Form>
      </div>
    </div>
  );
}
