/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

(function () {
    "use strict";

    const ConsentRules = {
        optIn: "opt-in",
        optOut: "opt-out",
    };

    const ConsentMethod = {
        banner: "banner",
        panel: "panel",
        gpc: "gpc",
    };

    const ConsentCategory = {
        analytics: "analytics",
        advertising: "advertising",
    };

    const PreconsentGoogle = {
        pings: "pings",
        held: "held",
    };

    const ConsentAction = {
        accept: "accept",
        reject: "reject",
        save: "save",
        choose: "choose",
        close: "close",
    };

    const ConsentConfig = {
        // A higher version asks again where there is a banner; elsewhere the earlier choice stands.
        policyVersion: 1,
        cookieName: "ce_consent",
        cookieMaxAgeSeconds: 60 * 60 * 24 * 365,
        parentDomain: "centiment.co",
        privacyPolicyUrl: "https://www.centiment.co/legal/privacy-policy",
        tagManagerUrl: "https://www.googletagmanager.com/gtm.js",
        optInCountries: [
            "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
            "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
            "NL", "PL", "PT", "RO", "SE", "SI", "SK",
            "IS", "LI", "NO", "GB", "CH",
            "RE", "GP", "MQ", "GF", "YT", "MF", "AX",
            "GI", "JE", "GG", "IM",
        ],
        optInRegions: ["CA-QC"],
        gpcRegions: ["US-CA", "US-CO", "US-CT", "US-DE", "US-LA", "US-MD", "US-MN", "US-MT", "US-NE", "US-NH", "US-NJ", "US-OR", "US-TX"],
        preconsentGoogle: PreconsentGoogle.pings,
        categoryCookies: {
            analytics: { names: ["_ga", "hubspotutk", "__hstc", "__hssc", "__hssrc", "_clck", "_clsk", "CentimentTracker"], prefixes: ["_ga_"] },
            advertising: { names: ["_fbp", "_fbc", "li_fat_id", "li_giant", "li_adsId", "__obref", "__oppref"], prefixes: ["_gcl_", "_gac_", "_uet"] },
        },
        analyticsVendors: ["Google Analytics", "HubSpot", "Microsoft Clarity"],
        advertisingVendors: ["Google", "Meta", "LinkedIn", "Microsoft", "OpenAI"],
    };

    // The sites, the apps and Tag Manager rely on these names.
    const ConsentUpdateEventName = "ce_consent_update";
    const ConsentChangeEventName = "ce_consent_change";
    const BannerHeightProperty = "--centiment-consent-banner-height";
    const PageRoomProperty = "--centiment-consent-page-room";
    const FooterLinkAction = "cookie-preferences";
    // A consent type of the script's own: every Google tag in Tag Manager is set to require it, so Reject all stops them firing.
    const GoogleTagsConsent = "ce_google_tags";

    const PhoneScreen = "(max-width: 479px)";
    const SpanningBannerScreen = `${PhoneScreen}, (max-height: 499px)`;

    const OptionOff = "off";
    const TagManagerIdPattern = /^GTM-[A-Z0-9]+$/;

    const UnknownCountry = "XX";
    const CloudflareUnknowns = [UnknownCountry, "T1"];
    const RegionPattern = /^[A-Z0-9]{2}(?:-[A-Z0-9]{1,3})?$/;

    // A new record format must keep reading version 1 records, or a stored opt-out is lost where there is no banner to ask again, as in the US.
    const RecordFormatVersion = "1";
    const RecordFieldCount = 8;
    const EmptyRegionField = "-";

    // The Worker replaces the quoted placeholder below with the visitor's region code, such as "US-CA".
    // The comparison value is built from two halves so the Worker's single replace never touches it.
    const PlacedRegion = "__CENTIMENT_CONSENT_REGION__";
    const RegionPlaceholder = "__CENTIMENT_" + "CONSENT_REGION__";

    // A held script is a tag the site writes as type text/plain with a data-consent category, so it waits for consent.
    // Once released it is marked, so it runs only once.
    const ReleasedAttribute = "data-consent-released";
    const HeldSelector = `script[type="text/plain"][data-consent]:not([${ReleasedAttribute}])`;
    const HeldOnlyAttributes = ["type", "data-consent", "data-src", ReleasedAttribute];

    const ConsentText = {
        bannerTitle: "Cookies on Centiment",
        bannerText: "We use analytics and advertising cookies only if you allow them. Necessary cookies keep the site working.",
        chooseCookies: "Choose cookies",
        orSeeOur: "or see our",
        privacyPolicy: "Privacy policy",
        rejectAll: "Reject all",
        acceptAll: "Accept all",
        panelTitle: "Your privacy choices",
        close: "Close",
        advertisingOn: "Advertising cookies are on",
        optedOut: "You're opted out of sale and sharing",
        necessary: "Necessary",
        necessaryText: "Keep the site secure and remember your cookie choice",
        alwaysOn: "Always on",
        analytics: "Analytics",
        getAnalyticsText: (vendorNames) => `${vendorNames} show us which pages people use`,
        advertising: "Advertising",
        getAdvertisingText: (vendorNames) => `${vendorNames} measure our ads and show them to you on other sites`,
        sharing: "US privacy laws call this sharing",
        gpcNote: "Your browser sends Global Privacy Control, so advertising cookies stay off unless you turn them on here or choose Accept all",
        gpcOverride: "Advertising cookies are on, overriding your browser's Global Privacy Control",
        saveChoices: "Save choices",
        notSold: "Centiment does not sell personal information for money",
        otherRequests: "For other privacy requests, see our",
    };

    const InstallWarning = {
        getTagManagerIdText: (value) => `Centiment consent: data-gtm="${value}" is not a Tag Manager container id such as GTM-XXXXXXX, so Tag Manager does not load.`,
        tagManagerRunning: "Centiment consent: Tag Manager or a Google tag already runs on this page, so it may have fired tags before the consent defaults. Load Tag Manager only through data-gtm.",
        getHeldCategoryText: (category) => `Centiment consent: a held script has data-consent="${category}", which is neither analytics nor advertising, so it never runs.`,
        pageConsentCommand: "Centiment consent: the page sets Google consent itself, and its command now comes after the consent defaults. Remove the page's own gtag(\"consent\", ...) and let this script set consent.",
    };

    const state = {
        cookieValue: null,
        record: null,
        consent: null,
        tagManagerLoaded: false,
        heldScriptQueue: Promise.resolve(),
    };

    const ui = {
        root: null,
        banner: null,
        bannerEnabled: false,
        panel: null,
        opener: null,
    };

    // The tag's options and the visitor's region and GPC signal; start() fills them in, since Node has no page and Region is defined further down.
    const options = {
        tagManagerId: null,
        bannerOnLoad: true,
    };

    const visitor = {
        region: null,
        regionCode: null,
        gpcSignal: false,
    };

    // Banner is defined further down, so the observer looks it up each time it fires.
    const bannerSizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => Banner.syncProperties()) : null;

    const start = () => {
        // The tag's options are read while the script first runs, since document.currentScript is null once it has finished.
        const tag = document.currentScript;
        const getOption = (name) => (tag ? tag.getAttribute(`data-${name}`) : null);
        const tagManagerOption = getOption("gtm");

        options.tagManagerId = TagManagerIdPattern.test(tagManagerOption) ? tagManagerOption : null;
        options.bannerOnLoad = getOption("banner") !== OptionOff;

        if (tagManagerOption !== null && options.tagManagerId === null) console.warn(InstallWarning.getTagManagerIdText(tagManagerOption));

        visitor.region = Region.parse(PlacedRegion);
        visitor.regionCode = visitor.region ? visitor.region.code : null;
        visitor.gpcSignal = window.navigator.globalPrivacyControl === true;

        Changes.loadStoredChoice(Cookies.read(ConsentConfig.cookieName));

        if (state.consent.needsGpcRecord) {
            Changes.saveRecord(state.consent.choice, ConsentMethod.gpc);
        } else if (state.record !== null) {
            Changes.refreshRecord();
        }

        const isChoiceCookieReadable = state.cookieValue !== null;

        if (isChoiceCookieReadable && state.consent.hasValidRecord) Cookies.expireCategories(Consent.getDeniedCategories(state.consent.choice));

        // The page's own entries go back in behind the consent defaults, so Tag Manager reads the consent state first.
        window.dataLayer = window.dataLayer || [];

        const isTagManagerRunning = Boolean(window.google_tag_manager);
        const canMovePageEntries = Array.isArray(window.dataLayer) && !isTagManagerRunning;
        const pageEntries = canMovePageEntries ? window.dataLayer.splice(0) : [];

        const isPageConsentCommand = (entry) => Object.prototype.toString.call(entry) === "[object Arguments]" && entry[0] === "consent";

        if (isTagManagerRunning) console.warn(InstallWarning.tagManagerRunning);
        if (pageEntries.some(isPageConsentCommand)) console.warn(InstallWarning.pageConsentCommand);

        window._hsp = window._hsp || [];
        window.disableHubSpotCookieBanner = true;

        Tags.gtag("consent", "default", Consent.getConsentModeState(state.consent));
        // Google redacts ad click ids only while ad_storage is denied, so this stays true.
        Tags.gtag("set", "ads_data_redaction", true);
        Tags.gtag("set", "url_passthrough", ConsentConfig.preconsentGoogle === PreconsentGoogle.pings);
        Tags.setHubSpotConsent(state.consent.choice);

        if (Consent.isChoiceKnown(state.consent)) Tags.pushConsentUpdate(state.consent.choice);

        window.dataLayer.push(...pageEntries);

        window.centimentConsent = Object.freeze({
            get: Changes.getSnapshot,
            onChange: (callback) => {
                const listener = (event) => callback(event.detail);

                callback(Changes.getSnapshot());
                window.addEventListener(ConsentChangeEventName, listener);

                return () => window.removeEventListener(ConsentChangeEventName, listener);
            },
            open: (opener) => Panel.open(opener instanceof HTMLElement ? opener : document.activeElement),
            showBanner: Banner.show,
            hideBanner: Banner.hide,
        });

        Tags.runGuarded(Tags.loadTagManager);
        Tags.runGuarded(Held.release);
        document.addEventListener("DOMContentLoaded", Held.release, { once: true });
        document.addEventListener("DOMContentLoaded", Held.warnUnknownCategories, { once: true });

        // Capture phase, so a page handler that stops the click cannot keep the panel from opening.
        document.addEventListener("click", (event) => {
            const trigger = event.target instanceof Element ? event.target.closest(`[data-action="${FooterLinkAction}"]`) : null;

            if (!trigger || !View.isDialogSupported()) return;

            event.preventDefault();
            Panel.open(trigger);
        }, { capture: true });

        document.addEventListener("visibilitychange", Changes.syncWithStoredChoice);
        window.addEventListener("focus", Changes.syncWithStoredChoice);
        window.addEventListener("pageshow", Changes.syncWithStoredChoice);

        if (window.cookieStore) window.cookieStore.addEventListener("change", Changes.syncOnChoiceCookieChange);

        if (options.bannerOnLoad) Banner.show();
    };

    const Region = {
        parse: (value) => {
            if (value === RegionPlaceholder) return null;

            const [country, stateCode = null] = RegionPattern.test(value) ? value.split("-") : [UnknownCountry];

            if (CloudflareUnknowns.includes(country)) return { code: UnknownCountry, country: UnknownCountry, state: null };

            return { code: value, country, state: stateCode };
        },

        // A page the Worker did not run for gets the opt-in rules, since an error, a bypassed route or a used-up free plan reaches
        // every visitor at once, Europeans included.
        getRules: (region) => {
            if (region === null) return ConsentRules.optIn;
            if (ConsentConfig.optInCountries.includes(region.country)) return ConsentRules.optIn;
            if (ConsentConfig.optInRegions.includes(region.code)) return ConsentRules.optIn;

            return ConsentRules.optOut;
        },

        isGpcState: (region) => region !== null && ConsentConfig.gpcRegions.includes(region.code),

        isGpcCountry: (country) => ConsentConfig.gpcRegions.some((code) => code.startsWith(`${country}-`)),

        isPreciseForGpc: (region) =>
            region !== null && region.code !== UnknownCountry && !(region.state === null && Region.isGpcCountry(region.country)),

        getGpcRegion: (region, record) => {
            if (!Region.isPreciseForGpc(region) && record !== null && record.regionCode !== null) return Region.parse(record.regionCode);

            return region;
        },
    };

    const Record = {
        encode: (record) => [
            RecordFormatVersion,
            record.id,
            record.policy,
            record.decidedAt,
            record.method,
            `${Number(record.choice.analytics)}${Number(record.choice.advertising)}`,
            record.regionCode || EmptyRegionField,
            Number(record.gpc),
        ].join("."),

        decode: (value) => {
            if (value === null) return null;

            const parts = value.split(".");

            if (parts.length !== RecordFieldCount || parts[0] !== RecordFormatVersion) return null;

            const [, id, policy, decidedAt, method, choices, regionCode, gpc] = parts;

            if (!/^[a-z0-9]{8,32}$/.test(id)) return null;
            if (!/^\d{1,16}$/.test(policy)) return null;
            if (!/^\d{1,12}$/.test(decidedAt)) return null;
            if (!Object.values(ConsentMethod).includes(method)) return null;
            if (!/^[01]{2}$/.test(choices) || !/^[01]$/.test(gpc)) return null;
            if (regionCode !== EmptyRegionField && !RegionPattern.test(regionCode)) return null;

            return {
                id,
                policy: Number(policy),
                decidedAt: Number(decidedAt),
                method,
                choice: { analytics: choices[0] === "1", advertising: choices[1] === "1" },
                regionCode: regionCode === EmptyRegionField ? null : regionCode,
                gpc: gpc === "1",
            };
        },

        createId: () => Array.from(window.crypto.getRandomValues(new Uint8Array(10)), (byte) => (byte % 36).toString(36)).join(""),

        getNowSeconds: () => Math.floor(Date.now() / 1000),

        getSavedRules: (record) => Region.getRules(record.regionCode === null ? null : Region.parse(record.regionCode)),

        isOlderPolicy: (record) => record.policy < ConsentConfig.policyVersion,

        isSavedByGpc: (record) => record.method === ConsentMethod.gpc,

        isPreTicked: (record) =>
            record.method !== ConsentMethod.banner && Record.getSavedRules(record) === ConsentRules.optOut && Consent.isAnyAllowed(record.choice),

        isGpcOverride: (record) => record.method === ConsentMethod.panel && record.gpc,

        getValidRecordForRegion: (record, region) => {
            if (record === null || Region.getRules(region) === ConsentRules.optOut) return record;
            if (Record.isOlderPolicy(record) || Record.isSavedByGpc(record)) return null;
            if (region !== null && Record.isPreTicked(record)) return null;

            return record;
        },

        isGpcRefusal: (record, inGpcState) =>
            inGpcState && record !== null && Record.isSavedByGpc(record) && !Consent.isAnyAllowed(record.choice),

        getApplicableChoice: (record, inGpcState) => {
            const isGpcRecordOutsideGpcStates = Record.isSavedByGpc(record) && !inGpcState;

            return isGpcRecordOutsideGpcStates ? { analytics: record.choice.analytics, advertising: true } : record.choice;
        },
    };

    const Consent = {
        resolve: ({ record, region, gpcSignal }) => {
            const rules = Region.getRules(region);
            const validRecord = Record.getValidRecordForRegion(record, region);
            const hasValidRecord = validRecord !== null;

            const inGpcState = Region.isGpcState(Region.getGpcRegion(region, record));
            const gpc = gpcSignal && inGpcState;

            const startingChoice = hasValidRecord ? Record.getApplicableChoice(validRecord, inGpcState) : Consent.getDefaultChoice(rules);
            const turnedOffByGpc = Consent.isTurnedOffByGpc(startingChoice, validRecord, gpc);
            const choice = turnedOffByGpc ? { analytics: startingChoice.analytics, advertising: false } : startingChoice;

            const decided = hasValidRecord && !Record.isSavedByGpc(validRecord);
            const refused = decided ? !Consent.isAnyAllowed(choice) : Record.isGpcRefusal(record, inGpcState);
            const needsGpcRecord = turnedOffByGpc && rules === ConsentRules.optOut;

            return { rules, gpc, decided, refused, choice, needsGpcRecord, hasValidRecord };
        },

        getDefaultChoice: (rules) => {
            const isOptOut = rules === ConsentRules.optOut;

            return { analytics: isOptOut, advertising: isOptOut };
        },

        isTurnedOffByGpc: (choice, record, gpc) => gpc && choice.advertising && !(record !== null && Record.isGpcOverride(record)),

        isAnyAllowed: (choice) => choice.analytics || choice.advertising,

        isChoiceKnown: (consent) => consent.decided || consent.rules === ConsentRules.optOut,

        getGrantedOrDenied: (isGranted) => (isGranted ? "granted" : "denied"),

        getConsentModeState: (consent) => ({
            ad_storage: Consent.getGrantedOrDenied(consent.choice.advertising),
            ad_user_data: Consent.getGrantedOrDenied(consent.choice.advertising),
            ad_personalization: Consent.getGrantedOrDenied(consent.choice.advertising),
            analytics_storage: Consent.getGrantedOrDenied(consent.choice.analytics),
            functionality_storage: "granted",
            security_storage: "granted",
            [GoogleTagsConsent]: Consent.getGrantedOrDenied(!consent.refused),
        }),

        isTagManagerAllowed: (consent) => {
            if (consent.refused) return false;
            if (Consent.isAnyAllowed(consent.choice)) return true;

            return ConsentConfig.preconsentGoogle === PreconsentGoogle.pings;
        },

        isSame: (one, other) =>
            one.decided === other.decided &&
            one.refused === other.refused &&
            one.gpc === other.gpc &&
            one.choice.analytics === other.choice.analytics &&
            one.choice.advertising === other.choice.advertising,

        getDeniedCategories: (choice) => Object.values(ConsentCategory).filter((category) => !choice[category]),

        getWithdrawnCategories: (before, after) => Consent.getDeniedCategories(after).filter((category) => before[category]),
    };

    const Cookies = {
        read: (name) => {
            const prefix = `${name}=`;
            const entry = Cookies.getEntries().find((item) => item.startsWith(prefix));

            return entry ? entry.slice(prefix.length) : null;
        },

        getNames: () => Cookies.getEntries().map((item) => item.split("=")[0]),

        getEntries: () => document.cookie.split(";").map((item) => item.trim()).filter(Boolean),

        write: (name, value, maxAgeSeconds) => {
            document.cookie = `${name}=${value}${Cookies.getAttributes(window.location.hostname, window.location.protocol, maxAgeSeconds)}`;
        },

        getAttributes: (hostname, protocol, maxAgeSeconds) => {
            const domain = Cookies.getDomain(hostname);
            const attributes = ["path=/", `max-age=${maxAgeSeconds}`, "samesite=lax"];

            if (domain) attributes.push(`domain=${domain}`);
            if (protocol === "https:") attributes.push("secure");

            return `; ${attributes.join("; ")}`;
        },

        getDomain: (hostname) => {
            const parent = ConsentConfig.parentDomain;

            return hostname === parent || hostname.endsWith(`.${parent}`) ? `.${parent}` : null;
        },

        expireCategories: (categories) => {
            categories.forEach((category) => Cookies.getCategoryCookies(Cookies.getNames(), category).forEach(Cookies.expire));
        },

        getCategoryCookies: (names, category) => {
            const { names: exact, prefixes } = ConsentConfig.categoryCookies[category];

            return names.filter((name) => exact.includes(name) || prefixes.some((prefix) => name.startsWith(prefix)));
        },

        expire: (name) => {
            const expired = `${name}=; path=/; max-age=0`;

            document.cookie = expired;
            Cookies.getExpiryDomains(window.location.hostname).forEach((domain) => { document.cookie = `${expired}; domain=${domain}`; });
        },

        getExpiryDomains: (hostname) => {
            const labels = hostname.split(".");

            return labels.slice(0, -1).map((_, index) => labels.slice(index).join("."));
        },
    };

    const Tags = {
        // Consent Mode reads the arguments object, as gtag.js pushes it, so gtag stays a plain function.
        gtag: function () {
            window.dataLayer.push(arguments);
        },

        pushConsentUpdate: (choice) => {
            window.dataLayer.push({
                event: ConsentUpdateEventName,
                ce_analytics: Consent.getGrantedOrDenied(choice.analytics),
                ce_advertising: Consent.getGrantedOrDenied(choice.advertising),
            });
        },

        setHubSpotConsent: (choice) => {
            window._hsp.push(["setHubSpotConsent", {
                analytics: choice.analytics,
                advertisement: choice.advertising,
                functionality: Consent.isAnyAllowed(choice),
            }]);
        },

        setMetaConsent: (choice) => {
            if (typeof window.fbq === "function") window.fbq("consent", choice.advertising ? "grant" : "revoke");
        },

        setClarityConsent: (choice) => {
            if (typeof window.clarity === "function") {
                window.clarity("consentv2", {
                    ad_Storage: Consent.getGrantedOrDenied(choice.advertising),
                    analytics_Storage: Consent.getGrantedOrDenied(choice.analytics),
                });
            }
        },

        setMicrosoftAdsConsent: (choice) => {
            if (window.uetq && typeof window.uetq.push === "function") window.uetq.push("consent", "update", { ad_storage: Consent.getGrantedOrDenied(choice.advertising) });
        },

        setOpenAiConsent: (choice) => {
            if (typeof window.oaiq === "function") window.oaiq("consent", choice.advertising);
        },

        loadTagManager: () => {
            if (!options.tagManagerId || state.tagManagerLoaded || !Consent.isTagManagerAllowed(state.consent)) return;

            state.tagManagerLoaded = true;
            window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

            const element = document.createElement("script");

            element.async = true;
            element.src = `${ConsentConfig.tagManagerUrl}?id=${options.tagManagerId}`;
            document.head.appendChild(element);
        },

        runGuarded: (step) => {
            try {
                step();
            } catch (error) {
                Tags.rethrowLater(error);
            }
        },

        rethrowLater: (error) => {
            window.setTimeout(() => { throw error; });
        },
    };

    const Held = {
        release: () => {
            const granted = Array.from(document.querySelectorAll(HeldSelector)).filter(Held.isGranted);

            granted.forEach((held) => {
                held.setAttribute(ReleasedAttribute, "");
                state.heldScriptQueue = state.heldScriptQueue.then(() => Held.releaseOne(held)).catch(Tags.rethrowLater);
            });
        },

        isGranted: (held) => state.consent.choice[held.getAttribute("data-consent")] === true,

        releaseOne: (held) => new Promise((resolve) => {
            if (!held.isConnected || !Held.isGranted(held)) {
                held.removeAttribute(ReleasedAttribute);
                resolve();

                return;
            }

            const element = document.createElement("script");
            const source = held.getAttribute("data-src");

            Array.from(held.attributes)
                .filter((attribute) => !HeldOnlyAttributes.includes(attribute.name))
                .forEach((attribute) => element.setAttribute(attribute.name, attribute.value));
            held.removeAttribute("id");

            if (source) {
                element.addEventListener("load", resolve);
                element.addEventListener("error", resolve);
                element.src = source;
            } else {
                element.textContent = held.textContent;
            }

            const isSkippedAsNoModule = element.noModule === true;

            held.parentNode.insertBefore(element, held.nextSibling);

            if (!source || isSkippedAsNoModule) resolve();
        }),

        warnUnknownCategories: () => {
            const categories = Object.values(ConsentCategory);

            document.querySelectorAll(HeldSelector).forEach((held) => {
                const category = held.getAttribute("data-consent");

                if (!categories.includes(category)) console.warn(InstallWarning.getHeldCategoryText(category));
            });
        },
    };

    const Styles = `
        :host { all: initial !important; display: contents !important; font-family: inherit !important; }
        .banner, dialog { font-family: inherit; font-size: 13px; font-weight: 400; font-style: normal; line-height: 20px; letter-spacing: normal; word-spacing: normal; text-align: left; text-indent: 0; text-transform: none; text-shadow: none; white-space: normal; color: #201f24; visibility: visible; -webkit-font-smoothing: antialiased; }
        *, *::before, *::after { box-sizing: border-box; }
        :focus-visible { outline: 2.5px solid #8f8e91; outline-offset: 3px; }
        a:focus-visible, .link:focus-visible { outline-offset: 0; }
        a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        a:hover { color: #4e5af9; }
        .banner { position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; max-width: 400px; margin-left: auto; padding: 20px; display: grid; gap: 8px; background: #fff; border: 1px solid #ededed; border-radius: 8px; box-shadow: 0 0 20px 0 rgba(32, 31, 36, 0.16); }
        .banner[hidden] { display: none; }
        .title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 400; }
        .text, .item-text, .foot { margin: 0; color: #5e5d61; }
        .link { padding: 0; font: inherit; background: none; border: 0; color: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .link:hover { color: #4e5af9; }
        .actions { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .button { min-height: 32px; padding: 5px 11px; font: inherit; font-weight: 500; border: 1px solid #c9c9ca; border-radius: 2px; background: transparent; color: #201f24; cursor: pointer; transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1); }
        .button:hover { background: #f6f6f6; }
        .button-primary { border-color: #4e5af9; background: #4e5af9; color: #fff; }
        .button-primary:hover { border-color: #7a83fb; background: #7a83fb; }
        dialog { width: min(600px, calc(100vw - 32px)); max-height: calc(100% - 32px); padding: 0; border: 0; border-radius: 8px; background: #fff; box-shadow: 0 0 20px 0 rgba(32, 31, 36, 0.08); overflow: auto; }
        dialog[open] { display: flex; flex-direction: column; }
        dialog:focus { outline: none; }
        dialog::backdrop { background: rgba(240, 240, 240, 0.6); -webkit-backdrop-filter: blur(2.5px); backdrop-filter: blur(2.5px); }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 12px 12px 20px; border-bottom: 1px solid #ededed; }
        .close { width: 32px; height: 32px; flex: none; display: grid; place-items: center; padding: 0; font: inherit; font-size: 24px; line-height: 1; font-weight: 300; border: 0; border-radius: 2px; background: none; color: #201f24; cursor: pointer; }
        .close:hover { background: #f6f6f6; }
        .body { min-height: 120px; overflow: auto; padding: 20px; display: grid; gap: 12px; background: linear-gradient(#fff 30%, rgba(255, 255, 255, 0)) center top / 100% 40px no-repeat local, linear-gradient(rgba(255, 255, 255, 0), #fff 70%) center bottom / 100% 40px no-repeat local, linear-gradient(rgba(32, 31, 36, 0.14), rgba(32, 31, 36, 0)) center top / 100% 12px no-repeat scroll, linear-gradient(rgba(32, 31, 36, 0), rgba(32, 31, 36, 0.14)) center bottom / 100% 12px no-repeat scroll; }
        .status { margin: 0; padding: 8px 12px; border: 1px solid #ededed; border-radius: 4px; background: #f6f6f6; }
        .items { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
        .item { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px; border: 1px solid #ededed; border-radius: 8px; }
        .item-title { display: inline-block; font-weight: 500; color: #201f24; }
        label { cursor: pointer; }
        .item-text { margin-top: 2px; }
        .always { white-space: nowrap; color: #5e5d61; }
        .note { margin: 8px 0 0; padding: 8px; border: 1px solid #feba00; border-radius: 4px; background: #fff9e8; color: #795f17; }
        .switch { -webkit-appearance: none; appearance: none; flex: none; width: 32px; height: 16px; margin: 2px 0 0; border-radius: 8px; background: radial-gradient(circle, #fff 5.5px, transparent 6px) 0 0 / 16px 16px no-repeat, #8f8e91; cursor: pointer; transition: background-position 100ms cubic-bezier(0.4, 0, 0.2, 1), background-color 100ms cubic-bezier(0.4, 0, 0.2, 1); }
        .switch:checked { background-position: 16px 0; background-color: #201f24; }
        .footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #ededed; }
        .footer .button { min-width: 120px; }
        @media ${SpanningBannerScreen} {
            .banner { max-width: none; }
        }
        @media ${PhoneScreen} {
            .footer { flex-direction: column; }
        }
        @media (forced-colors: active) {
            .switch { -webkit-appearance: auto; appearance: auto; width: 16px; background: none; }
            .body { background: none; }
        }
    `;

    const PrivacyPolicyLink = `<a href="${ConsentConfig.privacyPolicyUrl}" target="_blank" rel="noopener">${ConsentText.privacyPolicy}</a>`;

    const View = {
        isDialogSupported: () => typeof HTMLDialogElement === "function" && typeof HTMLDialogElement.prototype.showModal === "function",

        whenBodyReady: (callback) => {
            if (document.body) {
                callback();
            } else {
                document.addEventListener("DOMContentLoaded", callback, { once: true });
            }
        },

        mountRoot: () => {
            if (ui.root) return ui.root;

            const host = document.createElement("div");

            host.setAttribute("data-centiment-consent", "");
            ui.root = host.attachShadow({ mode: "open" });

            const style = document.createElement("style");

            style.textContent = Styles;
            ui.root.appendChild(style);
            ui.root.addEventListener("click", View.handleClick);
            document.body.prepend(host);

            return ui.root;
        },

        createElementFromHtml: (html) => {
            const template = document.createElement("template");

            template.innerHTML = html.trim();

            return template.content.firstElementChild;
        },

        handleClick: (event) => {
            const target = event.target instanceof Element ? event.target.closest("[data-consent-action]") : null;

            if (!target) return;

            const inPanel = ui.panel !== null && ui.panel.contains(target);
            const method = inPanel ? ConsentMethod.panel : ConsentMethod.banner;
            const action = target.getAttribute("data-consent-action");

            if (action === ConsentAction.accept) Changes.commit({ analytics: true, advertising: true }, method);
            if (action === ConsentAction.reject) Changes.commit({ analytics: false, advertising: false }, method);
            if (action === ConsentAction.save) Changes.commit(Panel.getChoice(), method);
            if (action === ConsentAction.choose) Panel.open(target);
            if (action === ConsentAction.close) Panel.close();
        },
    };

    const Banner = {
        show: () => {
            ui.bannerEnabled = true;
            View.whenBodyReady(Banner.sync);
        },

        hide: () => {
            ui.bannerEnabled = false;
            Banner.remove();
        },

        sync: () => {
            if (Consent.isChoiceKnown(state.consent)) {
                Banner.remove();

                return;
            }

            if (!ui.bannerEnabled || ui.banner) return;

            ui.banner = View.createElementFromHtml(Banner.getHtml());
            Banner.syncVisibility();
            View.mountRoot().appendChild(ui.banner);
            window.addEventListener("resize", Banner.syncProperties);
            Banner.syncProperties();

            if (bannerSizeObserver) bannerSizeObserver.observe(ui.banner);
        },

        remove: () => {
            if (!ui.banner) return;

            if (bannerSizeObserver) bannerSizeObserver.unobserve(ui.banner);

            window.removeEventListener("resize", Banner.syncProperties);
            ui.banner.remove();
            ui.banner = null;
            Banner.syncProperties();
        },

        syncVisibility: () => {
            if (ui.banner) ui.banner.hidden = ui.panel !== null && ui.panel.open;
        },

        getHtml: () => `
            <section class="banner" aria-labelledby="consent-banner-title">
                <h2 class="title" id="consent-banner-title">${ConsentText.bannerTitle}</h2>
                <p class="text">${ConsentText.bannerText} <button type="button" class="link" data-consent-action="${ConsentAction.choose}">${ConsentText.chooseCookies}</button> ${ConsentText.orSeeOur} ${PrivacyPolicyLink}</p>
                <div class="actions">
                    <button type="button" class="button button-primary" data-consent-action="${ConsentAction.reject}">${ConsentText.rejectAll}</button>
                    <button type="button" class="button button-primary" data-consent-action="${ConsentAction.accept}">${ConsentText.acceptAll}</button>
                </div>
            </section>`,

        getHeight: (banner) => Math.ceil(banner.getBoundingClientRect().height + parseFloat(getComputedStyle(banner).bottom)),

        syncProperties: () => {
            if (ui.banner && ui.banner.hidden) return;

            const height = ui.banner ? Banner.getHeight(ui.banner) : 0;

            Banner.syncPixelProperty(BannerHeightProperty, height);
            Banner.syncPixelProperty(PageRoomProperty, window.matchMedia(SpanningBannerScreen).matches ? height : 0);
        },

        syncPixelProperty: (property, pixels) => {
            if (pixels > 0) {
                document.documentElement.style.setProperty(property, `${pixels}px`);
            } else {
                document.documentElement.style.removeProperty(property);
            }
        },
    };

    const Panel = {
        open: (opener) => {
            if (!View.isDialogSupported()) {
                window.open(ConsentConfig.privacyPolicyUrl, "_blank", "noopener");

                return;
            }

            View.whenBodyReady(() => {
                Panel.close();

                const panel = View.createElementFromHtml(Panel.getHtml());

                panel.addEventListener("close", () => {
                    if (ui.panel === panel) Panel.close();
                });
                ui.opener = opener;
                ui.panel = panel;

                View.mountRoot().appendChild(panel);
                panel.showModal();
                panel.focus();
                Banner.syncVisibility();
            });
        },

        close: () => {
            if (!ui.panel) return;

            const panel = ui.panel;
            const opener = ui.opener;

            ui.panel = null;
            ui.opener = null;

            if (panel.open) panel.close();

            panel.remove();
            Banner.syncVisibility();
            Banner.syncProperties();

            if (opener && opener.isConnected) opener.focus();
        },

        getChoice: () => {
            const getInput = (category) => ui.panel.querySelector(`[data-consent-category="${category}"]`);

            return { analytics: getInput(ConsentCategory.analytics).checked, advertising: getInput(ConsentCategory.advertising).checked };
        },

        getHtml: () => {
            const analyticsVendorNames = Panel.formatList(ConsentConfig.analyticsVendors);
            const advertisingVendorNames = Panel.formatList(ConsentConfig.advertisingVendors);

            const analyticsText = ConsentText.getAnalyticsText(analyticsVendorNames);
            const advertisingText = Panel.joinSentences(ConsentText.getAdvertisingText(advertisingVendorNames), Panel.getUsLawOnlyText(ConsentText.sharing));
            const advertisingDescribedBy = `consent-advertising-text${Panel.isGpcNoteShown() ? " consent-gpc-note" : ""}`;
            const footText = Panel.joinSentences(Panel.getUsLawOnlyText(ConsentText.notSold), `${ConsentText.otherRequests} ${PrivacyPolicyLink}`);

            return `
                <dialog tabindex="-1" aria-labelledby="consent-panel-title">
                    <div class="head">
                        <h2 class="title" id="consent-panel-title">${ConsentText.panelTitle}</h2>
                        <button type="button" class="close" data-consent-action="${ConsentAction.close}" aria-label="${ConsentText.close}">&times;</button>
                    </div>
                    <div class="body">
                        ${Panel.getStatusHtml()}
                        <ul class="items">
                            <li class="item">
                                <div><span class="item-title">${ConsentText.necessary}</span><p class="item-text">${ConsentText.necessaryText}</p></div>
                                <span class="always">${ConsentText.alwaysOn}</span>
                            </li>
                            <li class="item">
                                <div><label class="item-title" for="consent-analytics">${ConsentText.analytics}</label><p class="item-text" id="consent-analytics-text">${analyticsText}</p></div>
                                <input id="consent-analytics" class="switch" type="checkbox" role="switch"
                                    aria-describedby="consent-analytics-text"
                                    data-consent-category="${ConsentCategory.analytics}"${Panel.getCheckedAttribute(ConsentCategory.analytics)}>
                            </li>
                            <li class="item">
                                <div>
                                    <label class="item-title" for="consent-advertising">${ConsentText.advertising}</label><p class="item-text" id="consent-advertising-text">${advertisingText}</p>
                                    ${Panel.getGpcNoteHtml()}
                                </div>
                                <input id="consent-advertising" class="switch" type="checkbox" role="switch"
                                    aria-describedby="${advertisingDescribedBy}"
                                    data-consent-category="${ConsentCategory.advertising}"${Panel.getCheckedAttribute(ConsentCategory.advertising)}>
                            </li>
                        </ul>
                        <p class="foot">${footText}</p>
                    </div>
                    <div class="footer">
                        <button type="button" class="button" data-consent-action="${ConsentAction.reject}">${ConsentText.rejectAll}</button>
                        <button type="button" class="button button-primary" data-consent-action="${ConsentAction.save}">${ConsentText.saveChoices}</button>
                        <button type="button" class="button" data-consent-action="${ConsentAction.accept}">${ConsentText.acceptAll}</button>
                    </div>
                </dialog>`;
        },

        getCheckedAttribute: (category) => (state.consent.choice[category] ? " checked" : ""),

        getStatusHtml: () => {
            const { decided, gpc, choice } = state.consent;

            if (!decided || !Panel.isUsLawWording()) return "";
            if (choice.advertising && gpc) return `<p class="status">${ConsentText.gpcOverride}</p>`;
            if (choice.advertising) return `<p class="status">${ConsentText.advertisingOn}</p>`;

            return `<p class="status">${ConsentText.optedOut}</p>`;
        },

        isGpcNoteShown: () => state.consent.gpc && !state.consent.choice.advertising,

        getGpcNoteHtml: () => {
            if (!Panel.isGpcNoteShown()) return "";

            return `<p class="note" id="consent-gpc-note">${ConsentText.gpcNote}</p>`;
        },

        isUsLawWording: () => state.consent.rules === ConsentRules.optOut || state.consent.gpc,

        getUsLawOnlyText: (text) => (Panel.isUsLawWording() ? text : ""),

        formatList: (items) => {
            if (items.length <= 1) return items.join("");

            const allButLast = items.slice(0, -1);
            const last = items[items.length - 1];

            return `${allButLast.join(", ")} and ${last}`;
        },

        joinSentences: (...items) => {
            const parts = items.filter(Boolean);

            return parts.length > 1 ? parts.map((part) => (Panel.isEndingInLink(part) ? part : `${part}.`)).join(" ") : parts.join("");
        },

        isEndingInLink: (part) => part.endsWith("</a>"),
    };

    const Changes = {
        deriveConsent: () => {
            state.consent = Consent.resolve({ record: state.record, region: visitor.region, gpcSignal: visitor.gpcSignal });
        },

        loadStoredChoice: (cookieValue) => {
            state.cookieValue = cookieValue;
            state.record = Record.decode(cookieValue);
            Changes.deriveConsent();
        },

        saveRecord: (choice, method) => {
            const storedRegionCode = state.record ? state.record.regionCode : null;
            const keepsStoredRegionCode = !Region.isPreciseForGpc(visitor.region) && storedRegionCode !== null;
            const savedRegionCode = keepsStoredRegionCode ? storedRegionCode : visitor.regionCode;

            const record = {
                id: state.record ? state.record.id : Record.createId(),
                policy: ConsentConfig.policyVersion,
                decidedAt: Record.getNowSeconds(),
                method,
                choice: { analytics: choice.analytics, advertising: choice.advertising },
                regionCode: savedRegionCode,
                gpc: state.consent.gpc,
            };

            Cookies.write(ConsentConfig.cookieName, Record.encode(record), ConsentConfig.cookieMaxAgeSeconds);
            state.cookieValue = Cookies.read(ConsentConfig.cookieName);
            state.record = record;
            Changes.deriveConsent();
        },

        // Safari keeps a cookie a script wrote for 7 days at most, so every page writes the stored record again.
        refreshRecord: () => {
            const expiresAt = state.record.decidedAt + ConsentConfig.cookieMaxAgeSeconds;
            const remaining = Math.min(expiresAt - Record.getNowSeconds(), ConsentConfig.cookieMaxAgeSeconds);

            if (remaining > 0) Cookies.write(ConsentConfig.cookieName, state.cookieValue, remaining);
        },

        commit: (choice, method) => {
            const before = state.consent;

            Changes.saveRecord(choice, method);
            Panel.close();
            Banner.remove();

            if (!Consent.isSame(before, state.consent)) Changes.announce(before);
        },

        syncWithStoredChoice: () => {
            const stored = Cookies.read(ConsentConfig.cookieName);

            if (stored === state.cookieValue) return;

            const before = state.consent;

            Changes.loadStoredChoice(stored);

            if (Consent.isSame(before, state.consent)) return;

            Panel.close();
            View.whenBodyReady(Banner.sync);
            Changes.announce(before);
        },

        syncOnChoiceCookieChange: (event) => {
            const isChoiceCookie = (cookie) => cookie.name === ConsentConfig.cookieName;

            if ([...event.changed, ...event.deleted].some(isChoiceCookie)) Changes.syncWithStoredChoice();
        },

        announce: (before) => {
            const after = state.consent;

            Tags.runGuarded(() => Tags.gtag("consent", "update", Consent.getConsentModeState(after)));
            Tags.runGuarded(() => Tags.setHubSpotConsent(after.choice));

            Tags.runGuarded(() => Tags.pushConsentUpdate(after.choice));
            Tags.runGuarded(Tags.loadTagManager);
            Tags.runGuarded(Held.release);

            Changes.dispatchConsentChange(Changes.getSnapshot());

            const categoriesOff = after.decided ? Consent.getDeniedCategories(after.choice) : Consent.getWithdrawnCategories(before.choice, after.choice);

            Cookies.expireCategories(categoriesOff);

            [Tags.setMetaConsent, Tags.setClarityConsent, Tags.setMicrosoftAdsConsent, Tags.setOpenAiConsent]
                .forEach((setConsent) => Tags.runGuarded(() => setConsent(after.choice)));
        },

        dispatchConsentChange: (snapshot) => {
            window.dispatchEvent(new CustomEvent(ConsentChangeEventName, { detail: snapshot }));
        },

        getSnapshot: () => ({
            analytics: state.consent.choice.analytics,
            advertising: state.consent.choice.advertising,
            decided: state.consent.decided,
            rules: state.consent.rules,
            region: visitor.regionCode,
            gpc: state.consent.gpc,
        }),
    };

    // In Node the tests read these sections, and the script stops before any page code.
    if (typeof window === "undefined") {
        globalThis.__centimentConsentCore = { ConsentConfig, Region, Record, Consent, Cookies };

        return;
    }

    if (window.centimentConsent) return;

    // The sites and apps rely on this API even if start() fails before putting the real one in place.
    const InertSnapshot = Object.freeze({
        analytics: false,
        advertising: false,
        decided: false,
        rules: ConsentRules.optIn,
        region: null,
        gpc: false,
    });

    window.centimentConsent = Object.freeze({
        get: () => ({ ...InertSnapshot }),
        onChange: (callback) => {
            callback({ ...InertSnapshot });

            return () => {};
        },
        open: () => {},
        showBanner: () => {},
        hideBanner: () => {},
    });

    start();
})();
