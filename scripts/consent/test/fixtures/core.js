/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import vm from "node:vm";
import { getScriptSource } from "./source.js";

const loadCore = (preconsent) => {
    vm.runInThisContext(getScriptSource(preconsent), { filename: "consent.js" });

    const core = globalThis.__centimentConsentCore;

    delete globalThis.__centimentConsentCore;

    return core;
};

export const core = loadCore("pings");
export const googleHeldCore = loadCore("held");

export const PolicyVersion = core.ConsentConfig.policyVersion;
export const OlderPolicyVersion = PolicyVersion - 1;
export const NewerPolicyVersion = PolicyVersion + 1;

export const RecordId = "k3f9x2q8mz";

export const MalformedRecords = {
    notDotted: "accepted",
    choicesNotZeroOrOne: "1.k3f9x2q8mz.1.1761475200.banner.2x.DE.0",
    unknownMethod: "1.k3f9x2q8mz.1.1761475200.sold.11.DE.0",
    laterFormatVersion: "2.k3f9x2q8mz.1.1761475200.banner.11.DE.0",
    idShortAndUpperCase: "1.SHORT.1.1.banner.11.DE.0",
    regionLowerCase: "1.k3f9x2q8mz.1.1761475200.banner.11.de.0",
    gpcNotZeroOrOne: "1.k3f9x2q8mz.1.1761475200.banner.11.DE.2",
    decidedAtNotANumber: "1.k3f9x2q8mz.1.soon.banner.11.DE.0",
    policyNotANumber: "1.k3f9x2q8mz.v2.1761475200.banner.11.DE.0",
    sevenFields: "1.k3f9x2q8mz.1.1761475200.banner.11.DE",
};

export const createRecord = ({ policy = PolicyVersion, method = "banner", analytics = true, advertising = true, region = "DE", gpc = false } = {}) => ({
    id: RecordId,
    policy,
    decidedAt: 1761475200,
    method,
    choice: { analytics, advertising },
    regionCode: region,
    gpc,
});

export const resolve = ({ region, record = null, gpcSignal = false }) =>
    core.Consent.resolve({ record, region: region === null ? null : core.Region.parse(region), gpcSignal });

export const createConsent = ({ analytics = false, advertising = false, refused = false } = {}) => ({ choice: { analytics, advertising }, refused });
