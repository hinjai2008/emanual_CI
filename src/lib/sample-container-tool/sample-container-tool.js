import { mount } from 'svelte';
import modalContainerImageSelection from '../modalContainerImageSelection/modalContainerImageSelection.svelte';

const imageModules = import.meta.glob(
    '/src/lib/containerImages/*.{avif,gif,heif,jpeg,jpg,png,tiff,webp,svg}',
    {
        eager: true,
        query: {
            enhanced: false
        }
    }
);

export default class SampleContainerTool {

    static get toolbox() {
        return {
            title: 'Sample Container',
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
        if (this.data && this.data.text) {
            if (!this.api.readOnly.isEnabled) {
                return this._createCard(this.data.text, this.data.imageSrc, true);
            }
            return this._createCard(this.data.text, this.data.imageSrc, false);
        } else {
            return this._createCard("", "", true);
        }
    }

    save(blockContent) {
        let text = blockContent.querySelector('.card-text').innerText || "";
        let imageSrc = blockContent.querySelector('img').id

        if (imageSrc === "/placeholder.jpg") {
            imageSrc = "";
        }

        return {
            text: text,
            imageSrc: imageSrc,
        };
    }

    validate(savedData) {
        if (savedData.text.trim() === "") {
            return false;
        }
        return true;
    }

    _createCard(text, imageSrc, editable = false) {
        const card = document.createElement('div');
        card.classList.add('card', 'bg-primary-subtle');
        card.style.width = '18rem';

        const cardBody = document.createElement('div');
        cardBody.classList.add('card-body');

        const cardText = document.createElement('p');
        cardText.classList.add('card-text');
        cardText.innerText = text;

        const image = document.createElement('img');
        image.classList.add('img-thumbnail');

        if (imageSrc && imageModules[`/src/lib/containerImages${imageSrc.replace("%20", " ")}`]) {
            image.id = imageSrc
            image.src = imageModules[`/src/lib/containerImages${imageSrc.replace("%20", " ")}`].default.img.src;
        } else {
            image.classList.add('d-none');
        }

        if (editable) {
            if (!imageSrc || imageSrc === "") {
                image.classList.remove('d-none');
                image.id = "/placeholder.jpg";
                image.src = imageModules['/src/lib/containerImages/placeholder.jpg']?.default.img.src || "";
                image.alt = "Placeholder image";
            }

            cardText.setAttribute('contenteditable', "true");
            cardText.classList.add('editable');
            image.classList.add('position-relative');

            const selectImageButton = document.createElement('button');
            selectImageButton.type = 'button';
            selectImageButton.classList.add('btn', 'btn-secondary', 'position-absolute', 'bottom-0', 'end-0', 'z-1');
            selectImageButton.setAttribute('data-bs-toggle', 'modal');
            let modalId = 'modalContainerImageSelection' + Math.floor(Math.random() * 10000000);
            selectImageButton.setAttribute('data-bs-target', '#' + modalId);
            selectImageButton.innerText = 'Select Image';

            cardBody.appendChild(selectImageButton);

            const modalContainerImageSelectionInstance = mount(modalContainerImageSelection, {
                target: document.body,
                props: {
                    modalId: modalId,
                    targetImageElement: image
                }
            });
        }

        cardBody.appendChild(cardText);
        cardBody.appendChild(image);
        card.appendChild(cardBody);

        return card;
    }
}