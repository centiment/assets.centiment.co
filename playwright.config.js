/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "scripts/consent/test",
    testMatch: "*.spec.js",
    fullyParallel: true,
    reporter: [["list"]],
    use: {
        browserName: "chromium",
        headless: true,
    },
});
