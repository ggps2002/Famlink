import { Checkbox, Form } from "antd";
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { InputRadio, InputTextArea } from "@shared/ui/Input";
import { toCamelCase } from "@shared/lib/toCamelCase";

export default function HireStep4({
  formRef,
  head,
  textAreaHead,
  subHead,
  data,
  checkBox,
  inputName,
  defaultVal,
  inputNot,
  subHead1,
  subHead2,
  name,
}) {
  const [value, setValue] = useState(defaultVal ? toCamelCase(defaultVal) : "");
  const [form] = Form.useForm();
  const allValues = data.map((v) => (v.val ? v.val : toCamelCase(v.name)));
  const [selectedValues, setSelectedValues] = useState([]);


// ✅ Clear selected values every time "name" or "data" changes (new step)
useEffect(() => {
  setSelectedValues([]);
  form.setFieldsValue({ [name ?? "option"]: [] });
}, [name, data, form]);

  const onRadioChange = (radioValue) => {
    setValue(radioValue);
    form.setFieldsValue({
      option: radioValue,
    });
  };

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [formRef, form]);

  const onCheckboxGroupChange = (checkedValues) => {
    form.setFieldsValue({
      [name ?? "option"]: checkedValues,
    });
    setSelectedValues(checkedValues);
  };

  const handleSelectAllChange = () => {
    const currentValues = form.getFieldValue(name ?? "option") || [];
    const updatedValues =
      currentValues.length === allValues.length ? [] : allValues;

    form.setFieldsValue({
      [name ?? "option"]: updatedValues,
    });
    setSelectedValues(updatedValues);
  };

  return (
    <div>
      <p className="Livvic-Bold text-4xl text-primary px-3 text-center w-full mb-6">
        {head}
      </p>

      <div
        className={`flex items-center flex-col justify-center ${
          !subHead2 ? "my-10" : "mb-10"
        }`}
      >
        <div>
          <Form form={form} name="validateOnly" autoComplete="off">
            {checkBox ? (
              <div className="flex flex-col">
                <Form.Item
                  name={name ?? "option"}
                  rules={[
                    {
                      required: inputName?.length > 0 ? false : true,
                      message: "Please select at least one option.",
                    },
                  ]}
                >
                  <Checkbox.Group
                    value={selectedValues}
                    onChange={onCheckboxGroupChange}
                    className="flex flex-col w-full"
                  >
                    <div
                      className={`${
                        data.length > 3 && "grid grid-cols-1 lg:grid-cols-2 gap-4"
                      }`}
                    >
                      {data.map((v) => {
                        const val = v.val ?? toCamelCase(v.name);
                        const isChecked = selectedValues.includes(val);

                        return (
                          <div key={val}>
                            <div className="input-width bg-white rounded-[10px] py-4 px-4 mb-4 shadow-soft h-[140px]">
                              <div className="flex gap-4 px-4 py-2 items-start">
                                {/* Custom Checkbox */}
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isChecked}
                                    onChange={() => {
                                      let updated;
                                      if (isChecked) {
                                        updated = selectedValues.filter(
                                          (item) => item !== val
                                        );
                                      } else {
                                        updated = [...selectedValues, val];
                                      }

                                      // ✅ Call your function here
                                      onCheckboxGroupChange(updated);
                                    }}
                                  />
                                  <div
                                    className={`w-5 h-5 rounded-full border-4 transition-colors duration-200 ${
                                      isChecked
                                        ? "border-[#AEC4FF]"
                                        : "border-[#EEEEEE]"
                                    }`}
                                  />
                                </label>

                                {/* Label and subtext */}
                                <div className="bg-white rounded-3xl py-1">
                                  <p className="Livvic-SemiBold text-lg text-primary leading-tight mb-2">
                                    {v.name}
                                  </p>
                                  <p className="Livvic-Medium text-sm">
                                    {v.subText}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {v.textArea && (
                              <>
                                <InputTextArea
                                  head={v.textArea}
                                  name={`${val}_textarea`}
                                  placeholder="Type here..."
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Checkbox.Group>
                </Form.Item>
              </div>
            ) : (
              <div
                className={`${
                  data.length > 3 && "grid grid-cols-1 lg:grid-cols-2 gap-x-2"
                }`}
              >
                {data.map((v, i) => (
                  <Form.Item name="option" key={i}>
                    <InputRadio
                      name={v.name}
                      value={value}
                      onRadioChange={onRadioChange}
                      val={v.val ? v.val : v.name}
                    />
                  </Form.Item>
                ))}
              </div>
            )}

            {checkBox && (
              <p
                style={{ marginTop: "-20px" }}
                className="text-end cursor-pointer mb-2"
                onClick={handleSelectAllChange}
              >
                {selectedValues.length === allValues.length
                  ? "Deselect All"
                  : "Select all that apply"}
              </p>
            )}

            {!inputNot && inputName?.length > 0 && (
              <InputTextArea
                form={form}
                name={inputName ? toCamelCase(inputName) : "specify"}
                placeholder={inputName || "Specify"}
                grid={data.length > 3}
                labelText={textAreaHead}
                req={false} // optional, if you want floating label
              />
            )}

            <div style={{ marginTop: "-40px" }}></div>
          </Form>
        </div>
      </div>
    </div>
  );
}

HireStep4.propTypes = {
  formRef: PropTypes.object,
  head: PropTypes.string,
  textAreaHead: PropTypes.string,
  subHead: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      val: PropTypes.string,
      textArea: PropTypes.string,
    })
  ).isRequired,
  checkBox: PropTypes.bool,
  inputName: PropTypes.string,
  defaultVal: PropTypes.string,
  inputNot: PropTypes.bool,
  subHead1: PropTypes.string,
  subHead2: PropTypes.string,
};
