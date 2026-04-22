import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, SESSION_MAX_AGE, makeToken, verifyToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = process.env.DASHBOARD_PASSWORD!;
  const secret = process.env.SESSION_SECRET!;
  const entered = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (entered !== password) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await makeToken(password, secret);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const nextParam = sp.next ?? "/";
  const hasError = sp.error === "1";

  // If already logged in, bounce straight to dashboard.
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (
    token &&
    process.env.DASHBOARD_PASSWORD &&
    process.env.SESSION_SECRET &&
    (await verifyToken(token, process.env.DASHBOARD_PASSWORD, process.env.SESSION_SECRET))
  ) {
    redirect(nextParam);
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="font-display text-4xl text-primary-700 leading-none">Picta</div>
          <div className="font-script text-2xl text-tertiary-500 -mt-1">dashboard</div>
        </div>
        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={nextParam} />
          <label className="block">
            <span className="text-sm text-ink-500">Password</span>
            <input
              type="password"
              name="password"
              autoFocus
              required
              className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-ink-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          {hasError && (
            <p className="text-sm text-secondary-500">Wrong password — try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary-700 text-white font-medium py-3 hover:bg-primary-600 transition"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}
