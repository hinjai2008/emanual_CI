export default class SynonymTool {
    static get toolbox() {
        return {
            title: 'Synonym',
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
        if (this.data && this.data.synonymList){
            if (this.data.synonymList.length > 0) {
            if (!this.api.readOnly.isEnabled) {
                return this._createSynonymList(this.data.synonymList, true);
            } else {
                return this._createSynonymList(this.data.synonymList, false);
            }
        }
           else if (this.data.synonymList.length === 0) {
            if (!this.api.readOnly.isEnabled) {
                return this._createSynonymList([], true);
            } else {
                return this._createSynonymList([], false);
            }
        }}
        else {
            if (!this.api.readOnly.isEnabled) {
                return this._createSynonymList([], true);
            } else {
                return this._createSynonymList([], false);
            }
        }
    }

    save(blockContent) {

        if (blockContent.tagName === 'DIV') {
            let synonym = Array.from(blockContent.querySelectorAll('span')).map(span => span.innerText);
            console.log(synonym)
            let synonymList = synonym.map(synonym => synonym.trim()).filter(synonym => synonym !== "");
            return {
                synonymList: synonymList,
            };
        }

        if (blockContent.tagName === 'INPUT') {
            let input = blockContent.value.split(';').map(synonym => synonym.trim()).filter(synonym => synonym !== "");
            return {
                synonymList: input,
            };
        }
    }




    _createSynonymList(synonymList, editable = false) {

        if(!editable) {

            const wrapper = document.createElement('div');

            synonymList.forEach((synonym) => {
                const synonymElement = document.createElement('span');
                synonymElement.classList.add('badge', 'bg-secondary', 'm-1');
                synonymElement.innerText = synonym;
                wrapper.appendChild(synonymElement);
            })

            return wrapper;


        } else if (editable) {
            const input = document.createElement('input');
            input.classList.add('form-control', 'mb-2');
            input.placeholder = 'use ; to separate synonyms';
            console.log(synonymList)
            input.value = synonymList.join('; ');
            return input;
        }


    }

}