// Shim that maps the subset of react-router-dom v6 used by the imported repo
// to TanStack Router equivalents, so the page/component files can stay
// untouched. Wired in via a Vite alias (see vite.config.ts).
import React from "react";
import {
  useNavigate as tsUseNavigate,
  useLocation as tsUseLocation,
  useParams as tsUseParams,
  Link as TsLink,
} from "@tanstack/react-router";

type NavOpts = { replace?: boolean; state?: unknown };

export function useNavigate() {
  const nav = tsUseNavigate();
  return React.useCallback((to: string | number, opts?: NavOpts) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nav({ to, replace: opts?.replace } as any);
  }, [nav]);
}

export function useLocation() {
  const loc = tsUseLocation();
  return {
    pathname: loc.pathname,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search: (loc as any).searchStr ?? "",
    hash: loc.hash ?? "",
    state: loc.state,
    key: "default",
  };
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  // strict:false lets the page read whatever dynamic segments exist on the matched route
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tsUseParams({ strict: false }) as any;
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  replace?: boolean;
  state?: unknown;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, state: _state, children, ...rest }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (
      <TsLink ref={ref} to={to as any} replace={replace} {...(rest as any)}>
        {children as any}
      </TsLink>
    );
  }
);
Link.displayName = "Link";

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const nav = useNavigate();
  React.useEffect(() => {
    nav(to, { replace });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return null;
}

// No-op shells so any stray imports don't break — App.jsx isn't copied, but
// keep these defined for completeness.
export const BrowserRouter = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Routes = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Route = (_: unknown) => null;
export const Outlet = () => null;
