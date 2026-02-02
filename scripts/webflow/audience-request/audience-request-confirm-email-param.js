/**
 * Centiment
 *
 * @author    Filip Rurak
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("wf-form-Audience-Request");

    form?.addEventListener("submit", (event) => {
        event.preventDefault();

        const data = new FormData(event.target);
        const values = Object.fromEntries(data.entries());
        const confirmEmail = values["Confirm-Email"];

        window.location = `/confirmation/audience-request?intro-ask=skip${confirmEmail?.length ? "&confirm-email=" + confirmEmail : ""}`;
    });
});
