import { mount } from 'svelte';
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
        console.log("renderCalled")
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
            buttonsWrapper.appendChild(selectRegisteredContainerButton);
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
        cardBody.appendChild(image);
        card.appendChild(cardBody);

        return card;
    }


    _replaceCodeToLink(cardText) {

        const text = cardText.innerText;
        cardText.setAttribute('rawText', text);

        const regex = /##.*##/g
        const matches = text.match(regex);
        console.log(matches);

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
        linkElement.href = "/container/" + matchingContainer.id.toString();

        if(!matchingContainer.name.blocks || matchingContainer.name.blocks.length === 0) {
            console.error(`No name found for container with code: ${code}`);
            return;
        }

        linkElement.innerText = matchingContainer.name.blocks[0].data.text;
        
        
        cardText.innerHTML = cardText.innerHTML.replace(regex, linkElement.outerHTML);
        
        return;
        
    }
}