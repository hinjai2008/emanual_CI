export default class LabSelectionTool {

    static get toolbox() {
        return {
            title: 'Lab Selection',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l1.5 4.5h4.5l-3.5 2.5 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-2.5h4.5z"/></svg>'
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
                span3.classList.add('category-name');
                span3.setAttribute('data-category-code', this.data.categoryCode);
                span3.innerText = this.data.categoryName;

                wrapper.appendChild(span1);
                wrapper.appendChild(span2);
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