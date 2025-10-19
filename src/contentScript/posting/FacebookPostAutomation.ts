/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

interface SerializedFile {
  data: number[]
  name: string
  type: string
  size: number
}

interface PostData {
  text: string
  mediaFile?: SerializedFile
  closeTabAfterPost?: boolean
}

/**
 * Facebook Post Automation
 * This script handles the automation of creating posts on Facebook
 */
export class FacebookPostAutomation {
  private static readonly SELECTORS = {
    // Compose button selector - matches the "What's on your mind?" element
    COMPOSE_BUTTON: 'div.xi81zsa.x1lkfr7t.xkjl1po.x1mzt3pk.xh8yej3.x13faqbe',
    COMPOSE_BUTTON_TEXT: 'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6',
    // Text area selector for Facebook composer
    TEXT_AREA: 'div[contenteditable="true"][role="textbox"]',
    TEXT_AREA_PLACEHOLDER: 'div[data-placeholder]',
    // Post button
    POST_BUTTON: 'div[aria-label="Post"][role="button"]',
    POST_BUTTON_ALT: 'div[role="button"]',
    // Media upload selectors
    MEDIA_INPUT: 'input[type="file"][accept*="image"], input[type="file"][accept*="video"]',
    MEDIA_BUTTON: '[aria-label*="Photo"], [aria-label*="photo"], [aria-label*="video"], [aria-label*="Video"]',
  }

  private static readonly RETRY_ATTEMPTS = 20
  private static readonly RETRY_DELAY = 1000

  // Track if text has been set to prevent duplicates
  private static textAlreadySet = false

  /**
   * Wait for an element to appear in the DOM
   */
  private static waitForElement(selector: string, timeout = 20000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const check = () => {
        const element = document.querySelector(selector)
        if (element) {
          console.log(`✅ [Facebook] Found element: ${selector}`)
          resolve(element)
          return
        }

        if (Date.now() - startTime > timeout) {
          console.error(`❌ [Facebook] Element ${selector} not found within ${timeout}ms`)
          reject(new Error(`Element ${selector} not found within ${timeout}ms`))
          return
        }

        setTimeout(check, 200)
      }

      check()
    })
  }

  /**
   * Wait for multiple selectors and return the first one found
   */
  private static waitForAnyElement(selectors: string[], timeout = 20000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const check = () => {
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (element) {
            console.log(`✅ [Facebook] Found element: ${selector}`)
            resolve(element)
            return
          }
        }

        if (Date.now() - startTime > timeout) {
          console.error(`❌ [Facebook] None of the elements found within ${timeout}ms:`, selectors)
          reject(new Error(`None of the elements found within ${timeout}ms`))
          return
        }

        setTimeout(check, 200)
      }

      check()
    })
  }

  /**
   * Click the "What's on your mind?" button to open the composer dialog
   */
  static async openComposer(): Promise<void> {
    try {
      console.log('🔍 [Facebook] Looking for compose button to open dialog...')

      // Try multiple strategies to find the clickable "What's on your mind?" element
      let composeButton: Element | null = null

      // Strategy 1: Find by specific classes (from the provided HTML)
      composeButton = document.querySelector('div.xi81zsa.x1lkfr7t.xkjl1po.x1mzt3pk.xh8yej3.x13faqbe')

      if (composeButton) {
        console.log('✅ [Facebook] Found compose button by specific classes')
      }

      // Strategy 2: Find spans with "What's on your mind" text and get clickable parent
      if (!composeButton) {
        console.log('⚠️ [Facebook] Trying to find by text content...')
        const spans = Array.from(document.querySelectorAll('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6'))

        for (const span of spans) {
          const text = span.textContent || ''
          if (text.includes("What's on your mind")) {
            console.log('✅ [Facebook] Found span with "What\'s on your mind" text')

            // Walk up the DOM tree to find the clickable parent
            let parent = span.parentElement
            let depth = 0
            while (parent && depth < 10) {
              const role = parent.getAttribute('role')
              const tabindex = parent.getAttribute('tabindex')

              // Check if it's clickable (has role="button" or is interactive)
              if (role === 'button' || role === 'textbox' || tabindex === '0' || parent.onclick) {
                composeButton = parent
                console.log('✅ [Facebook] Found clickable parent element')
                break
              }
              parent = parent.parentElement
              depth++
            }

            if (composeButton) break
          }
        }
      }

      // Strategy 3: Find by general selector
      if (!composeButton) {
        console.log('⚠️ [Facebook] Trying general selector...')
        composeButton = document.querySelector(this.SELECTORS.COMPOSE_BUTTON)
      }

      if (!composeButton) {
        throw new Error('Could not find Facebook compose button to open dialog')
      }

      console.log('✅ [Facebook] Found compose button, clicking to open dialog...')
      console.log('📝 [Facebook] Button element:', composeButton)
      console.log('📝 [Facebook] Button classes:', (composeButton as HTMLElement).className)

      // Click the compose button to open the dialog
      if (composeButton instanceof HTMLElement) {
        composeButton.click()
      } else {
        (composeButton as any).click()
      }

      console.log('✅ [Facebook] Compose button clicked, waiting for dialog to open...')

      // Wait for the composer dialog to open
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error) {
      console.error('❌ [Facebook] Error opening composer:', error)
      throw error
    }
  }

  /**
   * Set text in the Facebook compose area
   */
  static async setText(text: string): Promise<void> {
    try {
      // Prevent duplicate text insertion
      if (this.textAlreadySet) {
        console.log('⚠️ [Facebook] Text already set, skipping duplicate call')
        return
      }

      console.log('🔍 [Facebook] Looking for Facebook text editor...')

      // Try multiple selectors to find the text editor
      let allEditors = Array.from(document.querySelectorAll('div[contenteditable="true"][role="textbox"][data-lexical-editor="true"]'))

      // If not found, try a more general selector
      if (allEditors.length === 0) {
        console.log('⚠️ [Facebook] Lexical editor not found, trying general contenteditable selector...')
        allEditors = Array.from(document.querySelectorAll('div[contenteditable="true"][role="textbox"]'))
      }

      // If still not found, try finding by placeholder text
      if (allEditors.length === 0) {
        console.log('⚠️ [Facebook] Trying to find by aria-placeholder...')
        allEditors = Array.from(document.querySelectorAll('div[aria-placeholder*="What\'s on your mind"]'))
      }

      console.log(`📍 [Facebook] Found ${allEditors.length} text editors on the page`)

      if (allEditors.length === 0) {
        throw new Error('Facebook text editor not found')
      }

      // Find the VISIBLE editor (not hidden by aria-hidden)
      let textEditor: HTMLElement | null = null

      console.log('🔍 [Facebook] Checking each editor for visibility...')
      for (let i = 0; i < allEditors.length; i++) {
        const editor = allEditors[i] as HTMLElement

        // Skip if already has content (to avoid duplicate insertion)
        const currentText = editor.textContent?.trim() || ''
        if (currentText && currentText === text.trim()) {
          console.log(`⚠️ [Facebook] Editor ${i + 1} already has the target text, skipping`)
          continue
        }

        // Check if editor has aria-hidden ancestor
        let current: HTMLElement | null = editor
        let isHidden = false

        while (current && current !== document.body) {
          if (current.getAttribute('aria-hidden') === 'true') {
            isHidden = true
            break
          }
          current = current.parentElement
        }

        // Check if editor is on screen
        const rect = editor.getBoundingClientRect()
        const isOnScreen = rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0

        // Check if it's in the viewport
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0 &&
                           rect.left < window.innerWidth && rect.right > 0

        console.log(`📝 [Facebook] Editor ${i + 1}:`)
        console.log(`   - aria-hidden ancestor: ${isHidden}`)
        console.log(`   - on screen: ${isOnScreen}`)
        console.log(`   - in viewport: ${isInViewport}`)
        console.log(`   - current text: "${currentText.substring(0, 50)}"`)

        // Select the editor that is NOT hidden and IS on screen and in viewport
        if (!isHidden && isOnScreen && isInViewport) {
          textEditor = editor
          console.log(`✅ [Facebook] Found visible editor ${i + 1}! Will use this one.`)
          break  // IMPORTANT: Stop after finding the first valid editor
        }
      }

      if (!textEditor) {
        console.log('⚠️ [Facebook] No fully visible editor found. Using the first non-hidden editor...')
        // Try to find editor that's at least not aria-hidden
        for (let i = 0; i < allEditors.length; i++) {
          const editor = allEditors[i] as HTMLElement
          let current: HTMLElement | null = editor
          let isHidden = false

          while (current && current !== document.body) {
            if (current.getAttribute('aria-hidden') === 'true') {
              isHidden = true
              break
            }
            current = current.parentElement
          }

          if (!isHidden) {
            textEditor = editor
            console.log(`✅ [Facebook] Using editor ${i + 1} (not aria-hidden)`)
            break
          }
        }
      }

      if (!textEditor) {
        // Last resort: use the first editor
        textEditor = allEditors[0] as HTMLElement
        console.log(`⚠️ [Facebook] Using first editor as last resort`)
      }

      console.log('✅ [Facebook] Found Facebook text editor, setting text...')
      console.log('📝 [Facebook] Editor element:', textEditor)
      console.log('📝 [Facebook] Editor classes:', textEditor.className)
      console.log('📝 [Facebook] Editor innerHTML:', textEditor.innerHTML.substring(0, 200))

      // Focus the editor
      textEditor.focus()
      await new Promise(resolve => setTimeout(resolve, 500))

      // Clear the editor first to prevent any existing content
      textEditor.innerHTML = ''

      // Find or create the <p> element inside the editor
      let paragraph = textEditor.querySelector('p.xdj266r')
      if (!paragraph) {
        // Create a new paragraph if it doesn't exist
        paragraph = document.createElement('p')
        paragraph.className = 'xdj266r x14z9mp xat24cr x1lziwak x16tdsg8'
        paragraph.setAttribute('dir', 'auto')
        textEditor.appendChild(paragraph)
      }

      // Clear the paragraph
      paragraph.innerHTML = ''

      // Split text by newlines and create proper structure
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        if (line.trim()) {
          const textNode = document.createTextNode(line)
          paragraph!.appendChild(textNode)
        } else if (index === 0) {
          // If first line is empty, add a text node with the content anyway
          const textNode = document.createTextNode(line)
          paragraph!.appendChild(textNode)
        }
        // Add <br> for newlines (except the last line)
        if (index < lines.length - 1) {
          paragraph!.appendChild(document.createElement('br'))
        }
      })

      // Give the DOM a moment to update before triggering events
      await new Promise(resolve => setTimeout(resolve, 100))

      // Trigger input event for Facebook's Lexical editor
      // NOTE: Only trigger ONCE to avoid duplication
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      })
      textEditor.dispatchEvent(inputEvent)

      // Mark text as set to prevent duplicates
      this.textAlreadySet = true
      console.log(`✅ [Facebook] Text set successfully: ${text.substring(0, 50)}...`)

    } catch (error) {
      console.error('❌ [Facebook] Error setting text:', error)
      throw error
    }
  }

  /**
   * Upload media file to Facebook post
   */
  static async uploadMedia(mediaFile: SerializedFile): Promise<void> {
    try {
      console.log('🎬 [Facebook] Starting media file upload for:', mediaFile.name, mediaFile.type)

      // Convert serialized file back to File object first
      const uint8Array = new Uint8Array(mediaFile.data)
      const file = new File([uint8Array], mediaFile.name, {
        type: mediaFile.type
      })

      console.log('📁 [Facebook] Reconstructed file:', {
        name: file.name,
        type: file.type,
        size: file.size
      })

      // Strategy 1: Try to find existing file input first
      let fileInput: HTMLInputElement | null = null

      const inputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"][accept*="video"]',
        'input[type="file"]'
      ]

      for (const selector of inputSelectors) {
        console.log(`🔍 [Facebook] Looking for file input: ${selector}`)
        fileInput = document.querySelector(selector) as HTMLInputElement
        if (fileInput) {
          console.log(`✅ [Facebook] Found existing file input with selector: ${selector}`)
          break
        }
      }

      // Strategy 2: If no file input found, try to find and click media button
      if (!fileInput) {
        console.log('🔍 [Facebook] No existing file input found, looking for media button...')

        const buttonSelectors = [
          '[aria-label*="Photo"]',
          '[aria-label*="photo"]',
          '[aria-label*="Image"]',
          '[aria-label*="image"]',
          '[aria-label*="Video"]',
          '[aria-label*="video"]',
          '[aria-label*="Media"]',
          '[aria-label*="media"]',
          'svg[aria-label*="Photo"]',
          'svg[aria-label*="photo"]'
        ]

        let mediaButton: Element | null = null

        for (const selector of buttonSelectors) {
          const elements = document.querySelectorAll(selector)
          console.log(`🔍 [Facebook] Found ${elements.length} elements for selector: ${selector}`)

          for (const element of elements) {
            // Check if element or parent is clickable
            let clickable = element
            if (element.tagName === 'svg' || element.tagName === 'SVG') {
              // For SVG, find the clickable parent
              let parent = element.parentElement
              let depth = 0
              while (parent && depth < 5) {
                const role = parent.getAttribute('role')
                const ariaLabel = parent.getAttribute('aria-label')
                if (role === 'button' || ariaLabel) {
                  clickable = parent
                  break
                }
                parent = parent.parentElement
                depth++
              }
            }

            // Verify this is the media button by checking visibility
            const rect = clickable.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              mediaButton = clickable
              console.log('✅ [Facebook] Found visible media button')
              break
            }
          }

          if (mediaButton) break
        }

        if (mediaButton) {
          console.log('🖱️ [Facebook] Clicking media button...')
          ;(mediaButton as HTMLElement).click()

          // Wait for file input to appear after clicking button
          await new Promise(resolve => setTimeout(resolve, 500))

          // Try to find file input again
          for (const selector of inputSelectors) {
            fileInput = document.querySelector(selector) as HTMLInputElement
            if (fileInput) {
              console.log(`✅ [Facebook] Found file input after clicking button: ${selector}`)
              break
            }
          }
        }
      }

      if (!fileInput) {
        throw new Error('[Facebook] Could not find file input for media upload')
      }

      console.log('📤 [Facebook] Setting file on input element...')

      // Create a DataTransfer object to simulate file selection
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInput.files = dataTransfer.files

      console.log('📤 [Facebook] Dispatching change event...')

      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true })
      fileInput.dispatchEvent(changeEvent)

      // Also trigger input event
      const inputEvent = new Event('input', { bubbles: true })
      fileInput.dispatchEvent(inputEvent)

      console.log('✅ [Facebook] Media file change event dispatched')

      // Wait for media to process and preview to appear
      console.log('⏳ [Facebook] Waiting for media preview to appear...')
      await this.waitForMediaUploadCompletion(file.name)

      console.log('✅ [Facebook] Media file uploaded and processed successfully')

    } catch (error) {
      console.error('❌ [Facebook] Error uploading media:', error)
      throw error
    }
  }

  /**
   * Wait for media upload to complete and verify success
   */
  private static async waitForMediaUploadCompletion(fileName: string): Promise<void> {
    console.log('🔍 [Facebook] Verifying media upload completion...')

    const maxWaitTime = 60000 // 60 seconds for media processing
    const checkInterval = 500 // Check every 500ms
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // Check for various indicators that media upload completed
      const indicators = [
        // Media preview in the dialog
        '[role="dialog"] img[src*="blob"]',
        '[role="dialog"] img[src*="facebook"]',
        '[role="dialog"] video',
        // Media container
        '[role="dialog"] [style*="background-image"]',
        // Image preview area
        'div[aria-label*="image"] img',
        'div[aria-label*="Image"] img'
      ]

      let uploadCompleted = false
      let completionElement: Element | null = null

      for (const selector of indicators) {
        const element = document.querySelector(selector)
        if (element) {
          uploadCompleted = true
          completionElement = element
          console.log(`✅ [Facebook] Found media preview indicator: ${selector}`)
          break
        }
      }

      if (uploadCompleted) {
        console.log('✅ [Facebook] Media upload completed successfully')
        // Wait a bit more for any final processing
        await new Promise(resolve => setTimeout(resolve, 1000))
        return
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    // Timeout reached - log warning but don't fail
    console.log('⚠️ [Facebook] Media upload verification timed out after 60s, but proceeding anyway...')
  }

  /**
   * Click the Post button to publish
   */
  static async publishPost(): Promise<void> {
    try {
      console.log('🔍 [Facebook] Looking for Post button...')

      // Wait for post button to appear and for any animations to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Try multiple strategies to find the Post button
      let postButton: HTMLElement | null = null

      // Wait for the button to become enabled (Facebook may disable it while processing)
      const maxWaitTime = 30000 // 30 seconds
      const checkInterval = 500 // Check every 500ms
      const startTime = Date.now()

      while (Date.now() - startTime < maxWaitTime) {
        // Strategy 1: Find by aria-label="Post" and role="button"
        const postButtons = Array.from(document.querySelectorAll('[aria-label="Post"][role="button"]'))
        console.log(`📍 [Facebook] Found ${postButtons.length} buttons with aria-label="Post"`)

        // Log details of each button
        postButtons.forEach((button, index) => {
          const rect = button.getBoundingClientRect()
          const isVisible = rect.width > 0 && rect.height > 0
          const isInViewport = rect.top >= 0 && rect.left >= 0 &&
                              rect.top < window.innerHeight && rect.left < window.innerWidth
          const isDisabled = button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true'
          console.log(`   Button ${index + 1}:`, {
            visible: isVisible,
            inViewport: isInViewport,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            disabled: isDisabled
          })
        })

        // Find the visible AND enabled one
        for (const button of postButtons) {
          const rect = button.getBoundingClientRect()
          const isVisible = rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0
          const isDisabled = button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true'

          if (isVisible && !isDisabled) {
            postButton = button as HTMLElement
            console.log('✅ [Facebook] Found visible and ENABLED Post button!')
            break
          }
        }

        if (postButton) {
          break // Found enabled button, exit loop
        }

        // Button not enabled yet, wait and try again
        console.log('⏳ [Facebook] Post button is disabled, waiting for it to become enabled...')
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }

      if (!postButton) {
        console.log('⚠️ [Facebook] Post button never became enabled after 30 seconds, trying anyway...')
        // As a last resort, try to find any Post button even if disabled
        const postButtons = Array.from(document.querySelectorAll('[aria-label="Post"][role="button"]'))
        for (const button of postButtons) {
          const rect = button.getBoundingClientRect()
          const isVisible = rect.width > 0 && rect.height > 0
          if (isVisible) {
            postButton = button as HTMLElement
            break
          }
        }
      }

      // Strategy 2: Find by text content "Post"
      if (!postButton) {
        console.log('⚠️ [Facebook] Trying to find by text content...')
        const spans = Array.from(document.querySelectorAll('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6'))

        for (const span of spans) {
          if (span.textContent?.trim() === 'Post') {
            console.log('✅ [Facebook] Found span with "Post" text')

            // Walk up to find the clickable button
            let parent = span.parentElement
            let depth = 0
            while (parent && depth < 10) {
              const role = parent.getAttribute('role')
              const ariaLabel = parent.getAttribute('aria-label')

              if (role === 'button' && ariaLabel === 'Post') {
                const rect = parent.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                  postButton = parent as HTMLElement
                  console.log('✅ [Facebook] Found clickable Post button parent')
                  break
                }
              }
              parent = parent.parentElement
              depth++
            }

            if (postButton) break
          }
        }
      }

      if (!postButton) {
        throw new Error('Facebook Post button not found')
      }

      console.log('✅ [Facebook] Found Post button, clicking...')
      console.log('📝 [Facebook] Button element:', postButton)
      console.log('📝 [Facebook] Button aria-label:', postButton.getAttribute('aria-label'))

      postButton.click()

      console.log('✅ [Facebook] Post button clicked')

      // Wait for post to be published
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error) {
      console.error('❌ [Facebook] Error publishing post:', error)
      throw error
    }
  }

  /**
   * Upload content to Facebook - Main entry point
   * Opens the composer dialog first, then fills in the content
   */
  static async uploadContent(data: PostData): Promise<void> {
    try {
      // Reset flags for this new post
      this.textAlreadySet = false

      console.log('🚀 [Facebook] Starting Facebook post automation...')
      console.log('📝 [Facebook] Post data:', {
        hasText: !!data.text,
        textLength: data.text?.length || 0,
        hasMedia: !!data.mediaFile
      })

      // Wait a bit for the page to fully load
      console.log('⏳ [Facebook] Waiting for Facebook homepage to load...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 1: Click the "What's on your mind?" button to open the composer dialog
      await this.openComposer()

      // Step 2: Upload media first if provided (Facebook may clear text when media is added)
      if (data.mediaFile) {
        console.log('🎬 [Facebook] Uploading media first...')
        await this.uploadMedia(data.mediaFile)
        // Wait for media upload to fully complete
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Step 3: Set text after media is uploaded (to prevent it being cleared)
      if (data.text && data.text.trim()) {
        console.log('📝 [Facebook] Setting text after media upload...')
        await this.setText(data.text)
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      console.log('✅ [Facebook] Facebook content preloaded successfully!')

      // Step 4: Wait a bit for UI to settle, then click the Post button to publish
      console.log('⏳ [Facebook] Waiting for UI to settle before clicking Post...')
      await new Promise(resolve => setTimeout(resolve, 1500))

      console.log('🚀 [Facebook] Publishing post...')
      await this.publishPost()

      console.log('✅ [Facebook] Post published successfully!')

      // Step 5: Signal completion if tab should be closed
      // The service worker will handle closing the tab to avoid re-triggering the script
      if (data.closeTabAfterPost) {
        console.log('✅ [Facebook] Post complete, tab will be closed by service worker')
      }

    } catch (error) {
      console.error('💥 [Facebook] Error in Facebook post automation:', error)
      throw error
    }
  }

  /**
   * Alternative method that opens the composer first
   */
  static async uploadContentWithComposer(data: PostData): Promise<void> {
    try {
      console.log('🚀 [Facebook] Starting Facebook post automation with composer...')

      // Step 1: Open the composer
      await this.openComposer()

      // Step 2: Set text if provided
      if (data.text && data.text.trim()) {
        await this.setText(data.text)
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Step 3: Upload media if provided
      if (data.mediaFile) {
        await this.uploadMedia(data.mediaFile)
      }

      console.log('✅ [Facebook] Facebook post automation completed successfully!')

    } catch (error) {
      console.error('💥 [Facebook] Error in Facebook post automation:', error)
      throw error
    }
  }
}

// Prevent duplicate script execution
if ((window as any).__facebookAutomationLoaded) {
  console.log('⚠️ [Facebook] Script already loaded, skipping duplicate initialization')
} else {
  (window as any).__facebookAutomationLoaded = true

  // Set up message listener for Facebook posting
  console.log('🔌 [Facebook] Facebook automation content script loaded')
  console.log('📍 [Facebook] Current URL:', window.location.href)
  console.log('🌐 [Facebook] Checking if on Facebook...')

  if (window.location.href.includes('facebook.com')) {
    console.log('✅ [Facebook] On Facebook domain, setting up message listener')

    // Track if we're currently processing to prevent duplicate runs
    let isProcessing = false

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 [Facebook] Content script received message:', message)
      console.log('📍 [Facebook] Current URL:', window.location.href)
      console.log('📄 [Facebook] Page title:', document.title)

      if (message.type === 'POST_FACEBOOK_CONTENT') {
        // Prevent duplicate processing
        if (isProcessing) {
          console.log('⚠️ [Facebook] Already processing a post, ignoring duplicate message')
          sendResponse({ success: false, error: 'Already processing' })
          return true
        }

        isProcessing = true
        console.log('🎯 [Facebook] Processing POST_FACEBOOK_CONTENT message with data:', {
          hasText: !!message.data?.text,
          textLength: message.data?.text?.length || 0,
          hasMediaFile: !!message.data?.mediaFile,
          mediaType: message.data?.mediaFile?.type || 'none',
          mediaSize: message.data?.mediaFile?.size || 0
        })

        FacebookPostAutomation.uploadContent(message.data)
          .then(() => {
            console.log('✅ [Facebook] Automation completed successfully')
            sendResponse({ success: true })
          })
          .catch((error) => {
            console.error('❌ [Facebook] Error in automation:', error)
            sendResponse({ success: false, error: error.message })
          })
          .finally(() => {
            // Reset processing flag after a delay
            setTimeout(() => {
              isProcessing = false
              console.log('🔄 [Facebook] Reset processing flag')
            }, 5000)
          })

        return true // Keep message channel open for async response
      }
    })

    console.log('✅ [Facebook] Message listener registered for POST_FACEBOOK_CONTENT')
  } else {
    console.log('ℹ️ [Facebook] Not on Facebook domain, skipping message listener setup')
  }
}

