/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ScriptSource } from "../../../scripts/consent/test/fixtures/source.js";
import { Cloudflare, GitHubPages, PlaceholderScript } from "./fixtures.js";
import worker from "../index.js";
import { getRegionCode, RegionPlaceholder } from "../region.js";

afterEach(GitHubPages.restore);

describe("getRegionCode", () => {
    it("gives the country and the state or province, joined", () => {
        assert.equal(getRegionCode({ country: "US", regionCode: "CA" }), "US-CA");
        assert.equal(getRegionCode({ country: "CA", regionCode: "QC" }), "CA-QC");
    });

    it("gives the country alone when Cloudflare has no region code", () => {
        assert.equal(getRegionCode({ country: "DE" }), "DE");
        assert.equal(getRegionCode({ country: "DE", regionCode: "" }), "DE");
    });

    it("gives Cloudflare's own unknowns as they come, XX and T1 for Tor, and XX when the country is missing", () => {
        assert.equal(getRegionCode({ country: "XX" }), "XX");
        assert.equal(getRegionCode({ country: "T1" }), "T1");
        assert.equal(getRegionCode({}), "XX");
    });

    it("gives null without cf, so the request passes through", () => {
        assert.equal(getRegionCode(undefined), null);
    });
});

describe("worker", () => {
    it("places the region in the file and sends a private one-hour cache", async () => {
        GitHubPages.serve(PlaceholderScript);

        const { body, response, ctx } = await Cloudflare.runWorker(Cloudflare.createVisitorRequest({ country: "US", regionCode: "CA" }));

        assert.equal(ctx.passThroughCalls, 1);
        assert.equal(body, "(function () { const placed = \"US-CA\"; })();");
        assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
        assert.equal(response.headers.get("Content-Type"), "application/javascript");
        assert.equal(response.headers.get("ETag"), null);
        assert.equal(response.headers.get("Last-Modified"), null);
    });

    it("drops the origin's Age, so a copy from Cloudflare's cache still gets its full hour in the browser", async () => {
        GitHubPages.serve(PlaceholderScript, { headers: { "Cache-Control": "max-age=14400", Age: "5000" } });

        const { response } = await Cloudflare.runWorker(Cloudflare.createVisitorRequest({ country: "DE" }));

        assert.equal(response.headers.get("Age"), null);
        assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
    });

    it("places a region exactly as Cloudflare sends it, even with a $ in it", async () => {
        GitHubPages.serve(PlaceholderScript);

        const { body } = await Cloudflare.runWorker(Cloudflare.createVisitorRequest({ country: "US", regionCode: "$&" }));

        assert.equal(body, "(function () { const placed = \"US-$&\"; })();");
    });

    it("drops the browser's conditional headers, so a cached file never keeps an old region", async () => {
        const requests = GitHubPages.serve(PlaceholderScript);

        await Cloudflare.runWorker(Cloudflare.createVisitorRequest({ country: "DE" }, { "If-None-Match": "\"abc\"", "If-Modified-Since": "Mon, 26 Oct 2026 10:00:00 GMT" }));

        assert.equal(requests[0].headers.get("If-None-Match"), null);
        assert.equal(requests[0].headers.get("If-Modified-Since"), null);
    });

    it("passes the file through unchanged without cf", async () => {
        GitHubPages.serve(PlaceholderScript);

        const { body, response } = await Cloudflare.runWorker(Cloudflare.createVisitorRequest(undefined));

        assert.equal(body, PlaceholderScript);
        assert.equal(response.headers.get("Cache-Control"), "max-age=600");
    });

    it("passes an origin error through unchanged, even one that carries the placeholder", async () => {
        GitHubPages.serve(PlaceholderScript, { status: 503, headers: { "Cache-Control": "max-age=600", "Content-Length": String(PlaceholderScript.length) } });

        const { body, response } = await Cloudflare.runWorker(Cloudflare.createVisitorRequest({ country: "US", regionCode: "CA" }));

        assert.equal(response.status, 503);
        assert.equal(body, PlaceholderScript);
        assert.equal(response.headers.get("Cache-Control"), "max-age=600");
        assert.equal(response.headers.get("Content-Length"), String(PlaceholderScript.length));
    });

    it("passes a file without the placeholder through unchanged, without the origin's length", async () => {
        GitHubPages.serve("console.log(1);", { headers: { "Cache-Control": "max-age=600", "Content-Length": "999" } });

        const { body, response } = await Cloudflare.runWorker(Cloudflare.createVisitorRequest({ country: "US" }));

        assert.equal(body, "console.log(1);");
        assert.equal(response.headers.get("Cache-Control"), "max-age=600");
        assert.equal(response.headers.get("Content-Length"), null);
    });

    it("keeps GitHub's caching headers on a HEAD request, which carries no file", async () => {
        GitHubPages.serve(PlaceholderScript);

        const { body, response } = await Cloudflare.runWorker(Cloudflare.createVisitorHeadRequest({ country: "US", regionCode: "CA" }));

        assert.equal(body, "");
        assert.equal(response.headers.get("Cache-Control"), "max-age=600");
        assert.equal(response.headers.get("ETag"), "\"abc\"");
    });

    it("asks the runtime to pass through when GitHub Pages breaks off partway through the file", async () => {
        GitHubPages.breakMidFile();

        const ctx = Cloudflare.createContext();

        await assert.rejects(worker.fetch(Cloudflare.createVisitorRequest({ country: "US" }), {}, ctx));
        assert.equal(ctx.passThroughCalls, 1);
    });

    it("asks the runtime to pass through when GitHub Pages fails", async () => {
        GitHubPages.fail();

        const ctx = Cloudflare.createContext();

        await assert.rejects(worker.fetch(Cloudflare.createVisitorRequest({ country: "US" }), {}, ctx));
        assert.equal(ctx.passThroughCalls, 1);
    });
});

describe("consent.js", () => {
    it("carries the placeholder exactly once, so the Worker places one region", () => {
        const placeholderCount = ScriptSource.split(RegionPlaceholder).length - 1;

        assert.equal(placeholderCount, 1);
    });
});
