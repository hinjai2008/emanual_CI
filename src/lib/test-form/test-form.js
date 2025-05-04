import "./test-form.css"
import { formModules } from "$lib/form-link/form-link";
import { base } from '$app/paths';


export default class TestFormTool {
    static get toolbox() {
        return {
            title: 'Test Form',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01M21 16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2L12 4l9 12z"/></svg>'
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
        console.log(this.data)
        if (this.data && this.data.form) {
            let formData = this.data.form
            if (!this.api.readOnly.isEnabled) {
                return this._createCard(formData.form_id, formData.form_ref_id, formData.form_code, formData.form_name, formData.form_link, formData.formRequestOnly, true);
            }
            return this._createCard(formData.form_id, formData.form_ref_id, formData.form_code, formData.form_name, formData.form_link, formData.formRequestOnly, false);
        } else {
            if (!this.api.readOnly.isEnabled) {
                return this._createCard("", "", "", "", "", false, true);
            } else {
                return this._createCard("", "", "", "", "", false, false);
            }  
        }
    }

    save(blockContent) {

        let form_id = ""
        let form_code = ""
        let form_ref_id = ""
        let form_name = ""
        let form_link = ""
        let formRequestOnly = false

        if (blockContent.tagName === 'DIV') {

            if(blockContent.classList.contains('accordion')) {


        form_id = blockContent.getAttribute('data-form_id');
        form_code = blockContent.getAttribute('data-form_code');
        form_ref_id = blockContent.getAttribute('data-form_ref_id');
        form_name = blockContent.getAttribute('data-form_name');
        form_link = blockContent.getAttribute('data-form_link');
        formRequestOnly = blockContent.getAttribute('data-formRequestOnly') === "true" ? true : false;

            } else {
                form_id = blockContent.querySelector('.form-select').value
                form_code = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_code') || "";
                form_ref_id = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_ref_id') || "";
                form_name = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_name') || "";
                form_link = blockContent.querySelector('.form-select').options[blockContent.querySelector('.form-select').selectedIndex].getAttribute('data-form_link') || "";
                const inputs = blockContent.querySelectorAll('input');
                inputs.forEach(input => {
                    if (input.checked) {
                        formRequestOnly = input.value === "true" ? true : false;
                    }
                });
            }

        }

        console.log(form_id, form_code, form_ref_id, form_name, form_link, formRequestOnly)

        return {
            form: {
                form_id: form_id,
                form_ref_id: form_ref_id,
                form_code: form_code,
                form_name: form_name,
                form_link: form_link,
                formRequestOnly: formRequestOnly
        }
    }
    }

    _createCard(form_id, form_ref_id, form_code, form_name, form_link, formRequestOnly=false, editable = false) {

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
            formSelect.appendChild(defaultOption);

            this.config.formList.forEach(optionform => {
                const option = document.createElement('option');

                const option_form_id = optionform.id;
                const option_form_ref_id = optionform.refId;
                const option_form_code = optionform.form_code.blocks[0].data.text;
                const option_form_name = optionform.form_name.blocks[0].data.text;
                const option_form_link = optionform.form_link.blocks[0].data.url;
                
                option.value = optionform.id;
                option.setAttribute('data-form_id', option_form_id.toString());
                option.setAttribute('data-form_ref_id', option_form_ref_id.toString());
                option.setAttribute('data-form_code', option_form_code);
                option.setAttribute('data-form_name', option_form_name);
                option.setAttribute('data-form_link', option_form_link);
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
        } else {
            const noFormLinkMessage = document.createElement('p');
            noFormLinkMessage.classList.add('text-muted', 'mb-0');
            noFormLinkMessage.innerText = "Please request the form (hard copy) from 8A Core Lab during office hours: 10:30 AM - 16:00 PM, weekdays only.";
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