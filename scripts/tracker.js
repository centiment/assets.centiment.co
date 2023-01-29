
/**
 * Author: Moin Khan
 * Dated: 29 Sep 2020
 * Latest Deploy: 18 Nov 2022
 */


/**
 * Returns value of a cookie otherwise an empty string
 *
 * @param {string} cookieName Name of the cookie to be read
 *
 * @returns {string}
 */
function getCookie(cookieName) {
    var result = document.cookie.match('(^|;)\\s*' + cookieName + '\\s*=\\s*([^;]+)')
    return result ? result.pop() : ''
}



/**
 * Obtain Tracking Parameters as a JSON String
 *
 * @param {string} cookieValue Stored Cookie Value
 * @param {string} queryString Query String of URL
 *
 * @returns {string}
 */
function trackingValue(cookieValue = '', queryString = location.search.slice(1)) {

    if (cookieValue != '') {
        trackerValue = JSON.parse(cookieValue)
    }

    //Append Hutk
    if (getCookie('hubspotutk')) {
        trackerValue['hutk'] = getCookie('hubspotutk')
    }

    //Append First Page
    if (!trackerValue.hasOwnProperty('firstPage')) {
        trackerValue['firstPage'] = [encodeURIComponent(currentURL), time]
    }

    //Append query string
    if (queryString) {
        var pairs = queryString.split('&')
        pairs.forEach(function (p) {
            var pair = p.split('=')
            var key = pair[0]
            var value = decodeURIComponent(pair[1] || '');

            if (!reservedKeys.includes(key)
                && (Object.keys(trackerValue).length <= 15 || trackerValue.hasOwnProperty(key) || key.includes("utm_") || key.includes("gclid"))) {
                trackerValue[key] = value
            }
        });
    }

    //Append centiment current URL
    if (currentURL) {
        var item = [encodeURIComponent(currentURL), time]

        if (!Array.isArray(trackerValue['flow-tracker'])) {
            trackerValue['flow-tracker'] = []
        }

        while (Object.keys(trackerValue['flow-tracker']).length > 19) {
            trackerValue['flow-tracker'].shift()
        }

        trackerValue['flow-tracker'].push(item)
    }
    if (typeof (trackerValue['flow-tracker']) == 'undefined') {
        trackerValue['flow-tracker'] = ['none', time]
    }


    //Append non-centiment referrers
    if (referrerDomain && !centimentDomains.includes(referrerDomain)) {
        var referrer_item = [encodeURIComponent(referrerURL), time]

        if (!Array.isArray(trackerValue['centiment-referrer'])) {
            trackerValue['centiment-referrer'] = []
        }

        while (Object.keys(trackerValue['centiment-referrer']).length > 9) {
            trackerValue['centiment-referrer'].shift()
        }

        trackerValue['centiment-referrer'].push(referrer_item)
    }
    if (typeof (trackerValue['centiment-referrer']) == 'undefined') {
        trackerValue['centiment-referrer'] = ['none', time]
    }


    return JSON.stringify(trackerValue)
};




/**
 * Set Cookie for 30 days
 *
 * @param {string} value Cookie value to be set
 *
 * @param {string} cookie_name Cookie name to be set. Default: CentimentTracker
 *
 * @returns {none}
 */
function setTrackingCookie(value, domain = 'centiment.co', cookie_name = 'CentimentTracker') {
    var cookie = cookie_name + '=' + value + '; path=/; domain=.' + domain
    var now = new Date()
    now.setTime(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    cookie += '; expires=' + now.toUTCString()
    document.cookie = cookie
}


var date = new Date();
var time = date.getTime();

var reservedKeys = ["flow-tracker", "centiment-referrer", "firstPage"];

var centimentDomains = ["www.centiment.co", "centiment.co", "quote.centiment.co", "temp.centiment.co", "app.centiment.co", "assets.centiment.co", "centiment-fs.webflow.io"]

var currentURL = window.location.href;

var trackerValue = {}

var referrerURL = document.referrer;
var referrerDomain = ""
if (referrerURL) {
    referrerDomain = referrerURL.match(/:\/\/(.[^/]+)/)[1];
}

setTrackingCookie(trackingValue(getCookie('CentimentTracker')), "centiment.co")
setTrackingCookie(trackingValue(getCookie('CentimentTracker')), "centiment-fs.webflow.io")
