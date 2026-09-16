import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { postPostJob } from "@features/jobs/store/postJobSlice";
import { fireToastMessage } from "@shared/ui/toast";

/**
 * Posts a job from any of the job-type questionnaires, then returns the member
 * to where they came from.
 *
 * Every job-type screen (tutor, swim, music, …) submits the same way, so the
 * dispatch, the toast and the navigate-back live here rather than being copied
 * into each one.
 */
export const useJobSubmitter = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submitJob = async ({ jobType, formValues, textAreaValue }) => {
    try {
      const { data } = await dispatch(
        postPostJob({
          jobType,
          [jobType]: {
            ...formValues,
            jobDescription: textAreaValue,
          },
        })
      ).unwrap();

      fireToastMessage({
        success: true,
        message: data.message,
      });

      navigate(-1);
    } catch (err) {
      fireToastMessage({
        type: "error",
        message: err.message || "Something went wrong",
      });
    }
  };

  return { submitJob };
};
