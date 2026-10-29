/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import {
    Banner,
    CaliforniaPage,
    Consent,
    Cookies,
    escapeRegExp,
    EuPage,
    expect,
    Page,
    Panel,
    PrivacyPolicyUrl,
    Styles,
    test,
    UsPage,
    WorkerDidNotRun,
} from "./fixtures/index.js";

const GpcNote = "Your browser sends Global Privacy Control, so advertising cookies stay off unless you turn them on here or choose Accept all";
const GpcNoteAtEnd = new RegExp(`${escapeRegExp(GpcNote)}$`);
const GpcOverride = "Advertising cookies are on, overriding your browser's Global Privacy Control";
const AdvertisingOn = "Advertising cookies are on";
const OptedOut = "You're opted out of sale and sharing";
const Sharing = "US privacy laws call this sharing.";
const NotSold = "Centiment does not sell personal information for money.";

const White = 255;
const ShadowBelow = 245;
const StyleProperties = ["background-color", "color", "font-size", "padding-top", "border-top-left-radius", "letter-spacing", "line-height"];

test.describe("GPC in the panel", () => {
    test("a California visitor with GPC is never prompted, and advertising is off over an earlier Accept", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ region: "US-CA" })]);
        await page.goto(CaliforniaPage);
        await Page.settle(page);

        expect(await Consent.get(page)).toMatchObject({ advertising: false, gpc: true });
        await expect(Banner.get(page)).toHaveCount(0);
        await expect(Panel.get(page)).toHaveCount(0);
    });

    test("the panel says the browser sends GPC, and switching Advertising on stands on the next page", async ({ page, context }) => {
        await Page.withGpc(page);
        await page.goto(CaliforniaPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByText(GpcNote)).toBeVisible();
        await expect(Panel.get(page).getByText(GpcNote)).toHaveCSS("font-style", "normal");
        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).not.toBeChecked();

        await Panel.get(page).getByRole("switch", { name: "Advertising" }).check();
        await Panel.get(page).getByRole("button", { name: "Save choices" }).click();

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.panel\.11\.US-CA\.1$/);

        await page.reload();

        expect(await Consent.get(page)).toMatchObject({ advertising: true, gpc: true, decided: true });

        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByText(GpcOverride, { exact: true })).toBeVisible();
        await expect(Panel.get(page).getByText(GpcNote)).toHaveCount(0);
    });

    test("a screen reader hears each switch's text with it, and the GPC note with Advertising", async ({ page }) => {
        await Page.withGpc(page);
        await page.goto(CaliforniaPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByRole("switch", { name: "Analytics" })).toHaveAccessibleDescription(/show us which pages people use$/);
        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).toHaveAccessibleDescription(GpcNoteAtEnd);
    });

    test("Accept all in the panel overrides GPC too", async ({ page, context }) => {
        await Page.withGpc(page);
        await page.goto(CaliforniaPage);
        await Page.getFooterLink(page).click();
        await Panel.get(page).getByRole("button", { name: "Accept all" }).click();

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.panel\.11\.US-CA\.1$/);
        expect(await Consent.get(page)).toMatchObject({ advertising: true });
    });

    test("an override then Reject all turns both off, and they stay off on the next page", async ({ page, context }) => {
        await Page.withGpc(page);
        await page.goto(CaliforniaPage);
        await Page.getFooterLink(page).click();
        await Panel.get(page).getByRole("button", { name: "Accept all" }).click();
        await Page.getFooterLink(page).click();
        await Panel.get(page).getByRole("button", { name: "Reject all" }).click();

        expect((await Cookies.getChoiceCookie(context)).value).toMatch(/\.panel\.00\.US-CA\.1$/);

        await page.reload();

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, decided: true, gpc: true });
    });

    test("where the Worker did not run and the stored region is a GPC state, the panel keeps the US law wording and says the choice overrides GPC", async ({ page, context }) => {
        await Page.withGpc(page);
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", region: "US-CA", gpc: true })]);
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByText(GpcOverride, { exact: true })).toBeVisible();
        await expect(Panel.get(page).getByText(Sharing)).toBeVisible();
        await expect(Panel.get(page).getByText(NotSold)).toBeVisible();
    });

    test("no GPC note where GPC does not apply", async ({ page }) => {
        await Page.withGpc(page);
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page)).toBeVisible();
        await expect(Panel.get(page).getByText(GpcNote)).toHaveCount(0);
        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).toHaveAccessibleDescription(/call this sharing\.$/);
        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).toHaveAttribute("aria-describedby", "consent-advertising-text");
    });
});

test.describe("the panel's status and US law wording", () => {
    test("in an opt-in region a decided visitor sees the choice, with no status line, no US law wording and no period after a lone sentence", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ analytics: false, advertising: false, region: "DE" })]);
        await page.goto(EuPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).not.toBeChecked();
        await expect(Panel.get(page).locator(".status")).toHaveCount(0);
        await expect(Panel.get(page).getByText(Sharing)).toHaveCount(0);
        await expect(Panel.get(page).getByText(NotSold)).toHaveCount(0);
        await expect(Panel.get(page).getByRole("switch", { name: "Advertising" })).toHaveAccessibleDescription(/on other sites$/);
        await expect(Panel.get(page).getByText("For other privacy requests, see our Privacy policy", { exact: true })).toBeVisible();
    });

    test("under the US rules the panel names sharing and says Centiment does not sell for money", async ({ page }) => {
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByText(Sharing)).toBeVisible();
        await expect(Panel.get(page).getByText(`${NotSold} For other privacy requests, see our Privacy policy`, { exact: true })).toBeVisible();
    });

    test("in the US a decided visitor with advertising off sees that they are opted out of sale and sharing", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", advertising: false, region: "US-NY" })]);
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByText(OptedOut, { exact: true })).toBeVisible();
    });

    test("in the US a decided visitor with advertising on sees that advertising cookies are on", async ({ page, context }) => {
        await context.addCookies([Cookies.createChoiceCookie({ method: "panel", region: "US-NY" })]);
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByText(AdvertisingOn, { exact: true })).toBeVisible();
    });
});

test.describe("keyboard", () => {
    test("the banner is the first tab stop on the page, its controls follow in order, and nothing moves focus", async ({ page }) => {
        await page.goto(EuPage);
        await expect(Banner.get(page)).toBeVisible();

        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

        for (const control of [
            Banner.get(page).getByRole("button", { name: "Choose cookies" }),
            Banner.get(page).getByRole("link", { name: "Privacy policy" }),
            Banner.get(page).getByRole("button", { name: "Reject all" }),
            Banner.get(page).getByRole("button", { name: "Accept all" }),
        ]) {
            await page.keyboard.press("Tab");
            await expect(control).toBeFocused();
        }
    });

    test("Choose cookies and the Privacy policy link draw their focus ring on the text, while Reject all keeps its 3px gap", async ({ page }) => {
        await page.goto(EuPage);
        for (const [control, offset] of [
            [Banner.get(page).getByRole("button", { name: "Choose cookies" }), "0px"],
            [Banner.get(page).getByRole("link", { name: "Privacy policy" }), "0px"],
            [Banner.get(page).getByRole("button", { name: "Reject all" }), "3px"],
        ]) {
            await page.keyboard.press("Tab");
            await expect(control).toBeFocused();
            await expect(control).toHaveCSS("outline-offset", offset);
        }
    });

    test("the panel is modal: its controls follow in tab order, the page behind cannot be focused, Esc closes it and focus returns to the link", async ({ page }) => {
        await page.goto(UsPage);

        const link = Page.getFooterLink(page);
        const pageButton = page.locator(".page-button");
        const controls = [
            Panel.get(page).getByRole("button", { name: "Close" }),
            Panel.get(page).getByRole("switch", { name: "Analytics" }),
            Panel.get(page).getByRole("switch", { name: "Advertising" }),
            Panel.get(page).getByRole("link", { name: "Privacy policy" }),
            Panel.get(page).getByRole("button", { name: "Reject all" }),
            Panel.get(page).getByRole("button", { name: "Save choices" }),
            Panel.get(page).getByRole("button", { name: "Accept all" }),
        ];

        await link.focus();
        await page.keyboard.press("Enter");
        await expect(Panel.get(page)).toBeFocused();

        for (const control of controls) {
            await page.keyboard.press("Tab");
            await expect(control).toBeFocused();
        }

        await pageButton.focus();

        await expect(pageButton).not.toBeFocused();

        await page.keyboard.press("Escape");

        await expect(Panel.get(page)).toHaveCount(0);
        await expect(link).toBeFocused();
    });

    test("open with an opener gives focus back to that opener when the panel closes, wherever focus was before", async ({ page }) => {
        await page.goto(UsPage);

        const pageButton = page.locator(".page-button");

        await Page.getFooterLink(page).focus();
        await page.evaluate(() => window.centimentConsent.open(document.querySelector(".page-button")));
        await expect(Panel.get(page)).toBeFocused();
        await page.keyboard.press("Escape");

        await expect(Panel.get(page)).toHaveCount(0);
        await expect(pageButton).toBeFocused();
    });

    test("open passed straight to a click listener gives focus back to the button, also where the browser drops focus on close", async ({ page }) => {
        await page.addInitScript(() => {
            const close = HTMLDialogElement.prototype.close;

            // Leaves focus nowhere once a dialog closes, so only the script's own focus call can bring it back.
            HTMLDialogElement.prototype.close = function (...args) {
                close.apply(this, args);
                document.activeElement.blur();
            };
        });
        await page.goto(UsPage);

        const pageButton = page.locator(".page-button");

        await page.evaluate(() => document.querySelector(".page-button").addEventListener("click", window.centimentConsent.open));
        await pageButton.focus();
        await page.keyboard.press("Enter");
        await expect(Panel.get(page)).toBeFocused();
        await Panel.get(page).getByRole("button", { name: "Close" }).click();

        await expect(Panel.get(page)).toHaveCount(0);
        await expect(pageButton).toBeFocused();
    });
});

test.describe("the panel's switches, links and phone layout", () => {
    const getCenterY = (box) => box.y + box.height / 2;

    test("on a browser that cannot open a dialog, the footer link goes to the Privacy policy", async ({ page }) => {
        await page.addInitScript(() => {
            delete HTMLDialogElement.prototype.showModal;
        });
        await page.route(PrivacyPolicyUrl, (route) => route.fulfill({ contentType: "text/html", body: "<title>Privacy policy</title>" }));
        await page.goto(UsPage);
        await Page.getFooterLink(page).evaluate((link, href) => link.setAttribute("href", href), PrivacyPolicyUrl);
        await Page.getFooterLink(page).click();

        await expect(page).toHaveURL(PrivacyPolicyUrl);
    });

    test("only a switch or its title flips it, both with a pointer, and the switch sits level with its title", async ({ page }) => {
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        const item = Panel.get(page).getByRole("listitem").filter({ hasText: "Analytics" });
        const title = item.locator("label");
        const toggle = Panel.get(page).getByRole("switch", { name: "Analytics" });
        const titleBox = await title.boundingBox();
        const itemBox = await item.boundingBox();

        await expect(toggle).toBeChecked();
        await item.click({ position: { x: itemBox.width / 2, y: getCenterY(titleBox) - itemBox.y } });
        await expect(toggle).toBeChecked();

        await title.click();
        await expect(toggle).not.toBeChecked();

        await expect(title).toHaveCSS("cursor", "pointer");
        await expect(toggle).toHaveCSS("cursor", "pointer");
        expect(Math.abs(getCenterY(await toggle.boundingBox()) - getCenterY(titleBox))).toBeLessThanOrEqual(0.5);
    });

    test("the Privacy policy links open in a new tab", async ({ page }) => {
        await page.goto(EuPage);

        const opensNewTab = async (link) => {
            await expect(link).toHaveAttribute("target", "_blank");
            await expect(link).toHaveAttribute("rel", "noopener");
        };

        await opensNewTab(Banner.get(page).getByRole("link", { name: "Privacy policy" }));
        await Banner.get(page).getByRole("button", { name: "Choose cookies" }).click();
        await opensNewTab(Panel.get(page).getByRole("link", { name: "Privacy policy" }));
    });

    test("in forced colors the switch falls back to the browser's own checkbox, so its state stays visible", async ({ page }) => {
        await page.emulateMedia({ forcedColors: "active" });
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).getByRole("switch", { name: "Analytics" })).toHaveCSS("appearance", "auto");
    });

    test("in the panel Save choices is filled, and Reject all and Accept all are outlined alike", async ({ page }) => {
        await page.goto(EuPage);
        await Banner.get(page).getByRole("button", { name: "Choose cookies" }).click();

        await expect(Panel.get(page).getByRole("button", { name: "Save choices" })).toHaveCSS("background-color", "rgb(78, 90, 249)");

        for (const name of ["Reject all", "Accept all"]) {
            await expect(Panel.get(page).getByRole("button", { name })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
            await expect(Panel.get(page).getByRole("button", { name })).toHaveCSS("color", "rgb(32, 31, 36)");
            await expect(Panel.get(page).getByRole("button", { name })).toHaveCSS("border-top-width", "1px");
            await expect(Panel.get(page).getByRole("button", { name })).toHaveCSS("border-top-color", "rgb(201, 201, 202)");
        }
    });

    test("on a phone the panel's buttons stack in one column, each on one line", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        const boxes = [];

        for (const name of ["Reject all", "Save choices", "Accept all"]) boxes.push(await Panel.get(page).getByRole("button", { name }).boundingBox());

        const [rejectBox, saveBox, acceptBox] = boxes;

        expect(new Set(boxes.map((box) => box.x)).size).toBe(1);
        expect(boxes.map((box) => box.height)).toEqual([32, 32, 32]);
        expect(rejectBox.y).toBeLessThan(saveBox.y);
        expect(saveBox.y).toBeLessThan(acceptBox.y);
    });

    test("on a small phone the panel keeps its title, Close and its buttons in view and scrolls only the middle", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto(EuPage);
        await Banner.get(page).getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(page)).toBeVisible();

        const controls = [
            Panel.get(page).getByRole("heading", { name: "Your privacy choices" }),
            ...["Close", "Reject all", "Save choices", "Accept all"].map((name) => Panel.get(page).getByRole("button", { name })),
        ];
        const areAllInView = async () => {
            const boxes = await Promise.all(controls.map((control) => control.boundingBox()));

            return boxes.every((box) => box.y >= 0 && box.y + box.height <= 568);
        };

        expect(await areAllInView()).toBe(true);
        expect(await Panel.get(page).locator(".body").evaluate((body) => {
            body.scrollTop = body.scrollHeight;

            return body.scrollTop;
        })).toBeGreaterThan(0);
        expect(await areAllInView()).toBe(true);
    });

    test("on a small phone a shadow at the list's edge shows while more of it is hidden that way", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto(CaliforniaPage);
        await Page.getFooterLink(page).click();
        await expect(Panel.get(page)).toBeVisible();

        const list = Panel.get(page).locator(".body");
        const box = await list.boundingBox();
        const getEdgeReds = async () => ({
            top: await Styles.getRedChannelAt(page, box.x + 8, box.y + 3),
            bottom: await Styles.getRedChannelAt(page, box.x + 8, box.y + box.height - 3),
        });

        expect((await getEdgeReds()).top).toBe(White);
        expect((await getEdgeReds()).bottom).toBeLessThan(ShadowBelow);

        await list.evaluate((body) => {
            body.scrollTop = body.scrollHeight;
        });

        await expect.poll(async () => (await getEdgeReds()).bottom).toBe(White);
        expect((await getEdgeReds()).top).toBeLessThan(ShadowBelow);
    });

    test("in forced colors the list draws no shadow, so no white band shows on a dark theme", async ({ page }) => {
        await page.emulateMedia({ forcedColors: "active" });
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        await expect(Panel.get(page).locator(".body")).toHaveCSS("background-image", "none");
    });

    test("on a screen as short as 400 percent zoom the panel wheels down to its last button and still shows part of its list", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 256 });
        await page.goto(EuPage);
        await Banner.get(page).getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(page)).toBeVisible();

        expect(await Panel.get(page).locator(".body").evaluate((body) => {
            const style = getComputedStyle(body);

            return body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        })).toBeGreaterThan(0);

        const title = await Panel.get(page).getByRole("heading", { name: "Your privacy choices" }).boundingBox();

        await page.mouse.move(title.x + 10, title.y + 10);
        await page.mouse.wheel(0, 1000);

        await expect.poll(async () => {
            const box = await Panel.get(page).getByRole("button", { name: "Accept all" }).boundingBox();

            return box.y + box.height <= 256;
        }).toBe(true);
    });

    test("an off switch's grey stands out 3 to 1 from the white panel, and an on switch is near-black", async ({ page }) => {
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        const analytics = Panel.get(page).getByRole("switch", { name: "Analytics" });

        await analytics.setChecked(false);
        await expect(analytics).toHaveCSS("background-color", "rgb(143, 142, 145)");
        await analytics.setChecked(true);
        await expect(analytics).toHaveCSS("background-color", "rgb(32, 31, 36)");
    });
});

test.describe("host page CSS", () => {
    const getAcceptStyle = (page) => Styles.get(Banner.get(page).getByRole("button", { name: "Accept all" }), StyleProperties);

    const getPanelStyle = async (page) => ({
        title: await Styles.get(Panel.get(page).getByRole("heading", { name: "Your privacy choices" }), StyleProperties),
        text: await Styles.get(Panel.get(page).getByText("Keep the site secure and remember your cookie choice"), StyleProperties),
    });

    const getBannerEdges = async (page) => {
        const box = await Banner.get(page).boundingBox();

        return box && { right: Math.round(box.x + box.width), bottom: Math.round(box.y + box.height), width: Math.round(box.width) };
    };

    const PageLookalikeHtml = `<section class="banner">A page banner</section><button type="button" class="button">A page button</button><dialog open>A page dialog</dialog>`;
    const PageLookalikeSelectors = [".banner", ".button", "footer a", "dialog"];

    const getPageLookalikeStyles = (page) => page.evaluate((selectors) => selectors.map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));

        return Array.from(style).filter((name) => !name.startsWith("--")).map((name) => `${selector} ${name}: ${style.getPropertyValue(name)}`);
    }), PageLookalikeSelectors);

    test("global rules like Webflow's, a hidden empty div or a moved one included, do not change the banner", async ({ page }) => {
        await page.goto(EuPage);

        const plain = { style: await getAcceptStyle(page), edges: await getBannerEdges(page) };

        await page.goto(Page.getUrl({ region: "DE", css: "hostile" }));

        const hostile = { style: await getAcceptStyle(page), edges: await getBannerEdges(page) };

        expect(hostile).toEqual(plain);
    });

    test("global rules like Webflow's do not change the panel", async ({ page }) => {
        await page.goto(UsPage);
        await Page.getFooterLink(page).click();

        const plain = await getPanelStyle(page);

        await page.goto(Page.getUrl({ region: "US-NY", css: "hostile" }));
        await Page.getFooterLink(page).click();

        expect(await getPanelStyle(page)).toEqual(plain);
    });

    test("the page's own .banner, .button, link and dialog keep their styles when the banner and then the panel open", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", banner: "off" }));
        await page.locator("main").evaluate((main, html) => main.insertAdjacentHTML("beforeend", html), PageLookalikeHtml);

        const before = await getPageLookalikeStyles(page);

        await page.evaluate(() => window.centimentConsent.showBanner());
        await expect(Banner.get(page)).toBeVisible();

        expect(await getPageLookalikeStyles(page)).toEqual(before);

        await Banner.get(page).getByRole("button", { name: "Choose cookies" }).click();
        await expect(Panel.get(page)).toBeVisible();

        expect(await getPageLookalikeStyles(page)).toEqual(before);
    });

    test("the consent box takes no place in the page's own layout, also in a flex body with a gap", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", css: "flex" }));
        await expect(Banner.get(page)).toBeVisible();

        expect((await page.locator("main").boundingBox()).y).toBe(0);
    });

    test("the banner and the panel use the page's font", async ({ page }) => {
        await page.goto(Page.getUrl({ region: "DE", css: "font" }));

        expect(await Styles.getFontFamily(Banner.get(page).getByRole("heading", { name: "Cookies on Centiment" }))).toBe("Arial, sans-serif");

        await Banner.get(page).getByRole("button", { name: "Choose cookies" }).click();

        expect(await Styles.getFontFamily(Panel.get(page).getByRole("heading", { name: "Your privacy choices" }))).toBe("Arial, sans-serif");
    });
});
