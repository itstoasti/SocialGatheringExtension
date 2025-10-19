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
}

/**
 * Threads Compose Page Automation
 * This script handles the automation of clicking the create button on Threads
 */
export class ThreadsComposeAutomation {
  private static readonly SELECTORS = {
    // Post button that appears in the compose dialog
    POST_BUTTON: 'div[role="button"]:has(> div.xc26acl)',
    POST_BUTTON_ALT: 'div[role="button"]',
    // Text area selector for Threads
    TEXT_AREA: 'div[contenteditable="true"][role="textbox"][data-lexical-editor="true"]',
    // Media upload selectors
    MEDIA_INPUT: 'input[type="file"][accept*="image"], input[type="file"][accept*="video"]',
    MEDIA_BUTTON: '[aria-label*="Attach"], [aria-label*="attach"], [aria-label*="Media"], [aria-label*="media"], [aria-label*="photo"], [aria-label*="Photo"], [aria-label*="video"], [aria-label*="Video"]',
  }

  private static readonly RETRY_ATTEMPTS = 20
  private static readonly RETRY_DELAY = 1000

  /**
   * Wait for an element to appear in the DOM
   */
  private static waitForElement(selector: string, timeout = 20000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const check = () => {
        const element = document.querySelector(selector)
        if (element) {
          console.log(`✅ Found element: ${selector}`)
          resolve(element)
          return
        }

        if (Date.now() - startTime > timeout) {
          console.error(`❌ Element ${selector} not found within ${timeout}ms`)
          reject(new Error(`Element ${selector} not found within ${timeout}ms`))
          return
        }

        setTimeout(check, 200)
      }

      check()
    })
  }

  /**
   * Set text in the Threads compose area
   */
  static async setText(text: string): Promise<void> {
    try {
      console.log('🔍 Looking for Threads text editor in the compose dialog...')

      // Find all text editors first
      const allEditors = Array.from(document.querySelectorAll(this.SELECTORS.TEXT_AREA))
      console.log(`📍 Found ${allEditors.length} text editors on the page`)

      // Find the VISIBLE editor (not hidden by aria-hidden)
      let textEditor: Element | null = null

      console.log('🔍 Checking each editor for visibility...')
      for (let i = 0; i < allEditors.length; i++) {
        const editor = allEditors[i] as HTMLElement

        // Check if editor has aria-hidden ancestor
        let current: HTMLElement | null = editor
        let isHidden = false
        let hiddenAncestor: HTMLElement | null = null

        while (current && current !== document.body) {
          if (current.getAttribute('aria-hidden') === 'true') {
            isHidden = true
            hiddenAncestor = current
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

        console.log(`📝 Editor ${i + 1}:`)
        console.log(`   - aria-hidden ancestor: ${isHidden} ${hiddenAncestor ? `(id: ${hiddenAncestor.id})` : ''}`)
        console.log(`   - on screen: ${isOnScreen}`)
        console.log(`   - in viewport: ${isInViewport}`)
        console.log(`   - rect: top=${rect.top}, left=${rect.left}, width=${rect.width}, height=${rect.height}`)

        // Select the editor that is NOT hidden and IS on screen and in viewport
        if (!isHidden && isOnScreen && isInViewport) {
          textEditor = editor
          console.log(`✅ Found visible editor ${i + 1}!`)
          break
        }
      }

      if (!textEditor) {
        console.log('⚠️ No fully visible editor found. Looking for the best candidate...')

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
            console.log(`✅ Using editor ${i + 1} (not aria-hidden)`)
            break
          }
        }
      }

      if (!textEditor) {
        // Last resort: use the last editor
        textEditor = allEditors[allEditors.length - 1]
        console.log(`⚠️ Using last editor as last resort`)
      }

      if (textEditor) {
        await this.typeInLexicalEditor(textEditor, text.trim())
        console.log('✅ Text input completed')
      } else {
        throw new Error('Threads text editor not found')
      }
    } catch (error) {
      console.error('❌ Error setting text:', error)
      throw error
    }
  }

  /**
   * Type text in Lexical editor (used by Threads) using multiple methods
   */
  private static async typeInLexicalEditor(element: Element, text: string): Promise<void> {
    const editor = element as HTMLElement
    console.log(`🎯 Attempting to type in Lexical editor: ${text}`)

    // Try methods in order of preference
    const methods = [
      () => this.tryDataTransferPaste(editor, text),
      () => this.tryCompositionEvents(editor, text),
      () => this.tryDirectTextInsertion(editor, text),
      () => this.tryCharByCharTyping(editor, text),
    ]

    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`🔄 Trying text input method ${i + 1}...`)
        const success = await methods[i]()
        if (success) {
          console.log(`✅ Text input method ${i + 1} succeeded`)

          // Wait a brief moment after successful insertion to let Lexical process it
          await new Promise(resolve => setTimeout(resolve, 300))

          // Double-check the text is still there
          const finalText = editor.textContent || editor.innerText || ''
          const normalizedFinal = finalText.replace(/\s+/g, '').toLowerCase()
          const normalizedExpected = text.replace(/\s+/g, '').toLowerCase()

          if (normalizedFinal === normalizedExpected && finalText.trim().length > 0) {
            console.log(`✅ Text verified after insertion: "${finalText.substring(0, 100)}..."`)
            return
          } else {
            console.log(`⚠️ Text disappeared or changed after insertion, trying next method...`)
            console.log(`   Expected: "${normalizedExpected.substring(0, 50)}..."`)
            console.log(`   Got: "${normalizedFinal.substring(0, 50)}..."`)
          }
        }
        console.log(`❌ Text input method ${i + 1} failed`)
      } catch (error) {
        console.log(`❌ Text input method ${i + 1} error:`, error)
      }
    }

    console.log('❌ All text input methods failed')
    throw new Error('Failed to input text in Lexical editor')
  }

  /**
   * Try DataTransfer API paste (compatible with Lexical)
   */
  private static async tryDataTransferPaste(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('📋 Trying DataTransfer paste...')

      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 300))

      // Create DataTransfer object with text
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/plain', text)
      dataTransfer.setData('text/html', text)

      // Create a proper paste event
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })

      // Dispatch the paste event
      editor.dispatchEvent(pasteEvent)

      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify the text was pasted - normalize whitespace for comparison
      const currentText = editor.textContent || editor.innerText || ''
      const normalizedCurrent = currentText.replace(/\s+/g, '').toLowerCase()
      const normalizedExpected = text.replace(/\s+/g, '').toLowerCase()

      // Success if the text content matches after removing ALL whitespace
      // This handles cases where Threads removes or changes whitespace/newlines
      const success = normalizedCurrent === normalizedExpected && currentText.trim().length > 0

      console.log(`🔍 DataTransfer paste check: expected (no spaces) "${normalizedExpected.substring(0, 50)}...", got (no spaces) "${normalizedCurrent.substring(0, 50)}...", success: ${success}`)
      return success

    } catch (error) {
      console.log('❌ Error in DataTransfer paste:', error)
      return false
    }
  }

  /**
   * Try composition events (simulates IME input)
   */
  private static async tryCompositionEvents(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('🔤 Trying composition events...')

      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 300))

      // Start composition
      const compositionStartEvent = new CompositionEvent('compositionstart', {
        data: '',
        bubbles: true,
        cancelable: true
      })

      editor.dispatchEvent(compositionStartEvent)
      await new Promise(resolve => setTimeout(resolve, 50))

      // Update composition
      const compositionUpdateEvent = new CompositionEvent('compositionupdate', {
        data: text,
        bubbles: true,
        cancelable: true
      })

      editor.dispatchEvent(compositionUpdateEvent)
      await new Promise(resolve => setTimeout(resolve, 50))

      // End composition
      const compositionEndEvent = new CompositionEvent('compositionend', {
        data: text,
        bubbles: true,
        cancelable: true
      })

      editor.dispatchEvent(compositionEndEvent)

      // Also dispatch input event
      const inputEvent = new InputEvent('input', {
        data: text,
        inputType: 'insertCompositionText',
        bubbles: true,
        cancelable: true
      })

      editor.dispatchEvent(inputEvent)

      await new Promise(resolve => setTimeout(resolve, 300))

      // Verify - normalize whitespace for comparison
      const currentText = editor.textContent || editor.innerText || ''
      const normalizedCurrent = currentText.replace(/\s+/g, '').toLowerCase()
      const normalizedExpected = text.replace(/\s+/g, '').toLowerCase()
      const success = normalizedCurrent === normalizedExpected && currentText.trim().length > 0

      console.log(`🔍 Composition events check: expected (no spaces) "${normalizedExpected.substring(0, 50)}...", got (no spaces) "${normalizedCurrent.substring(0, 50)}...", success: ${success}`)
      return success

    } catch (error) {
      console.log('❌ Error in composition events:', error)
      return false
    }
  }

  /**
   * Try direct text insertion with proper Lexical structure
   */
  private static async tryDirectTextInsertion(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('📝 Trying direct text insertion with Lexical structure...')

      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 300))

      // Find the paragraph element inside the editor
      const paragraph = editor.querySelector('p')
      if (paragraph) {
        // Clear existing content first
        paragraph.innerHTML = ''

        // Create the proper Lexical structure: <span data-lexical-text="true">text</span>
        const textSpan = document.createElement('span')
        textSpan.setAttribute('data-lexical-text', 'true')
        textSpan.textContent = text

        paragraph.appendChild(textSpan)

        // Move cursor to the end
        const range = document.createRange()
        const selection = window.getSelection()
        range.setStart(textSpan.firstChild!, text.length)
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)

        // Dispatch comprehensive input events
        const events = [
          new Event('focus', { bubbles: true }),
          new InputEvent('beforeinput', {
            data: text,
            inputType: 'insertText',
            bubbles: true,
            cancelable: true
          }),
          new InputEvent('input', {
            data: text,
            inputType: 'insertText',
            bubbles: true,
            cancelable: true
          }),
          new Event('change', { bubbles: true })
        ]

        for (const event of events) {
          editor.dispatchEvent(event)
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        await new Promise(resolve => setTimeout(resolve, 500))

        // Verify the span exists with correct content - normalize whitespace for comparison
        const spanCheck = paragraph.querySelector('span[data-lexical-text="true"]')
        const currentText = editor.textContent || editor.innerText || ''
        const normalizedCurrent = currentText.replace(/\s+/g, '').toLowerCase()
        const normalizedExpected = text.replace(/\s+/g, '').toLowerCase()
        const success = !!spanCheck &&
                        normalizedCurrent === normalizedExpected &&
                        currentText.trim().length > 0

        console.log(`🔍 Direct text insertion check: span exists: ${!!spanCheck}, expected (no spaces) "${normalizedExpected.substring(0, 50)}...", got (no spaces) "${normalizedCurrent.substring(0, 50)}...", success: ${success}`)
        return success
      }

      return false

    } catch (error) {
      console.log('❌ Error in direct text insertion:', error)
      return false
    }
  }

  /**
   * Try simulating keystrokes character by character with Lexical structure
   */
  private static async tryCharByCharTyping(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('⌨️ Trying character-by-character typing with Lexical structure...')

      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 300))

      // Find the paragraph element
      const paragraph = editor.querySelector('p')
      if (!paragraph) {
        return false
      }

      // Clear existing content and create Lexical span structure
      paragraph.innerHTML = ''
      const textSpan = document.createElement('span')
      textSpan.setAttribute('data-lexical-text', 'true')
      textSpan.textContent = ''
      paragraph.appendChild(textSpan)

      // Type each character
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        textSpan.textContent += char

        // Dispatch events for this character
        const keydownEvent = new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true
        })

        const inputEvent = new InputEvent('input', {
          data: char,
          inputType: 'insertText',
          bubbles: true,
          cancelable: true
        })

        const keyupEvent = new KeyboardEvent('keyup', {
          key: char,
          bubbles: true,
          cancelable: true
        })

        editor.dispatchEvent(keydownEvent)
        editor.dispatchEvent(inputEvent)
        editor.dispatchEvent(keyupEvent)

        // Small delay between characters
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify the span exists with correct content - normalize whitespace for comparison
      const spanCheck = paragraph.querySelector('span[data-lexical-text="true"]')
      const currentText = editor.textContent || editor.innerText || ''
      const normalizedCurrent = currentText.replace(/\s+/g, '').toLowerCase()
      const normalizedExpected = text.replace(/\s+/g, '').toLowerCase()
      const success = !!spanCheck &&
                      normalizedCurrent === normalizedExpected &&
                      currentText.trim().length > 0

      console.log(`🔍 Character-by-character check: span exists: ${!!spanCheck}, expected (no spaces) "${normalizedExpected.substring(0, 50)}...", got (no spaces) "${normalizedCurrent.substring(0, 50)}...", success: ${success}`)
      return success

    } catch (error) {
      console.log('❌ Error in character-by-character typing:', error)
      return false
    }
  }

  /**
   * Upload a media file to Threads
   */
  private static async uploadMediaFile(file: File): Promise<void> {
    try {
      console.log('🎬 Starting media file upload for:', file.name, file.type)

      // First, try to find the file input DIRECTLY
      let fileInput: HTMLInputElement | null = null

      const inputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"][accept*="video"]',
        'input[type="file"]'
      ]

      // Look for existing file input first
      for (const selector of inputSelectors) {
        console.log(`🔍 Looking for existing file input: ${selector}`)
        fileInput = document.querySelector(selector) as HTMLInputElement
        if (fileInput) {
          console.log(`✅ Found existing file input with selector: ${selector}`)
          break
        }
      }

      // If no file input found, try to find and click media button
      if (!fileInput) {
        console.log('🔍 No existing file input found, looking for media button...')

        // Look for media button - Threads uses different patterns
        const buttonSelectors = [
          '[aria-label*="Attach"]',
          '[aria-label*="attach"]',
          '[aria-label*="Media"]',
          '[aria-label*="media"]',
          'svg[aria-label*="Attach"]',
          'svg[aria-label*="attach"]'
        ]

        let mediaButton: Element | null = null
        for (const selector of buttonSelectors) {
          console.log(`🔍 Trying button selector: ${selector}`)

          // For SVG elements, we need to find the clickable parent
          const element = document.querySelector(selector)
          if (element) {
            if (element.tagName.toLowerCase() === 'svg') {
              // Find the clickable parent (usually a div with role="button")
              mediaButton = element.closest('[role="button"]')
              if (mediaButton) {
                console.log(`✅ Found media button (parent of SVG) with selector: ${selector}`)
                break
              }
            } else {
              mediaButton = element
              console.log(`✅ Found media button with selector: ${selector}`)
              break
            }
          }
        }

        if (mediaButton) {
          console.log('👆 Clicking media upload button...')
          ;(mediaButton as HTMLElement).click()

          // Wait for file input to appear
          await new Promise(resolve => setTimeout(resolve, 500))

          // Look for file input again
          for (const selector of inputSelectors) {
            console.log(`🔍 Looking for file input after click: ${selector}`)
            fileInput = document.querySelector(selector) as HTMLInputElement
            if (fileInput) {
              console.log(`✅ Found file input with selector: ${selector}`)
              break
            }
          }

          if (!fileInput) {
            // Try to find any file input that might be hidden
            const allInputs = document.querySelectorAll('input[type="file"]')
            console.log(`🔍 Found ${allInputs.length} file inputs, trying the last one...`)
            if (allInputs.length > 0) {
              fileInput = allInputs[allInputs.length - 1] as HTMLInputElement
            }
          }
        }
      }

      if (fileInput) {
        console.log('📁 Setting file on input programmatically...')

        // Create a new FileList with our file
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        fileInput.files = dataTransfer.files

        // Trigger multiple events to ensure detection
        const events = ['change', 'input']
        for (const eventType of events) {
          const event = new Event(eventType, { bubbles: true })
          fileInput.dispatchEvent(event)
        }

        console.log('⏳ Waiting for media upload to process...')

        // Wait for media upload to complete
        await this.waitForMediaUploadCompletion(file.name)

        console.log('✅ Media file upload completed and verified')
      } else {
        throw new Error('File input not found with any method')
      }
    } catch (error) {
      console.error('❌ Error uploading media file:', error)
      throw error
    }
  }

  /**
   * Wait for media upload to complete and verify success
   */
  private static async waitForMediaUploadCompletion(fileName: string): Promise<void> {
    console.log('🔍 Verifying media upload completion...')

    const maxWaitTime = 120000 // 120 seconds (2 minutes) for larger video files
    const checkInterval = 500 // Check every 500ms
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // Check for various indicators that media upload completed
      const indicators = [
        // Media preview appeared
        '[role="dialog"] img',
        '[role="dialog"] video',
        // Look for media container with content
        '[role="dialog"] [style*="background-image"]'
      ]

      let uploadCompleted = false
      let completionElement: Element | null = null

      for (const selector of indicators) {
        const element = document.querySelector(selector)
        if (element) {
          console.log(`✅ Found upload completion indicator: ${selector}`)
          uploadCompleted = true
          completionElement = element
          break
        }
      }

      if (uploadCompleted && completionElement) {
        // Check if it's an image or video element and verify it's loaded
        if (completionElement.tagName.toLowerCase() === 'img') {
          const img = completionElement as HTMLImageElement
          if (img.complete && img.naturalHeight !== 0) {
            console.log(`✅ Image is fully loaded and ready`)
            break
          } else {
            console.log(`⏳ Image not fully loaded yet - complete: ${img.complete}, naturalHeight: ${img.naturalHeight}`)
          }
        } else if (completionElement.tagName.toLowerCase() === 'video') {
          const video = completionElement as HTMLVideoElement
          if (video.readyState >= 2 && video.duration > 0) {
            console.log(`✅ Video is fully loaded and ready`)
            break
          } else {
            console.log(`⏳ Video not fully loaded yet - readyState: ${video.readyState}, duration: ${video.duration}`)
          }
        } else {
          // For other indicators (like background-image), just wait a bit more to be safe
          await new Promise(resolve => setTimeout(resolve, 1000))
          console.log(`✅ Media upload indicator found, considering upload complete`)
          break
        }
      }

      // Log progress periodically
      const elapsedTime = Date.now() - startTime
      if (elapsedTime % 3000 < 500) { // Every 3 seconds
        console.log(`⏳ Still waiting for media upload... (${Math.round(elapsedTime / 1000)}s elapsed)`)
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    console.log('✅ Media upload verification completed')
  }

  /**
   * Click the Post button on Threads (to open compose dialog)
   */
  static async clickPostButton(): Promise<void> {
    try {
      console.log('🎯 Looking for Threads Post button...')

      // Find all div elements with role="button"
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'))
      console.log(`📍 Found ${buttons.length} elements with role="button"`)

      // Find the button that contains "Post" text
      let postButton: HTMLElement | null = null

      for (const button of buttons) {
        const text = button.textContent?.trim()
        console.log(`🔍 Button text: "${text}"`)

        if (text === 'Post') {
          postButton = button as HTMLElement
          console.log('✅ Found Post button!')
          break
        }
      }

      if (!postButton) {
        console.log('⚠️ Post button with exact text "Post" not found, trying alternative selectors...')

        // Try to find by the specific class structure
        const altButtons = Array.from(document.querySelectorAll('div[role="button"] > div.xc26acl'))
        console.log(`📍 Found ${altButtons.length} elements with class xc26acl`)

        for (const inner of altButtons) {
          if (inner.textContent?.trim() === 'Post') {
            postButton = inner.parentElement as HTMLElement
            console.log('✅ Found Post button via alternative selector!')
            break
          }
        }
      }

      if (!postButton) {
        throw new Error('Post button not found on page')
      }

      console.log('👆 Clicking Threads Post button...')
      console.log('🎯 Button element:', postButton)
      console.log('🎯 Button classes:', postButton.className)
      console.log('🎯 Button attributes:', {
        role: postButton.getAttribute('role'),
        tabindex: postButton.getAttribute('tabindex')
      })

      // Just use a single direct click - it works reliably
      console.log('🖱️ Clicking Post button (direct click)...')
      postButton.click()

      // Wait a moment for the dialog to open
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check if compose dialog opened
      const dialogOpened = document.querySelector('[role="dialog"]') !== null
      console.log(`🔍 Compose dialog opened: ${dialogOpened}`)

      if (dialogOpened) {
        console.log('✅ Post button clicked successfully - compose dialog is open')
      } else {
        console.log('⚠️ Compose dialog not detected, but continuing anyway...')
      }

    } catch (error) {
      console.error('❌ Error clicking Post button:', error)
      throw error
    }
  }

  /**
   * Click the submit Post button inside the compose dialog to actually post
   */
  static async clickSubmitButton(): Promise<void> {
    try {
      console.log('🎯 Looking for Submit Post button inside dialog...')

      // Find the dialog
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) {
        throw new Error('Compose dialog not found')
      }

      // Wait for the Post button to be enabled (not disabled/aria-disabled)
      // This is crucial for video uploads that take time to process
      const maxWaitTime = 60000 // 60 seconds for large videos
      const checkInterval = 500
      const startTime = Date.now()

      let submitButton: HTMLElement | null = null

      console.log('⏳ Waiting for Post button to become enabled...')

      while (Date.now() - startTime < maxWaitTime) {
        // Find all buttons with role="button" inside the dialog
        const buttons = Array.from(dialog.querySelectorAll('div[role="button"]'))
        console.log(`🔍 Found ${buttons.length} buttons with role="button" in dialog`)

        // Find all Post buttons and rank them by position (bottom-right is likely the submit button)
        const postButtons: Array<{element: HTMLElement, rect: DOMRect, index: number}> = []

        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i]
          const text = button.textContent?.trim()
          if (text === 'Post') {
            const buttonElement = button as HTMLElement
            const isVisible = buttonElement.offsetWidth > 0 && buttonElement.offsetHeight > 0
            const rect = buttonElement.getBoundingClientRect()

            // Check if button is disabled
            const isDisabled = buttonElement.getAttribute('aria-disabled') === 'true' ||
                             buttonElement.hasAttribute('disabled') ||
                             buttonElement.classList.contains('disabled')

            console.log(`🔍 Found Post button ${i + 1}:`, {
              visible: isVisible,
              disabled: isDisabled,
              position: { top: Math.round(rect.top), left: Math.round(rect.left), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
              size: { width: Math.round(rect.width), height: Math.round(rect.height) }
            })

            if (isVisible && !isDisabled) {
              postButtons.push({ element: buttonElement, rect, index: i })
            }
          }
        }

        // If we found enabled Post buttons, select the one that's most likely the submit button
        // The submit button is typically in the bottom-right area of the dialog
        if (postButtons.length > 0) {
          console.log(`✅ Found ${postButtons.length} enabled Post button(s)`)

          // Sort by position: prefer buttons that are lower (higher top value) and more to the right (higher left value)
          postButtons.sort((a, b) => {
            // First priority: lower position (higher top value)
            const topDiff = b.rect.top - a.rect.top
            if (Math.abs(topDiff) > 10) { // More than 10px difference
              return topDiff
            }
            // Second priority: more to the right (higher left value)
            return b.rect.left - a.rect.left
          })

          submitButton = postButtons[0].element
          console.log(`✅ Selected Post button at position (top: ${Math.round(postButtons[0].rect.top)}, left: ${Math.round(postButtons[0].rect.left)}) as submit button`)
          break
        }

        // If no button found yet, try alternative selector
        if (!submitButton) {
          const altButtons = Array.from(dialog.querySelectorAll('div[role="button"] > div.xc26acl'))
          console.log(`🔍 Trying alternative selector, found ${altButtons.length} elements with class xc26acl`)

          const altPostButtons: Array<{element: HTMLElement, rect: DOMRect}> = []

          for (const inner of altButtons) {
            if (inner.textContent?.trim() === 'Post') {
              const buttonElement = inner.parentElement as HTMLElement
              const isVisible = buttonElement && buttonElement.offsetWidth > 0 && buttonElement.offsetHeight > 0
              const isDisabled = buttonElement && (
                buttonElement.getAttribute('aria-disabled') === 'true' ||
                buttonElement.hasAttribute('disabled') ||
                buttonElement.classList.contains('disabled')
              )

              if (isVisible && !isDisabled) {
                const rect = buttonElement.getBoundingClientRect()
                altPostButtons.push({ element: buttonElement, rect })
              }
            }
          }

          if (altPostButtons.length > 0) {
            // Sort by position (bottom-right preferred)
            altPostButtons.sort((a, b) => {
              const topDiff = b.rect.top - a.rect.top
              if (Math.abs(topDiff) > 10) {
                return topDiff
              }
              return b.rect.left - a.rect.left
            })

            submitButton = altPostButtons[0].element
            console.log('✅ Found enabled submit Post button via alternative selector!')
            break
          }
        }

        // If still no button found, wait and try again
        if (!submitButton) {
          const elapsedTime = Date.now() - startTime
          if (elapsedTime % 5000 < checkInterval) { // Log every 5 seconds
            console.log(`⏳ Still waiting for Post button to be enabled... (${Math.round(elapsedTime / 1000)}s elapsed)`)
          }
          await new Promise(resolve => setTimeout(resolve, checkInterval))
        }
      }

      if (!submitButton) {
        throw new Error('Submit Post button not found or never became enabled within timeout')
      }

      console.log('👆 Clicking Submit Post button...')
      console.log('🎯 Button element:', submitButton)
      console.log('🎯 Button classes:', submitButton.className)

      // Click the submit button
      console.log('🖱️ Clicking Submit button (direct click)...')
      submitButton.click()

      // Wait to see if post was submitted
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check if dialog closed (indicates successful post)
      const dialogStillOpen = document.querySelector('[role="dialog"]') !== null
      console.log(`🔍 Dialog still open: ${dialogStillOpen}`)

      if (!dialogStillOpen) {
        console.log('✅ Post submitted successfully - dialog closed!')
      } else {
        console.log('⚠️ Dialog still open after submit, post may need manual verification')
      }

    } catch (error) {
      console.error('❌ Error clicking Submit button:', error)
      throw error
    }
  }

  /**
   * Check if the create dialog/modal opened
   */
  private static checkCreateDialogOpened(): boolean {
    // Look for indicators that the create dialog opened
    const indicators = [
      // Common modal/dialog indicators
      '[role="dialog"]',
      '[role="modal"]',
      '.modal',
      '.dialog',
      // Composer/textarea indicators
      'textarea[placeholder*="thread"]',
      'textarea[placeholder*="Start"]',
      'textarea[placeholder*="What"]',
      '[contenteditable="true"]',
    ]

    for (const selector of indicators) {
      if (document.querySelector(selector)) {
        console.log(`✅ Found create dialog indicator: ${selector}`)
        return true
      }
    }

    return false
  }

  /**
   * Main automation function to post content to Threads
   */
  static async postContent(data: PostData): Promise<void> {
    console.log('🚀 Starting Threads compose automation...')
    console.log('📊 Data received:', data)

    try {
      // Wait for page to fully load and compose dialog to appear
      console.log('⏳ Waiting for page and Post button to load...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 1: Click the Post button to open the compose dialog
      console.log('📝 Step 1: Clicking Post button to open compose dialog...')
      await this.clickPostButton()

      // Step 2: Wait longer for compose dialog to open and become ready
      console.log('⏳ Step 2: Waiting for compose dialog to fully open...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 3: Verify the dialog is actually open by checking for the text editor
      console.log('🔍 Step 3: Verifying compose dialog is open...')
      const dialogCheck = document.querySelector('[role="dialog"]')
      if (dialogCheck) {
        console.log('✅ Compose dialog found')
      } else {
        console.log('⚠️ No dialog found, but continuing anyway...')
      }

      // Reconstruct File object from serialized data if present
      let mediaFile: File | undefined = undefined
      if (data.mediaFile && data.mediaFile.data) {
        console.log('🔄 Reconstructing media file from serialized data...')
        const uint8Array = new Uint8Array(data.mediaFile.data)
        mediaFile = new File([uint8Array], data.mediaFile.name, {
          type: data.mediaFile.type
        })
        console.log('✅ Reconstructed media file:', {
          name: mediaFile.name,
          type: mediaFile.type,
          size: mediaFile.size
        })
      }

      // Step 4: Upload media file first (if provided)
      if (mediaFile) {
        console.log('📷 Step 4: Uploading media file...')
        await this.uploadMediaFile(mediaFile)

        // Wait MUCH longer for media to be FULLY processed before adding text
        // Threads clears the text field while media is processing
        console.log('⏳ Waiting 5 seconds for media to be fully processed before adding text...')
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else {
        console.log('ℹ️ No media file provided, skipping media upload...')
      }

      // Step 5: Add text content if provided
      if (data.text && data.text.trim()) {
        console.log('📝 Step 5: Adding text content...')

        // Find the text editor again (it might have been recreated when dialog opened)
        try {
          await this.setText(data.text)

          // Verify text is visible in the DOM after insertion
          await new Promise(resolve => setTimeout(resolve, 500))
          const allTextAreas = document.querySelectorAll('div[contenteditable="true"][role="textbox"][data-lexical-editor="true"]')
          console.log(`🔍 Found ${allTextAreas.length} text editors after insertion`)

          let foundText = false
          for (let i = 0; i < allTextAreas.length; i++) {
            const editor = allTextAreas[i] as HTMLElement
            const text = editor.textContent || ''
            console.log(`📝 Editor ${i + 1} contains: "${text}"`)
            if (text.includes(data.text)) {
              foundText = true
              console.log(`✅ Text found in editor ${i + 1}`)
            }
          }

          if (!foundText) {
            console.log('⚠️ Text not found in any editor, but proceeding...')
          }
        } catch (error) {
          console.error('❌ Error setting text:', error)
          throw error
        }
      } else {
        console.log('ℹ️ No text content provided, skipping text input...')
      }

      // Step 6: Wait a moment for the content to be processed
      console.log('⏳ Step 6: Waiting for content validation...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 7: Click the submit button to post
      console.log('🎯 Step 7: Clicking submit button to post...')
      await this.clickSubmitButton()

      console.log('✅ Automation completed successfully!')

    } catch (error) {
      console.error('❌ Error in Threads compose automation:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }
}

/**
 * Message listener for content script
 */
console.log('🔗 ThreadsComposeAutomation content script loaded on:', window.location.href)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message)
  console.log('📍 Current URL:', window.location.href)
  console.log('📄 Page title:', document.title)

  if (message.type === 'POST_THREADS_CONTENT') {
    console.log('🎯 Processing POST_THREADS_CONTENT message with data:', {
      hasText: !!message.data?.text,
      textLength: message.data?.text?.length || 0,
      hasMediaFile: !!message.data?.mediaFile,
      mediaType: message.data?.mediaFile?.type || 'none',
      mediaSize: message.data?.mediaFile?.size || 0
    })

    ThreadsComposeAutomation.postContent(message.data)
      .then(() => {
        console.log('✅ Automation completed successfully')
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error('❌ Error in automation:', error)
        sendResponse({ success: false, error: error.message })
      })

    // Return true to indicate we'll send a response asynchronously
    return true
  } else {
    console.log('ℹ️ Ignoring message with type:', message.type)
  }

  return false
})

export default ThreadsComposeAutomation
