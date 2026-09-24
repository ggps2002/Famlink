import { Camera } from "lucide-react";

/* Optional family photo on the last questionnaire step. The profile page shows
 * it at the top of the family's card; without one it shows an initial.
 *
 * The questionnaire saves as JSON, so the file can't travel with it — the
 * parent uploads it separately (editUserThunk, the same call the edit-profile
 * page uses) once the profile has saved. */
export default function FamilyPhotoPicker({ image, onChange }) {
  return (
    <div className="mx-auto max-w-3xl mt-2 mb-6 flex flex-col items-center gap-3">
      <p className="text-lg Livvic-SemiBold text-primary">Add a family photo (optional)</p>
      <label className="relative cursor-pointer group" aria-label="Choose a family photo">
        <input type="file" accept="image/*" className="sr-only" onChange={onChange} />
        {image ? (
          <img src={image} alt="" className="w-28 h-28 rounded-[24px] object-cover" />
        ) : (
          <div className="w-28 h-28 rounded-[24px] bg-[#EEF3FF] border border-dashed border-[#AEC4FF] flex items-center justify-center text-[#001243]">
            <Camera className="w-7 h-7" />
          </div>
        )}
        <span className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-full bg-white border border-[#E3E7EF] shadow-sm flex items-center justify-center group-hover:bg-[#EEF3FF] group-focus-within:ring-2 group-focus-within:ring-[#AEC4FF]">
          <Camera className="w-4 h-4 text-[#001243]" />
        </span>
      </label>
      <p className="text-sm text-gray-500 Livvic-Medium text-center max-w-sm">
        A clear photo helps caregivers and other families feel connected to you.
      </p>
    </div>
  );
}
