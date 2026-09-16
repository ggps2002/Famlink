import React, { useState, useEffect } from "react";
import { Form, Input, Select } from "antd";

function SelectChildrenAge({
  form,
  opt,
  selectedValue,
  handleSelectChange,
  numberOfChildren = null,
  childrenAges = "",
}) {
  const [localCount, setLocalCount] = useState(
    selectedValue || numberOfChildren || null
  );

  useEffect(() => {
    if (selectedValue !== undefined && selectedValue !== null) {
      setLocalCount(selectedValue);
    } else if (numberOfChildren !== undefined && numberOfChildren !== null) {
      setLocalCount(numberOfChildren);
    }
  }, [selectedValue, numberOfChildren]);

  useEffect(() => {
    if (childrenAges && form && localCount >= 1) {
      const agesArray = typeof childrenAges === 'string' ? childrenAges.split(",") : childrenAges;
      const fieldsToUpdate = {};
      for (let index = 0; index < Number(localCount); index++) {
        let childAgeData = typeof agesArray[index] === 'string' ? agesArray[index].trim() : String(agesArray[index]?.label || "");
        const isMonths = childAgeData.toLowerCase().includes("month") || childAgeData.toLowerCase().includes("mo");
        const numMatch = childAgeData.match(/(\d+)/);
        const age = numMatch ? numMatch[1] : "";
        const unit = isMonths ? "months" : "years";

        fieldsToUpdate[`Child${index + 1}_age`] = age;
        fieldsToUpdate[`Child${index + 1}_unit`] = unit;
      }
      form.setFieldsValue(fieldsToUpdate);
    }
  }, [childrenAges, localCount, form]);

  const handleChange = (val) => {
    setLocalCount(val);
    handleSelectChange?.(val); // still notify parent if needed
  };

  return (
    <div className="flex flex-col">
      <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Number of Children</span>} style={{ marginBottom: 0 }}>
        <Select
          className="h-[50px] w-full rounded-xl border-gray-200 Livvic-Medium"
          value={localCount}
          onChange={handleChange}
          placeholder="How many children?"
        >
          {opt.map((num) => (
            <Select.Option key={num} value={num}>{num}</Select.Option>
          ))}
        </Select>
      </Form.Item>

      {Number(localCount) >= 1 && (
        <>
          <p className="text-lg text-primary Livvic-SemiBold my-6">
            Their ages
          </p>

          <div className="flex flex-col md:flex-row flex-wrap gap-4">
            {[...Array(Number(localCount))].map((_, index) => {
              const childAgeData = childrenAges?.split(",")[index]?.trim() || "";

              const isMonths = childAgeData.toLowerCase().includes("month");
              const numMatch = childAgeData.match(/(\d+)/);
              const age = numMatch ? numMatch[1] : "";
              const unit = isMonths ? "months" : "years";

              return (
                <div key={index} className="flex flex-col mb-2 w-full md:w-auto">
                  <div className="flex flex-row items-center gap-2">
                    <Form.Item
                      name={`Child${index + 1}_age`}
                      noStyle
                      initialValue={age || ""}
                      rules={[
                        { required: true, message: "Please provide child's age" },
                        {
                          validator: (_, value) =>
                            value && Number(value) > 0
                              ? Promise.resolve()
                              : Promise.reject("Age must be greater than 0"),
                        },
                      ]}
                    >
                      <Input
                        type="number"
                        placeholder={`${index + 1} Child`}
                        min={1}
                        className="h-[50px] rounded-xl border-gray-200 Livvic-Medium w-[100px] focus:border-[#AEC4FF]"
                      />
                    </Form.Item>

                    <Form.Item
                      name={`Child${index + 1}_unit`}
                      noStyle
                      initialValue={unit}
                    >
                      <Select className="h-[50px] w-[130px] rounded-xl border-gray-200 Livvic-Medium">
                        <Select.Option value="months">Months Old</Select.Option>
                        <Select.Option value="years">Years Old</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default SelectChildrenAge;