import React from "react";

/* Image-led service tile: full-bleed photo, gradient scrim, copy pinned bottom.
 *
 * The type here used to scale DOWN with the viewport (`text-xl md:text-lg` on
 * the title, `text-lg md:text-sm` on the description), so the cards were
 * shoutier on a phone than on a desktop. Now it scales up like everything else.
 */
function ServicesCard({ title, description, icon }) {
  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[3/4]">
      <img
        src={icon}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
      />

      {/* Scrim, so the copy stays legible whatever the photo does underneath. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
        <p className="fl-h4 text-white">{title}</p>
        <p className="fl-small text-white/70 mt-1.5">{description}</p>
      </div>
    </div>
  );
}

export default ServicesCard;
