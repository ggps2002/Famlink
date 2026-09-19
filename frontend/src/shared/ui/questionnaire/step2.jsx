import { SelectComponent, InputDa } from "@shared/ui/Input";
import { Form } from "antd";

export default function HireStep2({
  opt,
  selectedValue,
  handleSelectChange,
  formRef,
}) {
  const [form] = Form.useForm();

  const onFinish = (value) => {
    value;
  };

  // Attach form instance to formRef
  if (formRef) {
    formRef.current = form;
  }
  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col items-center">
        <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-5">
          How many children
          <br /> do you have?
        </p>
        <div className="">
          <SelectComponent
            opt={opt}
            selectedValue={selectedValue}
            onSelectChange={handleSelectChange}
            placeholder={"Children"}
          />
        </div>
        <div className="">
          <p className="text-lg text-primary Livvic-SemiBold my-6">
            Their ages
          </p>
          <Form
            form={form}
            name="validateOnly"
            autoComplete="off"
            onFinish={onFinish}
          >
            {selectedValue > 1 ? (
              <div className="space-y-4">
                {selectedValue &&
                  [...Array(Number(selectedValue))].map((i, index) => (
                    <InputDa
                      key={index}
                      placeholder={"Type age"}
                      name={`${index + 1} Child`}
                      val={`Child${index + 1}`}
                      type={"number"}
                      labelText={`${index + 1} Child`}
                    />
                  ))}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedValue &&
                  [...Array(Number(selectedValue))].map((i, index) => (
                    <InputDa
                      key={index}
                      placeholder={"Type age"}
                      name={`${index + 1} Child`}
                      val={`Child${index + 1}`}
                      type={"number"}
                      labelText={`${index + 1} Child`}
                    />
                  ))}
              </div>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
}
