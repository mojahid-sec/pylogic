import { createServer } from 'vite';

async function main() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const mod = (await server.ssrLoadModule('/tests/verify-platform.ts')) as {
      runTests: () => Promise<void>;
    };
    await mod.runTests();
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
