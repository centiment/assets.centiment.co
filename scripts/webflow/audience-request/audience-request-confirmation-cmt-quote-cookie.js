/**
 * Centiment
 *
 * @author    Filip Rurak
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 */

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const confirmEmail = params.get("confirm-email");

    const expires = new Date(Date.now() + (2 * 60 * 60 * 1000)).toUTCString();

    document.cookie = `CMT-QUOTE-SUBMIT-EMAIL=${confirmEmail ?? "empty"}; expires=${expires}; path=/; domain=.centiment.co; SameSite=Lax`;
});
