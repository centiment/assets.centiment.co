/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

export const RegionPlaceholder = JSON.stringify("__CENTIMENT_CONSENT_REGION__");

const UnknownCountry = "XX";

const getCode = (value) => (typeof value === "string" ? value.toUpperCase() : "");

export const getRegionCode = (cf) => {
    if (!cf) return null;

    const countryCode = getCode(cf.country) || UnknownCountry;
    const stateCode = getCode(cf.regionCode);

    return stateCode ? `${countryCode}-${stateCode}` : countryCode;
};
