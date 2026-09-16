import Ra from "@shared/ui/Rate";
import Avatar from "react-avatar";

/**
 * One review card in the horizontal rail on a profile screen.
 *
 * Geometry is the design's: a 335x218 card, 20px padding, 20px radius, a 1px
 * #eee border, and a 14px rhythm between the stars, the body and the byline.
 * Fixed height on purpose — the rail reads as a row of equal cards, and a long
 * review scrolls inside its own card rather than making one card taller than
 * its neighbours.
 */
// `starColor` is opt-in: the profile screens pass the design's #FFB73A so the
// stars match the rating bars beside them, while JobDescription and
// ProfileFamily — which share this card — keep the app's default amber.
export default function Reviews({ img, points, name, size = 16, para, created, starColor }) {
  return (
    <div className="snap-start shrink-0 w-[335px] h-[218px] p-[20px] rounded-[20px] border border-[#EEEEEE] bg-white flex flex-col justify-between overflow-y-auto hide-scrollbar">
      <div className="flex flex-col gap-[14px]">
        <Ra points={points} size={size} color={starColor} />
        <p className="Livvic-Medium text-[14px] leading-[22px] text-[#555555]">{para}</p>
      </div>

      <div className="flex gap-[8px] items-center">
        {img ? (
          <img className="object-cover w-[36px] h-[36px] rounded-full shrink-0" src={img} alt="" />
        ) : (
          <Avatar
            className="rounded-full shrink-0"
            size="36"
            round
            color="#AEC4FF"
            name={name?.split(" ").slice(0, 2).join(" ")}
          />
        )}
        <div className="flex flex-col gap-[4px]">
          <p className="Livvic-SemiBold text-[14px] leading-[22px] text-black">{name}</p>
          <p className="Livvic-Medium text-[12px] leading-[12px] text-[#666666]">
            {created
              ? new Date(created).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : null}
          </p>
        </div>
      </div>
    </div>
  );
}
