export const formModules = import.meta.glob(
    '/src/lib/forms/*.pdf',
    {
        eager: true,
    }
);

export default class FormLinkTool {

    static get toolbox() {
        return {
            title: 'Form Link',
            // SVG: matches the attached black chain link icon, smaller size
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="13" viewBox="0 0 24 24">
<path fill-rule="evenodd" clip-rule="evenodd" d="M10.975 14.51a1.05 1.05 0 0 0 0-1.485 2.95 2.95 0 0 1 0-4.172l3.536-3.535a2.95 2.95 0 1 1 4.172 4.172l-1.093 1.092a1.05 1.05 0 0 0 1.485 1.485l1.093-1.092a5.05 5.05 0 0 0-7.142-7.142L9.49 7.368a5.05 5.05 0 0 0 0 7.142c.41.41 1.075.41 1.485 0zm2.05-5.02a1.05 1.05 0 0 0 0 1.485 2.95 2.95 0 0 1 0 4.172l-3.5 3.5a2.95 2.95 0 1 1-4.171-4.172l1.025-1.025a1.05 1.05 0 0 0-1.485-1.485L3.87 12.99a5.05 5.05 0 0 0 7.142 7.142l3.5-3.5a5.05 5.05 0 0 0 0-7.142 1.05 1.05 0 0 0-1.485 0z" fill="#000000"/>
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