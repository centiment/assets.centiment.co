/**
 * Centiment
 *
 * @author    Filip Rurak
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 */

const updatePatternPosition = (progressEl) => {
    const patternEl = document.querySelector(".slider---pattern");
    if (!progressEl || !patternEl) return;

    const progressRight = parseFloat(progressEl.style.right ?? 0);
    patternEl.style.width = `${100 - progressRight}%`;
};

const observeSliderStyles = () => {
    const progressEl = document.querySelector(".slider---progress");

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => mutation.type === "attributes" && updatePatternPosition(progressEl));
    });

    observer.observe(progressEl, { attributes: true, attributeFilter: ["style"] });
};

document.addEventListener("DOMContentLoaded", observeSliderStyles);
