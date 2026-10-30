/**
 * Centiment
 *
 * @author    Rostyslav Kozar
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 *
 */

export type ConsentRules = "opt-in" | "opt-out";

export interface ConsentState {
    analytics: boolean;
    advertising: boolean;
    decided: boolean;
    rules: ConsentRules;
    region: string | null;
    gpc: boolean;
}

export interface CentimentConsent {
    get(): ConsentState;
    onChange(callback: (state: ConsentState) => void): () => void;
    open(opener?: HTMLElement | Event | null): void;
    showBanner(): void;
    hideBanner(): void;
}

declare global {
    interface Window {
        centimentConsent?: CentimentConsent;
    }

    interface WindowEventMap {
        "ce_consent_change": CustomEvent<ConsentState>;
    }
}
