/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

import { readFileSync } from "node:fs";

export const ScriptSource = readFileSync(new URL("../../v1/consent.js", import.meta.url), "utf8");

const PingsLine = "preconsentGoogle: PreconsentGoogle.pings,";

export const getScriptSource = (preconsent) => {
    const preconsentGoogle = preconsent ?? "pings";

    if (preconsentGoogle === "pings") return ScriptSource;
    if (!ScriptSource.includes(PingsLine)) throw new Error(`consent.js no longer has the line ${PingsLine}`);

    return ScriptSource.replace(PingsLine, `preconsentGoogle: PreconsentGoogle.${preconsentGoogle},`);
};
