
/**
 * Author: Moin Khan
 * Dated: 29 Sep 2020
 * Lastest Deploy: 16 Oct 2020
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

    //Append query string
    if (queryString) {
        var pairs = queryString.split('&')
        pairs.forEach(function (p) {
            var pair = p.split('=')
            var key = pair[0]
            var value = decodeURIComponent(pair[1] || '');
            if (!reservedKeys.includes(key)) {
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
        trackerValue['flow-tracker'].push(item)

    }

    //Append non-centiment referrers   
    if (referrerDomain) {
        var referrer_item = [encodeURIComponent(referrerURL), time]

        if (!Array.isArray(trackerValue['centiment-referrer'])) {
            trackerValue['centiment-referrer'] = []
        }
        trackerValue['centiment-referrer'].push(referrer_item)
    }

    if (typeof (trackerValue['flow-tracker']) == 'undefined') {
        trackerValue['flow-tracker'] = ['none', time]
    }

    if (typeof (trackerValue['centiment-referrer']) == 'undefined') {
        trackerValue['centiment-referrer'] = ['none', time]
    }

    return JSON.stringify(trackerValue)
};




/**
 * Set CentimentTracker Cookie for 30 days
 * 
 * @param {string} value Cookie value to be set
 * 
 * @returns {none}
 */
function setTrackingCookie(value) {
    var cookie = 'CentimentTracker' + '=' + value + '; path=/; domain=.centiment.co'
    var now = new Date()
    now.setTime(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    cookie += '; expires=' + now.toUTCString()
    document.cookie = cookie
}


var date = new Date();
var time = date.getTime();
var reservedKeys = ["flow-tracker", "centiment-referrer"];

var centimentDomains = ["www.centiment.co", "centiment.co", "quote.centiment.co", "temp.centiment.co", "app.centiment.co"]

var currentURL = window.location.href;

var referrerURL = document.referrer;
var referrerDomain = ""

var trackerValue = {}

if (referrerURL) {
    referrerDomain = referrerURL.match(/:\/\/(.[^/]+)/)[1];
}

setTrackingCookie(trackingValue(getCookie('CentimentTracker')))
