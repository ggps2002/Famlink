import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import Input from "antd/es/input/Input";

function OpenText({
  openFieldName,
  placeholder,
  title,
  formRef,
  required = true,
}) {
  const [form] = Form.useForm();
  // const allValues = step2Data.map((v) => (v.val ? v.val : toCamelCase(v.name)));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [formRef, form]);
  return (
    <div className="mb-6 mx-auto max-w-3xl">
      <p className="text-primary Livvic-Bold text-center text-2xl sm:text-3xl md:text-4xl px-3 mb-5">
        {title}
      </p>

      <div className="my-4">
        <Form form={form} name="validateOnly" autoComplete="off">
          <Form.Item
            style={{ padding: 0, margin: 0 }}
            name={openFieldName}
            rules={[{ required: required, message: "" }]}
          >
            <Input.TextArea
              rows={4} // controls height (increase rows for taller box)
              placeholder={placeholder}
              className="w-full max-w-2xl py-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 shadow-sm"
            />
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}

export default OpenText;
