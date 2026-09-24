import { NavLink } from "react-router-dom";
import CustomButton from "@shared/ui/Button";
import { SectionHeading, Card } from "@shared/ui/Section";

// Entries with a slug link to their landing page (real internal links so the
// neighborhood pages aren't orphans); the rest render as plain text.
const CITIES = [
  {
    name: "Oakland",
    neighborhoods: [
      { name: "Rockridge", slug: "rockridge" },
      { name: "Temescal", slug: "temescal" },
      { name: "Piedmont Avenue", slug: "piedmont-avenue" },
      { name: "Grand Lake", slug: "grand-lake" },
      { name: "Adams Point", slug: "adams-point" },
      { name: "Montclair", slug: "montclair" },
      { name: "Lakeshore", slug: "lakeshore" },
    ],
  },
  {
    name: "Berkeley",
    neighborhoods: [
      { name: "North Berkeley", slug: "north-berkeley" },
      { name: "Elmwood", slug: "elmwood" },
      { name: "Downtown Berkeley", slug: "downtown-berkeley" },
      { name: "West Berkeley", slug: "west-berkeley" },
    ],
  },
  {
    name: "Alameda",
    neighborhoods: [{ name: "Central Alameda" }, { name: "Bay Farm Island" }],
  },
];

const NEARBY = [
  { name: "Emeryville", slug: "emeryville-ca" },
  { name: "Albany", slug: "albany-ca" },
  { name: "San Leandro", slug: "san-leandro-ca" },
  { name: "Castro Valley", slug: "castro-valley-ca" },
];

const ServiceAreaOakland = () => (
  <>
    <SectionHeading
      title="Service Areas"
      lede="Connect with nanny share families across the East Bay."
    />

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {CITIES.map((city) => (
        <Card key={city.name} className="p-5">
          <h3 className="fl-h3 text-ink mb-3">{city.name}</h3>
          <ul className="space-y-2">
            {city.neighborhoods.map((n) => (
              <li key={n.name} className="fl-body flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0"
                  aria-hidden="true"
                />
                {n.slug ? (
                  <NavLink
                    to={`/nanny-share/${n.slug}`}
                    onClick={() => window.scrollTo({ top: 0 })}
                    className="hover:text-ink hover:underline transition-colors"
                  >
                    {n.name}
                  </NavLink>
                ) : (
                  n.name
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>

    <div className="mt-8">
      <h3 className="fl-h3 text-ink mb-3">Nearby areas</h3>
      <div className="flex flex-wrap gap-2">
        {NEARBY.map((area) => (
          <NavLink
            key={area.name}
            to={`/nanny-share/${area.slug}`}
            onClick={() => window.scrollTo({ top: 0 })}
            className="fl-small text-ink bg-white border-2 border-gray-100 rounded-full px-4 py-1.5 hover:border-accent transition-colors"
          >
            {area.name}
          </NavLink>
        ))}
      </div>
    </div>

    <div className="bg-[#EBF5FF] rounded-2xl p-5 sm:p-6 mt-8 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="fl-h3 text-ink mb-1">Ready to find your nanny share match?</p>
        <p className="fl-small">Connect with nanny share families across the East Bay.</p>
      </div>

      <NavLink
        to="/find-nanny-share"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <CustomButton
          btnText="Create Your Profile"
          className="text-ink bg-accent hover:bg-accent-strong w-full sm:w-auto transition-colors"
        />
      </NavLink>
    </div>
  </>
);

export default ServiceAreaOakland;
