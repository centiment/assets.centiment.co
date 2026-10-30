/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import {
    AdvertisingCookies,
    AllHeldScripts,
    AnalyticsCookies,
    AnalyticsHeldScripts,
    Banner,
    Consent,
    CookieName,
    Cookies,
    EuPage,
    expect,
    Google,
    Held,
    HubSpotConsentCookie,
    LoginCookie,
    OlderPolicyVersion,
    Page,
    Panel,
    SurveyHost,
    SurveyParentDomain,
    Tags,
    test,
    UsPage,
} from "./fixtures/index.js";

const AdvertisingWithdrawnCalls = [
    ["fbq", "consent", "revoke"],
    ["clarity", "consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }],
    ["uetq", "consent", "update", { ad_storage: "denied" }],
    ["oaiq", "consent", false],
];

test.describe("a US visitor", () => {
    test("no banner, everything granted and every held script runs", async ({ page }) => {
        await page.goto(UsPage);
        await Held.waitForRuns(page, AllHeldScripts.length);

        await expect(Banner.get(page)).toHaveCount(0);
        expect(await Held.getRuns(page)).toEqual(AllHeldScripts);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: false, rules: "opt-out" });
    });

    test("a footer link added after load opens the panel too", async ({ page }) => {
        await page.goto(UsPage);
        await page.evaluate(() => {
            const link = document.createElement("a");

            link.href = "#";
            link.textContent = "Cookie settings";
            link.setAttribute("data-action", "cookie-preferences");
            document.body.appendChild(link);
        });
        await page.getByRole("link", { name: "Cookie settings" }).click();

        await expect(Panel.get(page)).toBeVisible();
    });

    test("Advertising off deletes the advertising cookies without a reload, onChange, Tag Manager and HubSpot get the withdrawal, and the next page holds the advertising scripts", async ({ page, context }) => {
        await Page.countLoads(page);
        await context.addCookies(Cookies.getTracking());
        await page.goto(UsPage);
        await Held.waitForRuns(page, AllHeldScripts.length);
        await Consent.recordChanges(page, "advertising");
        await Panel.save(page, { advertising: false });
        await Page.settle(page);

        const names = await Cookies.getNames(context);
        const entries = await Google.getDataLayer(page);

        expect(await Page.getLoadCount(page)).toBe(1);
        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, decided: true });
        expect(await Consent.getRecordedChanges(page)).toEqual([true, false]);
        expect(Google.getConsentCommands(entries, "update")).toEqual([expect.objectContaining({ ad_storage: "denied", analytics_storage: "granted" })]);
        expect(Google.getConsentUpdates(entries)).toEqual([
            { event: "ce_consent_update", ce_analytics: "granted", ce_advertising: "granted" },
            { event: "ce_consent_update", ce_analytics: "granted", ce_advertising: "denied" },
        ]);
        expect(await page.evaluate(() => window._hsp)).toEqual([
            ["setHubSpotConsent", { analytics: true, advertisement: true, functionality: true }],
            ["setHubSpotConsent", { analytics: true, advertisement: false, functionality: true }],
        ]);
        AdvertisingCookies.forEach((name) => expect(names, name).not.toContain(name));
        [...AnalyticsCookies, LoginCookie, HubSpotConsentCookie].forEach((name) => expect(names, name).toContain(name));

        await page.reload();
        await Held.waitForRuns(page, AnalyticsHeldScripts.length);
        await Page.settle(page);

        expect(await Held.getRuns(page)).toEqual(AnalyticsHeldScripts);
    });

    test("Analytics off deletes the analytics cookies and keeps the login cookie and HubSpot's own consent cookie", async ({ page, context }) => {
        await context.addCookies(Cookies.getTracking());
        await page.goto(UsPage);
        await Panel.save(page, { analytics: false });

        const names = await Cookies.getNames(context);

        AnalyticsCookies.forEach((name) => expect(names, name).not.toContain(name));
        [...AdvertisingCookies, LoginCookie, HubSpotConsentCookie].forEach((name) => expect(names, name).toContain(name));
    });
});

test.describe("a stored choice on a later page", () => {
    test("a stored Reject all deletes the tracking cookies left from before, and keeps the login and HubSpot's consent cookie", async ({ page, context }) => {
        await context.addCookies([...Cookies.getTracking(), Cookies.createChoiceCookie({ analytics: false, advertising: false, region: "DE" })]);
        await page.goto(EuPage);

        const names = await Cookies.getNames(context);

        [...AnalyticsCookies, ...AdvertisingCookies].forEach((name) => expect(names, name).not.toContain(name));
        [LoginCookie, HubSpotConsentCookie, CookieName].forEach((name) => expect(names, name).toContain(name));
    });

    test("an undecided European visitor keeps every cookie, tracker.js's included, also with a record that does not apply", async ({ page, context }) => {
        for (const stored of [[], [Cookies.createChoiceCookie({ policy: OlderPolicyVersion, analytics: false, advertising: false })], [Cookies.createChoiceCookie({ method: "gpc", advertising: false, region: "US-CA", gpc: true })]]) {
            await context.clearCookies();
            await context.addCookies([...Cookies.getTracking(), ...stored]);
            await page.goto(EuPage);

            const names = await Cookies.getNames(context);

            [...AnalyticsCookies, ...AdvertisingCookies].forEach((name) => expect(names, name).toContain(name));
        }
    });
});

test.describe("Reject all on a page with tracking cookies from before", () => {
    test("Reject all in the banner deletes the tracking cookies left from before, without a reload", async ({ page, context }) => {
        await Page.countLoads(page);
        await context.addCookies(Cookies.getTracking());
        await page.goto(EuPage);
        await Banner.get(page).getByRole("button", { name: "Reject all" }).click();

        const names = await Cookies.getNames(context);

        expect(await Page.getLoadCount(page)).toBe(1);
        [...AnalyticsCookies, ...AdvertisingCookies].forEach((name) => expect(names, name).not.toContain(name));
        [LoginCookie, HubSpotConsentCookie].forEach((name) => expect(names, name).toContain(name));
    });
});

test.describe("a host outside centiment.co", () => {
    test("Analytics off deletes the vendors' cookies on the host and on its parent domain", async ({ page, context }) => {
        await context.addCookies([
            { name: "_ga", value: "GA1.1.123.456", domain: SurveyParentDomain, path: "/" },
            { name: "_clck", value: "abc", domain: SurveyParentDomain, path: "/" },
            { name: "hubspotutk", value: "abc", domain: SurveyHost, path: "/" },
            { name: "session", value: "abc", domain: SurveyParentDomain, path: "/" },
        ]);
        await page.goto(Page.getUrl({ region: "US-NY", host: SurveyHost }));
        await Panel.save(page, { analytics: false });

        expect((await Cookies.getNames(context)).sort()).toEqual([CookieName, "session"]);
    });
});

test.describe("cookies blocked", () => {
    test("a withdrawal that cannot be saved still applies on the page, also after the page catches up", async ({ page }) => {
        await page.addInitScript(() => {
            const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

            Object.defineProperty(Document.prototype, "cookie", {
                configurable: true,
                get() { return descriptor.get.call(this); },
                set(value) { if (!String(value).startsWith("ce_consent=")) descriptor.set.call(this, value); },
            });
        });
        await page.goto(UsPage);
        await Panel.save(page, { advertising: false });

        expect(await Consent.get(page)).toMatchObject({ advertising: false });

        await Page.focusWindow(page);

        expect(await Consent.get(page)).toMatchObject({ advertising: false });
    });
});

test.describe("the tags already running on the page", () => {
    test("each gets its own consent call when a category is withdrawn, and again when it is allowed back", async ({ page }) => {
        await Tags.stub(page);
        await page.goto(UsPage);
        await Panel.save(page, { analytics: false, advertising: false });

        const withdrawnCalls = await Tags.getCalls(page);

        expect(withdrawnCalls).toEqual([
            ["fbq", "consent", "revoke"],
            ["clarity", "consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }],
            ["uetq", "consent", "update", { ad_storage: "denied" }],
            ["oaiq", "consent", false],
        ]);

        await Panel.save(page, { analytics: true, advertising: true });

        expect((await Tags.getCalls(page)).slice(withdrawnCalls.length)).toEqual([
            ["fbq", "consent", "grant"],
            ["clarity", "consentv2", { ad_Storage: "granted", analytics_Storage: "granted" }],
            ["uetq", "consent", "update", { ad_storage: "granted" }],
            ["oaiq", "consent", true],
        ]);
    });

    test("a tag whose consent call throws does not stop the other tags' calls, and its error still reaches the page", async ({ page }) => {
        const errors = [];

        page.on("pageerror", (error) => errors.push(error.message));
        await Tags.stub(page, { failing: "fbq" });
        await page.goto(UsPage);
        await Panel.save(page, { advertising: false });

        expect(await Tags.getCalls(page)).toEqual(AdvertisingWithdrawnCalls.filter(([tag]) => tag !== "fbq"));
        await expect.poll(() => errors).toEqual(["fbq failed"]);
    });

    test("a HubSpot call that throws does not stop onChange, the cookies going or the other tags' calls, and its error still reaches the page", async ({ page, context }) => {
        const errors = [];

        page.on("pageerror", (error) => errors.push(error.message));
        await Tags.stub(page);
        await context.addCookies(Cookies.getTracking());
        await page.goto(UsPage);
        await page.evaluate(() => {
            window._hsp.push = () => { throw new Error("HubSpot failed"); };
        });
        await Consent.recordChanges(page, "advertising");
        await Panel.save(page, { advertising: false });

        const names = await Cookies.getNames(context);

        expect(await Consent.getRecordedChanges(page)).toEqual([true, false]);
        AdvertisingCookies.forEach((name) => expect(names, name).not.toContain(name));
        expect(await Tags.getCalls(page)).toEqual(AdvertisingWithdrawnCalls);
        await expect.poll(() => errors).toEqual(["HubSpot failed"]);
    });

    test("a dataLayer that throws does not stop the cookies going or the tags' calls", async ({ page, context }) => {
        await Tags.stub(page);
        await context.addCookies(Cookies.getTracking());
        await page.goto(UsPage);
        await page.evaluate(() => {
            window.dataLayer.push = () => { throw new Error("dataLayer failed"); };
        });
        await Panel.save(page, { advertising: false });

        const names = await Cookies.getNames(context);

        AdvertisingCookies.forEach((name) => expect(names, name).not.toContain(name));
        expect(await Tags.getCalls(page)).toEqual(AdvertisingWithdrawnCalls);
    });

    test("a held script release that throws does not stop the cookies going or the tags' calls, and its error still reaches the page", async ({ page, context }) => {
        const errors = [];

        page.on("pageerror", (error) => errors.push(error.message));
        await Tags.stub(page);
        await context.addCookies(Cookies.getTracking());
        await page.goto(UsPage);
        await Held.waitForRuns(page, AllHeldScripts.length);
        await Page.breakSetAttribute(page, "data-consent-released");
        await page.evaluate(() => {
            document.body.insertAdjacentHTML("beforeend", "<script type=\"text/plain\" data-consent=\"analytics\">window.heldRuns.push(\"late\");</script>");
        });
        await Panel.save(page, { advertising: false });

        const names = await Cookies.getNames(context);

        AdvertisingCookies.forEach((name) => expect(names, name).not.toContain(name));
        expect(await Tags.getCalls(page)).toEqual(AdvertisingWithdrawnCalls);
        await expect.poll(() => errors).toEqual(["release failed"]);
    });

    test("consent.js defines no fbq, clarity, uetq or oaiq on a page without those tags", async ({ page }) => {
        await page.goto(UsPage);
        await Panel.save(page, { advertising: false });

        expect(await page.evaluate(() => [typeof window.fbq, typeof window.clarity, typeof window.uetq, typeof window.oaiq])).toEqual(["undefined", "undefined", "undefined", "undefined"]);
    });
});
