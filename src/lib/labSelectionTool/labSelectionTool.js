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
                wrapper.classList.add('my-2')

                const span1 = document.createElement('span');
                span1.classList.add('lab-name');
                span1.innerText = this.data.labName;

                const span2 = document.createElement('span');
                span2.innerText = " - "

                const span3 = document.createElement('span');
                span3.classList.add('category-name', 'd-none');
                span3.setAttribute('data-category-code', this.data.categoryCode);
                span3.innerText = this.data.categoryName;

                wrapper.appendChild(span1);
                wrapper.appendChild(span3);

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