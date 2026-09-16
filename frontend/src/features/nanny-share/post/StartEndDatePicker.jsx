import React from "react";
import { DatePicker, Space } from "antd";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

function StartEndDatePicker({ startDate, endDate, setStartDate, setEndDate }) {
  const onChange = (dates, dateStrings) => {
    if (dates) {
      setStartDate(dates[0].toDate()); // save as JS Date for Mongo
      setEndDate(dates[1].toDate());
    } else {
      setStartDate(null);
      setEndDate(null);
    }
  };

  // disable past dates
  const disabledDate = (current) => {
    return current && current < dayjs().startOf("day");
  };

  return (
    <Space direction="vertical" size={12}>
      <RangePicker
        value={[
          startDate ? dayjs(startDate) : null,
          endDate ? dayjs(endDate) : null,
        ]}
        onChange={onChange}
        disabledDate={disabledDate}
      />
    </Space>
  );
}

export default StartEndDatePicker;
