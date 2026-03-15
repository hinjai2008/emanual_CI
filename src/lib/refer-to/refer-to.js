const INFO_OPTIONS = [
    'patient preparation',
    'specimen collection',
    'test requirements',
    'consultaiton & endorsement',
];

function joinInfoOptions(options) {
    if (!options || options.length === 0) return '';
    if (options.length === 1) return options[0];
    if (options.length === 2) return `${options[0]} and ${options[1]}`;
    return `${options.slice(0, -1).join(', ')}, and ${options[options.length - 1]}`;
}

function normalizeUrl(url) {
    if (!url) return 'https://www.google.com';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function buildReferToText(infoOptions, intranetLink) {
    const selected = (infoOptions && infoOptions.length > 0) ? infoOptions : INFO_OPTIONS;
    const infoText = joinInfoOptions(selected);
    const displayLink = intranetLink || 'www.google.com';
    const href = normalizeUrl(displayLink);

    return `Additional information and guidelines on ${infoText} are avaiable in the following link: <a href="${href}" target="_blank" rel="noopener noreferrer">${displayLink}</a>`;
}

export default class ReferToTool {
    static get toolbox() {
        return {
            title: 'Refer to...',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
        };
    }

    static get isReadOnlySupported() {
        return true;
    }

    constructor({ data, api, config }) {
        this.data = data || {};
        this.api = api;
        this.config = config || {};
    }

    render() {
        if (this.api.readOnly.isEnabled) {
            const p = document.createElement('p');
            p.innerHTML = this.data.text || buildReferToText(this.data.infoOptions, this.data.intranetLink);
            return p;
        }

        const wrapper = document.createElement('div');
        wrapper.classList.add('border', 'rounded', 'p-2', 'mb-2');

        const selectedInfo = Array.isArray(this.data.infoOptions) && this.data.infoOptions.length > 0
            ? this.data.infoOptions
            : [...INFO_OPTIONS];

        const labs = Array.isArray(this.config.labList) ? this.config.labList : [];
        const labLinks = new Set(labs.map((lab) => lab.intranet_link || 'www.google.com'));

        const title = document.createElement('div');
        title.classList.add('fw-bold', 'mb-2');
        title.innerText = 'Select available information/guidelines:';
        wrapper.appendChild(title);

        const infoContainer = document.createElement('div');
        infoContainer.classList.add('mb-2');
        INFO_OPTIONS.forEach((option, idx) => {
            const checkWrap = document.createElement('div');
            checkWrap.classList.add('form-check');

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.classList.add('form-check-input', 'refer-to-option');
            input.id = `refer-to-opt-${idx}-${Math.random().toString(36).slice(2, 8)}`;
            input.value = option;
            input.checked = selectedInfo.includes(option);

            const label = document.createElement('label');
            label.classList.add('form-check-label');
            label.setAttribute('for', input.id);
            label.innerText = option;

            checkWrap.appendChild(input);
            checkWrap.appendChild(label);
            infoContainer.appendChild(checkWrap);
        });
        wrapper.appendChild(infoContainer);

        const labLabel = document.createElement('label');
        labLabel.classList.add('form-label');
        labLabel.innerText = 'Select laboratory intranet link:';
        wrapper.appendChild(labLabel);

        const labSelect = document.createElement('select');
        labSelect.classList.add('form-select', 'refer-to-lab', 'mb-2');
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.innerText = 'Select a laboratory';
        labSelect.appendChild(defaultOption);

        labs.forEach((lab) => {
            const option = document.createElement('option');
            option.value = lab.intranet_link || 'www.google.com';
            option.innerText = `${lab.labName} - ${lab.categoryName}`;
            labSelect.appendChild(option);
        });

        if (this.data.intranetLink) {
            labSelect.value = this.data.intranetLink;
        }

        wrapper.appendChild(labSelect);

        const customLinkLabel = document.createElement('label');
        customLinkLabel.classList.add('form-label');
        customLinkLabel.innerText = 'Or enter a custom link:';
        wrapper.appendChild(customLinkLabel);

        const customLinkInput = document.createElement('input');
        customLinkInput.type = 'text';
        customLinkInput.classList.add('form-control', 'refer-to-custom-link', 'mb-2');
        customLinkInput.placeholder = 'e.g. intranet.hospital.local/guideline';

        if (this.data.intranetLink && !labLinks.has(this.data.intranetLink)) {
            customLinkInput.value = this.data.intranetLink;
            labSelect.value = '';
        }

        wrapper.appendChild(customLinkInput);

        const preview = document.createElement('p');
        preview.classList.add('mb-0', 'text-muted', 'refer-to-preview');
        wrapper.appendChild(preview);

        const updatePreview = () => {
            const selectedOptions = Array.from(wrapper.querySelectorAll('.refer-to-option:checked'))
                .map((el) => el.value);
            const customLink = customLinkInput.value.trim();
            const link = customLink || labSelect.value || 'www.google.com';
            preview.innerHTML = buildReferToText(selectedOptions, link);
        };

        wrapper.querySelectorAll('.refer-to-option').forEach((el) => {
            el.addEventListener('change', updatePreview);
        });
        labSelect.addEventListener('change', updatePreview);
        customLinkInput.addEventListener('input', updatePreview);

        updatePreview();

        return wrapper;
    }

    save(blockContent) {
        if (blockContent.tagName === 'P') {
            return {
                infoOptions: this.data.infoOptions || [...INFO_OPTIONS],
                intranetLink: this.data.intranetLink || 'www.google.com',
                text: blockContent.innerText,
            };
        }

        const selectedOptions = Array.from(blockContent.querySelectorAll('.refer-to-option:checked'))
            .map((el) => el.value);
        const labSelect = blockContent.querySelector('.refer-to-lab');
        const customLinkInput = blockContent.querySelector('.refer-to-custom-link');
        const customLink = customLinkInput ? customLinkInput.value.trim() : '';
        const intranetLink = customLink || (labSelect ? (labSelect.value || 'www.google.com') : 'www.google.com');
        const text = buildReferToText(selectedOptions, intranetLink);

        return {
            infoOptions: selectedOptions,
            intranetLink,
            text,
        };
    }

    validate(savedData) {
        return !!(savedData && savedData.text && savedData.text.trim().length > 0);
    }
}
