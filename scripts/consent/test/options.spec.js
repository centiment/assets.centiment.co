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
    Cookies,
    EuPage,
    expect,
    Google,
    Held,
    Page,
    Panel,
    PrivacyPolicyUrl,
    Requests,
    test,
} from "./fixtures/index.js";

test.describe("banner off", () => {
    test("an EU visitor with a stored Accept is granted, with no banner", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie()]);
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: true });
        await expect(Banner.get(page)).toHaveCount(0);
    });

    test("an undecided EU visitor stays denied, with no banner, and the panel still opens", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));
        await Page.settle(page);

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: false });
        await expect(Banner.get(page)).toHaveCount(0);

        await page.evaluate(() => window.centimentConsent.open());

        await expect(Panel.get(page)).toBeVisible();
    });

    test("a US visitor gets both on, as without the option", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "US-NY", banner: "off" }));

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true });
    });
});

test.describe("HubSpot", () => {
    test("its banner is off and it hears the choice at load and after a decision", async ({ page }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Accept all" }).click();

        expect(await page.evaluate(() => window.disableHubSpotCookieBanner)).toBe(true);
        expect(await page.evaluate(() => window._hsp)).toEqual([
            ["setHubSpotConsent", { analytics: false, advertisement: false, functionality: false }],
            ["setHubSpotConsent", { analytics: true, advertisement: true, functionality: true }],
        ]);
    });
});

test.describe("no Tag Manager", () => {
    test("without data-gtm nothing is requested from Google and the API works at once", async ({ page, requests }) => {
        await page.goto(Page.getUrl({ region: "US-NY", gtm: "" }));
        await Page.settle(page);

        expect(Google.getTagManagerRequests(requests)).toEqual([]);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true });
        expect(await page.evaluate(() => {
            const seenBeforeOnChangeReturns = [];

            window.centimentConsent.onChange((state) => seenBeforeOnChangeReturns.push(state.analytics));

            return seenBeforeOnChangeReturns;
        })).toEqual([true]);
    });

    test("a data-gtm that is not a container id loads no Tag Manager, and the console says why", async ({ page, requests }) => {
        const warnings = Page.getWarnings(page);

        await page.goto(Page.getUrl({ region: "US-NY", gtm: "UA-12345" }));
        await Page.settle(page);

        expect(Google.getTagManagerRequests(requests)).toEqual([]);
        expect(warnings).toEqual([expect.stringContaining('data-gtm="UA-12345"')]);
    });
});

test.describe("Google held until a grant", () => {
    test("in an opt-in region nothing goes to Google before Accept all, url_passthrough is off, and Accept all loads Tag Manager once", async ({ page, requests }) => {
        await page.goto(Page.getUrl({ region: "DE", preconsent: "held" }));
        await Page.settle(page);

        expect(Requests.getForeign(requests)).toEqual([]);
        expect(await Google.getDataLayer(page)).toContainEqual({ gtag: ["set", "url_passthrough", false] });

        await page.getByRole("button", { name: "Accept all" }).click();
        await Google.waitForTagManager(page);

        expect(Google.getTagManagerRequests(requests)).toHaveLength(1);
    });

    test("a dataLayer that throws does not stop Accept all from running the held scripts", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", preconsent: "held" }));
        await page.evaluate(() => {
            window.dataLayer.push = () => { throw new Error("dataLayer failed"); };
        });
        await page.getByRole("button", { name: "Accept all" }).click();
        await Held.waitForRuns(page, AllHeldScripts.length);

        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);
    });

    test("a US visitor gets Tag Manager at once", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "US-NY", preconsent: "held" }));
        await Google.waitForTagManager(page);

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true });
    });
});

test.describe("the tag included twice", () => {
    test("a second copy does nothing, so the page gets one banner, one Tag Manager and an API that takes the choice", async ({ page, requests }) => {
        await page.goto(Page.getUrl({ region: "DE", tagCopies: 2 }));
        await expect.poll(() => Google.getTagManagerRequests(requests).length).toBeGreaterThan(0);
        await Page.settle(page);

        await expect(Banner.get(page)).toHaveCount(1);
        expect(Google.getTagManagerRequests(requests)).toHaveLength(1);
        expect(Google.getConsentCommands(await Google.getDataLayer(page), "default")).toHaveLength(1);

        await Banner.get(page).getByRole("button", { name: "Accept all" }).click();

        await expect(Banner.get(page)).toHaveCount(0);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: true });
    });
});

test.describe("the apps' banner calls", () => {
    test("showBanner shows it to an undecided EU visitor, hideBanner removes it, and a choice in it is saved", async ({ page, context }) => {
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));
        await page.evaluate(() => window.centimentConsent.showBanner());

        await expect(Banner.get(page)).toBeVisible();

        await page.evaluate(() => window.centimentConsent.hideBanner());

        await expect(Banner.get(page)).toHaveCount(0);

        await page.evaluate(() => window.centimentConsent.showBanner());
        await page.getByRole("button", { name: "Accept all" }).click();

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.banner\.11\.DE\.0$/);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: true });
    });

    test("where the panel cannot open, open() sends the visitor to the Privacy policy in a new tab, and a banner the app shows afterwards is still shown", async ({ page }) => {
        await page.addInitScript(() => {
            delete HTMLDialogElement.prototype.showModal;
        });
        await Page.stubWindowOpen(page);
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));
        await expect(page.evaluate(() => window.centimentConsent.open())).resolves.toBeUndefined();
        await Page.settle(page);

        expect(await Page.getWindowOpenCalls(page)).toEqual([[PrivacyPolicyUrl, "_blank", "noopener"]]);

        await page.evaluate(() => window.centimentConsent.showBanner());

        await expect(Banner.get(page)).toBeVisible();
    });

    test("on a phone, a banner that was not showing and that the app shows while the panel is open waits behind it with no room, then shows with its room when the panel closes", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));
        await Page.getFooterLink(page).click();
        await expect(Panel.get(page)).toBeVisible();
        await page.evaluate(() => window.centimentConsent.showBanner());
        await Page.settle(page);

        await expect(page.locator("section.banner")).toHaveAttribute("hidden", "");
        expect(await Banner.getPageRoom(page)).toBe("");
        expect(await Banner.getHeight(page)).toBe("");

        await Panel.get(page).getByRole("button", { name: "Close" }).click();

        await expect(Banner.get(page)).toBeVisible();

        const room = await Banner.getExpectedRoom(page);

        await expect.poll(() => Banner.getPageRoom(page)).toBe(room);
        expect(await Banner.getHeight(page)).toBe(await Banner.getPageRoom(page));
    });

    test("showBanner does nothing for a US visitor or a decided one", async ({ page, context }) => {
        await page.goto(Page.getUrl({ region: "US-NY", banner: "off" }));
        await page.evaluate(() => window.centimentConsent.showBanner());
        await Page.settle(page);

        await expect(Banner.get(page)).toHaveCount(0);

        await context.addCookies([Cookies.createChoiceCookie()]);
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));
        await page.evaluate(() => window.centimentConsent.showBanner());
        await Page.settle(page);

        await expect(Banner.get(page)).toHaveCount(0);
    });
});
