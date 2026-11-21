import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    // page.route() mocks must observe every API request; a registered app
    // service worker could bypass those mocks and send fake test tokens to CI's API.
    serviceWorkers: "block",
  },
});
