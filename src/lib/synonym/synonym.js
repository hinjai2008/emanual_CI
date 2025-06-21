export default class SynonymTool {
    static get toolbox() {
        return {
            title: 'Synonym',
            // SVG: double tilde (≈) symbol, filled with blue color
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" viewBox="0 0 48 48">
  <g>
    <path d="M10 16 Q16 12, 24 16 T38 16" stroke="#1976d2" stroke-width="4" fill="#1976d2" stroke-linecap="round"/>
    <path d="M10 28 Q16 24, 24 28 T38 28" stroke="#1976d2" stroke-width="4" fill=""#1976d2" stroke-linecap="round"/>
  </g>
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