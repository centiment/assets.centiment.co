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

    document.cookie = `CMT-QUOTE=${confirmEmail ?? "empty"}; expires=${new Date(0).toUTCString()}; path=/; domain=.centiment.co; SameSite=Lax`;
    document.cookie = `CMT-QUOTE=${confirmEmail ?? "empty"}; expires=${expires}; path=/; domain=.centiment.co; SameSite=Lax`;
});
