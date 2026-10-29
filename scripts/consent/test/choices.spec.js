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
    CaliforniaPage,
    Consent,
    Cookies,
    EuPage,
    expect,
    Google,
    Held,
    Page,
    Panel,
    PolicyVersion,
    PrivacyPolicyUrl,
    Requests,
    TagManagerHost,
    test,
    UsPage,
} from "./fixtures/index.js";

test.describe("opt-in choices", () => {
    test("Reject all denies both", async ({ page, context }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Reject all" }).click();

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(new RegExp(String.raw`^1\.[a-z0-9]+\.${PolicyVersion}\.\d+\.banner\.00\.DE\.0$`));
    });

    test("with GPC on the banner shows, and Accept all grants both and stores no GPC, which does not apply here", async ({ page, context }) => {
        await Page.withGpc(page);
        await page.goto(EuPage);
        await expect(Banner.get(page)).toBeVisible();
        await page.getByRole("button", { name: "Accept all" }).click();

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: true, gpc: false });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.banner\.11\.DE\.0$/);
    });
});

test.describe("an EU visitor before a choice", () => {
    test("defaults go out denied before Tag Manager, and HubSpot is already told when Tag Manager runs", async ({ page }) => {
        await page.goto(EuPage);
        await Google.waitForTagManager(page);

        const entries = await Google.getDataLayer(page);
        const defaults = Google.getConsentCommands(entries, "default");

        expect(defaults).toEqual([{
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
            analytics_storage: "denied",
            functionality_storage: "granted",
            security_storage: "granted",
            ce_google_tags: "granted",
        }]);
        expect(Google.getConsentCommandIndex(entries, "default")).toBeLessThan(Google.getEventIndex(entries, "gtm.js"));
        expect(entries).toContainEqual({ gtag: ["set", "ads_data_redaction", true] });
        expect(entries).toContainEqual({ gtag: ["set", "url_passthrough", true] });
        expect(Google.getConsentUpdates(entries)).toEqual([]);

        const saw = await page.evaluate(() => window.tagManagerSaw);

        expect(saw.hubSpot).toEqual([["setHubSpotConsent", { analytics: false, advertisement: false, functionality: false }]]);
        expect(await page.evaluate(() => window.disableHubSpotCookieBanner)).toBe(true);
    });

    test("an event the page pushed before the script ran moves behind the defaults, so Tag Manager reads the consent state first", async ({ page }) => {
        await page.addInitScript(() => {
            window.dataLayer = [{ event: "page_early" }];
        });
        await page.goto(EuPage);
        await Google.waitForTagManager(page);

        const entries = await Google.getDataLayer(page);

        expect(Google.getConsentCommandIndex(entries, "default")).toBe(0);
        expect(Google.getEventIndex(entries, "page_early")).toBeGreaterThan(0);
        expect(Google.getEventIndex(entries, "page_early")).toBeLessThan(Google.getEventIndex(entries, "gtm.js"));
    });

    test("with Tag Manager already on the page, an event the page pushed earlier stays first and is not pushed again, and the console warns", async ({ page }) => {
        const warnings = Page.getWarnings(page);

        await page.addInitScript(() => {
            window.google_tag_manager = {};
            window.dataLayer = [{ event: "page_early" }];
        });
        await page.goto(EuPage);
        await Google.waitForTagManager(page);

        const entries = await Google.getDataLayer(page);

        expect(Google.getEventIndex(entries, "page_early")).toBe(0);
        expect(entries.filter((entry) => entry.event === "page_early")).toHaveLength(1);
        expect(warnings).toEqual([expect.stringContaining("already runs on this page")]);
    });

    test("Tag Manager throwing as it is put in does not stop the banner, and its error reaches the page", async ({ page }) => {
        const errors = [];

        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript((tagManagerHost) => {
            const descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");

            Object.defineProperty(HTMLScriptElement.prototype, "src", {
                configurable: true,
                get() { return descriptor.get.call(this); },
                set(value) {
                    if (String(value).startsWith(`https://${tagManagerHost}/`)) throw new Error("Tag Manager failed");

                    descriptor.set.call(this, value);
                },
            });
        }, TagManagerHost);
        await page.goto(EuPage);

        await expect(Banner.get(page)).toBeVisible();
        await expect.poll(() => errors).toEqual(["Tag Manager failed"]);
    });

    test("only Tag Manager is requested, no cookie is set and no held script runs", async ({ page, context, requests }) => {
        await page.goto(EuPage);
        await Page.settle(page);

        expect(Requests.getForeign(requests).map((url) => url.hostname)).toEqual([TagManagerHost]);
        expect(await context.cookies()).toEqual([]);
        expect(await Held.getRuns(page)).toEqual([]);
    });

    test("the banner offers Reject all and Accept all in the same filled style, at the same size", async ({ page }) => {
        await page.goto(EuPage);

        const reject = page.getByRole("button", { name: "Reject all" });
        const accept = page.getByRole("button", { name: "Accept all" });
        const rejectBox = await reject.boundingBox();
        const acceptBox = await accept.boundingBox();

        expect(rejectBox.width).toBe(acceptBox.width);
        expect(rejectBox.height).toBe(acceptBox.height);

        for (const button of [reject, accept]) {
            await expect(button).toHaveCSS("background-color", "rgb(78, 90, 249)");
            await expect(button).toHaveCSS("color", "rgb(255, 255, 255)");
        }

        await expect(Banner.get(page).getByRole("button", { name: "Choose cookies" })).toBeVisible();
    });

    test("with the tag loaded without defer, which runs before the page has a body, the banner still shows", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", defer: false }));

        await expect(Page.getConsentTag(page)).not.toHaveAttribute("defer");
        await expect(Banner.get(page)).toBeVisible();
    });
});

test.describe("the banner's text", () => {
    test("two sentences with their periods, then Choose cookies or see our Privacy policy, with no period at the end", async ({ page }) => {
        await page.goto(EuPage);

        await expect(Banner.get(page).locator(".text")).toHaveText("We use analytics and advertising cookies only if you allow them. Necessary cookies keep the site working. Choose cookies or see our Privacy policy");
    });
});

test.describe("room for the banner", () => {
    test("on a phone, while the banner shows, the page gets the room it takes, which stays while the panel is open, goes after a choice, and never comes in the US", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(EuPage);

        const room = await Banner.getExpectedRoom(page);

        await expect.poll(() => Banner.getPageRoom(page)).toBe(room);

        await page.getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(page)).toBeVisible();
        await Page.settle(page);

        expect(await Banner.getPageRoom(page)).toBe(room);

        await page.keyboard.press("Escape");

        await expect(Panel.get(page)).toHaveCount(0);
        expect(await Banner.getPageRoom(page)).toBe(room);

        await page.getByRole("button", { name: "Accept all" }).click();

        await expect.poll(() => Banner.getPageRoom(page)).toBe("");

        await page.goto(UsPage);
        await Page.settle(page);

        expect(await Banner.getPageRoom(page)).toBe("");
    });

    test("on a wider screen the corner card leaves no room, and the room comes and goes as the screen crosses a phone's 480 pixels", async ({ page }) => {
        await page.goto(EuPage);
        await expect(Banner.get(page)).toBeVisible();
        await Page.settle(page);

        expect(await Banner.getPageRoom(page)).toBe("");

        await page.setViewportSize({ width: 479, height: 812 });

        await expect.poll(() => Banner.getPageRoom(page)).not.toBe("");
        expect(await Banner.getPageRoom(page)).toBe(await Banner.getExpectedRoom(page));

        await page.setViewportSize({ width: 480, height: 812 });

        await expect.poll(() => Banner.getPageRoom(page)).toBe("");

        await page.setViewportSize({ width: 432, height: 812 });

        await expect.poll(() => Banner.getPageRoom(page)).not.toBe("");
    });

    test("a phone on its side gets the banner across its width with the room it takes, and a taller screen of that width gets the corner card with none", async ({ page }) => {
        await page.setViewportSize({ width: 812, height: 375 });
        await page.goto(EuPage);
        await expect(Banner.get(page)).toBeVisible();
        await expect.poll(() => Banner.getPageRoom(page)).not.toBe("");

        const box = await Banner.get(page).boundingBox();

        expect(box.width).toBe(812 - 32);
        expect(await Banner.getPageRoom(page)).toBe(await Banner.getExpectedRoom(page));

        await page.setViewportSize({ width: 812, height: 500 });

        await expect.poll(() => Banner.getPageRoom(page)).toBe("");
        expect((await Banner.get(page).boundingBox()).width).toBe(400);
    });

    test("the banner height is set beside the corner card too, stays while the panel is open, matches the room on a phone, and goes after a choice", async ({ page }) => {
        await page.goto(EuPage);

        const height = await Banner.getExpectedRoom(page);

        await expect.poll(() => Banner.getHeight(page)).toBe(height);
        expect(await Banner.getPageRoom(page)).toBe("");

        await page.getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(page)).toBeVisible();
        await Page.settle(page);

        expect(await Banner.getHeight(page)).toBe(height);

        await page.keyboard.press("Escape");
        await expect(Panel.get(page)).toHaveCount(0);
        await page.setViewportSize({ width: 375, height: 812 });

        await expect.poll(() => Banner.getPageRoom(page)).not.toBe("");
        expect(await Banner.getHeight(page)).toBe(await Banner.getPageRoom(page));

        await page.getByRole("button", { name: "Accept all" }).click();

        await expect.poll(() => Banner.getHeight(page)).toBe("");
        expect(await Banner.getPageRoom(page)).toBe("");
    });

    test("on a phone, a page padded by the room scrolls its last control above the banner, and the room follows a font change and a narrower screen", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(Page.getUrl({ region: "DE", css: "room" }));
        await expect(Banner.get(page)).toBeVisible();
        await expect.poll(() => Banner.getPageRoom(page)).not.toBe("");
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

        const footer = await page.locator("footer").boundingBox();

        // Scrolling stops on a whole pixel, so the page's fractional height can leave its end up to a pixel lower.
        expect(footer.y + footer.height).toBeLessThan((await Banner.get(page).boundingBox()).y + 1);

        const before = await Banner.getPageRoom(page);

        await page.evaluate(() => {
            document.body.style.fontFamily = "monospace";
        });

        await expect.poll(() => Banner.getPageRoom(page)).not.toBe(before);
        expect(await Banner.getPageRoom(page)).toBe(await Banner.getExpectedRoom(page));

        const wide = await Banner.getPageRoom(page);

        await page.setViewportSize({ width: 280, height: 812 });

        await expect.poll(() => Banner.getPageRoom(page)).not.toBe(wide);
        expect(await Banner.getPageRoom(page)).toBe(await Banner.getExpectedRoom(page));
    });
});

test.describe("Accept all", () => {
    test("grants both once, runs every held script once in order and keeps it on the next page", async ({ page }) => {
        await page.goto(EuPage);
        await Page.settle(page);
        await page.getByRole("button", { name: "Accept all" }).click();
        await expect(Banner.get(page)).toHaveCount(0);
        await Held.waitForRuns(page, AllHeldScripts.length);
        await Page.settle(page);

        const entries = await Google.getDataLayer(page);

        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);
        expect(Google.getConsentCommands(entries, "update")).toEqual([expect.objectContaining({ ad_storage: "granted", analytics_storage: "granted", ce_google_tags: "granted" })]);
        expect(Google.getConsentUpdates(entries)).toEqual([{ event: "ce_consent_update", ce_analytics: "granted", ce_advertising: "granted" }]);

        await page.reload();
        await Google.waitForTagManager(page);

        const next = await Google.getDataLayer(page);

        await expect(Banner.get(page)).toHaveCount(0);
        expect(Google.getConsentUpdates(next)).toEqual([{ event: "ce_consent_update", ce_analytics: "granted", ce_advertising: "granted" }]);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: true });
        expect(Google.getEventIndex(next, "ce_consent_update")).toBeLessThan(Google.getEventIndex(next, "gtm.js"));
    });
});

test.describe("Reject all", () => {
    test("denies both, runs no held script, keeps it on the next page and sends nothing to Google there", async ({ page, requests }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Reject all" }).click();
        await Page.settle(page);

        const entries = await Google.getDataLayer(page);

        expect(await Held.getRuns(page)).toEqual([]);
        expect(Google.getConsentCommands(entries, "update")).toEqual([expect.objectContaining({ ad_storage: "denied", analytics_storage: "denied", ce_google_tags: "denied" })]);
        expect(Google.getConsentUpdates(entries)).toEqual([{ event: "ce_consent_update", ce_analytics: "denied", ce_advertising: "denied" }]);

        requests.length = 0;
        await page.reload();
        await Page.settle(page);

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true });
        await expect(Banner.get(page)).toHaveCount(0);
        expect(Google.getTagManagerRequests(requests)).toEqual([]);
        expect(Google.getConsentCommands(await Google.getDataLayer(page), "default")).toEqual([expect.objectContaining({ ce_google_tags: "denied" })]);
    });

    test("a later Accept all in the panel loads Tag Manager once", async ({ page, requests }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Reject all" }).click();
        await page.reload();
        await Page.settle(page);
        requests.length = 0;

        await Page.getFooterLink(page).click();
        await Panel.get(page).getByRole("button", { name: "Accept all" }).click();
        await Google.waitForTagManager(page);

        expect(Google.getTagManagerRequests(requests)).toHaveLength(1);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true });
    });
});

test.describe("Choose cookies", () => {
    test("Analytics on, Advertising off and Save runs only the analytics scripts", async ({ page }) => {
        await page.goto(EuPage);
        await Page.settle(page);
        await page.getByRole("button", { name: "Choose cookies" }).click();
        await Panel.get(page).getByRole("switch", { name: "Analytics" }).check();
        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).not.toBeChecked();
        await Panel.get(page).getByRole("button", { name: "Save choices" }).click();
        await Held.waitForRuns(page, AnalyticsHeldScripts.length);
        await Page.settle(page);

        expect(await Held.getRuns(page)).toEqual(AnalyticsHeldScripts);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, decided: true });
        await expect(Panel.get(page)).toHaveCount(0);
        await expect(Banner.get(page)).toHaveCount(0);
    });

    test("the banner hides while the panel is open, and closing the panel returns to it", async ({ page }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(page)).toBeVisible();
        await expect(Banner.get(page)).toHaveCount(0);
        await page.keyboard.press("Escape");

        await expect(Panel.get(page)).toHaveCount(0);
        await expect(Banner.get(page)).toBeVisible();

        await page.getByRole("button", { name: "Choose cookies" }).click();
        await Panel.get(page).getByRole("button", { name: "Close" }).click();

        await expect(Panel.get(page)).toHaveCount(0);
        await expect(Banner.get(page)).toBeVisible();
        expect((await Consent.get(page)).decided).toBe(false);
    });

    test("where the panel cannot open, Choose cookies opens the Privacy policy in a new tab, and the banner stays with its buttons working", async ({ page }) => {
        await page.addInitScript(() => {
            delete HTMLDialogElement.prototype.showModal;
        });
        await Page.stubWindowOpen(page);
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Choose cookies" }).click();
        await Page.settle(page);

        expect(await Page.getWindowOpenCalls(page)).toEqual([[PrivacyPolicyUrl, "_blank", "noopener"]]);
        await expect(Banner.get(page)).toBeVisible();

        await Banner.get(page).getByRole("button", { name: "Reject all" }).click();

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true });
    });
});

test.describe("the API around a decision", () => {
    test("get and onChange report the state before and after a decision, and the window event fires once", async ({ page }) => {
        await Consent.recordChangeEventsBeforeLoad(page);
        await page.goto(EuPage);
        await Consent.recordChanges(page);

        expect(await Consent.get(page)).toEqual({ analytics: false, advertising: false, decided: false, rules: "opt-in", region: "DE", gpc: false });

        await page.getByRole("button", { name: "Accept all" }).click();

        const after = { analytics: true, advertising: true, decided: true, rules: "opt-in", region: "DE", gpc: false };

        expect(await Consent.get(page)).toEqual(after);
        expect(await Consent.getRecordedChanges(page)).toEqual([expect.objectContaining({ decided: false }), after]);
        expect(await Consent.getRecordedChangeEvents(page)).toEqual([after]);
    });

    test("the function onChange returns unsubscribes, so a decision after it does not call the callback", async ({ page }) => {
        await page.goto(EuPage);
        await Consent.recordChanges(page, "decided");
        await Consent.stopRecordingChanges(page);
        await page.getByRole("button", { name: "Accept all" }).click();

        expect(await Consent.get(page)).toMatchObject({ decided: true });
        expect(await Consent.getRecordedChanges(page)).toEqual([false]);
    });
});

test.describe("as a page loads", () => {
    test("under the opt-out rules with nothing stored, ce_consent_update goes out once with both granted, before Tag Manager", async ({ page }) => {
        await page.goto(UsPage);
        await Google.waitForTagManager(page);

        const entries = await Google.getDataLayer(page);

        expect(Google.getConsentUpdates(entries)).toEqual([{ event: "ce_consent_update", ce_analytics: "granted", ce_advertising: "granted" }]);
        expect(Google.getEventIndex(entries, "ce_consent_update")).toBeLessThan(Google.getEventIndex(entries, "gtm.js"));
    });

    test("in California with GPC, ce_consent_update goes out with advertising denied", async ({ page }) => {
        await Page.withGpc(page);
        await page.goto(CaliforniaPage);
        await Google.waitForTagManager(page);

        expect(Google.getConsentUpdates(await Google.getDataLayer(page))).toEqual([{ event: "ce_consent_update", ce_analytics: "granted", ce_advertising: "denied" }]);
    });

    test("the window event ce_consent_change does not fire as the page loads, with or without a stored choice", async ({ page, context }) => {
        await Consent.recordChangeEventsBeforeLoad(page);
        await page.goto(UsPage);
        await Page.settle(page);

        expect(await Consent.getRecordedChangeEvents(page)).toEqual([]);

        await context.addCookies([Cookies.createChoiceCookie()]);
        await page.goto(EuPage);
        await Page.settle(page);

        expect(await Consent.getRecordedChangeEvents(page)).toEqual([]);
    });
});
