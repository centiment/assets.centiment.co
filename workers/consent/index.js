/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { getRegionCode, RegionPlaceholder } from "./region.js";

const PlacedFileCacheControl = "private, max-age=3600";
const CacheCheckHeaders = ["If-None-Match", "If-Modified-Since"];
const OriginCopyHeaders = ["ETag", "Last-Modified", "Age"];

export default {
    async fetch(request, env, ctx) {
        ctx.passThroughOnException();

        const regionCode = getRegionCode(request.cf);
        if (regionCode === null) return fetch(request);

        const response = await fetch(createRequestWithoutCacheChecks(request));
        if (response.status !== 200) return response;

        return placeRegion(response, regionCode);
    },
};

const createRequestWithoutCacheChecks = (request) => {
    const headers = new Headers(request.headers);

    CacheCheckHeaders.forEach((name) => headers.delete(name));

    return new Request(request, { headers });
};

const placeRegion = async (response, regionCode) => {
    const body = await response.text();
    const headers = new Headers(response.headers);

    headers.delete("Content-Length");

    if (!body.includes(RegionPlaceholder)) return new Response(body, { status: response.status, headers });

    OriginCopyHeaders.forEach((name) => headers.delete(name));
    headers.set("Cache-Control", PlacedFileCacheControl);

    return new Response(body.replace(RegionPlaceholder, () => JSON.stringify(regionCode)), {
        status: response.status,
        headers,
    });
};
