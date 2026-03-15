import "./test-form.css"
import { formModules } from "$lib/form-link/form-link";
import { base } from '$app/paths';
import { form } from "$app/server";

const TIER_OPTION_LABELS = [
    "Biochemistry Test Tier1",
    "Biochemistry Test Tier2",
    "Biochemistry Test Tier3",
    "Haematology Test Tier1",
    "Haematorlogy Test Tier 2",
    "Haematology Test Tier 3",
    "Microbiology Test Tier1",
    "Microbiology Test Tier 2",
    "Microbiology Test Tier 3",
];

function isTierOptionCode(form_code = "") {
    return TIER_OPTION_LABELS.includes(form_code);
}

function getTierNoticeText(tierLabel = "") {
    const contactNumber = tierLabel.includes("Microbiology") ? "29901851" : "34087740";
    return `GCRS ordering was not specifically set up for this test, please order (${tierLabel}) in CMS and contact ${contactNumber} for authorization code.`;
}


export default class TestFormTool {
    static get toolbox() {
        return {
            title: 'Test Form',
            // SVG: simple form/document icon
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" viewBox="0 0 24 24" fill="none" stroke="#1976d2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="3" width="16" height="18" rx="2" fill="#e3f2fd" stroke="#1976d2"/>
  <line x1="8" y1="7" x2="16" y2="7" stroke="#1976d2"/>
  <line x1="8" y1="11" x2="16" y2="11" stroke="#1976d2"/>
  <line x1="8" y1="15" x2="12" y2="15" stroke="#1976d2"/>
</svg>`
        };
    }

    static get isReadOnlySupported() {
        return true;
    }

    constructor({ data, api, config }) {
        this.data = data;
        this.api = api;
        this.config = config || {};
    }

    render() {
        if (this.data && this.data.form) {
            let formData = this.data.form
            const specialTier = formData.specialTier === true || isTierOptionCode(formData.form_code);
            if (!this.api.readOnly.isEnabled) {
                return this._createCard(formData.form_id, formData.form_ref_id, formData.form_code, formData.form_name, formData.form_link, formData.form_external_link, formData.formRequestOnly, true, specialTier);
            }
            return this._createCard(formData.form_id, formData.form_ref_id, formData.form_code, formData.form_name, formData.form_link, formData.form_external_link, formData.formRequestOnly, false, specialTier);
        } else {
            if (!this.api.readOnly.isEnabled) {
                return this._createCard("", "", "", "", "", "", false, true, false);
            } else {
                return this._createCard("", "", "", "", "", "", false, false, false);
            }
        }
    }

    save(blockContent) {

        let form_id = ""
        let form_code = ""
        let form_ref_id = ""
        let form_name = ""
        let form_link = ""
        let form_external_link = ""
        let formRequestOnly = false
        let specialTier = false

        if (blockContent.tagName === 'DIV') {

            if(blockContent.classList.contains('accordion')) {


        form_id = blockContent.getAttribute('data-form_id');
        form_code = blockContent.getAttribute('data-form_code');
        form_ref_id = blockContent.getAttribute('data-form_ref_id');
        form_name = blockContent.getAttribute('data-form_name');
        form_link = blockContent.getAttribute('data-form_link');
        form_external_link = blockContent.getAttribute('data-form_external_link');
        formRequestOnly = blockContent.getAttribute('data-formRequestOnly') === "true" ? true : false;
        specialTier = blockContent.getAttribute('data-specialTier') === "true" ? true : false;

            } else {
                form_id = blockContent.querySelector('.form-select').value
                form_code = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_code') || "";
                form_ref_id = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_ref_id') || "";
                form_name = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_name') || "";
                form_link = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_link') || "";
                form_external_link = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_external_link') || "";
                specialTier = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-special_tier') === "true";
                const inputs = blockContent.querySelectorAll('input');
                inputs.forEach(input => {
                    if (input.checked) {
                        formRequestOnly = input.value === "true" ? true : false;
                    }
                });
            }

        }

        return {
            form: {
                form_id: form_id,
                form_ref_id: form_ref_id,
                form_code: form_code,
                form_name: form_name,
                form_link: form_link,
                form_external_link: form_external_link,
                formRequestOnly: formRequestOnly,
                specialTier: specialTier
        }
    }
    }

    _createCard(form_id, form_ref_id, form_code, form_name, form_link, form_external_link, formRequestOnly=false, editable = false, specialTier = false) {

        const uniqueId = Math.floor(Math.random() * 10000000);

        if  (editable) {

            const selectionsWrapper = document.createElement('div');
            selectionsWrapper.classList.add('d-flex', 'flex-column', 'gap-2');

            const formSelect = document.createElement('select');
            formSelect.classList.add('form-select');

            formSelect.id = "formSelect" + uniqueId;

            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.innerText = "GCRS only";
            defaultOption.setAttribute('data-special_tier', "false");
            formSelect.appendChild(defaultOption);

            TIER_OPTION_LABELS.forEach((tierLabel) => {
                const tierOption = document.createElement('option');
                tierOption.value = `tier:${tierLabel}`;
                tierOption.setAttribute('data-form_id', "");
                tierOption.setAttribute('data-form_ref_id', "");
                tierOption.setAttribute('data-form_code', tierLabel);
                tierOption.setAttribute('data-form_name', "");
                tierOption.setAttribute('data-form_link', "");
                tierOption.setAttribute('data-form_external_link', "");
                tierOption.setAttribute('data-special_tier', "true");
                tierOption.innerText = tierLabel;

                if (form_code === tierLabel || (specialTier && form_code === tierLabel)) {
                    tierOption.selected = true;
                }

                formSelect.appendChild(tierOption);
            });

            this.config.formList.forEach(optionform => {
                const option = document.createElement('option');

                const option_form_id = optionform.id;
                const option_form_ref_id = optionform.refId;
                const option_form_code = optionform.form_code.blocks[0].data.text;
                const option_form_name = optionform.form_name.blocks[0].data.text;
                const option_form_link = optionform.form_link.blocks[0].data.url;
                console.log(optionform);
                const option_form_external_link = optionform.form_external_link.blocks[0].data.text;

                option.value = optionform.id;
                option.setAttribute('data-form_id', option_form_id.toString());
                option.setAttribute('data-form_ref_id', option_form_ref_id.toString());
                option.setAttribute('data-form_code', option_form_code);
                option.setAttribute('data-form_name', option_form_name);
                option.setAttribute('data-form_link', option_form_link);
                option.setAttribute('data-form_external_link', option_form_external_link);
                option.setAttribute('data-special_tier', "false");
                option.innerText = option_form_code + " - " + option_form_name

                if (option_form_code === form_code) {
                    option.selected = true;
                }

                formSelect.appendChild(option);
            });

            const formRequestOnlyRadioTrue= document.createElement('div');
            formRequestOnlyRadioTrue.classList.add('form-check');

            const formRequestOnlyRadioTrueInput = document.createElement('input');
            formRequestOnlyRadioTrueInput.classList.add('form-check-input');
            formRequestOnlyRadioTrueInput.type = 'radio';
            formRequestOnlyRadioTrueInput.id = "formRequestOnlyRadioTrue" + uniqueId;
            formRequestOnlyRadioTrueInput.name = "formRequestOnlyRadio" + uniqueId;
            formRequestOnlyRadioTrueInput.value = "true";
            formRequestOnlyRadioTrueInput.checked = formRequestOnly === true ? true : false;

            const formRequestOnlyRadioTrueLabel = document.createElement('label');
            formRequestOnlyRadioTrueLabel.classList.add('form-check-label');
            formRequestOnlyRadioTrueLabel.setAttribute('for', "formRequestOnlyRadioTrue" + uniqueId);
            formRequestOnlyRadioTrueLabel.innerText = "Requests must be done using the form (GCRS not avaliable)";

            formRequestOnlyRadioTrue.appendChild(formRequestOnlyRadioTrueInput);
            formRequestOnlyRadioTrue.appendChild(formRequestOnlyRadioTrueLabel);

            const formRequestOnlyRadioFalse= document.createElement('div');
            formRequestOnlyRadioFalse.classList.add('form-check');

            const formRequestOnlyRadioFalseInput = document.createElement('input');
            formRequestOnlyRadioFalseInput.classList.add('form-check-input');
            formRequestOnlyRadioFalseInput.type = 'radio';
            formRequestOnlyRadioFalseInput.id = "formRequestOnlyRadioFalse" + uniqueId;
            formRequestOnlyRadioFalseInput.name = "formRequestOnlyRadio" + uniqueId;
            formRequestOnlyRadioFalseInput.value = "false";
            formRequestOnlyRadioFalseInput.checked = formRequestOnly === true ? false : true;

            const formRequestOnlyRadioFalseLabel = document.createElement('label');
            formRequestOnlyRadioFalseLabel.classList.add('form-check-label');
            formRequestOnlyRadioFalseLabel.setAttribute('for', "formRequestOnlyRadioFalse" + uniqueId);
            formRequestOnlyRadioFalseLabel.innerText = "Only for GCRS/CMS downtime";

            formRequestOnlyRadioFalse.appendChild(formRequestOnlyRadioFalseInput);
            formRequestOnlyRadioFalse.appendChild(formRequestOnlyRadioFalseLabel);

            selectionsWrapper.appendChild(formSelect);
            selectionsWrapper.appendChild(formRequestOnlyRadioTrue);
            selectionsWrapper.appendChild(formRequestOnlyRadioFalse);
            return selectionsWrapper;
        }


        if (!editable) {
            const isTierSelection = specialTier || isTierOptionCode(form_code);

            if (isTierSelection) {
                const tierLabel = form_code || "Biochemistry Test Tier1";
                const tierRefId = form_ref_id && form_ref_id !== "" ? form_ref_id : `tier_${uniqueId}`;

                const accordition = document.createElement('div');
                accordition.classList.add('accordion');
                accordition.id = tierRefId;
                accordition.setAttribute('data-form_id', form_id?.toString() || "");
                accordition.setAttribute('data-form_code', tierLabel);
                accordition.setAttribute('data-form_ref_id', tierRefId.toString());
                accordition.setAttribute('data-form_name', "");
                accordition.setAttribute('data-form_link', "");
                accordition.setAttribute('data-form_external_link', "");
                accordition.setAttribute('data-formRequestOnly', "true");
                accordition.setAttribute('data-specialTier', "true");

                const accorditonItem = document.createElement('div');
                accorditonItem.classList.add('accordion-item');

                const accorditionHeader = document.createElement('h2');
                accorditionHeader.classList.add('accordion-header');

                const accorditionHeaderBtn = document.createElement('button');
                accorditionHeaderBtn.classList.add('accordion-button');
                accorditionHeaderBtn.type = 'button';
                accorditionHeaderBtn.setAttribute('data-bs-toggle', 'collapse');
                accorditionHeaderBtn.setAttribute('data-bs-target', '#' + tierRefId + 'Content');
                accorditionHeaderBtn.innerText = "Non specific GCRS test ordering - " + tierLabel;

                const collapseWrapper = document.createElement('div');
                collapseWrapper.classList.add('accordion-collapse', 'collapse', 'show');
                collapseWrapper.id = tierRefId + 'Content';
                collapseWrapper.setAttribute('data-bs-parent', '#' + tierRefId);

                const accordionBody = document.createElement('div');
                accordionBody.classList.add('accordion-body');
                accordionBody.style.width = "100%";

                const noFormLinkMessage = document.createElement('p');
                noFormLinkMessage.classList.add('mb-0');
                noFormLinkMessage.innerText = getTierNoticeText(tierLabel);
                accordionBody.appendChild(noFormLinkMessage);

                accorditionHeader.appendChild(accorditionHeaderBtn);
                accorditonItem.appendChild(accorditionHeader);

                collapseWrapper.appendChild(accordionBody);
                accorditonItem.appendChild(collapseWrapper);

                accordition.appendChild(accorditonItem);

                return accordition;
            }
            
            // form_link can be empty, but form_id, form_ref_id and form_name cannot be empty
            if (form_name === "" || form_id === "" || form_ref_id === "" || formRequestOnly === null) {
                const defaultMessage = document.createElement('p');
                defaultMessage.classList.add('text-muted', 'mb-0');
                defaultMessage.innerText = "GCRS only";
                return defaultMessage;
            }


        const accordition = document.createElement('div');
        accordition.classList.add('accordion');
        accordition.id = form_ref_id;
        accordition.setAttribute('data-form_id', form_id.toString());
        accordition.setAttribute('data-form_code', form_code);
        accordition.setAttribute('data-form_ref_id', form_ref_id.toString());
        accordition.setAttribute('data-form_name', form_name);
        accordition.setAttribute('data-form_link', form_link);
        accordition.setAttribute('data-form_external_link', form_external_link);
        accordition.setAttribute('data-formRequestOnly', formRequestOnly.toString());

        const accorditonItem = document.createElement('div');
        accorditonItem.classList.add('accordion-item');

        const accorditionHeader = document.createElement('h2');
        accorditionHeader.classList.add('accordion-header',);

        const accorditionHeaderBtn = document.createElement('button');
        accorditionHeaderBtn.classList.add('accordion-button', 'collapsed');
        if (formRequestOnly) {
            accorditionHeaderBtn.classList.remove('collapsed');
        }
        accorditionHeaderBtn.type = 'button';
        accorditionHeaderBtn.setAttribute('data-bs-toggle', 'collapse');
        accorditionHeaderBtn.setAttribute('data-bs-target', '#' + form_ref_id + 'Content');
        accorditionHeaderBtn.innerText = formRequestOnly ? "Requests must be done using the form (GCRS not avaliable)" : "Only for GCRS/CMS downtime"
        
        const collapseWrapper = document.createElement('div');
        collapseWrapper.classList.add('accordion-collapse', 'collapse');
        if (formRequestOnly) {
            collapseWrapper.classList.add('show');
        }
        collapseWrapper.id = form_ref_id + 'Content';
        collapseWrapper.setAttribute('data-bs-parent', '#' + form_ref_id);

        const accordionBody = document.createElement('div');
        accordionBody.classList.add('accordion-body');
        accordionBody.style.width = "100%";

        const formLink = document.createElement('a');
        formLink.classList.add('d-block', 'mb-2', 'text-decoration-none', 'text-primary');
        formLink.innerText = form_code + " - " + form_name;
        formLink.href = base + "/form/" + form_id.toString();

        accordionBody.appendChild(formLink);

        if (form_link !== "") {
            const buildUrl = formModules[`/src/lib/forms/${form_link}`].default;
            const downloadButton = document.createElement('button');
            const buttonTone = formRequestOnly ? "btn-primary" : "btn-secondary";
            downloadButton.classList.add('btn', buttonTone, 'btn-sm');
            downloadButton.innerText = "Download Form";
            downloadButton.onclick = () => {
                window.open(buildUrl, '_blank');
            }
            accordionBody.appendChild(downloadButton);
        } else if (form_external_link !== "") {
            const downloadButton = document.createElement('button');
            const buttonTone = formRequestOnly ? "btn-primary" : "btn-secondary";
            downloadButton.classList.add('btn', buttonTone, 'btn-sm');
            downloadButton.innerText = "Download Link";
            downloadButton.onclick = () => {
                // Ensure URL is absolute
                const url = form_external_link.startsWith('http://') || form_external_link.startsWith('https://') 
                    ? form_external_link 
                    : 'https://' + form_external_link;
                window.open(url, '_blank', 'noopener,noreferrer');
            }
            accordionBody.appendChild(downloadButton);
        } else {
            const noFormLinkMessage = document.createElement('p');
            noFormLinkMessage.classList.add('text-muted', 'mb-0');
            noFormLinkMessage.innerText = "Please request the form (hard copy) from 8A Core Lab during office hours: Monday to Friday from 10:30 to 16:00 (closed at 13:00 -14:00);  Saturday from 10:00 a.m. to 12:00 noon) using PAT2198HO.";
            accordionBody.appendChild(noFormLinkMessage);
        }



        accorditionHeader.appendChild(accorditionHeaderBtn);
        accorditonItem.appendChild(accorditionHeader);

        collapseWrapper.appendChild(accordionBody);
        accorditonItem.appendChild(collapseWrapper);

        accordition.appendChild(accorditonItem);


        return accordition;

        }

    }

}