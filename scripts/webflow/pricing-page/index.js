/**
 * Centiment
 *
 * @author    Filip Rurak
 * @copyright Centiment LLC.
 * @link      https://centiment.co
 */

// External scripts' variables
// ————————————————————————————————————————
const isLoggedIn = true;
// ————————————————————————————————————————

const Enums = {
    RecurringInterval: {
        Monthly: "monthly",
        Yearly: "yearly",
    },
};

const Prices = {
    Professional: {
        [Enums.RecurringInterval.Monthly]: {
            "4000": 450,
            "6000": 675,
            "8000": 900,
            "10000": 1125,
            "12000": 1350,
            "14000": 1575,
            "16000": 1800,
        },
        [Enums.RecurringInterval.Yearly]: {
            "4000": 400,
            "6000": 600,
            "8000": 800,
            "10000": 1000,
            "12000": 1200,
            "14000": 1400,
            "16000": 1600,
        },
    },
};

let State = {
    recurringInterval: Enums.RecurringInterval.Yearly,
    interactions: 0,
    sliderValue: 0,
    sliderMax: 7,
};

const Helper = {
    formatPrice: (number) => number.toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    formatReadable: (number) => (Number(number) || 0).toLocaleString("en-US"),
    getProfessionalPlanInteractionsList: () => Object.keys(Prices.Professional[State.recurringInterval]).map(key => parseInt(key)).sort((a, b) => a - b),
};

/**
 * Run interface updates
 */
const runInterfaceUpdates = () => {
    const _runProfessionalPlanCardUpdates = () => {
        const priceValueElement = document.getElementById("professional-price-value");

        // 1. Update price value — e.g. "$1,200"
        if (Prices.Professional[State.recurringInterval][State.interactions]) {
            priceValueElement.innerText = Helper.formatPrice(Prices.Professional[State.recurringInterval][State.interactions]);
        }

        const cardElement = document.getElementById("professional-card");
        const cardInteractionsElement = document.getElementById("professional-card-interactions");
        const cardButtonLabelElement = document.getElementById("professional-card-button-label");

        // 1. Update interactions bullet point — e.g. "12,000 interactions"
        // 2. Update button label
        // 3. Toggle disabled class on plan card
        if (Helper.getProfessionalPlanInteractionsList().includes(State.interactions)) {
            cardInteractionsElement.innerText = `${Helper.formatReadable(State.interactions)} interactions`;
            cardButtonLabelElement.innerText = isLoggedIn ? "Get Professional" : "Get started free";
            cardElement.classList.remove("--disabled");
        } else {
            cardButtonLabelElement.innerText = "Not applicable";
            cardElement.classList.add("--disabled");
        }
    };

    const _runSliderUpdates = () => {
        const sliderPatternElement = document.getElementById("interactions-slider-pattern");

        const percentage = Math.min(100, (State.sliderValue / State.sliderMax) * 100);
        sliderPatternElement.style.width = `${percentage}%`;
    }

    _runProfessionalPlanCardUpdates();
    _runSliderUpdates();
};

/**
 * Watch for input switch updates
 */
const watchRecurringIntervalChanges = () => {
    const switchInput = document.getElementById("recurring-interval-switch");

    switchInput?.addEventListener("click", () => {
        State.recurringInterval = State.recurringInterval === Enums.RecurringInterval.Monthly
            ? Enums.RecurringInterval.Yearly
            : Enums.RecurringInterval.Monthly;

        switchInput.classList.remove(`--${Enums.RecurringInterval.Yearly}`, `--${Enums.RecurringInterval.Monthly}`);
        switchInput.classList.add(`--${State.recurringInterval}`);

        runInterfaceUpdates();
    });
};

/**
 * Watch for range slider updates
 */
const watchInteractionsChanges = () => {
    const rangeInput = document.getElementById("interactions-slider");

    rangeInput?.addEventListener("input", (e) => {
        State.sliderValue = parseInt(e.target.value);
        State.interactions = Helper.getProfessionalPlanInteractionsList()[State.sliderValue];

        runInterfaceUpdates();
    });
};

/**
 * Initialize interactions state
 */
const setLowestInteractions = () => {
    State.interactions = Helper.getProfessionalPlanInteractionsList()[0];
};

const initializePricingPage = () => {
    setLowestInteractions();
    runInterfaceUpdates();

    watchRecurringIntervalChanges();
    watchInteractionsChanges();
};

document.addEventListener("DOMContentLoaded", initializePricingPage);
