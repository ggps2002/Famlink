import { useState } from "react";
import { Form } from "antd";

const languageOptions = [
  "English",
  "Spanish",
  "French",
  "Mandarin",
  "Cantonese",
  "Arabic",
];

export default function OptionSelector({
  form,
  defaultCheckedValues = [],
  options = [],
  name,
}) {
  const [selectedOptions, setSelectedOptions] = useState(
    defaultCheckedValues.map((v) => v.toLowerCase())
  );

  const handleToggle = (option) => {
    let updated;
    if (selectedOptions.includes(option.toLowerCase())) {
      updated = selectedOptions.filter((l) => l !== option.toLowerCase());
    } else {
      updated = [...selectedOptions, option.toLowerCase()];
    }

    setSelectedOptions(updated);
    form.setFieldsValue({ [name]: updated });
  };

  return (
    <Form.Item
      style={{ margin: 0, padding: 0 }}
      name={name}
      initialValue={selectedOptions}
    >
      <div className="flex flex-wrap gap-4">
        {options.map((opt, i) => {
          const selected = selectedOptions.includes(opt.toLowerCase());
          return (
            <div
              key={i}
              onClick={() => handleToggle(opt)}
              className={`cursor-pointer rounded-full px-6 py-2 transition-all ${selected
                ? "bg-[#AEC4FF] text-primary"
                : "border border-[#EEEEEE] text-[#555]"
                }`}
            >
              <p className="Livvic-Medium text-md">{opt}</p>
            </div>
          );
        })}
      </div>
    </Form.Item>
  );
}
