import { getTokenStatus } from "@/lib/queries";

export async function TokenBanner() {
  const { expires_at, days_remaining } = await getTokenStatus();

  // Hide if no data yet, or if we have 14+ days of runway.
  if (expires_at == null || days_remaining == null) return null;
  if (days_remaining >= 14) return null;

  const red = days_remaining <= 7;
  const bg = red ? "bg-secondary-500" : "bg-tertiary-500";
  const expiredText =
    days_remaining < 0
      ? "The Instagram access token has expired."
      : days_remaining === 0
        ? "The Instagram access token expires today."
        : `The Instagram access token expires in ${days_remaining} day${
            days_remaining === 1 ? "" : "s"
          }.`;

  return (
    <div className={`${bg} text-white text-sm`}>
      <div className="max-w-[1280px] mx-auto px-6 py-2.5 flex items-center gap-3">
        <span className="font-medium">⚠︎ {expiredText}</span>
        <span className="opacity-90">
          Ask Gauthier (social media manager) to refresh it, then update{" "}
          <code className="bg-black/20 px-1 py-0.5 rounded text-[11px]">IG_ACCESS_TOKEN</code> on
          Vercel.
        </span>
      </div>
    </div>
  );
}
