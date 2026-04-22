import { fmtNum, fmtPct } from "@/lib/format";
import type { TopPost } from "@/lib/queries";

export function TopPostsSection({
  statics,
  reels,
}: {
  statics: TopPost[];
  reels: TopPost[];
}) {
  return (
    <div className="space-y-16">
      <TopGroup title="Top Performing Instagram" scriptWord="Posts" posts={statics} variant="static" />
      <TopGroup title="Top Performing Instagram" scriptWord="Reels" posts={reels} variant="reel" />
    </div>
  );
}

function TopGroup({
  title,
  scriptWord,
  posts,
  variant,
}: {
  title: string;
  scriptWord: string;
  posts: TopPost[];
  variant: "static" | "reel";
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-8 items-start">
      <div>
        <h2 className="font-display text-[3.25rem] leading-[1.05] text-primary-700">
          {title}
          <span className="block font-script text-tertiary-400 text-[3.5rem] leading-none -mt-3 ml-10">
            {scriptWord}
          </span>
        </h2>
      </div>
      {posts.length === 0 ? (
        <div className="text-sm text-ink-400 rounded-2xl border border-dashed border-ink-200 p-8 text-center">
          No {variant === "reel" ? "reels" : "static posts"} in this period.
        </div>
      ) : (
        <div className={variant === "reel" ? "grid grid-cols-2 gap-6" : "grid grid-cols-2 gap-6"}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} variant={variant} />
          ))}
        </div>
      )}
    </section>
  );
}

function PostCard({ post, variant }: { post: TopPost; variant: "static" | "reel" }) {
  const titleText = (post.caption ?? "").split("\n")[0].slice(0, 60) || "Untitled";
  const frameCls =
    variant === "reel"
      ? "aspect-[9/16] rounded-[28px] overflow-hidden bg-ink-100 border-[6px] border-ink-900 shadow-xl"
      : "aspect-square rounded-xl overflow-hidden bg-ink-100";

  return (
    <a
      href={post.permalink ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="group block"
    >
      <div className="text-sm font-medium text-ink-800 mb-2 line-clamp-1">{titleText}</div>
      <div className={frameCls}>
        {post.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-ink-400 text-xs">no thumbnail</div>
        )}
      </div>
      <dl className="mt-3 text-xs text-ink-600 leading-relaxed">
        <Row label="Views" value={fmtNum(post.views)} />
        <Row label="Reach" value={fmtNum(post.reach)} />
        <Row label="Engagement rate" value={fmtPct(post.engagement_rate, 2)} />
        <Row label="Likes" value={fmtNum(post.likes)} />
        <Row label="Comments" value={fmtNum(post.comments)} />
        <Row label="Shares" value={fmtNum(post.shares)} />
        <Row label="Saves" value={fmtNum(post.saves)} />
      </dl>
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ink-100 last:border-0 py-1">
      <dt className="text-ink-500">{label}</dt>
      <dd className="num text-ink-800 font-medium">{value}</dd>
    </div>
  );
}
