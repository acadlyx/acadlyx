const targets = [
  {
    name: "backend health",
    url: `${process.env.ACADLYX_API_URL || "https://acadlyx-api.onrender.com"}/api/v1/health`,
    validate: async (response) => {
      const body = await response.json();
      if (body?.success !== true) {
        throw new Error("health endpoint did not return success=true");
      }
    },
  },
  {
    name: "frontend",
    url: process.env.ACADLYX_WEB_URL || "https://acadlyx-orcin.vercel.app/",
    validate: async (response) => {
      const body = await response.text();
      if (!body.includes("__next")) {
        throw new Error("Next.js application marker was not found");
      }
    },
  },
];

const timeoutMs = 20_000;

for (const target of targets) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "ACADLYX-production-smoke/1.0",
        Accept: "text/html,application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await target.validate(response);
    console.log(`PASS ${target.name}: ${response.status} ${target.url}`);
  } catch (error) {
    console.error(`FAIL ${target.name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
