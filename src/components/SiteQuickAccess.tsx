type QuickItem = {
  href?: string;
  icon: string;
  title: string;
  text: string;
  premium?: boolean;
  soon?: boolean;
};

const QUICK_ITEMS: QuickItem[] = [
  {
    href: "/on-the-water",
    icon: "🌊",
    title: "On the Water",
    text: "Find water conditions and adventures near you.",
  },
  {
    href: "/off-the-road",
    icon: "🥾",
    title: "Off the Road",
    text: "Find trails, peaks, dirt, snow, and outdoor adventures.",
  },
  {
    icon: "✈️",
    title: "In the Air",
    text: "Air adventures are coming soon.",
    soon: true,
  },
  {
    href: "/passport",
    icon: "🛂",
    title: "Passport",
    text: "Collect your travel memories.",
  },
  {
    href: "/journal",
    icon: "📖",
    title: "Journal",
    text: "Save the story of every trip.",
  },
  {
    href: "/community",
    icon: "🌎",
    title: "Community",
    text: "See and share adventures.",
  },
 
  {
    href: "/saved-trips",
    icon: "🧳",
    title: "My Trips",
    text: "Return to saved adventures.",
  },
];

function QuickCard({ item }: { item: QuickItem }) {
  const base =
    "relative min-h-[132px] rounded-2xl border bg-white p-4 text-left shadow-sm transition";

  const tone = item.premium
    ? "border-orange-200 hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-lg"
    : item.soon
      ? "cursor-default border-slate-200 bg-slate-50/80 opacity-75"
      : "border-slate-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg";

  const content = (
    <>
      {item.soon && (
        <span className="absolute right-3 top-3 rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-800">
          Soon
        </span>
      )}

      <div className="text-2xl">{item.icon}</div>

      <div
        className={`mt-3 text-base font-black ${
          item.premium ? "text-orange-600" : "text-[#092530]"
        }`}
      >
        {item.title}
      </div>

      <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
    </>
  );

  if (!item.href || item.soon) {
    return (
      <div className={`${base} ${tone}`} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <a href={item.href} className={`${base} ${tone}`}>
      {content}
    </a>
  );
}

export default function SiteQuickAccess({
  className = "",
}: {
  className?: string;
}) {
  return (
    <section
      className={`mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 ${className}`}
      aria-label="TrippinDays quick access"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {QUICK_ITEMS.map((item) => (
          <QuickCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}
