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
    AnalyticsCookies,
    Banner,
    CaliforniaPage,
    Consent,
    Cookies,
    DaySeconds,
    EuPage,
    expect,
    Google,
    Held,
    LoginCookie,
    MalformedRecords,
    OlderPolicyVersion,
    Page,
    Panel,
    Requests,
    SurveyHost,
    test,
    UsPage,
    WorkerDidNotRun,
    YearSeconds,
} from "./fixtures/index.js";

test.describe("the stored record", () => {
    test("a record for the current policy applies, with no banner", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ analytics: true, advertising: false })]);
        await page.goto(EuPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, decided: true });
        await expect(Banner.get(page)).toHaveCount(0);
    });

    test("a record for an older policy asks again in an opt-in region", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ policy: OlderPolicyVersion })]);
        await page.goto(EuPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: false });
        await expect(Banner.get(page)).toBeVisible();
    });

    test("a record for an older policy still applies in an opt-out region, where nobody is asked", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ policy: OlderPolicyVersion, method: "panel", analytics: false, advertising: false, region: "US-NY" })]);
        await page.goto(UsPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true });
    });

    test("a malformed record is no choice", async ({ page, context }) => {
        for (const [name, value] of Object.entries(MalformedRecords)) {
            await context.clearCookies();
            await context.addCookies([{ ...Cookies.createChoiceCookie(), value }]);
            await page.goto(EuPage);

            expect((await Consent.get(page)).decided, name).toBe(false);
            await expect(Banner.get(page), name).toBeVisible();
        }
    });

    test("when the Worker did not run, the record's stored region decides GPC", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, gpc: true, region: null });
    });

    test("when the Worker did not run, a choice saved there keeps the stored region", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));
        await Panel.save(page, { advertising: false });

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.panel\.10\.US-CA\.1$/);
    });

    test("where the Worker placed a region, a saved choice stores that fresh region", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ policy: OlderPolicyVersion, region: "US-CA" })]);
        await page.goto(EuPage);
        await Banner.get(page).getByRole("button", { name: "Accept all" }).click();

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.banner\.11\.DE\.0$/);
    });

    test("where Cloudflare could not place the visitor, the stored region decides GPC and the gpc record keeps it", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(Page.getUrl({ region: "XX" }));

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, gpc: true, rules: "opt-out" });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.10\.US-CA\.1$/);
    });

    test("where Cloudflare placed the visitor in the US without a state, the stored region decides GPC and the gpc record keeps it", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(Page.getUrl({ region: "US" }));

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, gpc: true, rules: "opt-out", region: "US" });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.10\.US-CA\.1$/);
    });

    test("when the Worker did not run, Accept all in the banner leaves advertising off for a GPC visitor stored in a GPC state", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ method: "gpc", advertising: false, region: "US-CA", gpc: true })]);
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));
        await Banner.get(page).getByRole("button", { name: "Accept all" }).click();

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, decided: true, gpc: true });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.banner\.11\.US-CA\.1$/);

        await page.reload();

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, gpc: true });
    });
});

test.describe("GPC over a stored choice", () => {
    test("a stored advertising yes made without GPC turns off under GPC in a listed state, and the record is rewritten", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(CaliforniaPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: false, gpc: true });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.10\.US-CA\.1$/);
    });

    test("GPC turning advertising off as the page starts deletes the advertising cookies and keeps the analytics ones", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([...Cookies.getTracking(), Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(CaliforniaPage);

        const names = await Cookies.getNames(context);

        AdvertisingCookies.forEach((name) => expect(names, name).not.toContain(name));
        [...AnalyticsCookies, LoginCookie].forEach((name) => expect(names, name).toContain(name));
    });

    test("a first GPC visit in a listed state, with no stored choice, deletes the advertising cookies left from before", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies(Cookies.getTracking());
        await page.goto(CaliforniaPage);

        const names = await Cookies.getNames(context);

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.10\.US-CA\.1$/);
        AdvertisingCookies.forEach((name) => expect(names, name).not.toContain(name));
        [...AnalyticsCookies, LoginCookie].forEach((name) => expect(names, name).toContain(name));
    });

    test("an http page that cannot see a Secure choice cookie leaves the advertising cookies alone", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([...Cookies.getTracking(), { ...Cookies.createChoiceCookie({ method: "panel", region: "US-CA", gpc: true }), secure: true }]);
        await page.goto(CaliforniaPage);

        const names = await Cookies.getNames(context);

        expect(await Consent.get(page)).toMatchObject({ advertising: false, gpc: true });
        AdvertisingCookies.forEach((name) => expect(names, name).toContain(name));
    });

    test("a first GPC visit in a listed state saves a gpc record that keeps advertising off on a later page in a listed state without GPC", async ({ page, context }) => {
        await Page.withGpc(page);
        await page.goto(Page.getUrl({ region: "US-TX" }));

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.10\.US-TX\.1$/);

        const plain = await context.newPage();

        await plain.goto(Page.getUrl({ region: "US-TX" }));

        expect(await Consent.get(plain)).toMatchObject({ analytics: true, advertising: false, decided: false, gpc: false });
    });

    test("a gpc record saved in a listed state turns advertising back on outside the GPC states, keeps the advertising cookies, and stays stored", async ({ page, context }) => {
        await context.addCookies([...Cookies.getTracking(), Cookies.createChoiceCookie({ method: "gpc", advertising: false, region: "US-CA", gpc: true })]);
        await page.goto(UsPage);

        const names = await Cookies.getNames(context);

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, decided: false, gpc: false });
        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.10\.US-CA\.1$/);
        AdvertisingCookies.forEach((name) => expect(names, name).toContain(name));
    });

    test("a choice made in the panel while GPC is on stands on the next page", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", region: "US-CA", gpc: true })]);
        await page.goto(CaliforniaPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, gpc: true, decided: true });
    });
});

test.describe("Analytics off and GPC's advertising off", () => {
    const AnalyticsOffRecord = Cookies.createChoiceCookie({ method: "panel", analytics: false, advertising: true, region: "US-CA" });

    test("count as Reject all in the GPC states, so Google gets nothing on this page or the next", async ({ page, context, requests }) => {
        await Page.withGpc(page);
        await context.addCookies([AnalyticsOffRecord]);
        await page.goto(CaliforniaPage);
        await page.reload();
        await Page.settle(page);

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.gpc\.00\.US-CA\.1$/);
        expect(Google.getConsentCommands(await Google.getDataLayer(page), "default")).toEqual([expect.objectContaining({ ce_google_tags: "denied" })]);
        expect(Google.getTagManagerRequests(requests)).toEqual([]);
    });

    test("outside the GPC states keep Google's tags on, with Analytics off and advertising back on", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([AnalyticsOffRecord]);
        await page.goto(CaliforniaPage);
        await page.goto(UsPage);
        await Google.waitForTagManager(page);

        expect(Google.getConsentCommands(await Google.getDataLayer(page), "default")).toEqual([expect.objectContaining({ ce_google_tags: "granted", analytics_storage: "denied", ad_storage: "granted" })]);
    });
});

test.describe("the choice cookie", () => {
    test("on a centiment.co host it is set on .centiment.co for 12 months", async ({ page, context }) => {
        await page.goto(EuPage);
        await page.getByRole("button", { name: "Accept all" }).click();

        const cookie = await Cookies.getChoiceCookie(context);
        const now = Date.now() / 1000;

        expect(cookie).toMatchObject({ domain: ".centiment.co", path: "/", secure: false, sameSite: "Lax" });
        expect(cookie.expires).toBeGreaterThan(now + YearSeconds - 60);
        expect(cookie.expires).toBeLessThan(now + YearSeconds + 60);
    });

    test("each page writes it again with what is left of its 12 months, so Safari's seven-day limit on script cookies starts over", async ({ page, context }) => {
        const now = Math.floor(Date.now() / 1000);
        const decidedAt = now - 30 * DaySeconds;

        await context.addCookies([{ ...Cookies.createChoiceCookie({ decidedAt }), expires: now + 7 * DaySeconds }]);
        await page.goto(EuPage);

        const cookie = await Cookies.getChoiceCookie(context);

        expect(cookie.value).toBe(Cookies.createChoiceCookie({ decidedAt }).value);
        expect(cookie.expires).toBeGreaterThan(decidedAt + YearSeconds - 60);
        expect(cookie.expires).toBeLessThan(decidedAt + YearSeconds + 60);
    });

    test("a choice dated ahead of the clock is written again for 12 months from now, never more", async ({ page, context }) => {
        const now = Math.floor(Date.now() / 1000);

        await context.addCookies([Cookies.createChoiceCookie({ decidedAt: now + 30 * DaySeconds })]);
        await page.goto(EuPage);

        const cookie = await Cookies.getChoiceCookie(context);

        expect(cookie.expires).toBeGreaterThan(now + YearSeconds - 60);
        expect(cookie.expires).toBeLessThan(now + YearSeconds + 60);
    });

    test("on https it is Secure", async ({ page, context }) => {
        await page.goto(Page.getUrl({ region: "DE", https: true }));
        await page.getByRole("button", { name: "Accept all" }).click();

        expect(await Cookies.getChoiceCookie(context)).toMatchObject({ domain: ".centiment.co", secure: true });
    });

    test("on a host outside centiment.co it is host-only", async ({ page, context }) => {
        await page.goto(Page.getUrl({ region: "DE", host: SurveyHost }));
        await page.getByRole("button", { name: "Accept all" }).click();

        expect(await Cookies.getChoiceCookie(context)).toMatchObject({ domain: SurveyHost });
    });
});

test.describe("consent.js does not load or does not start", () => {
    test("when consent.js does not load, a page installed as the README says requests no tracker and never loads Tag Manager", async ({ page, requests }) => {
        await page.route("**/scripts/consent/v1/consent.js*", (route) => route.abort());
        await page.goto(UsPage);
        await Page.settle(page);

        expect(Requests.getForeign(requests)).toEqual([]);
        expect(await Held.getRuns(page)).toEqual([]);
        expect(await page.evaluate(() => window.tagManagerRuns)).toBeUndefined();
    });

    test("a failed start leaves an API that allows nothing, and Tag Manager never loads", async ({ page, requests }) => {
        await page.addInitScript(() => {
            Object.defineProperty(Document.prototype, "cookie", { configurable: true, get() { throw new Error("cookies unavailable"); }, set() {} });
        });
        await page.goto(UsPage);
        await Page.settle(page);

        expect(await Consent.get(page)).toEqual({ analytics: false, advertising: false, decided: false, rules: "opt-in", region: null, gpc: false });

        await Consent.recordChanges(page, "analytics");
        await page.evaluate(() => {
            window.centimentConsent.open();
            window.centimentConsent.showBanner();
        });

        expect(await Consent.getRecordedChanges(page)).toEqual([false]);
        expect(Requests.getForeign(requests)).toEqual([]);
    });
});

test.describe("one choice across hosts", () => {
    test("a choice on www applies on try", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", host: "www.centiment.co" }));
        await page.getByRole("button", { name: "Reject all" }).click();
        await page.goto(Page.getUrl({ region: "DE", host: "try.centiment.co" }));

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true });
        await expect(Banner.get(page)).toHaveCount(0);
    });
});
