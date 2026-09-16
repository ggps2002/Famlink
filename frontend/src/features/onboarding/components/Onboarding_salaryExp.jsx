import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import { InputDa } from "@shared/ui/Input";

function Onboarding_salaryExp({ form }) {
  return (
    <div >
      <Form
        form={form}
        name="validateOnly"
        autoComplete="off"
        className="flex flex-wrap gap-4"
      >
        <InputDa
          type={"number"}
          name={"1 Child"}
          val={"firstChild"}
          placeholder={"$20.00"}
          labelText="1 Child"
        />
        <InputDa
          type={"number"}
          name={"2 Child"}
          val={"secChild"}
          placeholder={"$30.00"}
          labelText="2 Child"
        />
        <InputDa
          type={"number"}
          name={"3 Child"}
          val={"thirdChild"}
          placeholder={"$40.00"}
          labelText="3 Child"
        />
        <InputDa
          type={"number"}
          name={"4 Child"}
          val={"fourthChild"}
          placeholder={"$50.00"}
          labelText="4 Child"
        />
        <InputDa
          type={"number"}
          name={"5 Child or more"}
          val={"fiveOrMoreChild"}
          placeholder={"$60.00"}
          labelText="5 Child or more"
        />
      </Form>
    </div>
  );
}

export default Onboarding_salaryExp;
