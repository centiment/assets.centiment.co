/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { core, createConsent, createRecord, googleHeldCore, MalformedRecords, NewerPolicyVersion, OlderPolicyVersion, PolicyVersion, resolve } from "./fixtures/core.js";
import { GpcIgnoredRegions, GpcRegions, OptInRegions, OptOutRegions, UnplacedRegions } from "./fixtures/region-lists.js";

const OptInStart = { rules: "opt-in", gpc: false, decided: false, refused: false, choice: { analytics: false, advertising: false }, needsGpcRecord: false, hasValidRecord: false };
const OptOutStart = { rules: "opt-out", gpc: false, decided: false, refused: false, choice: { analytics: true, advertising: true }, needsGpcRecord: false, hasValidRecord: false };

describe("Region.parse", () => {
    it("reads the region the Worker placed", () => {
        assert.deepEqual(core.Region.parse("US-CA"), { code: "US-CA", country: "US", state: "CA" });
        assert.deepEqual(core.Region.parse("DE"), { code: "DE", country: "DE", state: null });
        assert.deepEqual(core.Region.parse("AU-NSW"), { code: "AU-NSW", country: "AU", state: "NSW" });
    });

    it("reads the untouched placeholder as no region, because the Worker did not run", () => {
        assert.equal(core.Region.parse("__CENTIMENT_CONSENT_REGION__"), null);
    });

    it("reads Cloudflare's unknowns and anything malformed as XX", () => {
        for (const value of [...UnplacedRegions, "USA", "DE;ALERT(1)"]) {
            assert.deepEqual(core.Region.parse(value), { code: "XX", country: "XX", state: null }, value);
        }
    });
});

describe("Region.getRules", () => {
    it("gives the opt-in rules to every opt-in region and to a page where the Worker did not run", () => {
        OptInRegions.forEach((code) => assert.equal(core.Region.getRules(core.Region.parse(code)), "opt-in", code));
        assert.equal(core.Region.getRules(null), "opt-in");
    });

    it("gives the opt-out rules everywhere else, visitors Cloudflare cannot place included", () => {
        OptOutRegions.forEach((code) => assert.equal(core.Region.getRules(core.Region.parse(code)), "opt-out", code));
    });
});

describe("Region.isGpcState", () => {
    it("applies in the listed states only", () => {
        GpcRegions.forEach((code) => assert.equal(core.Region.isGpcState(core.Region.parse(code)), true, code));
        [...GpcIgnoredRegions, "DE"].forEach((code) => assert.equal(core.Region.isGpcState(core.Region.parse(code)), false, code));
        assert.equal(core.Region.isGpcState(null), false);
    });
});

describe("Consent.resolve", () => {
    it("starts an undecided visitor at nothing allowed in an opt-in region and when the Worker did not run", () => {
        for (const region of ["DE", null]) {
            assert.deepEqual(resolve({ region, gpcSignal: true }), OptInStart, String(region));
        }
    });

    it("starts an undecided opt-out visitor with both on", () => {
        assert.deepEqual(resolve({ region: "US-NY" }), OptOutStart);
        assert.deepEqual(resolve({ region: "US-CA" }), OptOutStart);
    });

    it("turns advertising off under GPC in a listed state and needs a gpc record", () => {
        assert.deepEqual(resolve({ region: "US-CA", gpcSignal: true }), { ...OptOutStart, gpc: true, choice: { analytics: true, advertising: false }, needsGpcRecord: true });
    });

    it("applies a current record as a decision, under either rules", () => {
        assert.deepEqual(resolve({ region: "DE", record: createRecord({ analytics: true, advertising: false }) }), { ...OptInStart, hasValidRecord: true, decided: true, choice: { analytics: true, advertising: false } });
        assert.deepEqual(resolve({ region: "US-NY", record: createRecord({ analytics: false, advertising: false, region: "US-NY" }) }).choice, { analytics: false, advertising: false });
    });

    it("asks again in an opt-in region when the record is for an older policy", () => {
        assert.deepEqual(resolve({ region: "DE", record: createRecord({ policy: OlderPolicyVersion }) }), OptInStart);
    });

    it("applies a record for a newer policy, so a page still running the older script does not ask again", () => {
        assert.deepEqual(resolve({ region: "DE", record: createRecord({ policy: NewerPolicyVersion, analytics: true, advertising: false }) }), { ...OptInStart, hasValidRecord: true, decided: true, choice: { analytics: true, advertising: false } });
    });

    it("keeps an older policy's record in an opt-out region, an earlier Reject included", () => {
        assert.deepEqual(resolve({ region: "US-NY", record: createRecord({ policy: OlderPolicyVersion, method: "panel", analytics: false, advertising: false, region: "US-NY" }) }), { ...OptOutStart, hasValidRecord: true, decided: true, refused: true, choice: { analytics: false, advertising: false } });
    });

    it("asks again in an opt-in region when a panel choice made under the opt-out rules allows anything, and keeps a refusal made there or any banner choice", () => {
        for (const region of ["US-NY", "XX"]) {
            assert.deepEqual(resolve({ region: "DE", record: createRecord({ method: "panel", region }) }), OptInStart, region);
            assert.deepEqual(resolve({ region: "DE", record: createRecord({ method: "panel", analytics: true, advertising: false, region }) }), OptInStart, region);
            assert.deepEqual(resolve({ region: "DE", record: createRecord({ method: "panel", analytics: false, advertising: false, region }) }), { ...OptInStart, hasValidRecord: true, decided: true, refused: true }, region);
        }

        assert.equal(resolve({ region: "DE", record: createRecord({ region: "CA-QC" }) }).decided, true);
        assert.equal(resolve({ region: "DE", record: createRecord({ region: null }) }).decided, true);
        assert.equal(resolve({ region: "DE", record: createRecord({ method: "banner", region: "US-CA" }) }).decided, true);
    });

    it("keeps a US visitor's panel choice on a page where the Worker did not run, so an outage does not ask them again", () => {
        assert.deepEqual(resolve({ region: null, record: createRecord({ method: "panel", region: "US-NY" }) }), { ...OptInStart, hasValidRecord: true, decided: true, choice: { analytics: true, advertising: true } });
    });

    it("keeps a gpc record's advertising off in the GPC states on a page without GPC, as no decision", () => {
        assert.deepEqual(resolve({ region: "US-TX", record: createRecord({ method: "gpc", analytics: true, advertising: false, region: "US-TX", gpc: true }) }), { ...OptOutStart, hasValidRecord: true, choice: { analytics: true, advertising: false } });
    });

    it("reads a gpc record as no choice in an opt-in region, so nothing is allowed before the banner", () => {
        assert.deepEqual(resolve({ region: "DE", record: createRecord({ method: "gpc", analytics: true, advertising: false, region: "US-TX", gpc: true }) }), OptInStart);
    });

    it("turns off a stored advertising yes made without GPC, and needs a gpc record", () => {
        for (const method of ["banner", "panel"]) {
            assert.deepEqual(resolve({ region: "US-CA", record: createRecord({ method, region: "US-CA" }), gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, decided: true, choice: { analytics: true, advertising: false }, needsGpcRecord: true }, method);
        }
    });

    it("lets only a panel choice made with GPC on win over GPC", () => {
        assert.deepEqual(resolve({ region: "US-CA", record: createRecord({ method: "panel", region: "US-CA", gpc: true }), gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, decided: true });
        assert.deepEqual(resolve({ region: "US-CA", record: createRecord({ method: "banner", region: null, gpc: true }), gpcSignal: true }).choice, { analytics: true, advertising: false });
        assert.deepEqual(resolve({ region: "US-CA", record: createRecord({ method: "gpc", analytics: true, advertising: false, region: "US-CA", gpc: true }), gpcSignal: true }).choice, { analytics: true, advertising: false });
    });

    it("keeps both off after an override then Reject all", () => {
        assert.deepEqual(resolve({ region: "US-CA", record: createRecord({ method: "panel", analytics: false, advertising: false, region: "US-CA", gpc: true }), gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, decided: true, refused: true, choice: { analytics: false, advertising: false } });
    });

    it("treats Analytics off plus GPC's advertising off as a refusal in the GPC states, also where the Worker did not run", () => {
        const analyticsOff = createRecord({ method: "panel", analytics: false, advertising: true, region: "US-CA" });
        const gpcBothOff = createRecord({ method: "gpc", analytics: false, advertising: false, region: "US-CA", gpc: true });

        assert.deepEqual(resolve({ region: "US-CA", record: analyticsOff, gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, decided: true, refused: true, choice: { analytics: false, advertising: false }, needsGpcRecord: true });
        assert.deepEqual(resolve({ region: "US-CA", record: gpcBothOff, gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, refused: true, choice: { analytics: false, advertising: false } });
        assert.equal(resolve({ region: "US-CA", record: gpcBothOff }).refused, true);
        assert.equal(resolve({ region: null, record: gpcBothOff, gpcSignal: true }).refused, true);
    });

    it("keeps Google's tags on for a gpc record with both off outside the GPC states, where its advertising goes back on", () => {
        const gpcBothOff = createRecord({ method: "gpc", analytics: false, advertising: false, region: "US-CA", gpc: true });

        assert.deepEqual(resolve({ region: "US-NY", record: gpcBothOff, gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, choice: { analytics: false, advertising: true } });
        assert.equal(resolve({ region: "DE", record: gpcBothOff, gpcSignal: true }).refused, false);
    });

    it("turns a gpc record's advertising back on outside the GPC states, with or without GPC, and keeps it off in them, also where the stored region decides", () => {
        const gpcRecord = createRecord({ method: "gpc", analytics: true, advertising: false, region: "US-CA", gpc: true });

        for (const gpcSignal of [false, true]) {
            assert.deepEqual(resolve({ region: "US-NY", record: gpcRecord, gpcSignal }), { ...OptOutStart, hasValidRecord: true }, `gpcSignal ${gpcSignal}`);
        }

        for (const region of ["US-TX", "XX", "US"]) {
            assert.deepEqual(resolve({ region, record: gpcRecord }).choice, { analytics: true, advertising: false }, region);
        }
    });

    it("needs no gpc record when GPC turns nothing off", () => {
        assert.equal(resolve({ region: "US-CA", record: createRecord({ method: "panel", advertising: false, region: "US-CA" }), gpcSignal: true }).needsGpcRecord, false);
    });

    it("lets the record's stored region decide GPC when the Worker did not run, and writes nothing under the opt-in rules", () => {
        assert.deepEqual(resolve({ region: null, record: createRecord({ region: "US-CA" }), gpcSignal: true }), { ...OptInStart, hasValidRecord: true, gpc: true, decided: true, choice: { analytics: true, advertising: false } });
        assert.deepEqual(resolve({ region: null, record: createRecord({ region: "DE" }), gpcSignal: true }).choice, { analytics: true, advertising: true });
        assert.deepEqual(resolve({ region: null, record: createRecord({ region: null }), gpcSignal: true }).choice, { analytics: true, advertising: true });
    });

    it("lets the record's stored region decide GPC where Cloudflare could not place the visitor, under the US rules", () => {
        assert.deepEqual(resolve({ region: "XX", record: createRecord({ region: "US-CA" }), gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, decided: true, choice: { analytics: true, advertising: false }, needsGpcRecord: true });
        assert.equal(resolve({ region: "T1", record: createRecord({ region: "US-CA" }), gpcSignal: true }).gpc, true);
        assert.equal(resolve({ region: "XX", record: createRecord({ region: "DE" }), gpcSignal: true }).gpc, false);
        assert.equal(resolve({ region: "XX", gpcSignal: true }).gpc, false);
    });

    it("lets the record's stored region decide GPC where Cloudflare placed the visitor in the US without a state", () => {
        assert.deepEqual(resolve({ region: "US", record: createRecord({ region: "US-CA" }), gpcSignal: true }), { ...OptOutStart, hasValidRecord: true, gpc: true, decided: true, choice: { analytics: true, advertising: false }, needsGpcRecord: true });
        assert.equal(resolve({ region: "US", record: createRecord({ region: "US-NY" }), gpcSignal: true }).gpc, false);
        assert.equal(resolve({ region: "US", gpcSignal: true }).gpc, false);
        assert.equal(resolve({ region: "DE", record: createRecord({ region: "US-CA" }), gpcSignal: true }).gpc, false);
    });

    it("lets the region of a gpc record or an older policy's record, which do not apply there, decide GPC when the Worker did not run", () => {
        const gpcRecord = createRecord({ method: "gpc", advertising: false, region: "US-CA", gpc: true });

        assert.deepEqual(resolve({ region: null, record: gpcRecord, gpcSignal: true }), { ...OptInStart, gpc: true });
        assert.equal(resolve({ region: "DE", record: gpcRecord, gpcSignal: true }).gpc, false);
        assert.equal(resolve({ region: null, record: createRecord({ policy: OlderPolicyVersion, region: "US-CA" }), gpcSignal: true }).gpc, true);
    });
});

describe("Record.encode and Record.decode", () => {
    it("writes the dotted record and reads it back", () => {
        const record = createRecord({ analytics: true, advertising: false });
        const value = core.Record.encode(record);

        assert.equal(value, `1.k3f9x2q8mz.${PolicyVersion}.1761475200.banner.10.DE.0`);
        assert.deepEqual(core.Record.decode(value), record);
        assert.deepEqual(core.Record.decode(`1.k3f9x2q8mz.${PolicyVersion}.1761475200.gpc.10.-.1`), createRecord({ method: "gpc", analytics: true, advertising: false, region: null, gpc: true }));
    });

    it("reads a malformed record as no record", () => {
        Object.entries({ noCookie: null, ...MalformedRecords }).forEach(([name, value]) => assert.equal(core.Record.decode(value), null, name));
    });
});

describe("Consent.getConsentModeState", () => {
    it("maps a choice to Consent Mode, with ce_google_tags granted unless the visitor refused", () => {
        assert.deepEqual(core.Consent.getConsentModeState(createConsent()), {
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
            analytics_storage: "denied",
            functionality_storage: "granted",
            security_storage: "granted",
            ce_google_tags: "granted",
        });
        assert.equal(core.Consent.getConsentModeState(createConsent({ refused: true })).ce_google_tags, "denied");
        assert.deepEqual(core.Consent.getConsentModeState(createConsent({ analytics: true })), {
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
            analytics_storage: "granted",
            functionality_storage: "granted",
            security_storage: "granted",
            ce_google_tags: "granted",
        });
    });
});

describe("Consent.isTagManagerAllowed", () => {
    it("with pings, loads it before a choice and after any grant, never after a refusal", () => {
        assert.equal(core.Consent.isTagManagerAllowed(createConsent()), true);
        assert.equal(core.Consent.isTagManagerAllowed(createConsent({ advertising: true })), true);
        assert.equal(core.Consent.isTagManagerAllowed(createConsent({ refused: true })), false);
    });

    it("held, waits for a grant", () => {
        assert.equal(googleHeldCore.Consent.isTagManagerAllowed(createConsent()), false);
        assert.equal(googleHeldCore.Consent.isTagManagerAllowed(createConsent({ analytics: true })), true);
        assert.equal(googleHeldCore.Consent.isTagManagerAllowed(createConsent({ refused: true })), false);
    });
});

describe("Consent.getWithdrawnCategories", () => {
    it("lists the categories a new choice withdraws", () => {
        const both = { analytics: true, advertising: true };

        assert.deepEqual(core.Consent.getWithdrawnCategories(both, { analytics: true, advertising: false }), ["advertising"]);
        assert.deepEqual(core.Consent.getWithdrawnCategories(both, { analytics: false, advertising: false }), ["analytics", "advertising"]);
        assert.deepEqual(core.Consent.getWithdrawnCategories({ analytics: false, advertising: true }, both), []);
    });
});

describe("Consent.getDeniedCategories", () => {
    it("lists the categories a stored choice turns off", () => {
        assert.deepEqual(core.Consent.getDeniedCategories({ analytics: true, advertising: false }), ["advertising"]);
        assert.deepEqual(core.Consent.getDeniedCategories({ analytics: false, advertising: false }), ["analytics", "advertising"]);
        assert.deepEqual(core.Consent.getDeniedCategories({ analytics: true, advertising: true }), []);
    });
});

describe("Cookies.getCategoryCookies", () => {
    const CookieNames = ["_ga", "_ga_ABC123", "_gac_UA123", "hubspotutk", "__hstc", "__hssc", "__hssrc", "__hs_opt_out", "__hs_cookie_cat_pref", "_clck", "_clsk", "CentimentTracker", "_gcl_au", "_fbp", "_fbc", "li_fat_id", "li_giant", "li_adsId", "__obref", "__oppref", "_uetsid", "CMT-AUTH", "ce_consent", "my_ga"];

    it("deletes each category's cookies and never the login, the choice or HubSpot's own consent cookies", () => {
        assert.deepEqual(core.Cookies.getCategoryCookies(CookieNames, "analytics"), ["_ga", "_ga_ABC123", "hubspotutk", "__hstc", "__hssc", "__hssrc", "_clck", "_clsk", "CentimentTracker"]);
        assert.deepEqual(core.Cookies.getCategoryCookies(CookieNames, "advertising"), ["_gac_UA123", "_gcl_au", "_fbp", "_fbc", "li_fat_id", "li_giant", "li_adsId", "__obref", "__oppref", "_uetsid"]);
    });
});

describe("Cookies.getExpiryDomains", () => {
    it("expires a cookie on the host and on every parent domain above it", () => {
        assert.deepEqual(core.Cookies.getExpiryDomains("www.centiment.co"), ["www.centiment.co", "centiment.co"]);
        assert.deepEqual(core.Cookies.getExpiryDomains("survey.example.com"), ["survey.example.com", "example.com"]);
        assert.deepEqual(core.Cookies.getExpiryDomains("a.b.co.uk"), ["a.b.co.uk", "b.co.uk", "co.uk"]);
        assert.deepEqual(core.Cookies.getExpiryDomains("localhost"), []);
    });
});

describe("Cookies.getAttributes", () => {
    it("is shared on .centiment.co on its hosts, host-only elsewhere, and Secure on https", () => {
        assert.equal(core.Cookies.getAttributes("www.centiment.co", "https:", 31536000), "; path=/; max-age=31536000; samesite=lax; domain=.centiment.co; secure");
        assert.equal(core.Cookies.getAttributes("centiment.co", "http:", 31536000), "; path=/; max-age=31536000; samesite=lax; domain=.centiment.co");
        assert.equal(core.Cookies.getAttributes("notcentiment.co", "https:", 31536000), "; path=/; max-age=31536000; samesite=lax; secure");
        assert.equal(core.Cookies.getAttributes("survey.example.com", "http:", 31536000), "; path=/; max-age=31536000; samesite=lax");
    });

    it("lasts as long as it is asked to", () => {
        assert.equal(core.Cookies.getAttributes("www.centiment.co", "https:", 600), "; path=/; max-age=600; samesite=lax; domain=.centiment.co; secure");
    });
});
