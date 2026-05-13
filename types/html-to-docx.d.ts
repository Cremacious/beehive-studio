declare module 'html-to-docx' {
  interface DocumentOptions {
    orientation?: 'portrait' | 'landscape'
    pageSize?: { width?: number; height?: number }
    margins?: {
      top?: number
      right?: number
      bottom?: number
      left?: number
      header?: number
      footer?: number
      gutter?: number
    }
    title?: string
    subject?: string
    creator?: string
    keywords?: string[]
    description?: string
    lastModifiedBy?: string
    revision?: number
    createdAt?: Date
    modifiedAt?: Date
    headerType?: 'default' | 'first' | 'even'
    header?: boolean
    footerType?: 'default' | 'first' | 'even'
    footer?: boolean
    font?: string
    fontSize?: number
    complexScriptFontSize?: number
    table?: { row?: { cantSplit?: boolean } }
    pageNumber?: boolean
    skipFirstHeaderFooter?: boolean
    lineNumber?: boolean
    lineNumberOptions?: {
      start?: number
      countBy?: number
      restart?: 'continuous' | 'newPage' | 'newSection'
    }
    numbering?: { defaultOrderedListStyleType?: string }
    decodeUnicode?: boolean
    lang?: string
  }

  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString: string | null,
    documentOptions?: DocumentOptions,
    footerHTMLString?: string | null,
  ): Promise<Buffer | Blob>

  export default HTMLtoDOCX
}
