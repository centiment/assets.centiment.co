/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import worker from "../index.js";
import { RegionPlaceholder } from "../region.js";

export const ScriptUrl = "https://assets.centiment.co/scripts/consent/v1/consent.js";
export const PlaceholderScript = `(function () { const placed = ${RegionPlaceholder}; })();`;
const GitHubPagesHeaders = {
    "Content-Type": "application/javascript",
    "Cache-Control": "max-age=600",
    ETag: "\"abc\"",
    "Last-Modified": "Mon, 26 Oct 2026 10:00:00 GMT",
};

const realFetch = globalThis.fetch;

export const GitHubPages = {
    serve: (body, { status = 200, headers = GitHubPagesHeaders } = {}) => {
        const requests = [];

        globalThis.fetch = async (request) => {
            requests.push(request);

            return new Response(request.method === "HEAD" ? null : body, { status, headers });
        };

        return requests;
    },

    fail: () => {
        globalThis.fetch = async () => { throw new Error("origin down"); };
    },

    breakMidFile: () => {
        globalThis.fetch = async () => new Response(new ReadableStream({ start: (controller) => controller.error(new Error("stream failed")) }), { status: 200 });
    },

    restore: () => {
        globalThis.fetch = realFetch;
    },
};

export const Cloudflare = {
    createVisitorRequest: (cf, headers = {}) => Object.assign(new Request(ScriptUrl, { headers }), { cf }),

    createVisitorHeadRequest: (cf) => Object.assign(new Request(ScriptUrl, { method: "HEAD" }), { cf }),

    createContext: () => {
        const ctx = { passThroughCalls: 0 };

        ctx.passThroughOnException = () => {
            ctx.passThroughCalls += 1;
        };

        return ctx;
    },

    runWorker: async (request) => {
        const ctx = Cloudflare.createContext();
        const response = await worker.fetch(request, {}, ctx);

        return { ctx, response, body: await response.text() };
    },
};
