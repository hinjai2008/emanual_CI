export default class AlertTag {

    static get toolbox() {
        return {
          title: 'Alert Tag',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01M21 16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2L12 4l9 12z"/></svg>'
        };
      }

    static get isReadOnlySupported() {
        return true
    }

    constructor({data, config}) {
        this.data = data
        this.config = config || {}
        
    }


    render() {

        if (this.data && this.data.text && this.data.background) {
            return this._createTag(this.data.text, this.data.background)
        } 
        
        else {

            const selection = document.createElement('select')
            const selectableTag = this.config.selectableTag
            selection.classList.add('form-select')
            selectableTag.forEach(alertTagConfig => {
                const option = document.createElement('option')
                option.value = alertTagConfig.code
                const renderTag = document.createElement('span')
                renderTag.classList.add('badge', 'rounded-pill', alertTagConfig.background)
                renderTag.innerText = alertTagConfig.text
                option.appendChild(renderTag)
                selection.appendChild(option)
            });
            return selection
    }

    }


    save (blockContent) {

        if (blockContent.tagName === 'SELECT') {
            let selectedCode = blockContent.value
            let text = this.config.selectableTag.find(alertTagConfig => alertTagConfig.code === selectedCode).text
            let background = this.config.selectableTag.find(alertTagConfig => alertTagConfig.code === selectedCode).background
            return {
                text: text,
                background: background,
            }
        } else if (blockContent.tagName === 'SPAN') {
            let text = blockContent.innerText
            let background = blockContent.classList[2]
            return {
                text: text,
                background: background,
            }


    }}


    _createTag(text, background) {
        const tagElement = document.createElement('span')
        tagElement.classList.add('badge', 'rounded-pill', background)
        tagElement.innerText = text
        return tagElement
    }
}