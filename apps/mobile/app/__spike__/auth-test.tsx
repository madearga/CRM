/**
 * U0 throwaway route for the auth spike.
 *
 * Renders the spike screen inside the mobile Convex provider so the
 * authenticated query can observe the Better Auth session state.
 */
import AuthSpikeScreen from '../../src/lib/__spike__/auth-spike';
import { MobileConvexProvider } from '../../src/lib/convex-auth';

export default function AuthTestRoute() {
  return (
    <MobileConvexProvider>
      <AuthSpikeScreen />
    </MobileConvexProvider>
  );
}
