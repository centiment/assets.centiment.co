/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { test as base, expect } from "@playwright/test";
import { Cloudflare, ScriptUrl } from "../../../../workers/consent/test/fixtures.js";
import { FixtureHosts, getFixturePage, getHeldScript, TagManagerHost, TagManagerStub, WorkerDidNotRun } from "./site.js";
import { getScriptSource } from "./source.js";

export { expect };

const HeldDelayMs = 150;

const getCloudflareLocation = (region) => {
    const [country, regionCode] = region.split("-");

    return regionCode ? { country, regionCode } : { country };
};

const fetchFromGitHubPages = async (request) => {
    const url = new URL(request.url);

    if (`${url.origin}${url.pathname}` !== ScriptUrl) throw new Error(`No network in the consent tests: ${url}`);

    return new Response(getScriptSource(url.searchParams.get("preconsent")), {
        status: 200,
        headers: { "Content-Type": "application/javascript", "Cache-Control": "max-age=600" },
    });
};

const getConsentScript = async (url) => {
    const region = url.searchParams.get("region");

    if (region === WorkerDidNotRun) return { status: 200, contentType: "application/javascript", body: getScriptSource(url.searchParams.get("preconsent")) };

    const { response, body } = await Cloudflare.runWorker(Object.assign(new Request(url), { cf: getCloudflareLocation(region) }));

    return { status: response.status, headers: Object.fromEntries(response.headers), body };
};

const getFixtureResponse = async (url) => {
    if (url.href.startsWith(ScriptUrl)) return getConsentScript(url);
    if (url.pathname === "/page") return { contentType: "text/html; charset=utf-8", body: getFixturePage(url.searchParams) };
    if (url.pathname.startsWith("/held/")) {
        await new Promise((resolve) => setTimeout(resolve, HeldDelayMs));

        return { contentType: "application/javascript", body: getHeldScript(url.pathname.slice("/held/".length).replace(/\.js$/, "")) };
    }

    return { status: 404, contentType: "text/plain", body: "Not found" };
};

export const test = base.extend({
    gitHubPages: [async ({}, use) => {
        const realFetch = globalThis.fetch;

        globalThis.fetch = fetchFromGitHubPages;
        await use();
        globalThis.fetch = realFetch;
    }, { scope: "worker", auto: true }],

    requests: [async ({ context }, use) => {
        const log = [];

        await context.route("**/*", async (route) => {
            const url = new URL(route.request().url());

            log.push(url);

            if (FixtureHosts.includes(url.hostname)) return route.fulfill(await getFixtureResponse(url));
            if (url.hostname === TagManagerHost) {
                return route.fulfill({ contentType: "application/javascript", body: TagManagerStub });
            }

            return route.abort();
        });

        await use(log);
    }, { auto: true }],
});
