
/**
 * Author: Moin Khan
 * Dated: 20 Nov 2020
 * Lastest Deploy: 20 Nov 2020
 */


//Initialize params
var LocPath = window.location.pathname;
var inputCustom = document.createElement("input");
inputCustom.type = "text";
inputCustom.name = "contact-source"
inputCustom.style = "display: none";
var targetForm = ''

//Hero Input
targetForm = document.getElementById("wf-form-Hero")
if (targetForm) {
    inputCustom.value = "cta-email-hero";
    targetForm.appendChild(inputCustom.cloneNode());
}

//Form Input
targetForm = document.getElementById("cta-form-footer")
if (targetForm) {
    inputCustom.value = "cta-form-footer";
    targetForm.appendChild(inputCustom.cloneNode());
}

//Survey Tool
if (LocPath == '/survey-tool') {
    targetForm = document.getElementById("cta-form-surveytool")
    if (targetForm) {
        inputCustom.value = "cta-email-surveytool";
        targetForm.appendChild(inputCustom.cloneNode());
    }
}

//Audience Panel
if (LocPath == '/audience-panel') {
    targetForm = document.getElementById("wf-form-Survey")
    if (targetForm) {
        inputCustom.value = "cta-email-audiencePanel";
        targetForm.appendChild(inputCustom.cloneNode());
    }
}

//Customers
if (LocPath == '/customers') {
    targetForm = document.getElementById("wf-form-Customers")
    if (targetForm) {
        inputCustom.value = "cta-email-customers";
        targetForm.appendChild(inputCustom.cloneNode());
    }

}

//MOE
if (LocPath == '/margin-of-error') {
    targetForm = document.getElementById("wf-form-Sidebar")
    if (targetForm) {
        inputCustom.value = "cta-email-sidebar";
        targetForm.appendChild(inputCustom.cloneNode());
    }
}


