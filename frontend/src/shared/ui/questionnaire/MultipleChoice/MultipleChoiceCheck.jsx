import { useState, useEffect } from "react";
import { Checkbox, Form } from "antd";
import { toCamelCase } from "@shared/lib/toCamelCase";
import { InputTextArea } from "@shared/ui/Input";

export default function MultiFormContainer({
  formData,
  head,
  subHead,
  formRef,
  addInput,
}) {
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState({}); // Store selected checkboxes

  useEffect(() => {
    const initialFormValues = formData.reduce((acc, v) => {
      const headingKey = toCamelCase(v.heading);
      acc[headingKey] = []; // Initialize with an empty array for checkboxes
      return acc;
    }, {});
    setFormValues(initialFormValues);
    form.setFieldsValue(initialFormValues);
  }, [formData, form]);

  const onCheckboxChange = (checkedValue, heading) => {
    const currentValues = formValues[heading] || [];
    const updatedValues = currentValues.includes(checkedValue)
      ? currentValues.filter((val) => val !== checkedValue)
      : [...currentValues, checkedValue]; // Add or remove checkbox value

    setFormValues((prevValues) => ({
      ...prevValues,
      [heading]: updatedValues,
    }));

    form.setFieldsValue({
      [heading]: updatedValues,
    });
  };

  const handleSelectAllChange = (heading, options) => {
    const allValues = options.map((opt) => opt.name);
    const currentValues = formValues[heading] || [];

    const updatedValues =
      currentValues.length === allValues.length ? [] : allValues; // Select all or deselect all

    setFormValues((prevValues) => ({
      ...prevValues,
      [heading]: updatedValues,
    }));

    form.setFieldsValue({
      [heading]: updatedValues,
    });
  };

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [formRef, form]);
  return (
    <Form form={form} initialValues={formValues}>
      <p className="px-3 onboarding-head text-center width-form mb-3">{head}</p>
      {/* <p className="Livvic px-3 text-xl text-center width-form mb-5 mt-6">
                {subHead}
            </p> */}

      {formData.map((v, i) => {
        const headingKey = toCamelCase(v.heading);
        const selectedCheckboxes = formValues[headingKey] || [];

        return (
          <div className="flex justify-center my-5" key={i}>
            <div>
              <p className="Livvic-SemiBold text-primary text-lg mb-1 input-text">
                {v.heading}
              </p>

              {/* Select All/Deselect All button */}

              {v.data.map((j, h) => (
                <div
                  key={h}
                  className="input-width bg-white rounded-[10px] shadow-soft py-4 px-4 my-3"
                >
                  {/* <div className='flex items-center justify-between'>
                                    
                                        <Form.Item style={{ margin: 0, padding: 0 }} key={h} name={headingKey}>
                                            <Checkbox
                                                checked={selectedCheckboxes.includes(j.name)}
                                                onChange={() => onCheckboxChange(j.name, headingKey)}
                                            />
                                        </Form.Item>
                                    </div> */}
                  <Form.Item
                    style={{ margin: 0, padding: 0 }}
                    key={h}
                    name={headingKey}
                  >
                    <div className="flex gap-4 px-4 py-2 items-start justify-between">
                      <p className="Livvic-SemiBold text-sm">{j.name}</p>
                      {/* Custom Checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedCheckboxes.includes(j.name)}
                          onChange={() => onCheckboxChange(j.name, headingKey)}
                        />
                        <div
                          className={`w-5 h-5 rounded-full border-4 transition-colors duration-200 ${
                            selectedCheckboxes.includes(j.name)
                              ? "border-[#AEC4FF]"
                              : "border-[#EEEEEE]"
                          }`}
                        />
                      </label>
                    </div>
                  </Form.Item>
                </div>
              ))}
              {v?.input && (
                <div style={{ marginBottom: "-20px" }}>
                  <InputTextArea form={form} name={toCamelCase(v.input)} placeholder={v.input} />
                </div>
              )}

              <p className="input-text line1-20">{v.subHeading}</p>
              <p
                style={{ marginTop: "0px" }}
                className="text-end cursor-pointer"
                onClick={() => handleSelectAllChange(headingKey, v.data)}
              >
                {selectedCheckboxes.length === v.data.length
                  ? "Deselect All"
                  : "Select all that apply"}
              </p>
            </div>
          </div>
        );
      })}
      {addInput && (
        <div className="flex justify-center" style={{ marginTop: "-20px" }}>
          <div>
            <p className="Livvic-SemiBold text-primary text-lg mb-1 input-text line1-20">
              {addInput.name}
            </p>
            <div className="flex justify-center">
              <InputTextArea
                form={form}
                name={addInput.val ? addInput.val : toCamelCase(addInput.name)}
                placeholder={addInput.placeholder}
              />
            </div>
          </div>
        </div>
      )}
    </Form>
  );
}
