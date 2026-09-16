import React from "react";
import nannyResources1 from "@/assets/images/nannyResources1.png";
import nannyResources2 from "@/assets/images/nannyResources2.png";
import nannyResources3 from "@/assets/images/nannyResources3.png";
import { ARTICLES_META } from "@shared/seo/articlesMeta";

// slug/title/excerpt (+ SEO fields) live in articlesMeta.js so the build-time
// prerender script can read them without evaluating JSX. Merge them back here.
const meta = Object.fromEntries(ARTICLES_META.map((m) => [m.slug, m]));

export const articlesData = [
  {
    id: 1,
    ...meta["what-is-a-nanny-share"],
    author: "@FamLink",
    img: nannyResources1,
    replyCount: 0,
    time: "4",
    content: (
      <div className="space-y-8 fl-body">
        <div>
          <div className="flex flex-wrap gap-4 text-sm text-[#888] Livvic-Medium mb-4 border-b border-gray-100 pb-4">
            <span><strong className="text-[#333]">Best For:</strong> Working parents • Infants • Toddlers</span>
            <span><strong className="text-[#333]">Last Updated:</strong> July 2026</span>
          </div>
        </div>
        
        <div className="bg-[#f8f9fa] p-5 sm:p-6 rounded-xl border-l-4 border-primary shadow-sm">
          <h4 className="text-primary Livvic-Bold text-lg sm:text-xl mb-2">Quick Answer</h4>
          <p>A nanny share is when two families hire one nanny together and split the cost. It's a simple way to receive personalized, in-home childcare while spending significantly less than hiring a private nanny on your own.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-4">In This Guide</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-disc pl-5 text-[#555] Livvic-Medium">
            <li>What a nanny share is</li>
            <li>How it works</li>
            <li>Typical costs</li>
            <li>Benefits</li>
            <li>Things to consider</li>
            <li>Is it right for your family?</li>
          </ul>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">What Is a Nanny Share?</h4>
          <p>Imagine another family in your neighborhood also needs childcare during the same hours you do. Instead of each family hiring their own nanny, you hire one nanny together and share the cost. The nanny cares for both families' children, creating a small, personalized childcare environment that is often more affordable than hiring a private nanny.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">How Does It Work?</h4>
          <p>Most nanny shares include two families with similar schedules and children who are close in age. Some families host the nanny at one home every day, while others rotate between homes. Before getting started, families usually agree on schedules, expectations, and how the nanny's pay will be divided.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">What Are the Benefits?</h4>
          <p>Families often choose a nanny share because it reduces childcare costs, provides more personalized attention than many daycare settings, offers flexible scheduling, and gives children the opportunity to socialize in a smaller group.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Things to Consider</h4>
          <p>A successful nanny share depends on finding a family with compatible schedules, parenting styles, and expectations. Open communication and clear agreements help everyone stay on the same page.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Is a Nanny Share Right for You?</h4>
          <p>A nanny share may be a great fit if you're looking to lower childcare costs, want more flexibility than daycare, and like the idea of your child spending time with another family. If your schedule changes frequently or you prefer one-on-one care at all times, another childcare option may be a better fit.</p>
        </div>

        <div className="bg-[#AEC4FF] p-6 sm:p-8 rounded-2xl shadow-sm">
          <h4 className="text-[#001243] Livvic-Bold text-xl sm:text-2xl mb-4">Key Takeaways</h4>
          <ul className="list-disc pl-5 space-y-3 fl-body text-ink">
            <li>One nanny is shared by two families.</li>
            <li>Families often save 30–50% compared to hiring their own nanny.</li>
            <li>Children receive personalized care in a small group.</li>
            <li>Finding a compatible family is one of the most important parts of a successful nanny share.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 2,
    ...meta["how-does-a-nanny-share-work"],
    author: "@FamLink",
    img: nannyResources2,
    replyCount: 0,
    time: "4",
    content: (
      <div className="space-y-8 fl-body">
        <div>
          <div className="flex flex-wrap gap-4 text-sm text-[#888] Livvic-Medium mb-4 border-b border-gray-100 pb-4">
            <span><strong className="text-[#333]">Best For:</strong> Families exploring nanny shares</span>
            <span><strong className="text-[#333]">Last Updated:</strong> July 2026</span>
          </div>
        </div>
        
        <div className="bg-[#f8f9fa] p-5 sm:p-6 rounded-xl border-l-4 border-primary shadow-sm">
          <h4 className="text-primary Livvic-Bold text-lg sm:text-xl mb-2">Quick Answer</h4>
          <p>A nanny share is a childcare arrangement where two families hire one nanny together and share the cost. The nanny cares for both families' children at the same time, usually in one home or by rotating between homes.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-4">In This Guide</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-disc pl-5 text-[#555] Livvic-Medium">
            <li>How a nanny share is set up</li>
            <li>Where care takes place</li>
            <li>How costs are shared</li>
            <li>What families should discuss first</li>
            <li>What a typical day looks like</li>
          </ul>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">How is a nanny share set up?</h4>
          <p>Most nanny shares involve two families with similar childcare schedules. Once both families agree they're a good fit, they hire one nanny together and decide on a weekly schedule, pay, responsibilities, and communication expectations.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Where does childcare happen?</h4>
          <p>Some nanny shares are hosted at one family's home every day. Others rotate between both homes each week or on specific days. The best option depends on space, commuting, and what works best for everyone involved.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">How are costs shared?</h4>
          <p>Families typically split the nanny's hourly wage based on the agreement they make together. In many cases, each family pays less than they would for a private nanny while the nanny earns more than they would working for a single family.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">What should families discuss first?</h4>
          <p>Before starting, talk about schedules, sick-day policies, holidays, transportation, meals, naps, screen time, discipline, and communication. Having these conversations early helps avoid misunderstandings later.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">What does a typical day look like?</h4>
          <p>A typical day looks much like a regular nanny's routine: arrival, playtime, meals, naps, outdoor activities, learning, and pickup. The biggest difference is that the nanny is caring for children from two families instead of one.</p>
        </div>

        <div className="bg-[#AEC4FF] p-6 sm:p-8 rounded-2xl shadow-sm">
          <h4 className="text-[#001243] Livvic-Bold text-xl sm:text-2xl mb-4">Key Takeaways</h4>
          <ul className="list-disc pl-5 space-y-3 fl-body text-ink">
            <li>One nanny cares for two families' children.</li>
            <li>Families agree on a shared schedule and expectations.</li>
            <li>Care can happen at one home or rotate between homes.</li>
            <li>Open communication is one of the biggest factors in a successful nanny share.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 3,
    ...meta["nanny-share-vs-daycare"],
    author: "@FamLink",
    img: nannyResources3,
    replyCount: 0,
    time: "5",
    content: (
      <div className="space-y-8 fl-body">
        <div>
          <div className="flex flex-wrap gap-4 text-sm text-[#888] Livvic-Medium mb-4 border-b border-gray-100 pb-4">
            <span><strong className="text-[#333]">Best For:</strong> Parents exploring childcare options</span>
            <span><strong className="text-[#333]">Last Updated:</strong> July 2026</span>
          </div>
        </div>
        
        <div className="bg-[#f8f9fa] p-5 sm:p-6 rounded-xl border-l-4 border-primary shadow-sm">
          <h4 className="text-primary Livvic-Bold text-lg sm:text-xl mb-2">Quick Answer</h4>
          <p>A nanny share and daycare are two of the most common childcare options for working parents, but they offer very different experiences. A nanny share combines the personalized care of a private nanny with the cost savings of sharing childcare with another family. Daycare provides a structured classroom setting with larger groups of children and fixed daily schedules. If you're looking for more flexibility, individualized attention, and a smaller caregiver-to-child ratio, a nanny share may be the better fit.</p>
        </div>

        <div className="bg-[#FFF3EA] p-5 sm:p-6 rounded-xl border border-[#FFE4CC]">
          <h4 className="text-[#C4621A] Livvic-Bold text-lg mb-2">Curious how much you could save?</h4>
          <p className="text-[#C4621A] mb-3">Before comparing childcare options, estimate what a nanny share could cost in your area using the FamLink Nanny Share Savings Calculator.</p>
          <button className="bg-[#C4621A] text-white px-5 py-2 rounded-lg Livvic-Medium hover:bg-[#a65215] transition-colors border-none cursor-pointer">
            Calculate My Savings
          </button>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-4">In This Guide</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-disc pl-5 text-[#555] Livvic-Medium">
            <li>Personalized care</li>
            <li>Caregiver-to-child ratio</li>
            <li>Cost</li>
            <li>Flexibility</li>
            <li>Illness exposure</li>
            <li>Socialization</li>
            <li>Which option is right for you?</li>
          </ul>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Personalized Care</h4>
          <p>A nanny share provides care in a home environment with a much smaller group of children. This often allows for routines that match each child's needs, including naps, meals, learning activities, and outdoor play. Daycare follows a structured schedule designed for larger groups of children.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-4">Caregiver-to-Child Ratio</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#F8F9FA] p-5 rounded-xl border border-gray-100">
              <h5 className="Livvic-Bold text-lg mb-2 text-[#304B9E]">Nanny Share</h5>
              <ul className="list-disc pl-5 space-y-1 text-[#555]">
                <li>Usually 2–4 children</li>
                <li>One dedicated nanny</li>
                <li>More individualized attention</li>
              </ul>
            </div>
            <div className="bg-[#F8F9FA] p-5 rounded-xl border border-gray-100">
              <h5 className="Livvic-Bold text-lg mb-2 text-[#304B9E]">Daycare</h5>
              <p className="text-sm mb-2">Teacher-to-child ratios vary by state, but common examples include:</p>
              <ul className="list-disc pl-5 space-y-1 text-[#555]">
                <li>Infants: 1 teacher for every 3–5 children</li>
                <li>Toddlers: 1 teacher for every 4–7 children</li>
                <li>Preschool: 1 teacher for every 8–12 children</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 italic text-[#666]"><strong className="text-[#444] not-italic">Why it matters:</strong> Smaller groups often allow caregivers to spend more one-on-one time with each child.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Cost</h4>
          <p>A nanny share typically costs less than hiring your own private nanny because two families split the cost. While daycare is often the lowest-cost option, many families choose a nanny share because it offers a balance between affordability and personalized care.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Flexibility</h4>
          <p>Most daycare centers operate on fixed hours with set drop-off and pick-up times. For parents with long commutes or changing work schedules, those schedules may not always be ideal. Nanny shares are often more flexible because families work directly with their nanny to create a schedule that fits everyone's needs.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Illness Exposure</h4>
          <p>Because daycare centers bring together larger groups of children who share toys, classrooms, and play spaces, many children experience more frequent colds during their first year. A nanny share involves a much smaller group of children, which may reduce exposure to common illnesses while still giving children opportunities to socialize.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-3">Socialization</h4>
          <p>Daycare introduces children to larger groups every day. Nanny shares also provide socialization, but in a smaller, familiar setting with the same children, helping many children build strong friendships and consistent routines.</p>
        </div>

        <div>
          <h4 className="text-[#111] Livvic-Bold text-xl sm:text-2xl mb-4">Which Option Is Right for You?</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-[#EEFDF4] p-5 rounded-xl border border-[#C6F7D8]">
              <h5 className="Livvic-Bold text-lg mb-3 text-[#0F5C2E]">A nanny share may be a great fit if you...</h5>
              <ul className="space-y-2 text-[#1C733C] Livvic-Medium">
                <li className="flex gap-2"><span>✓</span> Want more personalized care</li>
                <li className="flex gap-2"><span>✓</span> Prefer a smaller caregiver-to-child ratio</li>
                <li className="flex gap-2"><span>✓</span> Need a flexible schedule</li>
                <li className="flex gap-2"><span>✓</span> Want to share the cost of a nanny</li>
              </ul>
            </div>
            <div className="bg-[#F8F9FA] p-5 rounded-xl border border-gray-200">
              <h5 className="Livvic-Bold text-lg mb-3 text-[#444]">Daycare may be a good fit if you...</h5>
              <ul className="space-y-2 text-[#555] Livvic-Medium">
                <li className="flex gap-2"><span>✓</span> Prefer a classroom environment</li>
                <li className="flex gap-2"><span>✓</span> Want a highly structured daily routine</li>
                <li className="flex gap-2"><span>✓</span> Are looking for a lower-cost childcare option</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-[#AEC4FF] p-6 sm:p-8 rounded-2xl shadow-sm">
          <h4 className="text-[#001243] Livvic-Bold text-xl sm:text-2xl mb-4">Key Takeaways</h4>
          <ul className="list-disc pl-5 space-y-3 fl-body text-ink">
            <li>Nanny shares combine personalized care with shared costs.</li>
            <li>Smaller groups may mean more individualized attention and lower illness exposure.</li>
            <li>Daycare offers structured routines and larger group interaction.</li>
            <li>The best choice depends on your family's priorities.</li>
          </ul>
        </div>
      </div>
    )
  }
];
