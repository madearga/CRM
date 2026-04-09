import { createAuthOptions } from '../authOptions';

// Export a static instance for Better Auth schema generation.
// This file should ONLY have the auth export — no other code.
// If imported at runtime, it will trigger errors due to missing environment variables.
export const auth = createAuthOptions();
