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
    Consent,
    EuPage,
    expect,
    Page,
    test,
    UsPage,
    WorkerDidNotRun,
} from "./fixtures/index.js";
import { UnplacedRegions } from "./fixtures/region-lists.js";

// The Node tests check every code in each list; these show that a page follows each list.

test.describe("rules by region", () => {
    test("an EU country, the UK, an EU outermost region and Quebec get the opt-in rules and the banner", async ({ page }) => {
        for (const region of ["DE", "GB", "RE", "CA-QC"]) {
            await page.goto(Page.getUrl({ region }));

            expect((await Consent.get(page)).rules, region).toBe("opt-in");
            await expect(Banner.get(page), region).toBeVisible();
        }
    });

    test("a US state, a country elsewhere, a visitor Cloudflare cannot place and a malformed code get the opt-out rules and no banner", async ({ page }) => {
        for (const region of ["US-NY", "BR", "XX", "DE;alert(1)"]) {
            await page.goto(Page.getUrl({ region }));

            expect((await Consent.get(page)).rules, region).toBe("opt-out");
            await expect(Banner.get(page), region).toHaveCount(0);
        }
    });

    test("a page where the Worker did not run gets the opt-in rules and the banner", async ({ page }) => {
        await page.goto(Page.getUrl({ region: WorkerDidNotRun }));

        expect(await Consent.get(page)).toMatchObject({ rules: "opt-in", region: null, decided: false });
        await expect(Banner.get(page)).toBeVisible();
    });

    test("Cloudflare's unknowns are reported as XX", async ({ page }) => {
        for (const region of UnplacedRegions) {
            await page.goto(Page.getUrl({ region }));

            expect((await Consent.get(page)).region, region).toBe("XX");
        }
    });
});

test.describe("GPC by region", () => {
    test("an opt-out visitor without GPC starts with both on", async ({ page }) => {
        await page.goto(UsPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: true, advertising: true, gpc: false, decided: false });
    });

    test("GPC in a listed state turns advertising off only", async ({ page }) => {
        await Page.withGpc(page);

        for (const region of ["US-CA", "US-MN", "US-TX"]) {
            await page.context().clearCookies();
            await page.goto(Page.getUrl({ region }));

            expect(await Consent.get(page), region).toMatchObject({ analytics: true, advertising: false, gpc: true });
        }
    });

    test("GPC is ignored in an unlisted state, outside the US, in an opt-in region and when Cloudflare cannot place a visitor with nothing stored", async ({ page }) => {
        await Page.withGpc(page);

        for (const region of ["US-NY", "BR", "XX"]) {
            await page.context().clearCookies();
            await page.goto(Page.getUrl({ region }));

            expect(await Consent.get(page), region).toMatchObject({ analytics: true, advertising: true, gpc: false });
        }

        await page.goto(EuPage);

        expect(await Consent.get(page)).toMatchObject({ analytics: false, advertising: false, gpc: false, rules: "opt-in" });
    });
});
