import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(__dirname, '..', '..');

const config: NextConfig = {
  // @kofc/shared publishes raw TypeScript (its package.json "main" is src/index.ts), so Next compiles it.
  transpilePackages: ['@kofc/shared'],
  // Trace and resolve from the workspace root, where node_modules and the lockfile live.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
    // Sprint 9 Revision 4.0: the pilot hub (services/server/hub) runs the phone data layer on the server, so its Expo
    // modules resolve to Node stand-ins there. The browser bundle never imports them.
    resolveAlias: {
      'expo-sqlite': './services/server/hub/shims/expo-sqlite.ts',
      'expo-crypto': './services/server/hub/shims/expo-crypto.ts',
      'expo-secure-store': './services/server/hub/shims/expo-secure-store.ts',
    },
  },
  // 90 lets the emblem render crisply (see BrandMark); 75 is Next's default for everything else.
  images: { qualities: [75, 90] },
  // Sprint 11 Revision 10.0: npm run build:exe sets KOFC_DESKTOP_BUILD=1 for a self-contained server (.next/standalone)
  // that the Electron shell runs without npm or node_modules. Other builds keep the default output.
  ...(process.env.KOFC_DESKTOP_BUILD === '1' ? { output: 'standalone' as const } : {}),
};

export default config;
