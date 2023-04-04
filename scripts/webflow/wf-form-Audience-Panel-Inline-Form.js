var INVALID_CLASSES = [];
var Webflow = Webflow || [];

const form = $("#wf-form-Audience-Panel-Inline-Form");
function margin_of_error(e, n = 1e6, r = 95) {
    if (((z_factor = { 80: 1.28, 85: 1.44, 90: 1.65, 95: 1.96, 99: 2.58 }), z_factor.hasOwnProperty(r))) return (iv = Math.sqrt((4 * (n - 1) * e) / (n - e))), (moe = Math.round((z_factor[r] / iv) * 100)), moe;
    console.error("Invalid confidence level.");
}
function toNextStep() {
    nextStep()
}
function enableNextButton(state) {
    var btns = $('[data-form="next-btn"]');

    if (state) {
        btns.css("pointer-events", "auto");
        btns.css("opacity", "1");
    } else {
        btns.css("pointer-events", "none");
        btns.css("opacity", "0.4");
    }
}
function setError(error) {
    var f = $("#form-custom-error");
    var m = f.find('.error-text');

    if (error) {
        setTimeout(function () {
            f.css("display", "block");
            m.text("•" + error);
        }, 0)
    } else {
        f.css("display", "none");
        m.text("");
    }
}
function addRemoveErrorClass(element, flag) {
    flag ? element.addClass("is_-invalid") : element.removeClass("is_-invalid");
    flag && INVALID_CLASSES.push(element);
}
function removeAllErrorClass() {
    INVALID_CLASSES.forEach(element => element.removeClass("is_-invalid"));
    INVALID_CLASSES = [];
}
const functions = [
    //Global step for back
    function () {
        var a = $('[data-form="back-btn"]');
        a.on("click", function () {
            setError("");
            removeAllErrorClass();
        });
    },
    //Global step for next
    function () {
    },

    // Step 1
    function () {
        var e,
            n = $("#responses-slider"),
            r = $("#responses-field"),
            o = $("#responses-button"),
            t = $("#responses-moe"),
            i = $("#responses-moe-link"),
            j = $("#responses-button"),
            f = n.parents(".slider").find(".slider---progress"),
            u = 500,
            c = 8e3,
            l = !1,
            d = !1,
            v = !0;
        function p(e, n, r) {
            var o, t, i, a;
            if (
                ("range" === r &&
                    ((o = (o = Math.floor(e / n)) >= 4 ? 3 : o),
                        s(),
                        (function (r, t) {
                            a = r + Math.round(((e - o * n) * t) / n);
                        })(t, i)),
                    "field" === r)
            ) {
                if (e >= 50 && e <= 250) o = 0;
                else if (e > 250 && e <= 500) o = 1;
                else if (e > 500 && e <= 1e3) o = 2;
                else {
                    if (!(e > 1e3 && e <= 5e3)) return !1;
                    o = 3;
                }
                s(),
                    (function (r, t) {
                        a = o * n + Math.round(((e - r) * n) / t);
                    })(t, i);
            }
            function s() {
                0 === o && ((t = 50), (i = 200)), 1 === o && ((t = 250), (i = 250)), 2 === o && ((t = 500), (i = 500)), 3 === o && ((t = 1e3), (i = 4e3));
            }
            return a;
        }
        function error(msg) {
            setError(msg);
            msg ? j.css("pointer-events", "none") : j.css("pointer-events", "auto");
        }
        function h(e, n) {
            var r = "https://" + document.domain,
                o = e,
                t = "?",
                i = 0;
            for (var [a, s] of Object.entries(n)) 0 !== i && (t += "&"), (t += a + "=" + s), i++;
            return r + o + t;
        }
        function m() {
            v = r[0].checkValidity();
        }
        function g(e) {
            (l = e[0].validity.rangeUnderflow), (d = e[0].validity.rangeOverflow);
        }
        function w() {
            l && error(`Enter a number ${r.attr('min')} or greater`);
        }
        function M() {
            d && error(`Enter a number ${r.attr('max')} or lower`);
        }
        function k() {
            var e = margin_of_error(u);
            "" !== r.val() && t.text(e);
        }
        function y(e, n, r) {
            var o = (100 * (r - n)) / r + "%";
            e.css("right", o);
        }
        function _() {
            var e = h("/margin-of-error", { sample: u, population: 1e6 });
            i.attr("href", e);
        }
        $(".slider---bar").each(function (e) {
            var n = $(this),
                r = n.find(".input-range"),
                o = n.find(".slider---progress"),
                t = r.val(),
                i = parseInt(r.attr("max")) - parseInt(r.attr("min"));
            r.on("input", function () {
                setError("");
                var e = $(this).val();
                y(o, e, i);
            }),
                y(o, t, i);
        }),
            r.on("focus", function () {
                r.on("keyup", function () {
                    clearTimeout(e),
                        (u = parseInt($(this).val())),
                        (c = p(u, 4e3, "field")),
                        m(),
                        g(r),
                        v
                            ? (_(), w(), k(), u <= 5e3 ? (n.val(c), y(f, c, 16e3)) : u > 5e3 && u <= 1e4 && (n.val(16e3), y(f, 16e3, 16e3)))
                            : (e = setTimeout(function () {
                                w(), M();
                            }, 0));
                }),
                    r.on("keydown", function () {
                        setError("");
                        clearTimeout(e);
                    });
            }),
            n.on("change", function () {
                setError("");
                m();
            }),
            n.on("input", function () {
                setError("");
                var e, n;
                g(r),
                    w(),
                    k(),
                    (c = parseInt($(this).val())),
                    (prevResponses = p(c, 4e3, "range")),
                    (e = prevResponses) >= 50 && e < 250
                        ? (n = 5 * Math.round(e / 5))
                        : e >= 250 && e < 500
                            ? (n = 10 * Math.round(e / 10))
                            : e >= 500 && e < 1e3
                                ? (n = 25 * Math.round(e / 25))
                                : e >= 1e3 && e <= 5e3 && (n = 100 * Math.round(e / 100)),
                    (u = n),
                    _(),
                    r.val(u);
            }),
            r.on("focus", function () {
            }),
            r.on("keypress", function (e) {
                if (13 !== e.which) return;
                if (r[0].checkValidity()) {
                    setError("");
                    enableNextButton(true);
                    e.preventDefault(), toNextStep();
                }
            });
        _(),
            r.val(u),
            r.trigger("input"),
            n.val(c),
            y(f, c, 16e3);

        form.on("init", () => {
            _(),
            r.val(u),
            r.trigger("input"),
            n.val(c),
            y(f, c, 16e3);
        })
    },

    // Step 2
    function () {
        var a = $("#price-targeted-responses"),
            b = $("#price-research-services-analysis"),
            c = $("#price-survey-programming"),
            d = $("#Become-a-survey-respondent"),
            f = $('[data-next-type="accomplish"]');

        function z() {
            const elements = [a, b, c]
            if (d.is(":checked")) {
                for (const el in elements) {
                    (elements[el]).is(":checked") ? (elements[el]).click() : "";
                }
            }
        }
        function y(elements) {
            for (const el in elements) {
                (elements[el]).on("change", function () {
                    if (d.is(":checked")) d.click();
                });
            }
        }
        function reset(elements) {
            for (const el in elements) {
                (elements[el]).is(":checked") ? (elements[el]).click() : "";
            }
        }

        d.on("change", z);
        y([a, b, c]);
        f.on("click", function () {
            if (d.is(":checked")) {
                // reset([a, b, c, d])
                window.location.href = "https://surveyhoney.com/?referrer=audience-pannel-accomplish&utm_campaign=cta-respondent&utm_medium=ap-lp2&utm_source=respondent-traffic";
            };
        });
    },

    // Step 3
    function () {
        var a = $("#questions");

        a.on("focus", function () {
            setTimeout(() => {
                if (!a[0].checkValidity()) {
                    enableNextButton(false);
                }
            }, 10);
        });
        a.on("input", function (e) {
            setError("");
            addRemoveErrorClass(a, false);
            if (!a[0].checkValidity()) {
                enableNextButton(false);
                addRemoveErrorClass(a, true);
            } else {
                enableNextButton(true);
            }
        });
        a.on("blur input", function (e) {
            setError("");
            if (!a[0].checkValidity()) {
                setError(`Enter a number between ${a.attr('min')} and ${a.attr('max')}`);
            }
        });
        a.on("keypress", function (e) {
            if (13 !== e.which) return;
            if (a[0].checkValidity()) {
                setError("");
                enableNextButton(true);
                e.preventDefault(), toNextStep();
            } else {
                a.trigger("input");
            }
        });
    },

    // Step 4 from 3
    function () {
        var a = $("#questions"),
            b = $("#minutes"),
            c = $("#minutes-q"),
            d = $("#estimated-minutes");

        a.on("change", function (e) {
            const q = parseInt(e.target.value);
            let i;
            q >= 1 && q <= 6 ? (i = 1) : q >= 7 && q <= 11 ? (i = 2) : q >= 12 && q <= 16 ? (i = 3) : q >= 17 && q <= 22 ? (i = 4) : q >= 23 && q <= 27 ? (i = 5) : q >= 28 && q <= 32 ? (i = 6) : q >= 33 && q <= 37 ? (i = 7) : q >= 38 && q <= 42 ? (i = 8) : q >= 43 && q <= 47 ? (i = 9) : q >= 48 && q <= 57 ? (i = 10) : q >= 58 && q <= 68 ? (i = 11) : q >= 69 && q <= 79 ? (i = 12) : q >= 80 && q <= 91 ? (i = 13) : q >= 92 && q <= 103 ? (i = 14) : q >= 104 && q <= 112 ? (i = 15) : q >= 113 && q <= 123 ? (i = 16) : q >= 124 && q <= 135 ? (i = 17) : q >= 136 && q <= 147 ? (i = 18) : q >= 148 && q <= 157 ? (i = 19) : q >= 158 && q <= 169 ? (i = 20) : q >= 170 && q <= 179 ? (i = 21) : q >= 180 && q <= 191 ? (i = 22) : q >= 192 && q <= 199 ? (i = 23) : q >= 200 && q <= 208 ? (i = 24) : q >= 209 && q <= 216 ? (i = 25) : q >= 217 && q <= 225 ? (i = 26) : q >= 226 && q <= 233 ? (i = 27) : q >= 234 && q <= 242 ? (i = 28) : q >= 243 && q <= 250 ? (i = 29) : q >= 252 && q <= 259 ? (i = 30) : q >= 260 && q <= 267 ? (i = 31) : q >= 268 && q <= 276 ? (i = 32) : q >= 277 && q <= 284 ? (i = 33) : q >= 285 && q <= 293 ? (i = 34) : q >= 294 && q <= 300 && (i = 35);

            b.text(i),
                d.val(i).trigger("change"),
                c.text(q);
        });
    },

    // Step 4
    function () {
        var a = $('[data-slider="minutes-range"]'),
            b = $("#estimated-minutes"),
            c = $(".slider---progress---tooltip").first(),
            f = a.parents(".minutes-range").find(".slider---progress");
        // .text(50)

        function updateSlider(val) {
            const max = a.attr("max");
            const percent = (1 - (val / max)) * 100

            f.css("right", percent + "%")
        };
        function getSliderValue(val) {
            let value;
            if (val > 0 && val <= 5) {
                value = val / 5 * 250 || 1;
            } else if (val > 5 && val <= 10) {
                value = val / 5 * 250;
            } else if (val > 10 && val <= 15) {
                value = val / 5 * 250;
            } else if (val > 15 && val <= 35) {
                value = 750 + (val - 15) / 20 * 250;
            }

            return value;
        };
        function getValueFromSlider(val) {
            let value;
            if (val > 0 && val <= 250) {
                value = val / 250 * 5 || 1;
            } else if (val > 250 && val <= 500) {
                value = val / 250 * 5;
            } else if (val > 500 && val <= 750) {
                value = val / 250 * 5;
            } else if (val > 750 && val <= 1001) {
                val = Math.min(val, 1000);
                value = 15 + (val - 750) / 250 * 20;
            }

            return Math.ceil(value);
        };

        a.on("input", (e) => {
            const val = getValueFromSlider(e.target.value);
            updateSlider(e.target.value);
            b.val(val),
                c.text(val);
        });
        b.on("input change", function (e) {
            const val = e.target.value;
            setError("");
            addRemoveErrorClass(b, false);
            if (!b[0].checkValidity()) {
                enableNextButton(false);
                setError(`Enter a number between ${b.attr('min')} and ${b.attr('max')}`);
                addRemoveErrorClass(b, true);
            } else {
                enableNextButton(true);
                updateSlider(getSliderValue(val));
                a.val(getSliderValue(val)),
                    c.text(val);
            }
        });
        b.on("keypress", function (e) {
            if (13 !== e.which) return;
            if (b[0].checkValidity()) {
                setError("");
                enableNextButton(true);
                e.preventDefault(), toNextStep();
            } else {
                b.trigger("input");
            }
        });
    },

    // Step 5
    function () {
        var a = $("#audience-description");

        a.on("input", function (e) {
            setError("");
            addRemoveErrorClass(a, false);
            if (e.target.value.length < 10) {
                enableNextButton(false);
            } else {
                enableNextButton(true);
            }
        });
        a.on("blur", function (e) {
            setError("");
            if (e.target.value.length < 10) {
                setError("Please enter at least 10 characters");
                addRemoveErrorClass(a, true);
            }
        });
    },

    // Step 6
    function () {
        var a = $('#tool'),
            b = $('#other-tool');

        function z() {
            if (!a.find(":selected").text()) {
                b.hide();
                return;
            } else {
                if (a.find(":selected").text() === "Other") {
                    b.show();
                    y();
                } else {
                    b.hide();
                    enableNextButton(true);
                    setTimeout(toNextStep, 100);
                }
            }
        }
        function y() {
            if (!b.val()) {
                enableNextButton(false);
            } else {
                enableNextButton(true);
            }
        }

        b.on("keypress", function (e) {
            if (13 !== e.which) return;
            if (b[0].checkValidity()) {
                setError("");
                enableNextButton(true);
                e.preventDefault(), toNextStep();
            } else {
                b.trigger("input");
            }
        });
        a.on("change", z),
            b.on("input", y);
        b.hide();
    },

    // Step 7
    function () {
        var a = $("#email");

        a.on("input", function (e) {
            setError("");
            addRemoveErrorClass(a, false);
            if (!a[0].checkValidity()) {
                enableNextButton(false);
            } else {
                enableNextButton(true);
            }
        });
        a.on("blur", function (e) {
            setError("");
            if (!a[0].checkValidity()) {
                addRemoveErrorClass(a, true);
                setError("Please enter a valid email");
            }
        });
        a.on("keypress", function (e) {
            if (13 !== e.which) return;
            if (a[0].checkValidity()) {
                setError("");
                enableNextButton(true);
                e.preventDefault(), toNextStep();
            } else {
                a.trigger("input");
            }
        });
    },
];

window.addEventListener("pageshow", () => {
    form.trigger('reset');
    form.trigger('init');
});

functions.forEach(f => Webflow.push(f));
