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
    Banner,
    Consent,
    CookieName,
    Cookies,
    EuPage,
    expect,
    Google,
    Held,
    Page,
    Panel,
    PolicyVersion,
    test,
    UsPage,
    WorkerDidNotRun,
} from "./fixtures/index.js";

test.describe("an open page catches up with a choice made elsewhere", () => {
    test("on http, a tab shown again applies a withdrawal from another tab and tells the page, without a reload", async ({ context }) => {
        const first = await context.newPage();

        await Page.controlVisibility(first);
        await Page.countLoads(first);
        await first.goto(UsPage);
        await Held.waitForRuns(first, AllHeldScripts.length);
        await Consent.recordChanges(first, "analytics");
        await Page.setVisibility(first, "hidden");

        const second = await context.newPage();

        await second.goto(UsPage);
        await Panel.save(second, { analytics: false });

        expect(await Consent.get(first)).toMatchObject({ analytics: true, decided: false });

        await Page.setVisibility(first, "visible");

        expect(await Consent.get(first)).toMatchObject({ analytics: false, advertising: true, decided: true });
        expect(await Consent.getRecordedChanges(first)).toEqual([true, false]);
        expect(Google.getConsentCommands(await Google.getDataLayer(first), "update")).toEqual([expect.objectContaining({ analytics_storage: "denied", ad_storage: "granted" })]);
        expect(await Page.getLoadCount(first)).toBe(1);
    });

    test("a window brought back closes its stale panel and drops the banner, and brings the banner back once the choice is gone", async ({ context }) => {
        const first = await context.newPage();

        await first.goto(EuPage);
        await first.getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(first)).toBeVisible();

        const second = await context.newPage();

        await second.goto(EuPage);
        await second.getByRole("button", { name: "Accept all" }).click();
        await Page.focusWindow(first);
        await Held.waitForRuns(first, AllHeldScripts.length);

        await expect(Panel.get(first)).toHaveCount(0);
        await expect(Banner.get(first)).toHaveCount(0);
        expect(await Consent.get(first)).toMatchObject({ analytics: true, advertising: true, decided: true });

        await context.clearCookies({ name: CookieName });
        await Page.focusWindow(first);

        await expect(Banner.get(first)).toBeVisible();
        expect(await Consent.get(first)).toMatchObject({ analytics: false, advertising: false, decided: false });
    });

    test("a tab that chose in its own banner brings the banner back once the choice is gone", async ({ page, context }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Reject all" }).click();
        await expect(Banner.get(page)).toHaveCount(0);

        await context.clearCookies({ name: CookieName });
        await Page.focusWindow(page);

        await expect(Banner.get(page)).toBeVisible();
        expect(await Consent.get(page)).toMatchObject({ decided: false });
    });

    test("a tab shown again sends nothing when its choice still stands, and its next save keeps the other tab's record id", async ({ page, context }) => {
        await Page.controlVisibility(page);
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Accept all" }).click();
        await Page.setVisibility(page, "hidden");
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", region: "DE" })]);
        await Page.setVisibility(page, "visible");

        expect(Google.getConsentCommands(await Google.getDataLayer(page), "update")).toHaveLength(1);

        await Page.getFooterLink(page).click();
        await Panel.get(page).getByRole("button", { name: "Reject all" }).click();

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(new RegExp(String.raw`^1\.k3f9x2q8mz\.${PolicyVersion}\.\d+\.panel\.00\.DE\.0$`));
    });

    test("a page shown again from the back and forward cache catches up", async ({ page, context }) => {
        await page.goto(EuPage);
        await context.addCookies([Cookies.createChoiceCookie({ analytics: false, advertising: false })]);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));

        await expect(Banner.get(page)).toHaveCount(0);
        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true });
    });

    test("a change to GPC alone reaches the app, where the Worker did not run", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", region: "US-CA" })]);
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));
        await Consent.recordChanges(page, "gpc");
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", analytics: true, advertising: false, region: "DE" })]);
        await Page.focusWindow(page);

        expect(await Consent.getRecordedChanges(page)).toEqual([true, false]);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, decided: true, gpc: false });
    });

    test("a refusal stored in a GPC state stops Google on an open page where the Worker did not run", async ({ page, context }) => {
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));
        await context.addCookies([Cookies.createChoiceCookie({ method: "gpc", analytics: false, advertising: false, region: "US-CA", gpc: true })]);
        await Page.focusWindow(page);

        expect(Google.getConsentCommands(await Google.getDataLayer(page), "update")).toEqual([expect.objectContaining({ ce_google_tags: "denied" })]);
    });

    test("on https a tab in the background catches up at once, when the browser reports the change", async ({ context }) => {
        const url = Page.getUrl({ region: "US-NY", https: true });
        const first = await context.newPage();

        await Page.controlVisibility(first);
        await first.goto(url);
        await Held.waitForRuns(first, AllHeldScripts.length);
        await Page.setVisibility(first, "hidden");

        const second = await context.newPage();

        await second.goto(url);
        await Panel.save(second, { analytics: false });
        await first.waitForFunction(() => window.centimentConsent.get().analytics === false);

        expect(await Consent.get(first)).toMatchObject({ analytics: false, advertising: true, decided: true });
        expect(Google.getConsentCommands(await Google.getDataLayer(first), "update")).toEqual([expect.objectContaining({ analytics_storage: "denied" })]);
    });

    test("on https a change the browser reports to another cookie does not make the page read its cookies again", async ({ page }) => {
        await page.addInitScript(() => {
            const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

            window.cookieReads = 0;
            Object.defineProperty(Document.prototype, "cookie", {
                configurable: true,
                get() {
                    window.cookieReads += 1;

                    return descriptor.get.call(this);
                },
                set(value) { descriptor.set.call(this, value); },
            });
        });
        await page.goto(Page.getUrl({ region: "US-NY", https: true }));
        await Page.settle(page);

        const readsBefore = await page.evaluate(() => window.cookieReads);

        // The script's change listener was added first, so it has run by the time this one hears the same change.
        const readsAfter = await page.evaluate(async () => {
            const changeHeard = new Promise((resolve) => {
                window.cookieStore.addEventListener("change", (event) => {
                    if (event.changed.some((cookie) => cookie.name === "_ga")) resolve();
                });
            });

            await window.cookieStore.set("_ga", "GA1.1.123.456");
            await changeHeard;

            return window.cookieReads;
        });

        expect(readsBefore).toBeGreaterThan(0);
        expect(readsAfter).toBe(readsBefore);
    });

    test("on https a choice deleted in another tab brings the banner back at once, with no focus or visibility event", async ({ context }) => {
        const url = Page.getUrl({ region: "DE", https: true });
        const first = await context.newPage();

        await Page.controlVisibility(first);
        await first.goto(url);
        await first.getByRole("button", { name: "Reject all" }).click();
        await expect(Banner.get(first)).toHaveCount(0);
        await Page.setVisibility(first, "hidden");

        const second = await context.newPage();

        await second.goto(url);
        await second.evaluate((name) => window.cookieStore.delete({ name, domain: "centiment.co" }), CookieName);

        await expect(Banner.get(first)).toBeVisible();
        expect(await Consent.get(first)).toMatchObject({ decided: false });
    });
});
