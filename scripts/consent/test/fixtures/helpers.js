/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { ScriptUrl } from "../../../../workers/consent/test/fixtures.js";
import { PolicyVersion, RecordId } from "./core.js";
import { CookieName, FixtureHosts, TagManagerHost } from "./site.js";

export const DaySeconds = 60 * 60 * 24;
const MonthSeconds = DaySeconds * 30;
export const YearSeconds = DaySeconds * 365;

const RecordFormatVersion = "1";

const breakSetAttributeInPage = (brokenName) => {
    const setAttribute = Element.prototype.setAttribute;

    Element.prototype.setAttribute = function (attributeName, value) {
        if (attributeName === brokenName) throw new Error("release failed");

        return setAttribute.call(this, attributeName, value);
    };
};

export const Page = {
    getUrl: ({ host = "www.centiment.co", https = true, region = "US-NY", gtm, banner, css, preconsent, defer = true, tagCopies = 1 } = {}) => {
        const query = new URLSearchParams({ region });

        if (gtm !== undefined) query.set("gtm", gtm);
        if (preconsent) query.set("preconsent", preconsent);
        if (banner) query.set("banner", banner);
        if (css) query.set("css", css);
        if (!defer) query.set("defer", "off");
        if (tagCopies !== 1) query.set("tagCopies", String(tagCopies));

        return `${https ? "https" : "http"}://${host}/page?${query}`;
    },

    settle: (page) => page.waitForTimeout(600),

    getFooterLink: (page) => page.getByRole("link", { name: "Your privacy choices" }),

    getConsentTag: (page) => page.locator(`script[src^="${ScriptUrl}"]`),

    getWarnings: (page) => {
        const warnings = [];

        page.on("console", (message) => {
            if (message.type() === "warning") warnings.push(message.text());
        });

        return warnings;
    },

    withGpc: (page) => page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true, configurable: true });
    }),

    hideCookieStore: (context) => context.addInitScript(() => {
        Object.defineProperty(window, "cookieStore", { value: undefined, configurable: true });
    }),

    controlVisibility: (page) => page.addInitScript(() => {
        let visibility = "visible";

        Object.defineProperty(Document.prototype, "visibilityState", { get: () => visibility, configurable: true });
        window.fixtureVisibility = (next) => {
            visibility = next;
            document.dispatchEvent(new Event("visibilitychange"));
        };
    }),

    setVisibility: (page, visibility) => page.evaluate((next) => window.fixtureVisibility(next), visibility),

    focusWindow: (page) => page.evaluate(() => window.dispatchEvent(new Event("focus"))),

    countLoads: (page) => page.addInitScript(() => {
        const loads = Number(sessionStorage.getItem("fixtureLoads") || 0) + 1;

        sessionStorage.setItem("fixtureLoads", String(loads));
    }),

    getLoadCount: (page) => page.evaluate(() => Number(sessionStorage.getItem("fixtureLoads") || 0)),

    stubWindowOpen: (page) => page.addInitScript(() => {
        window.openCalls = [];
        window.open = (...args) => {
            window.openCalls.push(args);

            return null;
        };
    }),

    getWindowOpenCalls: (page) => page.evaluate(() => window.openCalls),

    breakSetAttribute: (page, name) => page.evaluate(breakSetAttributeInPage, name),

    breakSetAttributeBeforeLoad: (page, name) => page.addInitScript(breakSetAttributeInPage, name),
};

export const UsPage = Page.getUrl({ region: "US-NY" });
export const CaliforniaPage = Page.getUrl({ region: "US-CA" });
export const EuPage = Page.getUrl({ region: "DE" });

export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const Banner = {
    get: (page) => page.getByRole("region", { name: "Cookies on Centiment" }),

    getPageRoom: (page) => page.evaluate(() => document.documentElement.style.getPropertyValue("--centiment-consent-page-room")),

    getHeight: (page) => page.evaluate(() => document.documentElement.style.getPropertyValue("--centiment-consent-banner-height")),

    getExpectedRoom: async (page) => `${Math.ceil(page.viewportSize().height - (await Banner.get(page).boundingBox()).y)}px`,
};

export const Panel = {
    get: (page) => page.getByRole("dialog", { name: "Your privacy choices" }),

    save: async (page, { analytics = true, advertising = true }) => {
        await Page.getFooterLink(page).click();
        await Panel.get(page).getByRole("switch", { name: "Analytics" }).setChecked(analytics);
        await Panel.get(page).getByRole("switch", { name: "Advertising" }).setChecked(advertising);
        await Panel.get(page).getByRole("button", { name: "Save choices" }).click();
    },
};

export const Consent = {
    get: (page) => page.evaluate(() => window.centimentConsent.get()),

    recordChanges: (page, field = null) => page.evaluate((name) => {
        window.recordedChanges = [];
        window.stopRecordingChanges = window.centimentConsent.onChange((state) => window.recordedChanges.push(name === null ? state : state[name]));
    }, field),

    stopRecordingChanges: (page) => page.evaluate(() => window.stopRecordingChanges()),

    getRecordedChanges: (page) => page.evaluate(() => window.recordedChanges),

    recordChangeEventsBeforeLoad: (page) => page.addInitScript(() => {
        window.recordedChangeEvents = [];
        window.addEventListener("ce_consent_change", (event) => window.recordedChangeEvents.push(event.detail));
    }),

    getRecordedChangeEvents: (page) => page.evaluate(() => window.recordedChangeEvents),
};

const isGtagCall = (entry) => Boolean(entry.gtag);

const isConsentCommand = (entry, command) => isGtagCall(entry) && entry.gtag[0] === "consent" && entry.gtag[1] === command;

export const Google = {
    getDataLayer: (page) => page.evaluate(() => window.dataLayer.map((entry) => (
        Object.prototype.toString.call(entry) === "[object Arguments]" ? { gtag: Array.from(entry) } : entry
    ))),

    getConsentUpdates: (entries) => entries.filter((entry) => entry.event === "ce_consent_update"),

    getConsentCommands: (entries, command) =>
        entries.filter((entry) => isConsentCommand(entry, command)).map((entry) => entry.gtag[2]),

    getConsentCommandIndex: (entries, command) => entries.findIndex((entry) => isConsentCommand(entry, command)),

    getEventIndex: (entries, name) => entries.findIndex((entry) => entry.event === name),

    waitForTagManager: (page) => page.waitForFunction(() => window.tagManagerRuns === 1),

    getTagManagerRequests: (requests) => requests.filter((url) => url.hostname === TagManagerHost),
};

export const Tags = {
    stub: (page, { failing = null } = {}) => page.addInitScript((failingTag) => {
        const createTagStub = (name) => (...args) => {
            if (name === failingTag) throw new Error(`${name} failed`);

            window.tagCalls.push([name, ...args]);
        };

        window.tagCalls = [];
        window.fbq = createTagStub("fbq");
        window.clarity = createTagStub("clarity");
        window.uetq = { push: createTagStub("uetq") };
        window.oaiq = createTagStub("oaiq");
    }, failing),

    getCalls: (page) => page.evaluate(() => window.tagCalls),
};

export const Held = {
    getRuns: (page) => page.evaluate(() => window.heldRuns || []),

    waitForRuns: (page, count) =>
        page.waitForFunction((expected) => (window.heldRuns || []).length === expected, count),
};

export const Cookies = {
    createChoiceCookie: ({
        policy = PolicyVersion,
        decidedAt = Math.floor(Date.now() / 1000) - MonthSeconds,
        method = "banner",
        analytics = true,
        advertising = true,
        region = "DE",
        gpc = false,
        domain = ".centiment.co",
    } = {}) => ({
        name: CookieName,
        value: [RecordFormatVersion, RecordId, policy, decidedAt, method, `${Number(analytics)}${Number(advertising)}`, region ?? "-", Number(gpc)].join("."),
        domain,
        path: "/",
    }),

    getTracking: (host = "www.centiment.co") => [
        { name: "_ga", value: "GA1.1.123.456", domain: ".centiment.co", path: "/" },
        { name: "_ga_ABC123", value: "GS1.1.1", domain: ".centiment.co", path: "/" },
        { name: "_gac_UA123", value: "1.1.1", domain: ".centiment.co", path: "/" },
        { name: "_gcl_au", value: "1.1.1", domain: ".centiment.co", path: "/" },
        { name: "_fbp", value: "fb.1.1", domain: ".centiment.co", path: "/" },
        { name: "li_fat_id", value: "abc", domain: ".centiment.co", path: "/" },
        { name: "__obref", value: "abc", domain: ".centiment.co", path: "/" },
        { name: "hubspotutk", value: "abc", domain: host, path: "/" },
        { name: "__hstc", value: "abc", domain: ".centiment.co", path: "/" },
        { name: "__hs_cookie_cat_pref", value: "1:true_2:false", domain: ".centiment.co", path: "/" },
        { name: "_clck", value: "abc", domain: host, path: "/" },
        { name: "CentimentTracker", value: "abc", domain: ".centiment.co", path: "/" },
        { name: "CMT-AUTH", value: "session", domain: ".centiment.co", path: "/" },
    ],

    getNames: async (context) => (await context.cookies()).map((cookie) => cookie.name),

    getChoiceCookie: async (context) => (await context.cookies()).find((cookie) => cookie.name === CookieName),
};

export const Styles = {
    get: (locator, properties) => locator.evaluate((element, names) => {
        const style = getComputedStyle(element);

        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
    }, properties),

    getFontFamily: (locator) => locator.evaluate((element) => getComputedStyle(element).fontFamily),

    getRedChannelAt: async (page, x, y) => {
        const shot = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });

        return page.evaluate(async (data) => {
            const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
            const context = new OffscreenCanvas(1, 1).getContext("2d");

            context.drawImage(image, 0, 0);

            return context.getImageData(0, 0, 1, 1).data[0];
        }, shot.toString("base64"));
    },
};

export const Requests = {
    getForeign: (requests) => requests.filter((url) => !FixtureHosts.includes(url.hostname)),
};
