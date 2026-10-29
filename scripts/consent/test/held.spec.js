/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import {
    AllHeldScripts,
    AnalyticsHeldScripts,
    Banner,
    Cookies,
    EuPage,
    expect,
    Held,
    Page,
    Panel,
    test,
    UsPage,
} from "./fixtures/index.js";

test.describe("held scripts after a stored choice", () => {
    test("the held scripts are released in order, with their attributes", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie()]);
        await page.goto(EuPage);
        await Held.waitForRuns(page, AllHeldScripts.length);

        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);

        const released = await page.evaluate(() => {
            const real = document.getElementById("held-ads");

            return {
                type: real.getAttribute("type"),
                src: real.getAttribute("src"),
                vendor: real.getAttribute("data-vendor"),
                crossorigin: real.getAttribute("crossorigin"),
                count: document.querySelectorAll("#held-ads").length,
            };
        });

        expect(released).toEqual({ type: null, src: "/held/advertising-body-external.js", vendor: "fixture", crossorigin: "anonymous", count: 1 });
    });

    test("a tag loaded without defer, which runs before any held script is parsed, still releases them all, in order", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie()]);
        await page.goto(Page.getUrl({ region: "DE", defer: false }));
        await Held.waitForRuns(page, AllHeldScripts.length);

        await expect(Page.getConsentTag(page)).not.toHaveAttribute("defer");
        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);
    });
});

test.describe("a held script removed before its turn", () => {
    test("the scripts after it still run, and no error reaches the page", async ({ page }) => {
        const errors = [];
        const remainingScripts = AllHeldScripts.filter((name) => name !== "advertising-body-external");

        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript(() => {
            window.addEventListener("DOMContentLoaded", () => document.getElementById("held-ads").remove());
        });
        await page.goto(UsPage);
        await Held.waitForRuns(page, remainingScripts.length);
        await Page.settle(page);

        expect(await Held.getRuns(page)).toEqual(remainingScripts);
        expect(errors).toEqual([]);
    });
});

test.describe("a held script whose release fails", () => {
    test("does not stop the ones after it, and its error reaches the page", async ({ page }) => {
        const errors = [];
        const expectedRuns = [...AllHeldScripts, "after-broken"];

        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(UsPage);
        await Held.waitForRuns(page, AllHeldScripts.length);
        await Page.breakSetAttribute(page, "data-broken");
        await page.evaluate(() => {
            document.body.insertAdjacentHTML("beforeend", [
                "<script type=\"text/plain\" data-consent=\"analytics\" data-broken>window.heldRuns.push(\"broken\");</script>",
                "<script type=\"text/plain\" data-consent=\"analytics\">window.heldRuns.push(\"after-broken\");</script>",
            ].join(""));
        });
        await Panel.save(page, { advertising: false });
        await Held.waitForRuns(page, expectedRuns.length);

        expect(await Held.getRuns(page)).toEqual(expectedRuns);
        await expect.poll(() => errors).toEqual(["release failed"]);
    });

    test("as the page loads, does not stop the footer link opening the panel, and its error reaches the page", async ({ page }) => {
        const errors = [];

        page.on("pageerror", (error) => errors.push(error.message));
        await Page.breakSetAttributeBeforeLoad(page, "data-consent-released");
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page)).toBeVisible();
        await expect.poll(() => errors).toContain("release failed");
    });
});

test.describe("a held script with a category other than analytics or advertising", () => {
    test("never runs, and the console says why", async ({ page }) => {
        const warnings = Page.getWarnings(page);

        await page.addInitScript(() => {
            document.addEventListener("DOMContentLoaded", () => {
                document.body.insertAdjacentHTML("beforeend", "<script type=\"text/plain\" data-consent=\"marketing\">window.heldRuns = (window.heldRuns || []).concat(\"marketing\");</script>");
            });
        });
        await page.goto(UsPage);
        await Held.waitForRuns(page, AllHeldScripts.length);
        await Page.settle(page);

        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);
        expect(warnings).toEqual([expect.stringContaining('data-consent="marketing"')]);
    });
});

test.describe("a held script the browser skips", () => {
    test("a nomodule script does not hold back the scripts after it", async ({ page }) => {
        const expectedRuns = [...AllHeldScripts, "after-nomodule"];

        await page.goto(EuPage);
        await page.evaluate(() => {
            document.body.insertAdjacentHTML("beforeend", [
                "<script type=\"text/plain\" data-consent=\"analytics\" data-src=\"/held/nomodule-external.js\" nomodule></script>",
                "<script type=\"text/plain\" data-consent=\"analytics\">window.heldRuns = (window.heldRuns || []).concat(\"after-nomodule\");</script>",
            ].join(""));
        });
        await Banner.get(page).getByRole("button", { name: "Accept all" }).click();
        await Held.waitForRuns(page, expectedRuns.length);

        expect(await Held.getRuns(page)).toEqual(expectedRuns);
    });
});

test.describe("a held script still waiting when its category is withdrawn", () => {
    test("does not run, and runs after a later grant", async ({ page }) => {
        const { promise: firstAllowed, resolve: allowFirst } = Promise.withResolvers();

        await page.route("**/held/analytics-head-external.js", async (route) => {
            await firstAllowed;
            await route.fallback();
        });
        await page.goto(UsPage, { waitUntil: "domcontentloaded" });
        await Panel.save(page, { advertising: false });
        allowFirst();
        await Held.waitForRuns(page, AnalyticsHeldScripts.length);
        await Page.settle(page);

        expect(await Held.getRuns(page)).toEqual(AnalyticsHeldScripts);

        await Panel.save(page, { advertising: true });
        await Held.waitForRuns(page, AllHeldScripts.length);

        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);
    });
});
