/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { ScriptUrl } from "../../../../workers/consent/test/fixtures.js";

export const TagManagerHost = "www.googletagmanager.com";
export const CookieName = "ce_consent";
export const SurveyParentDomain = ".consent-fixture.test";
export const SurveyHost = `survey${SurveyParentDomain}`;
export const WorkerDidNotRun = "none";
export const PrivacyPolicyUrl = "https://www.centiment.co/legal/privacy-policy";

export const AllHeldScripts = ["analytics-head-external", "analytics-head-embedded", "advertising-body-external", "advertising-body-embedded"];
export const AnalyticsHeldScripts = ["analytics-head-external", "analytics-head-embedded"];

export const AdvertisingCookies = ["_gac_UA123", "_gcl_au", "_fbp", "li_fat_id", "__obref"];
export const AnalyticsCookies = ["_ga", "_ga_ABC123", "hubspotutk", "__hstc", "_clck", "CentimentTracker"];
export const LoginCookie = "CMT-AUTH";
export const HubSpotConsentCookie = "__hs_cookie_cat_pref";

const PageHosts = ["www.centiment.co", "try.centiment.co", SurveyHost];
export const FixtureHosts = [...PageHosts, new URL(ScriptUrl).hostname];

export const TagManagerStub = `
    window.tagManagerRuns = (window.tagManagerRuns || 0) + 1;
    window.tagManagerSaw = { hubSpot: (window._hsp || []).slice(), dataLayer: window.dataLayer.length };`;

const HostileCss = `
    <style>
        * { font-family: "Comic Sans MS", cursive !important; letter-spacing: 3px !important; }
        button { background: #ff00aa !important; color: #00ff00 !important; font-size: 40px !important; padding: 30px !important; border-radius: 0 !important; }
        section, div, p, h2, dialog { margin: 40px !important; line-height: 4 !important; }
        div { color: #fff; font-size: 30px; }
        div:empty { display: none; }
        body > div { transform: translateY(40px); }
    </style>`;

const PageFontCss = "<style>body { font-family: Arial, sans-serif; }</style>";
const PageFlexCss = "<style>body { display: flex; flex-direction: column; gap: 24px; margin: 0; }</style>";
const PageRoomCss = "<style>body { margin: 0; padding-bottom: var(--centiment-consent-page-room, 0px); } main { min-height: 150vh; }</style>";
const PageCss = { hostile: HostileCss, font: PageFontCss, flex: PageFlexCss, room: PageRoomCss };

export const getHeldScript = (name) => `window.heldRuns = (window.heldRuns || []).concat(${JSON.stringify(name)});`;

const getAttributeText = (name, value) => (value ? ` ${name}="${value}"` : "");

export const getFixturePage = (query) => {
    const region = query.get("region");
    const script = new URLSearchParams({ region, preconsent: query.get("preconsent") ?? "pings" });
    const gtm = query.get("gtm") ?? "GTM-TEST1";
    const options = `${getAttributeText("data-gtm", gtm)}${getAttributeText("data-banner", query.get("banner"))}`;
    const deferAttribute = query.get("defer") === "off" ? "" : " defer";

    const consentTag = `<script src="${ScriptUrl}?${script}"${options}${deferAttribute} data-cfasync="false"></script>`;
    const consentTags = Array(Number(query.get("tagCopies") ?? 1)).fill(consentTag).join("\n");

    return `
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>Consent fixture</title>
                ${PageCss[query.get("css")] ?? ""}
                ${consentTags}
                <script type="text/plain" data-consent="analytics" data-src="/held/analytics-head-external.js" data-held-id="analytics-head-external"></script>
                <script type="text/plain" data-consent="analytics">${getHeldScript("analytics-head-embedded")}</script>
            </head>
            <body>
                <main>
                    <h1>Better respondents, better data</h1>
                    <button type="button" class="page-button">A page button</button>
                </main>
                <footer><a href="#" data-action="cookie-preferences">Your privacy choices</a></footer>
                <script type="text/plain" data-consent="advertising" data-src="/held/advertising-body-external.js" id="held-ads" data-vendor="fixture" crossorigin="anonymous"></script>
                <script type="text/plain" data-consent="advertising">${getHeldScript("advertising-body-embedded")}</script>
            </body>
        </html>`;
};
