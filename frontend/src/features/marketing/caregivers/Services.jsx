import React, { useRef, useEffect } from 'react';
import ServicesCard from '@features/marketing/components/ServicesCard';

const services = [
  {
    icon: "nannyshareEarnMore.jpg",
    title: "Earn More",
    description: "Nanny share caregivers typically earn 20–30% more than single-family positions.",
  },
  {
    icon: "shareConnect.jpg",
    title: "Connect With Families",
    description: "Get discovered by families in your area who are actively looking for a nanny share.",
  },
  {
    icon: "nannyshareFlexibleJob.jpg",
    title: "Flexible Job Structure",
    description: "Build a schedule that works for you while working with families that align with your needs.",
  },
  {
    icon: "nannyshareSpecialist.jpg",
    title: "Become a Nanny Share Specialist",
    description: "Stand out as an experienced share nanny and build a strong reputation in your neighborhood.",
  },
  {
    icon: "nannyshareMatches.jpg",
    title: "Real Matches Near You",
    description: "We connect you with families already searching in your area — no cold outreach needed.",
  },
  {
    icon: "nannyshareAgreement.jpg",
    title: "Share Agreement Support",
    description: "Access templates to help you set clear expectations with both families from the start.",
  },
];

const SCROLL_AMOUNT = 320; // px per step — roughly one card width
const INTERVAL_MS = 2000;  // 2 seconds between each step

function Services() {
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftRef = useRef(0);
  const autoScrollRef = useRef(null);
  const isPaused = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    autoScrollRef.current = setInterval(() => {
      if (isPaused.current) return;

      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;

      if (atEnd) {
        // Jump back to start
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        // Step forward one card
        el.scrollTo({ left: el.scrollLeft + SCROLL_AMOUNT, behavior: 'smooth' });
      }
    }, INTERVAL_MS);

    return () => clearInterval(autoScrollRef.current);
  }, []);

  const onMouseEnter = () => { isPaused.current = true; };
  const onMouseLeave = () => {
    isPaused.current = false;
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };

  const onMouseDown = (e) => {
    isDragging.current = true;
    isPaused.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
  };

  const onMouseUp = () => {
    isDragging.current = false;
    isPaused.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };

  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  return (
    <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">

      {/* Header */}
      <div className="sm:text-left max-w-4xl mx-auto sm:mx-0">
        <h1 className="Livvic-Bold text-4xl sm:text-4xl md:text-5xl leading-tight sm:leading-[50px] md:leading-[60px] lg:leading-[80px] mb-4 sm:mb-6">
          Why Join Famlink
        </h1>
        <h2 className="Livvic text-[#00000099] text-lg sm:text-xl max-w-2xl mx-auto sm:mx-0 mb-8 sm:mb-10 lg:mb-12">
          We connect caregivers with jobs that fit their talents—and support their growth.
        </h2>
      </div>

      {/* Scroll row */}
      <div
        ref={scrollRef}
        className="services-scroll flex gap-4 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-2 select-none"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          cursor: "grab",
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        <style>{`
          .services-scroll { overflow-x: scroll !important; }
          .services-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {services.map((service) => (
          <div
            key={service.title}
            className="flex-none w-[80vw] sm:w-[44vw] lg:w-[30vw] xl:w-[23vw] max-w-[320px] min-w-[220px]"
          >
            <ServicesCard
              title={service.title}
              description={service.description}
              icon={service.icon}
            />
          </div>
        ))}
      </div>

    </div>
  );
}

export default Services;