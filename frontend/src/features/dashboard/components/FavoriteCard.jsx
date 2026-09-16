import star from "@/assets/images/star.png";
import Avatar from "react-avatar";

export default function FavouriteCard({
  nanny,
  img,
  time,
  name,
  intro,
  loc,
  hr,
  exp,
  rate,
  zipCode,
}) {
  return (
    <div
      className={`flex flex-col justify-between shadow-custom-shadow  bg-white p-4 rounded-2xl min-h-96 lg:w-96 Quicksand`}
    >
      <div>
        <div className="flex justify-between">
          {img ? (
            <img
              className="bg-black rounded-full w-20 h-20 object-contain"
              src={img}
              alt="img"
            />
          ) : (
            <Avatar
              className="rounded-full text-black"
              size="80"
              color={"#AEC4FF"}
              name={name
                ?.split(" ") // Split by space
                .slice(0, 2) // Take first 1–2 words
                .join(" ")}
            />
          )}

          <div>
            {time && (
              <p
                style={{ background: "#E7F6FD" }}
                className="px-2 py-1 rounded-lg text-sm"
              >
                {time}
              </p>
            )}
          </div>
        </div>
        <p className="my-2 Livvic-Bold text-2xl">{name}</p>
      </div>

      <p className="Livvic-Medium flex-1">
        {intro.length > 300 ? `${intro.substring(0, 300)}...` : intro}
      </p>

      <div>
        {loc && (
          <p className="my-2 Livvic-SemiBold text-lg">{loc?.format_location}</p>
        )}
        {/* {zipCode && (
          <p className="my-2 Livvic-SemiBold text-lg">ZipCode: {zipCode}</p>
        )} */}
        <div className="flex justify-between items-center">
          {!nanny ? (
            <p>
              {hr && (
                <span className="Livvic-SemiBold">
                  {hr}hr <span className="font-normal">with kids | </span>
                </span>
              )}
              <span className="Livvic-SemiBold">{exp}</span> experience
            </p>
          ) : (
            <p>
              <span className="Livvic-SemiBold">
                {hr} <span className="font-normal">kids</span>
              </span>
            </p>
          )}
          {rate && (
            <div
              style={{ background: "#FBF5DE" }}
              className="flex gap-x-1 px-2 rounded-xl"
            >
              <p>{rate}</p>
              <img className="object-contain" src={star} alt="star" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
