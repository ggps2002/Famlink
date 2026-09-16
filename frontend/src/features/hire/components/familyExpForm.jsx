import React, { useEffect, useState } from "react";
import { Form, Input } from "antd";
import { InputDa, SelectComponent } from "@shared/ui/Input";
import OptionSelector from "@shared/ui/LanguageSelector";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const FamilyExperienceForm = ({ form }) => {
  // const [form] = Form.useForm();
  const [selectedValue, setSelectedValue] = useState(null);
  const [selectedValue1, setSelectedValue1] = useState(null);
  const [selectedValue2, setSelectedValue2] = useState(null);
  const [selectedValue3, setSelectedValue3] = useState(null);

  const [selected, setSelected] = useState([]);
  const [selected1, setSelected1] = useState([]);

  const options = [
    { label: "Newborn (0-6 months)", value: "newborn" },
    { label: "Infants (6-12 months)", value: "infants" },
    { label: "Toddlers (1-3 years)", value: "toddlers" },
    { label: "Preschoolers (3-5 years)", value: "preschoolers" },
    { label: "School-age (6-12 years)", value: "school-age" },
    { label: "Teens (12+ years)", value: "teens" },
  ];

  const options1 = [
    { label: "Childcare", value: "childcare" },
    { label: "Meal preparation", value: "mealPreparation" },
    { label: "Educational activities", value: "educationalActivities" },
    { label: "Transportation to school", value: "transportationToSchool" },
    { label: "Light housekeeping", value: "lightHousekeeping" },
    { label: "Homework assistance", value: "homeworkAssistance" },
    {
      label: "Managing children's schedules",
      value: "managingChildrenSchedules",
    },
  ];

  const handleSelect = (value) => {
    if (selected.includes(value)) {
      setSelected((prevSelected) =>
        prevSelected.filter((item) => item !== value)
      );
    } else {
      setSelected((prevSelected) => [...prevSelected, value]);
    }
  };

  useEffect(() => {
    if (form) {
      form.setFieldsValue({
        ageGroupsOfChildren: selected,
        keyResponsibilities: selected1,
      });
    }
  }, [selected, selected1, form]);

  const handleSelect1 = (value) => {
    if (selected1.includes(value)) {
      setSelected1(selected1.filter((item) => item !== value));
    } else {
      setSelected1([...selected1, value]);
    }
  };

  const handleSelectAll1 = () => {
    if (selected1.length === options1.length) {
      setSelected1([]);
    } else {
      setSelected1(options1.map((option) => option.value));
    }
  };

  const opt = [
    "Full-time Nanny",
    "Part-time Nanny",
    "Occasional Babysitting",
    "Live-in Nanny",
    "Date Nights",
  ];
  const opt1 = [
    "Less than 6 months",
    "6 months to 1 year",
    "1 to 2 years",
    "More than 2 years",
  ];
  const opt2 = ["1 child", "2 children", "3 children", "4 or more children"];

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="Livvic-SemiBold text-lg">
          Experience Entry for Nanny and Babysitter
        </p>
      </div>

      <div className="bg-white rounded-2xl">
        <Form layout="vertical" form={form} className="w-full">
          {/* First Row - Family Name and Type of Care */}
          <div className="rounded-xl">
            <h3 className="text-lg Livvic-Medium text-gray-700 mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="w-full">
                <InputDa
                  name={"Family Identifier/Nickname (Optional)"}
                  labelText="Family name"
                />
              </div>
              <div className="w-full">
                <Form.Item
                  name="typeOfCareProvided"
                  rules={[{ required: true, message: "" }]}
                >
                  <SelectComponent
                    opt={opt}
                    onSelectChange={(value) => {
                      setSelectedValue(value);
                      form.setFieldsValue({ typeOfCareProvided: value });
                    }}
                    selectedValue={selectedValue}
                    placeholder={"Type of Care Provided"}
                  />
                </Form.Item>
              </div>
            </div>
          </div>

          {/* Second Row - Duration and Number of Children */}
          <div className="rounded-xl">
            <h3 className="text-lg Livvic-Medium text-gray-700 mb-4">
              Employment Details
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6">
              <div className="w-full">
                <Form.Item
                  name="durationOfEmployment"
                  rules={[{ required: true, message: "" }]}
                >
                  <SelectComponent
                    opt={opt1}
                    onSelectChange={(value) => {
                      setSelectedValue1(value);
                      form.setFieldsValue({ durationOfEmployment: value });
                    }}
                    selectedValue={selectedValue1}
                    placeholder={"Duration of Employment"}
                  />
                </Form.Item>
              </div>
              <div className="w-full">
                <Form.Item
                  name="numberOfChildren"
                  rules={[{ required: true, message: "" }]}
                >
                  <SelectComponent
                    opt={opt2}
                    onSelectChange={(value) => {
                      setSelectedValue2(value);
                      form.setFieldsValue({ numberOfChildren: value });
                    }}
                    selectedValue={selectedValue2}
                    placeholder={"Number of Children"}
                  />
                </Form.Item>
              </div>
            </div>
          </div>

          {/* Age Groups Section */}
          <div className="rounded-xl">
            <h3 className="text-lg Livvic-Medium text-gray-700 mb-4">
              Age Group(s) of Children
            </h3>
            <OnboardingOptionSelector
              options={options}
              form={form}
              name={"ageGroupsOfChildren"}
              multi={true}
            />
            {/* <p className="Livvic text-xl mt-2 mb-4 capitalize">Select all age groups that apply</p> */}
            {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                        {options.map((option) => (
                            <Form.Item
                                key={option.value}
                                style={{ padding: 0, margin: 0 }}
                                name={'ageGroupsOfChildren'}
                            >
                                <div
                                    className={`cursor-pointer p-4 rounded-xl border-2 text-center shadow-sm transition-all duration-200 ${
                                        selected.includes(option.value)
                                            ? 'bg-blue-50 border-blue-400 shadow-md transform scale-105'
                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                                    } hover:transform hover:scale-105`}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    {option.label}
                                </div>
                            </Form.Item>
                        ))}
                    </div> */}
          </div>

          {/* Key Responsibilities Section */}
          <div className=" rounded-xl">
            <h3 className="text-lg Livvic-Medium text-gray-700 mb-4">
              Key Responsibilities
            </h3>
            {/* <p className="Livvic text-xl mb-4 capitalize">Select all responsibilities that applied</p> */}
            {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                        {options1.map((option) => (
                            <Form.Item
                                key={option.value}
                                style={{ padding: 0, margin: 0 }}
                                name={'keyResponsibilities'}
                            >
                                <div
                                    className={`cursor-pointer p-4 rounded-xl border-2 text-center shadow-sm transition-all duration-200 ${
                                        selected1.includes(option.value)
                                            ? 'bg-blue-50 border-blue-400 shadow-md transform scale-105'
                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                                    } hover:transform hover:scale-105`}
                                    onClick={() => handleSelect1(option.value)}
                                >
                                    {option.label}
                                </div>
                            </Form.Item>
                        ))}
                    </div> */}

            <OnboardingOptionSelector
              options={options1}
              form={form}
              name={"keyResponsibilities"}
              multi={true}
              specify={true}
            />

            {/* Specify input for Key Responsibilities */}
            {/* <div className="mb-4">
                        <Form.Item
                            style={{ padding: 0, margin: 0 }}
                            name={'keyResponsibilitiesSpecify'}
                            rules={[{ required: false, message: '' }]}
                        >
                            <Input
                                type="text"
                                placeholder="Specify other responsibilities..."
                                className="w-full max-w-md py-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 shadow-sm"
                            />
                        </Form.Item>
                    </div>

                    <p className="text-gray-500 text-end cursor-pointer hover:text-blue-500 transition-colors" onClick={handleSelectAll1}>
                        {selected1.length === options1.length
                            ? 'Deselect All'
                            : 'Select all that apply'}
                    </p> */}
          </div>

          {/* Location and Reason for Leaving */}
          <div className="rounded-xl">
            <h3 className="text-lg Livvic-Medium text-gray-700 mb-4">
              Additional Information
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="w-full">
                <InputDa
                  name={"Location of Work"}
                  labelText={"Type Location"}
                />
              </div>
              <div className="w-full">
                <InputDa
                  name={"Reason for Leaving (Optional)"}
                  req={true}
                  labelText={"Write Reason for Leaving"}
                />
              </div>
            </div>
          </div>

          {/* References Available */}
          <div className="rounded-xl mt-8">
            <h3 className="text-lg Livvic-Medium text-gray-700 mb-4">
              References
            </h3>
            <div className="w-full max-w-md">
              <Form.Item
                name="referencesAvailable"
                rules={[{ required: true, message: "" }]}
              >
                <SelectComponent
                  opt={["Yes", "No"]}
                  onSelectChange={(value) => {
                    setSelectedValue3(value);
                    form.setFieldsValue({ referencesAvailable: value });
                  }}
                  selectedValue={selectedValue3}
                  placeholder={"References Available"}
                />
              </Form.Item>
            </div>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default FamilyExperienceForm;
