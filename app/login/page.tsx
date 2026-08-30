import Icon from "@/components/Icon";
import { login } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid: "Invalid credentials.",
  missing: "Enter a username and password.",
  expired: "Session expired — sign in again.",
  offline: "Backend unreachable — try again shortly.",
};

/** Own-property lookup only: ?error=constructor must not reach the prototype. */
function messageFor(key?: string): string | null {
  if (!key) return null;
  return Object.prototype.hasOwnProperty.call(MESSAGES, key)
    ? MESSAGES[key]
    : MESSAGES.invalid;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const message = messageFor(searchParams.error);

  return (
    <div className="login-wrap">
      <form className="card login-card" action={login}>
        <div className="card-title">
          <Icon name="cash" size={18} />
          Sign in
        </div>
        <p className="login-hint">
          Dashboard access is limited to admin accounts created with{" "}
          <code>scripts/onboard.py</code>.
        </p>
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
            autoFocus
            required
            maxLength={32}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
        {message ? (
          <div className="login-error">
            <Icon name="offline" size={15} />
            {message}
          </div>
        ) : null}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
