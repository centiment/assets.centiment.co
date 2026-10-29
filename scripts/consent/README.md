# Centiment cookie consent

One script for every Centiment site and app. It sets Google Consent Mode, loads Tag Manager, shows the banner where the law needs one, keeps one choice on `.centiment.co`, opens the Your privacy choices panel from any footer link, and tells every tag what the visitor chose.

## Install

Put the tag first in the head, before any other script, with `defer` so the page never waits for it, and with `data-cfasync="false"` before `src`, where Cloudflare's docs require it, so Rocket Loader leaves it alone:

```html
<script data-cfasync="false" src="https://assets.centiment.co/scripts/consent/v1/consent.js" data-gtm="GTM-XXXXXXX" defer></script>
```

| Option | Values | Use |
|---|---|---|
| `data-gtm` | a container id, such as `GTM-XXXXXXX` | Tag Manager to load. Leave it out where there is no Tag Manager (the apps today). Any other value loads no Tag Manager, and the console says why. |
| `data-banner` | `off` | No banner when the page loads; a stored choice still applies and undecided visitors in the opt-in regions stay denied. Surveys and the apps. |

Then remove the site's own Tag Manager snippet and turn HubSpot's own cookie banner off.

With `defer` the tag runs once the HTML is parsed: after every script, inline or loaded, that has none of `defer`, `async` or `type="module"`, and after any async script that has already arrived. A tag left on the page outside Tag Manager, such as an old Tag Manager snippet, gtag.js or a pixel, can therefore run before the consent defaults.

So every tag besides this one goes into Tag Manager or is held (see Scripts that cannot move into Tag Manager). The script loads Tag Manager itself, after the consent defaults, so if the script fails to load no tags run. Anything the page pushes to `dataLayer` before the script runs moves behind the defaults, so Tag Manager reads the consent state first. A Google consent command the page pushed, from a `gtag("consent", ...)` left on the page, then comes after the script's defaults, so the console warns: remove it and let the script set consent. If Tag Manager already runs on the page, those entries stay where they are, so Tag Manager does not get them twice, and the console warns: load Tag Manager only through `data-gtm`.

Leave the tag without an `integrity` attribute. The region Worker writes each visitor's region into the file and the file changes with each release, so no single hash matches and the browser would refuse to run the script.

While the banner shows, the script sets two properties on the `html` element:

| Property | Set on | For |
|---|---|---|
| `--centiment-consent-banner-height` | every screen | a fixed or sticky element that must sit above the banner, such as a sheet that opens at the bottom of the screen: `bottom: calc(16px + var(--centiment-consent-banner-height, 0px))` |
| `--centiment-consent-page-room` | a screen narrower than 480px or shorter than 500px, as on a phone upright or on its side, where the banner spans the bottom of the screen; on larger screens the banner is a card in the corner beside the page's end, so the page gets no room and no empty band below its end | the element that scrolls, on a page whose last control could sit under the banner, such as a form's Next button on a phone: `padding-bottom: var(--centiment-consent-page-room, 0px)` |

Both hold the banner's height plus its gap from the bottom edge, in whole pixels; they follow the banner's size as the screen turns or narrows, stay while the panel is open so the page does not jump behind it, and go once the banner goes. The script never changes the page's layout itself, so use them in CSS rather than reading them once.

## Who sees what

| Visitor | Banner | Before a choice | When the browser sends GPC |
|---|---|---|---|
| EU, EEA, UK, Switzerland, Quebec, the EU's outermost regions and Åland, Gibraltar, Jersey, Guernsey, Isle of Man | yes | only necessary cookies; Tag Manager loads and Google's tags send cookieless pings | ignored |
| Any page where the region Worker did not run | yes | as above | ignored, unless the region stored in the choice cookie is one of the states below |
| US in CA, CO, CT, DE, LA, MD, MN, MT, NE, NH, NJ, OR, TX | no | analytics and advertising on | advertising off silently; only a choice saved in the panel while GPC applies overrides it |
| Everyone else, including visitors Cloudflare cannot place | no | analytics and advertising on | ignored, except where Cloudflare cannot place the visitor or places them in the US without a state: there the region stored in the choice cookie decides, so GPC applies as in the row above when that region is one of its states |

After Reject all, or Save choices with both switches off, Tag Manager fires no more Google tags (see Tag Manager setup), and later pages do not load Tag Manager until the visitor allows something, so they send nothing to Google. The request log in Tag Manager setup checks the page where the visitor rejects. In the GPC states, Analytics turned off by the visitor together with advertising turned off by GPC counts as Reject all too.

A choice lasts 12 months. Under the opt-in rules three kinds of stored choice do not count, so the banner asks again: a choice made under an older policy version; a gpc record, which the script saved itself when GPC turned advertising off; and, where the Worker placed the visitor, a panel choice that allows anything and was saved in a region with the opt-out rules, since the panel there opens with Analytics already on. A refusal made in that panel still counts. Under the opt-out rules every stored choice stands, one made under an older policy version included, since there is no banner to ask again. A gpc record is different: it keeps advertising off only in the GPC states, also on a page without GPC, and elsewhere advertising is back on while the Analytics it stored stands. Where Cloudflare cannot place the visitor or places them in the US without a state, the region stored in the record decides which.

When a visitor turns a category off, the page does not reload. The script deletes that category's cookies on the host and its parent domains (`.centiment.co` on centiment.co hosts), and sends the consent call of each tag already running on the page: Google's Consent Mode, HubSpot, the Meta pixel, Clarity, Microsoft's UET and OpenAI's pixel. Each later page with a stored choice deletes the cookies of every category it turns off, so cookies a tag set only on another Centiment host go as well. A tag with no such call, or one that goes on measuring without cookies (Google's tags and Clarity), runs until the visitor leaves the page; on later pages each tag's consent check in Tag Manager, or a held script's category, decides whether it runs.

A page that is already open catches up with a choice made in another tab, or on another Centiment site, as soon as the browser reports the cookie changed (current browsers, on https), and otherwise when it is shown again, its window comes to the front, or the visitor returns to it with the Back button: it signals the new choice as if it were made there, closes an open panel, and drops or brings back the banner.

## Footer link

Every page gets one link that opens the panel. Links added after the page loads work too. Point it at the Privacy policy: the script opens the panel instead, so only a visitor whose browser blocked the script or cannot open a dialog, or who clicks the link before the page has finished loading, lands on the policy. On a browser that cannot open a dialog, Choose cookies and `open()` open the policy in a new tab instead, so the page stays where it is.

```html
<a href="https://www.centiment.co/legal/privacy-policy" data-action="cookie-preferences">Your privacy choices</a>
```

Put California's opt-out icon beside the link on every site, since California's rules require it there, drawn in the link's own text color with `v1/privacy-choices-icon-mono.svg`: the California Attorney General's icon in one color, with the X cut out, for a CSS mask or inline SVG. California's rules let a site change the icon's colors so it stays conspicuous on its page (11 CCR § 7015(b)(3), since 1 January 2026); `v1/privacy-choices-icon.svg` is the Attorney General's original file from oag.ca.gov/privacy/ccpa/icons-download. Make it as tall as the link's capital letters, about the size of the other header and footer icons, as California's rules ask (§ 7015(b)). The CSS sizes it in em of the link's text, so it follows each site's text size, and leaves it on the text's baseline; in a flex row, center it with the text instead. An icon element that sets a font size of its own needs `font-size: inherit`, or the em counts from that size. Hide it from screen readers, so the link's text names the link:

```html
<a href="https://www.centiment.co/legal/privacy-policy" data-action="cookie-preferences"><span class="privacy-choices-icon" aria-hidden="true"></span> Your privacy choices</a>
```

```css
.privacy-choices-icon {
    display: inline-block;
    width: 1.5em;
    height: 0.7em;
    background-color: currentColor;
    forced-color-adjust: none;
    -webkit-mask: url("https://assets.centiment.co/scripts/consent/v1/privacy-choices-icon-mono.svg") center / contain no-repeat;
    mask: url("https://assets.centiment.co/scripts/consent/v1/privacy-choices-icon-mono.svg") center / contain no-repeat;
}

@media (forced-colors: active) {
    .privacy-choices-icon {
        background-color: LinkText;
    }
}
```

## Tag Manager setup

In each container:

- Every Google tag (Google tag, GA4, Google Ads): Advanced Settings, Consent Settings, Require additional consent, `ce_google_tags`. This stops Tag Manager firing Google's tags after Reject all, on the page where the visitor clicks too. A Google tag that fired before the click may still send cookieless pings for what it measures by itself, such as scrolls and outbound clicks, until the visitor leaves the page; the request log below checks it.
- Every other ad tag, such as Meta, LinkedIn, Microsoft or OpenAI: Require additional consent, `ad_storage`.
- OpenAI's tag: also call `oaiq("consent", true)` before `oaiq("init", ...)`. After a withdrawal the pixel keeps its own stored denial, and when the visitor allows advertising again on a page where the pixel has not loaded, only this call clears it; the `ad_storage` check above lets the tag fire only when advertising is allowed, so `true` is always right.
- Every other analytics tag, such as Clarity: Require additional consent, `analytics_storage`.
- Clarity's tag: also call `clarity("consentv2", { ad_Storage: ..., analytics_Storage: ... })` with the dataLayer variables `ce_advertising` and `ce_analytics` when it loads. For visitors from the EEA, the UK and Switzerland, and wherever Clarity's own Consent Mode setting is on, Clarity runs without its cookies until it gets this call. The script makes it only when the visitor changes their choice, so on later pages only the tag tells Clarity.
- A new tag that sets cookies of its own, in `v1/consent.js`:
    - its vendor in `ConsentConfig.analyticsVendors` or `advertisingVendors`, which the panel names;
    - its cookie names in `categoryCookies` in the same object, or a withdrawal leaves them behind;
    - when the tag has a consent call of its own, a `Tags.set...Consent` function beside the others, added to the list `Changes.announce` calls. Then name the tag where Who sees what lists the tags a withdrawal tells, and add its call to the withdrawal tests (`Tags.stub` in `test/fixtures/helpers.js`).
- Keep what the site needs to work, such as a form's handler or a chat, out of Tag Manager: after Reject all, later pages do not load Tag Manager at all.
- Custom tags can trigger on the custom event `ce_consent_update` and read the dataLayer variables `ce_analytics` and `ce_advertising` (`granted` or `denied`).

Tag Manager loads before a choice in the opt-in regions, so a non-Google tag without its consent check fires before consent. Check each container with a request log from Europe before launch: before a choice only Google's hosts, after Reject all nothing from Google (also while scrolling and clicking an outbound link on the page where the visitor rejected), and no tracking cookie (only `ce_consent` and essential cookies).

In the apps, if Tag Manager is added, it stays loaded after login (there is no reload), so keeping ad tags off the app's own pages is a page rule on each tag in the container, not the script's job.

## Scripts that cannot move into Tag Manager

Hold them until their category is granted:

```html
<script type="text/plain" data-consent="analytics" data-src="https://example.com/analytics.js"></script>
<script type="text/plain" data-consent="advertising">/* inline code */</script>
```

`data-consent` is `analytics` or `advertising`; a script in the page's HTML with any other value never runs, and the console says so. Each runs once, in document order; an external one finishes loading before the next starts. Other attributes are copied to the real script. Put them in the page's HTML: one added by script after the page has loaded waits for the visitor's next change of choice.

Hold `scripts/tracker.js` under Analytics too, since it writes the `CentimentTracker` cookie on every page. On Webflow, give the logged-in nav its own cookie read first: it calls tracker.js's `getCookie`, which does not exist until a held tracker.js has run, and never for a visitor who has not allowed Analytics.

## JavaScript API

`window.centimentConsent` is ready as soon as the tag has run: with `defer`, once the HTML is parsed, before DOMContentLoaded and before the page's own deferred and module scripts that follow the tag. Call it from those, or after DOMContentLoaded, never from an inline script in the page. If the script fails before its API is ready, an API that reports nothing allowed is still there. A blocked or failed download leaves no API at all, so call it as `window.centimentConsent?.get()`.

- `get()` returns `{ analytics, advertising, decided, rules, region, gpc }`. `decided` is true once a choice the visitor made in the banner or the panel counts here (see Who sees what); a gpc record the script saved itself leaves it false. `rules` is `"opt-in"` or `"opt-out"`; `region` is the consent region (`"US-CA"`, `"DE"`, `"XX"` when Cloudflare could not place the visitor, `null` when the Worker did not run), for consent only, never for geo features; `gpc` is true when the browser sends GPC and it applies here.
- `onChange(callback)` calls `callback(get())` at once and after every change, a change made in another tab included; it returns a function that unsubscribes.
- `open(opener)` opens the panel, and when it closes gives focus back to `opener`, or without one to whatever had focus when it opened, as long as that element is still on the page. Passed straight to a click listener, it gets the event, which counts as no opener. The apps pass their menu button, since the menu item that was clicked is gone by then. Call it from the click itself: on a browser that cannot open a dialog it opens the Privacy policy in a new tab, which a browser blocks outside a click.
- `showBanner()` shows the banner to an undecided visitor in an opt-in region and does nothing otherwise; `hideBanner()` removes it. The apps call them on login, signup and quote pages and when leaving them.

The page also gets the window event `ce_consent_change`, with `get()` as its `detail`, after every change of consent, made on the page or caught up from another tab or site, and never as the page loads. The `dataLayer` event `ce_consent_update` (see Tag Manager setup) comes after every change too, and also as each page loads wherever the choice is already known: once the visitor has decided, and from the start under the opt-out rules. `v1/consent.d.ts` holds the full types. Each site or app copies the part it uses into its own repo, since another repo cannot import this file, and updates its copy when the file changes.

## Forms

A form that sends leads includes the choice, read from `get()` when it is sent:

| Field | Value |
|---|---|
| `consent_analytics` | `granted` or `denied` |
| `consent_advertising` | `granted` or `denied` |

## The choice cookie

`ce_consent`, on `.centiment.co` on centiment.co hosts and host-only elsewhere, `Secure` on https, 12 months, `SameSite=Lax`. Its value is eight fields joined by dots, as `1.k3f9x2q8mz.1.1761475200.banner.10.DE.0`:

| Field | Example | Meaning |
|---|---|---|
| version | `1` | the format's version |
| record id | `k3f9x2q8mz` | 10 random lowercase letters and digits, kept by every later record that replaces this one |
| policy | `1` | the policy version the choice was saved under |
| decision time | `1761475200` | when the choice was saved, in seconds |
| method | `banner` | `banner`, `panel`, or `gpc` for a record the script saved itself when GPC turned advertising off |
| choices | `10` | Analytics then Advertising, `1` for on and `0` for off |
| region | `DE` | the region the Worker placed when the choice was saved; a choice saved where the Worker did not run, or where Cloudflare could not place the visitor or placed them in the US without a state, keeps the region of the record it replaces, and with no record to replace stores `-`, `XX` or `US` |
| gpc | `0` | `1` when GPC applied as the choice was saved |

A later format must keep reading version 1 records: a script that read only its own format would treat every older cookie as no choice, and where there is no banner, as in the US, a visitor's opt-out would be lost. A new format ships in place, in two releases of the same file, each followed by a purge of the file from Cloudflare's cache once the GitHub Pages deployment has finished, as in Releasing a change. The first still writes version 1 records but also reads the new format; the second, at least an hour after the first purge, once browsers have dropped their older copy, starts writing the new format. Every centiment.co page shares one cached copy of the file, so once Cloudflare's copy is purged an update in place reaches each browser within the hour, apart from a tab left open on the older copy. A new path would instead leave every site that still has the v1 tag writing version 1 records over the new ones until that site changes its tag. Safari keeps a cookie written by a script for 7 days at most, so each page writes it again with what is left of its 12 months; a Safari visitor who stays away for more than a week loses the choice.

## The region Worker

`workers/consent/` serves `v1/consent.js` with the visitor's region placed in it, from Cloudflare's `request.cf`. Its route, in `wrangler.toml`, matches this one file's address on assets.centiment.co, with or without a query string such as `?v=2`, so Cloudflare hands each request for the file to the Worker, and every other file goes to GitHub Pages as before. The route ends in `*` because Cloudflare matches a route against the whole address, query string included. The Worker fetches the file from GitHub Pages and replaces the quoted placeholder in it with the region code, such as `"US-CA"`. On any error it serves the file unchanged, which the script reads as "the Worker did not run" and treats with the opt-in rules.

Why the Worker changes the headers:

- It drops the browser's `If-None-Match` and `If-Modified-Since` before it asks GitHub Pages, so GitHub Pages sends the whole file to place the region in, never a 304 that would leave the browser on an older copy with another region or none.
- It drops GitHub's `ETag`, `Last-Modified` and `Age`, which describe GitHub's copy rather than the placed file, and sends `Cache-Control: private, max-age=3600`, so only the visitor's own browser keeps the placed file, for a full hour, even when the Worker read GitHub's file from Cloudflare's cache.
- A HEAD request, which carries no file, and a file without the placeholder keep GitHub's caching headers, as does an error from GitHub Pages.

Going live, once:

1. Count the daily page loads of every site and app that loads the script: GA4's page views for the sites, plus the apps' and surveys' own counts, since GA4 sees no page without Tag Manager. Past the Workers free plan's 100,000 requests a day, the route serves the plain file until midnight UTC, so every visitor, in the US too, gets the opt-in rules and the banner. If the count comes near that, move the account to the Workers Paid plan first.
2. Deploy from `workers/consent/`: first `npx wrangler deploy --dry-run`, which bundles the Worker without publishing it, then `npx wrangler deploy`. The deployer's environment holds the account id as `CLOUDFLARE_ACCOUNT_ID`, never `wrangler.toml`, since this repo is public, and an API token as `CLOUDFLARE_API_TOKEN`, made from Cloudflare's Edit Cloudflare Workers template and limited to Centiment's account and the centiment.co zone, so it may edit the Worker and the zone's Workers routes.
3. In the centiment.co zone's Workers Routes, set the route's request limit failure mode to Fail open, so a day over the plan's request limit serves the plain file instead of an error.
4. Add a Cache Rule on the same path with Browser TTL set to respect the origin, so a copy the Worker did not place stays in browsers for GitHub Pages' 10 minutes, not the zone's 4 hours.
5. Check that `curl -s -o /dev/null -D - https://assets.centiment.co/scripts/consent/v1/consent.js` shows `Cache-Control: private, max-age=3600`, which means the Worker served the file (a HEAD request, such as `curl -I`, gets GitHub's headers instead), and that the same request with `?v=1` after `consent.js` shows it too.

No site switches to the script before step 5 passes: until then the file carries no region, so every visitor, in the US too, gets the opt-in rules.

## Releasing a change

A push to master reaches every site that loads the script, so each change goes:

1. Run `pnpm test` and `pnpm test:browser`, and see both pass.
2. Merge it into master through a pull request.
3. Once the GitHub Pages deployment has finished, purge the file from Cloudflare's cache.
4. On master, pulled up to date, run `pnpm check:live`. It fetches the live file, puts the placeholder back where the Worker placed the region, and compares the result with `v1/consent.js`; it ends with "The live file matches v1/consent.js" only when they are the same.

Rolling back a bad release: revert the commit, then purge the file from Cloudflare's cache. Visitors who already loaded the bad file keep it for up to an hour, or 10 minutes where the Worker passed it through, since a purge cannot reach a browser's own cache.

## Tests

```sh
pnpm install
pnpm exec playwright install chromium   # once, for the browser tests
pnpm test           # the Worker and the script's rules, on Node's own test runner
pnpm test:browser   # the script on Playwright; every request is routed, so no server runs and nothing reaches the network
```
