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
const maxAttempts = 30;
const retryDelayMs = 10_000;

async function verifyTarget(target) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(target.url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "ACADLYX-production-smoke/1.1",
          Accept: "text/html,application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await target.validate(response);
      console.log(`PASS ${target.name}: ${response.status} ${target.url} (attempt ${attempt}/${maxAttempts})`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `RETRY ${target.name}: ${lastError.message} (attempt ${attempt}/${maxAttempts})`,
      );

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `${target.name} failed after ${maxAttempts} attempts: ${lastError?.message || "unknown error"}`,
  );
}

let failed = false;

for (const target of targets) {
  try {
    await verifyTarget(target);
  } catch (error) {
    failed = true;
    console.error(
      `FAIL ${target.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failed) {
  process.exit(1);
}
