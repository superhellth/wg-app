import { Navigate, Outlet } from "react-router-dom";
import { useIdentity } from "../api/identity.js";

/** Full gate: needs WG token AND a picked member. */
export function RequireIdentity() {
  const { wgToken, memberId } = useIdentity();
  if (!wgToken) return <Navigate to="/willkommen" replace />;
  if (!memberId) return <Navigate to="/wer-bin-ich" replace />;
  return <Outlet />;
}

/** Needs a WG token but not yet a member (for the identity picker). */
export function RequireToken() {
  const { wgToken } = useIdentity();
  if (!wgToken) return <Navigate to="/willkommen" replace />;
  return <Outlet />;
}

/** Onboarding routes: if already fully set up, skip to the app. */
export function PublicOnly() {
  const { wgToken, memberId } = useIdentity();
  if (wgToken && memberId) return <Navigate to="/" replace />;
  return <Outlet />;
}
