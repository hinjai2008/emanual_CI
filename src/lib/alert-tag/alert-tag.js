export default class AlertTag {

    static get toolbox() {
        return {
          title: 'Alert Tag',
          icon: '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>'
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
            console.log('selectedCode', selectedCode)
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