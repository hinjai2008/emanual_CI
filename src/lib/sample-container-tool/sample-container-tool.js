import { mount } from 'svelte';
import { base } from '$app/paths';
import modalContainerImageSelection from '../modalContainerImageSelection/modalContainerImageSelection.svelte';
import modalRegisteredContainerSelection from '../modalRegisteredContainerSelection/modalRegisteredContainerSelection.svelte';

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
            // SVG: specimen container with blue cap, simplified lines
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" viewBox="0 0 48 48">
  <rect x="8" y="6" width="32" height="8" rx="2" fill="#4fc3f7" stroke="#1976d2" stroke-width="2"/>
  <path d="M12 14 v22 a4 4 0 0 0 4 4 h16 a4 4 0 0 0 4-4 V14" fill="#fff" stroke="#1976d2" stroke-width="2"/>
  <path d="M16 26 v6" stroke="#90a4ae" stroke-width="2" stroke-linecap="round"/>
  <path d="M16 20 v2" stroke="#90a4ae" stroke-width="2" stroke-linecap="round"/>
  <rect x="8" y="6" width="32" height="8" rx="2" fill="none" stroke="#1976d2" stroke-width="2"/>
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
        if (!this.config.forContinerRegistration) {
            if (this.data && this.data.text) {
                if (!this.api.readOnly.isEnabled) {
                    return this._createCard(this.data.text, this.data.imageSrc, true);
                }
                return this._createCard(this.data.text, this.data.imageSrc, false);
            } else {
                return this._createCard("", "", true);
            }
        }

        else if (this.config.forContinerRegistration) {
            if (this.data && this.data.imageSrc) {
                if (!this.api.readOnly.isEnabled) {
                    return this._createCard("", this.data.imageSrc, true);
                }
                return this._createCard("", this.data.imageSrc, false);
            } else {
                return this._createCard("", "", true);
            }
        }
    }

    save(blockContent) {


        let text = blockContent.querySelector('.card-text').innerText || "";

        if (blockContent.querySelector('.linkToContainer')) {
            text = this.data.text
        }

        let imageSrc = blockContent.querySelector('img').id

        if (imageSrc === "/placeholder.jpg") {
            imageSrc = "";
        }

        if (!this.config.forContinerRegistration) {
        return {
            text: text,
            imageSrc: imageSrc,
        }} 
        
        else {
            return {
                imageSrc: imageSrc,
            }
        }
        
        ;
    }

    validate(savedData) {
        if (!this.config.forContinerRegistration) {
            if (savedData.text.trim() === "") {
                return false;
            }
        }

        if (this.config.forContinerRegistration) {
            if (savedData.imageSrc.trim() === "") {
                return false;
            }
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
        if ((text === "" && !editable) || this.config.forContinerRegistration) {
            cardText.classList.add('d-none');
        }

        cardText.innerText = text;
        this._replaceCodeToLink(cardText);

        if (!editable && (!imageSrc || imageSrc === "")) {
            cardText.classList.add('mb-0');
        }

        const image = document.createElement('img');
        image.classList.add('img-thumbnail');
        image.style.width = '100%';
        image.style.height = '180px';
        image.style.objectFit = 'contain';
        image.style.backgroundColor = '#ffffff';

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

            cardText.innerText = text;
            cardText.setAttribute('contenteditable', "true");
            cardText.classList.add('editable');
            image.classList.add('position-relative');

            const buttonsWrapper = document.createElement('div');
            buttonsWrapper.classList.add('d-flex', 'align-items-end', 'flex-column', 'position-absolute', 'end-0', 'bottom-0', 'z-1');

            const selectImageButton = document.createElement('button');
            selectImageButton.type = 'button';
            selectImageButton.classList.add('btn', 'btn-sm', 'btn-secondary', 'mt-auto');
            selectImageButton.setAttribute('data-bs-toggle', 'modal');
            let imageSelectModalId = 'modalContainerImageSelection' + Math.floor(Math.random() * 10000000);
            selectImageButton.setAttribute('data-bs-target', '#' + imageSelectModalId);
            selectImageButton.innerText = 'Select Image';

            const selectRegisteredContainerButton = document.createElement('button');
            selectRegisteredContainerButton.type = 'button';
            selectRegisteredContainerButton.classList.add('btn', 'btn-sm', 'btn-primary', 'mt-auto');
            selectRegisteredContainerButton.setAttribute('data-bs-toggle', 'modal');
            let containerSelectModalId = 'modalContainerImageSelection' + Math.floor(Math.random() * 10000000);
            selectRegisteredContainerButton.setAttribute('data-bs-target', '#' + containerSelectModalId);
            selectRegisteredContainerButton.innerText = 'Select Registered Container';

            buttonsWrapper.appendChild(selectImageButton);
            if (!this.config.forContinerRegistration) {
            buttonsWrapper.appendChild(selectRegisteredContainerButton);
            }
            cardBody.appendChild(buttonsWrapper);
            

            const modalContainerImageSelectionInstance = mount(modalContainerImageSelection, {
                target: document.body,
                props: {
                    modalId: imageSelectModalId,
                    targetTextElement: cardText,
                    targetImageElement: image
                }
            });

            const modalRegisteredContainerSelectionInstance = mount(modalRegisteredContainerSelection, {
                target: document.body,
                props: {
                    modalId: containerSelectModalId,
                    targetTextElement: cardText,
                    targetImageElement: image
                }
            });
        };

        cardBody.appendChild(cardText);

        if (!editable && !image.classList.contains('d-none')) {
            const modalId = 'containerEnlargeModal' + Math.floor(Math.random() * 10000000);

            const modal = document.createElement('div');
            modal.classList.add('modal', 'fade');
            modal.id = modalId;
            modal.tabIndex = -1;
            modal.setAttribute('aria-hidden', 'true');

            const modalDialog = document.createElement('div');
            modalDialog.classList.add('modal-dialog', 'modal-dialog-centered', 'modal-lg');

            const modalContent = document.createElement('div');
            modalContent.classList.add('modal-content');

            const modalHeader = document.createElement('div');
            modalHeader.classList.add('modal-header', 'border-0', 'pb-0');

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.classList.add('btn-close');
            closeButton.setAttribute('data-bs-dismiss', 'modal');
            closeButton.setAttribute('aria-label', 'Close');

            modalHeader.appendChild(closeButton);

            const modalBody = document.createElement('div');
            modalBody.classList.add('modal-body', 'text-center', 'p-3');

            const enlargedImage = document.createElement('img');
            enlargedImage.src = image.src;
            enlargedImage.style.maxWidth = '100%';
            enlargedImage.style.maxHeight = '80vh';
            enlargedImage.style.objectFit = 'contain';
            enlargedImage.alt = image.alt || 'Container image';

            modalBody.appendChild(enlargedImage);
            modalContent.appendChild(modalHeader);
            modalContent.appendChild(modalBody);
            modalDialog.appendChild(modalContent);
            modal.appendChild(modalDialog);
            document.body.appendChild(modal);

            const imageWrapper = document.createElement('div');
            imageWrapper.style.position = 'relative';
            imageWrapper.style.display = 'block';

            const enlargeButton = document.createElement('button');
            enlargeButton.type = 'button';
            enlargeButton.classList.add('btn', 'btn-sm', 'btn-light', 'position-absolute', 'top-0', 'end-0', 'm-1');
            enlargeButton.style.opacity = '0.85';
            enlargeButton.style.zIndex = '2';
            enlargeButton.title = 'Enlarge image';
            enlargeButton.setAttribute('data-bs-toggle', 'modal');
            enlargeButton.setAttribute('data-bs-target', '#' + modalId);
            enlargeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24"><g id="Complete"><g id="expand"><g><polyline data-name="Right" fill="none" id="Right-2" points="3 17.3 3 21 6.7 21" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="10" x2="3.8" y1="14" y2="20.2"/><line fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="14" x2="20.2" y1="10" y2="3.8"/><polyline data-name="Right" fill="none" id="Right-3" points="21 6.7 21 3 17.3 3" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></g></g></svg>`;

            imageWrapper.appendChild(image);
            imageWrapper.appendChild(enlargeButton);
            cardBody.appendChild(imageWrapper);
        } else {
            cardBody.appendChild(image);
        }

        card.appendChild(cardBody);

        return card;
    }


    _replaceCodeToLink(cardText) {

        const text = cardText.innerText;
        cardText.setAttribute('rawText', text);

        const regex = /##.*##/g
        const matches = text.match(regex);;

        if (!matches) {
            return;
        }

        // Only get the first match
        const code = matches[0].replace(/##/g, "").toUpperCase();

        const containerList = this.config.containerList;

        const matchingContainer = containerList.find(
            (container) => {

                if (!container.code.blocks || container.code.blocks.length === 0) {
                    return false;
                }

                    return container.code.blocks[0].data.text.toUpperCase() === code;
                }
        );

        if (!matchingContainer) {
            console.error(`No matching container found for code: ${code}`);
            return;
        }

        const linkElement = document.createElement('a');
        linkElement.classList.add('text-decoration-none', 'text-primary', 'linkToContainer');
        linkElement.style.cursor = 'pointer';
        linkElement.href = base + "/container/" + matchingContainer.id.toString();

        if(!matchingContainer.name.blocks || matchingContainer.name.blocks.length === 0) {
            console.error(`No name found for container with code: ${code}`);
            return;
        }

        linkElement.innerText = matchingContainer.name.blocks[0].data.text;
        
        
        cardText.innerHTML = cardText.innerHTML.replace(regex, linkElement.outerHTML);
        
        return;
        
    }
}