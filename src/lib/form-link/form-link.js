
const formModules = import.meta.glob(
    '/src/lib/forms/*.pdf',
    {
        eager: true,
    }
);

export default class FormLinkTool {


    static get toolbox() {
        return {
            title: 'Form Link',
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
        if (this.data && this.data.url) {
            if (!this.api.readOnly.isEnabled) {
                return this._createLink(this.data.url, true);
            } else {
                return this._createLink(this.data.url, false);
            }
        } else {
            if (!this.api.readOnly.isEnabled) {
                return this._createLink("", true);
            } else {
                return this._createLink("", false);
            }
        }
    }

    save(blockContent) {

        if (blockContent.tagName === 'DIV') {
            let url = blockContent.querySelector('button').id;
            return {
                url: url,
            };
        }

        if (blockContent.tagName === 'SPAN' && blockContent.id === "defaultText") {
            return {
                url: "",
            };
        }

        if (blockContent.tagName === 'INPUT') {
            let url = blockContent.value;
            return {
                url: url,
            };
        }
    }


    _createLink(url, editable = false) {

        if (!editable) {

            if (url === "") {
                const defaultText = document.createElement('span');
                defaultText.id = "defaultText";
                defaultText.innerText = "Please request the form (hard copy) from 8A Core Lab during office hours: 10:30 AM - 16:00 PM, weekdays only.";
                return defaultText;
            }

            const wrapper = document.createElement('div');

            const buildUrl = formModules[`/src/lib/forms/${url}`].default;
            const button = document.createElement('button');
            button.id = url
            button.classList.add('btn', 'btn-primary', 'mb-2');
            button.innerText = "Download";
            button.onclick = () => {
                window.open(buildUrl, '_blank');
        }

            const iframe = document.createElement('iframe');
            iframe.src = buildUrl;
            iframe.width = "100%";
            iframe.height = "800px";
            wrapper.appendChild(button);
            wrapper.appendChild(iframe);
            return wrapper;
        }

        else if (editable) {
            const input = document.createElement('input');
            input.classList.add('form-control', 'mb-2');
            input.placeholder = "Enter the form name here... (e.g. 'Form1.pdf')";
            input.value = url;
            return input;
        }
    }

}