/**
 * Centiment
 *
 * @author    Filip Rurak
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 */

/**
 * /forms/audience-request
 */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("wf-form-Audience-Request");

    form?.addEventListener("submit", (event) => {
        event.preventDefault();

        const confirmEmail = document.getElementById("confirm-email")?.value;

        if (confirmEmail) {
            const expires = new Date(Date.now() + (2 * 60 * 60 * 1000)).toUTCString();
            document.cookie = `CMT-QUOTE-SUBMIT-EMAIL=${confirmEmail}; expires=${expires}; path=/; domain=.centiment.co; SameSite=Lax`;
        }

        event.target.requestSubmit();
    });
});

/**
 * /forms/audience-request-accomplish
 */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("wf-form-Audience-Request-Accomplish");

    form?.addEventListener("submit", (event) => {
        event.preventDefault();

        const confirmEmail = document.getElementById("confirm-email")?.value;

        if (confirmEmail) {
            const expires = new Date(Date.now() + (2 * 60 * 60 * 1000)).toUTCString();
            document.cookie = `CMT-QUOTE-SUBMIT-EMAIL=${confirmEmail}; expires=${expires}; path=/; domain=.centiment.co; SameSite=Lax`;
        }

        event.target.requestSubmit();
    });
});
