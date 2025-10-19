/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export {}

declare global {
  interface Window {
    webpackChunk_twitter_responsive_web: WebPackModuleItem[]
  }
}

type WebpackLoadFunction = (a: unknown, b: unknown, c: unknown) => void
type Module = Record<number | string, WebpackLoadFunction>
type WebPackModuleItem = [[string], Module]
type ESModule<T = unknown> = {
  default: T
  __esModule: true
}
type MakeTransactionId = (path: string, method: string) => Promise<string>

let generateTransactionId: MakeTransactionId | undefined = undefined

type TxTarget = {
  method: string
  path: string
}

const requesetPathWeakMap = new WeakMap<XMLHttpRequest, TxTarget>()

const Pattern = Object.freeze({
  tweetRelated:
    /^(?:\/i\/api)?\/graphql\/(?<queryId>.+)?\/(?<queryName>TweetDetail|TweetResultByRestId|UserTweets|UserMedia|HomeTimeline|HomeLatestTimeline|UserTweetsAndReplies|UserHighlightsTweets|UserArticlesTweets|Bookmarks|Likes|CommunitiesExploreTimeline|ListLatestTweetsTimeline)$/,
})

const enum MediaHarvestEvent {
  MediaResponse = 'mh:media-response',
  ResponseTransactionId = 'mh:tx-id:response',
  RequestTransactionId = 'mh:tx-id:request',
}

function validateUrl(url: string | URL | undefined): URL | undefined {
  if (!url) return undefined
  if (url instanceof URL) return url
  if (URL.canParse(url)) return new URL(url)
  return undefined
}

XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
  apply(target, thisArg: XMLHttpRequest, args) {
    const [method, url] = args

    const validUrl = validateUrl(url)
    if (validUrl) {
      const matchedUrl = validUrl.pathname.match(Pattern.tweetRelated)
      if (validUrl && matchedUrl) {
        thisArg.addEventListener('load', captureResponse)
        requesetPathWeakMap.set(thisArg, {
          method,
          path: validUrl.pathname,
        })
      }
    }

    return Reflect.apply(target, thisArg, args)
  },
})

function captureResponse(this: XMLHttpRequest, _ev: ProgressEvent) {
  if (this.status === 200) {
    const url = URL.parse(this.responseURL)
    if (!url) return

    const event = new CustomEvent<MediaHarvest.MediaResponseDetail>(
      MediaHarvestEvent.MediaResponse,
      {
        detail: {
          path: url.pathname,
          status: this.status,
          body: this.responseText,
        },
      }
    )

    document.dispatchEvent(event)
  }
}

self.webpackChunk_twitter_responsive_web = new Proxy<
  Window['webpackChunk_twitter_responsive_web']
>([], {
  get: function (target, prop, receiver) {
    return prop === 'push'
      ? arrayPushProxy(target.push.bind(target))
      : Reflect.get(target, prop, receiver)
  },
})

function arrayPushProxy<T>(arrayPush: Array<T>['push']) {
  return new Proxy(arrayPush, {
    apply(method, thisArg, args: WebPackModuleItem[]) {
      return Reflect.apply(
        method,
        thisArg,
        args.map(item => {
          const [[name], module] = item
          return name.includes('ondemand.s')
            ? [[name], moduleProxy(module)]
            : item
        })
      )
    },
  })
}

function moduleProxy(module: Module) {
  return new Proxy(module, {
    get(target, prop, receiver) {
      return typeof prop === 'symbol'
        ? Reflect.get(target, prop, receiver)
        : webpackLoaderFunctionProxy(target[prop])
    },
  })
}

function esModuleProxy(esModule: Partial<ESModule>) {
  return new Proxy(esModule, {
    defineProperty(target, property, attributes) {
      if (property === 'default')
        return Reflect.defineProperty(target, property, {
          ...attributes,
          configurable: true,
        })

      return Reflect.defineProperty(target, property, attributes)
    },
  })
}

function webpackLoaderFunctionProxy(loaderFunc: WebpackLoadFunction) {
  return new Proxy(loaderFunc, {
    apply(
      exportItem,
      thisArg,
      args: [object, Partial<ESModule>, CallableFunction]
    ) {
      const [_, esModule, loader] = args
      const returnVal = Reflect.apply(exportItem, thisArg, [
        _,
        esModuleProxy(esModule),
        loader,
      ])

      if (
        isESModule(esModule) &&
        isCallableFunction<() => MakeTransactionId>(esModule.default)
      ) {
        const txIdGenerator = esModule.default()
        generateTransactionId ||= txIdGenerator
        Object.defineProperty(esModule, 'default', {
          configurable: true,
          enumerable: true,
          get: () => () => txIdGenerator,
        })
      }

      return returnVal
    },
  })
}

function isESModule(value: unknown): value is ESModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__esModule' in value &&
    value.__esModule === true
  )
}

function isCallableFunction<T>(value: unknown): value is T {
  return typeof value === 'function'
}

// --- TikTok page-context sanitization ---
;(function setupTikTokSanitizers() {
  try {
    if (!location.hostname.includes('tiktok.com')) return

    let mhDesiredCaption = ''
    document.addEventListener('mh:set-caption', (e: Event) => {
      try {
        mhDesiredCaption = (e as CustomEvent<string>).detail || mhDesiredCaption
      } catch {}
    })

    const SAFE_BASENAME = 'mh_tmp_upload'
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')

    const leadingPatterns: RegExp[] = [
      // Our safe basename + optional numeric suffixes, even if concatenated to following text
      new RegExp(`^(?:${escapeRegExp(SAFE_BASENAME)}(?:[_-]?\\d+)+)`, 'i'),
      // Common filename token styles
      /^(?:em3dia-\d+(?:-\d+){0,2})/i,
      /^(?:[a-zA-Z]+[_-]\d{6,})/i,
      /^(?:[a-zA-Z0-9]+-\d{10,}-\d+)/i,
    ]

    const anywherePatterns: RegExp[] = [
      new RegExp(`${escapeRegExp(SAFE_BASENAME)}(?:[_-]?\\d+)+`, 'gi'),
      /em3dia-\d+(?:-\d+){0,2}/gi,
      /\b[a-zA-Z]+[_-]\d{6,}\b/gi,
      /\b[a-zA-Z0-9\-_]+\d{6,}\b/gi,
      /\b\w+-\d{10,}-\d+\b/gi,
    ]

    function sanitizeCaption(raw: unknown): string {
      let s = String(raw ?? '')
      // Strip leading tokens (even if glued to the caption)
      for (const re of leadingPatterns) {
        if (re.test(s)) s = s.replace(re, ' ')
      }
      // Remove anywhere tokens
      for (const re of anywherePatterns) {
        s = s.replace(re, ' ')
      }
      return s.replace(/\s+/g, ' ').trim()
    }

    function sanitizeJSONString(jsonStr: string): string {
      try {
        const obj = JSON.parse(jsonStr)
        const keys = new Set(['desc', 'description', 'caption', 'text'])
        const stack: any[] = [obj]
        while (stack.length) {
          const cur = stack.pop()
          for (const k of Object.keys(cur)) {
            const v = cur[k]
            if (v && typeof v === 'object') stack.push(v)
            else if (typeof v === 'string') cur[k] = keys.has(k) ? (mhDesiredCaption || sanitizeCaption(v)) : sanitizeCaption(v)
          }
        }
        return JSON.stringify(obj)
      } catch {
        return sanitizeCaption(jsonStr)
      }
    }

    function sanitizeBody(body: any): any {
      if (typeof body === 'string') return sanitizeJSONString(body)
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        ;['desc', 'description', 'caption', 'text'].forEach((k) => {
          const val = body.get(k)
          if (typeof val === 'string' && val) body.set(k, mhDesiredCaption || sanitizeCaption(val))
        })
        return body
      }
      return body
    }

    // Patch fetch
    try {
      const ofetch = window.fetch.bind(window)
      window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        try { if (init && init.body) init = { ...init, body: sanitizeBody(init.body) } } catch {}
        return ofetch(input as any, init)
      }
    } catch {}

    // Patch XHR
    try {
      const originalSend = XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
        try { if (body) body = sanitizeBody(body as any) as any } catch {}
        return originalSend.apply(this, [body as any])
      }
    } catch {}

    // Patch sendBeacon
    try {
      const oBeacon = navigator.sendBeacon?.bind(navigator)
      if (oBeacon) {
        navigator.sendBeacon = function(url: string | URL, data?: BodyInit | null): boolean {
          try { if (data) data = sanitizeBody(data as any) as any } catch {}
          return oBeacon(url, data)
        }
      }
    } catch {}

    // Patch FormData + URLSearchParams field-level
    try {
      const oAppend = FormData.prototype.append
      const oSet = FormData.prototype.set
      FormData.prototype.append = function(name: string, value: any, fileName?: string) {
        try { if (typeof value === 'string') value = sanitizeCaption(value) } catch {}
        return oAppend.call(this, name, value, fileName as any)
      }
      FormData.prototype.set = function(name: string, value: any, fileName?: string) {
        try { if (typeof value === 'string') value = sanitizeCaption(value) } catch {}
        return oSet.call(this, name, value, fileName as any)
      }
    } catch {}

    try {
      const p = URLSearchParams.prototype as any
      const a = p.append
      const s = p.set
      p.append = function(name: string, value: string) { try { value = sanitizeCaption(value) } catch {} return a.call(this, name, value) }
      p.set = function(name: string, value: string) { try { value = sanitizeCaption(value) } catch {} return s.call(this, name, value) }
    } catch {}
  } catch {}
})()

document.addEventListener('mh:tx-id:request', async e => {
  if (generateTransactionId === undefined) return

  const { path, method, uuid } = e.detail
  const txId = await generateTransactionId(path, method)

  document.dispatchEvent(
    new CustomEvent<MediaHarvest.TxIdResponseDetail>(
      MediaHarvestEvent.ResponseTransactionId,
      {
        detail: {
          uuid,
          value: txId,
        },
      }
    )
  )
})
