export default class LabSelectionTool {

    static get toolbox() {
        return {
            title: 'Lab Selection',
            // SVG: simple flask with blue liquid, easy to identify
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <g>
    <path d="M8 2h8v2h-1v6.586l4.293 4.293a1 1 0 0 1-.707 1.707H5.414a1 1 0 0 1-.707-1.707L9 10.586V4h-1V2z" fill="#2196f3" stroke="#1565c0" stroke-width="1"/>
    <rect x="10" y="2" width="4" height="8" fill="#fff" stroke="#1565c0" stroke-width="1"/>
    <ellipse cx="12" cy="17" rx="7" ry="3" fill="#bbdefb" stroke="#1565c0" stroke-width="1"/>
    <ellipse cx="12" cy="17" rx="4" ry="1.5" fill="#2196f3" opacity="0.7"/>
  </g>
</svg>`
        };
    }

    static get isReadOnlySupported() {
        return true;
    }

    constructor({ data, api, config}) {
        this.data = data;
        this.api = api;
        this.config = config || {};
    }


    save(blockContent) {

        if (blockContent.tagName === 'SELECT') {
            const selectedOption = blockContent.value;

            if (selectedOption === '') {
                return {
                    labName: '',
                    categoryCode: '',
                    categoryName: ''
                };
            }

            if (selectedOption) {
                const [labName, categoryCode, categoryName] = selectedOption.split("#_#");
                return {
                    labName,
                    categoryCode,
                    categoryName
                };
            }
        } else {

            const labName = blockContent.querySelector('.lab-name').innerText;
            const categoryCode = blockContent.querySelector('.category-name').getAttribute('data-category-code');
            const categoryName = blockContent.querySelector('.category-name').innerText;
            
            return {
                labName,
                categoryCode,
                categoryName
            };
        }
    }

    validate(savedData) {

        if (savedData.labName === '' || savedData.categoryCode === '' || savedData.categoryName === '') {
            return false;
        }
        return true;
    }


    render() {
        if (this.data && this.data.labName && this.data.categoryCode && this.data.categoryName) {
            if(this.api.readOnly.isEnabled) {
                
                const wrapper = document.createElement('div');
                wrapper.classList.add('my-2', 'd-flex', 'align-items-center', 'flex-wrap', 'gap-2');

                const labNameSpan = document.createElement('span');
                labNameSpan.classList.add('lab-name');
                labNameSpan.innerText = this.data.labName;

                const categorySpan = document.createElement('span');
                categorySpan.classList.add('category-name', 'd-none');
                categorySpan.setAttribute('data-category-code', this.data.categoryCode);
                categorySpan.innerText = this.data.categoryName;

                wrapper.appendChild(labNameSpan);
                wrapper.appendChild(categorySpan);

                // Find matching lab config entry
                const labList = Array.isArray(this.config.labList) ? this.config.labList : [];
                const labConfig = labList.find(l => l.labName === this.data.labName && l.categoryCode === this.data.categoryCode)
                    || labList.find(l => l.labName === this.data.labName);

                if (labConfig) {
                    // Clickable website / lab manual link
                    if (labConfig.intranet_link) {
                        const href = /^https?:\/\//i.test(labConfig.intranet_link)
                            ? labConfig.intranet_link
                            : 'https://' + labConfig.intranet_link;
                        const link = document.createElement('a');
                        link.href = href;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.innerText = '(Website / Lab Manual)';
                        link.classList.add('small');
                        wrapper.appendChild(link);
                    }

                    // Phone icon with Bootstrap tooltip — only if telephone is available
                    if (labConfig.telephone) {
                        const isSendout = !this.data.labName.startsWith('CMC');

                        const contactLines = ['<span class="lab-tooltip-contact">📞 ' + labConfig.telephone + '</span>'];
                        if (labConfig.fax) {
                            contactLines.push('<span class="lab-tooltip-contact">📠 ' + labConfig.fax + '</span>');
                        }
                        let tooltipHtml = contactLines.join('<br>');
                        if (isSendout) {
                            tooltipHtml += '<div class="lab-tooltip-sendout">For general enquiry on sendout or courier arrangement, please contact CMC Core Lab Reception at ext. 7737</div>';
                        }

                        const phoneIcon = document.createElement('span');
                        phoneIcon.style.cursor = 'help';
                        phoneIcon.setAttribute('role', 'img');
                        phoneIcon.setAttribute('aria-label', 'Contact information');
                        phoneIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

                        if (window.bootstrap && window.bootstrap.Tooltip) {
                            new window.bootstrap.Tooltip(phoneIcon, {
                                title: tooltipHtml,
                                html: true,
                                placement: 'top',
                                customClass: 'lab-contact-tooltip',
                            });
                        }

                        wrapper.appendChild(phoneIcon);
                    }
                }

                return wrapper;

            }

        }
        
        if (!this.api.readOnly.isEnabled) {

            const select = document.createElement('select');
            select.classList.add('lab-selection', 'form-select');

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.innerText = 'Select a lab';
            select.appendChild(defaultOption);

            const labList = this.config.labList;

            for (const lab of labList) {
                const labName = lab.labName;
                const categoryCode = lab.categoryCode;
                const categoryName = lab.categoryName;
                const option = document.createElement('option');
                option.value = labName + "#_#" + categoryCode + "#_#" + categoryName;
                option.innerText = labName + " - " + categoryName;
                select.appendChild(option);
            }

            if (this.data && this.data.labName && this.data.categoryCode && this.data.categoryName) {
                select.value = this.data.labName + "#_#" + this.data.categoryCode + "#_#" + this.data.categoryName;
            } else {
                select.value = '';
            }

            return select;
        }
}

}