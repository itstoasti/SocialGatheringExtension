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
 * Twitter Compose Page Automation
 * This script handles the automation of posting content to Twitter
 */
export class TwitterComposeAutomation {
  private static readonly SELECTORS = {
    TWEET_TEXT_AREA: '[data-testid="tweetTextarea_0"]',
    DRAFTJS_EDITOR: '.public-DraftEditor-content[contenteditable="true"]',
    MEDIA_INPUT: 'input[data-testid="fileInput"]',
    MEDIA_BUTTON: '[data-testid="attachments"] [aria-label*="Add photos or video"], [data-testid="attachments"] [aria-label*="Media"], [aria-label*="Add photos or video"]',
    POST_BUTTON: '[data-testid="tweetButton"]',
    COMPOSE_CONTAINER: '[data-testid="toolBar"]',
  }

  private static readonly RETRY_ATTEMPTS = 10
  private static readonly RETRY_DELAY = 1000

  /**
   * Set text in the compose area
   */
  static async setText(text: string): Promise<void> {
    try {
      console.log('🔍 Looking for DraftJS editor...')
      const draftJSEditor = await this.waitForElement(this.SELECTORS.DRAFTJS_EDITOR, 5000)
      
      if (draftJSEditor) {
        await this.typeInDraftJSEditor(draftJSEditor, text.trim())
        console.log('✅ Text input completed')
      } else {
        throw new Error('DraftJS editor not found')
      }
    } catch (error) {
      console.error('❌ Error setting text:', error)
      throw error
    }
  }

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
   * Type text in DraftJS editor using multiple methods
   */
  private static async typeInDraftJSEditor(element: Element, text: string): Promise<void> {
    const editor = element as HTMLElement
    console.log(`🎯 Attempting to type in DraftJS editor: ${text}`)
    
    // Try methods in order of preference
    const methods = [
      () => this.tryDataTransferPaste(editor, text),
      () => this.tryCompositionEvents(editor, text),
      () => this.tryClipboardWithEvents(editor, text),
      () => this.tryDirectPasteEvent(editor, text)
    ]
    
    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`🔄 Trying text input method ${i + 1}...`)
        const success = await methods[i]()
        if (success) {
          console.log(`✅ Text input method ${i + 1} succeeded`)
          return
        }
        console.log(`❌ Text input method ${i + 1} failed`)
      } catch (error) {
        console.log(`❌ Text input method ${i + 1} error:`, error)
      }
    }
    
    console.log('❌ All text input methods failed')
    throw new Error('Failed to input text in DraftJS editor')
  }

  /**
   * Try DataTransfer API paste (most compatible with DraftJS)
   */
  private static async tryDataTransferPaste(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('📋 Trying DataTransfer paste...')
      
      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 200))
      
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
      const normalizedCurrent = currentText.replace(/\s+/g, ' ').trim()
      const normalizedExpected = text.replace(/\s+/g, ' ').trim()

      // Success if currentText contains most of the expected text (allowing for formatting differences)
      const success = (normalizedCurrent.includes(normalizedExpected) || normalizedExpected.includes(normalizedCurrent)) &&
                      currentText.trim().length > 0

      console.log(`🔍 DataTransfer paste check: expected "${text}", got "${currentText}", success: ${success}`)
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
      await new Promise(resolve => setTimeout(resolve, 200))
      
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
      const normalizedCurrent = currentText.replace(/\s+/g, ' ').trim()
      const normalizedExpected = text.replace(/\s+/g, ' ').trim()
      const success = (normalizedCurrent.includes(normalizedExpected) || normalizedExpected.includes(normalizedCurrent)) &&
                      currentText.trim().length > 0

      console.log(`🔍 Composition events check: expected "${text}", got "${currentText}", success: ${success}`)
      return success
      
    } catch (error) {
      console.log('❌ Error in composition events:', error)
      return false
    }
  }

  /**
   * Try clipboard with proper event sequence
   */
  private static async tryClipboardWithEvents(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('📋 Trying clipboard with events...')
      
      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Write to clipboard
      await navigator.clipboard.writeText(text)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Create proper clipboard data
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/plain', text)
      
      // Create beforepaste event
      const beforePasteEvent = new Event('beforepaste', {
        bubbles: true,
        cancelable: true
      })
      
      editor.dispatchEvent(beforePasteEvent)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Create paste event
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })
      
      editor.dispatchEvent(pasteEvent)
      await new Promise(resolve => setTimeout(resolve, 300))

      // Verify - normalize whitespace for comparison
      const currentText = editor.textContent || editor.innerText || ''
      const normalizedCurrent = currentText.replace(/\s+/g, ' ').trim()
      const normalizedExpected = text.replace(/\s+/g, ' ').trim()
      const success = (normalizedCurrent.includes(normalizedExpected) || normalizedExpected.includes(normalizedCurrent)) &&
                      currentText.trim().length > 0

      console.log(`🔍 Clipboard with events check: expected "${text}", got "${currentText}", success: ${success}`)
      return success
      
    } catch (error) {
      console.log('❌ Error in clipboard with events:', error)
      return false
    }
  }

  /**
   * Try direct paste event (last resort)
   */
  private static async tryDirectPasteEvent(editor: HTMLElement, text: string): Promise<boolean> {
    try {
      console.log('🔧 Trying direct paste event...')
      
      // Focus the editor
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Try to find the React component instance
      const reactKey = Object.keys(editor).find(key => 
        key.startsWith('__reactInternalInstance') || 
        key.startsWith('__reactFiber')
      )
      
      if (reactKey) {
        console.log('🔍 Found React instance, attempting state update...')
        
        // Create a more comprehensive paste event
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/plain', text)
        clipboardData.setData('text/html', text)
        
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true
        })
        
        // Set up proper event sequence
        const events = [
          new Event('focus', { bubbles: true }),
          new InputEvent('beforeinput', {
            data: text,
            inputType: 'insertFromPaste',
            bubbles: true,
            cancelable: true
          }),
          pasteEvent,
          new InputEvent('input', {
            data: text,
            inputType: 'insertFromPaste',
            bubbles: true,
            cancelable: true
          }),
          new Event('change', { bubbles: true })
        ]
        
        // Dispatch all events
        for (const event of events) {
          editor.dispatchEvent(event)
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        await new Promise(resolve => setTimeout(resolve, 300))

        // Verify - normalize whitespace for comparison
        const currentText = editor.textContent || editor.innerText || ''
        const normalizedCurrent = currentText.replace(/\s+/g, ' ').trim()
        const normalizedExpected = text.replace(/\s+/g, ' ').trim()
        const success = (normalizedCurrent.includes(normalizedExpected) || normalizedExpected.includes(normalizedCurrent)) &&
                        currentText.trim().length > 0

        console.log(`🔍 Direct paste event check: expected "${text}", got "${currentText}", success: ${success}`)
        return success
      }
      
      return false
      
    } catch (error) {
      console.log('❌ Error in direct paste event:', error)
      return false
    }
  }

  /**
   * Simulate realistic key press with proper event sequence
   */
  private static async simulateKeyPress(
    element: HTMLElement, 
    key: string, 
    modifiers: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}
  ): Promise<void> {
    const eventOptions = {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers
    }
    
    // Create and dispatch keydown
    const keydownEvent = new KeyboardEvent('keydown', eventOptions)
    element.dispatchEvent(keydownEvent)
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Create and dispatch keyup
    const keyupEvent = new KeyboardEvent('keyup', eventOptions)
    element.dispatchEvent(keyupEvent)
    
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  /**
   * Clear DraftJS content safely
   */
  private static async clearDraftJSContent(editor: HTMLElement): Promise<void> {
    try {
      console.log('🧹 Clearing DraftJS content...')
      
      // Focus first
      editor.focus()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Use keyboard shortcuts to clear
      await this.simulateKeyPress(editor, 'a', { ctrlKey: true })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      await this.simulateKeyPress(editor, 'Delete')
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('✅ DraftJS content cleared')
      
    } catch (error) {
      console.log('❌ Error clearing DraftJS content:', error)
    }
  }









  /**
   * Upload a media file to Twitter with improved detection - no dialog approach
   */
  private static async uploadMediaFile(file: File): Promise<void> {
    try {
      console.log('🎬 Starting media file upload for:', file.name, file.type)
      
      // First, try to find the file input DIRECTLY without clicking anything
      let fileInput: HTMLInputElement | null = null
      
      const inputSelectors = [
        'input[data-testid="fileInput"]',
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
      
      // If no file input found, try to find it after clicking media button
      if (!fileInput) {
        console.log('🔍 No existing file input found, looking for media button...')
      
      const buttonSelectors = [
        '[data-testid="attachments"] [aria-label*="Add photos or video"]',
        '[data-testid="attachments"] [aria-label*="Media"]', 
        '[aria-label*="Add photos or video"]',
        '[aria-label*="Add media"]',
        '[data-testid="attachments"] button',
        '[role="button"][aria-label*="Media"]'
      ]
      
        let mediaButton: Element | null = null
      for (const selector of buttonSelectors) {
          console.log(`🔍 Trying button selector: ${selector}`)
        mediaButton = document.querySelector(selector)
        if (mediaButton) {
          console.log(`✅ Found media button with selector: ${selector}`)
          break
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
        
        // Make sure the input is not disabled or hidden in a way that would trigger dialogs
        if (fileInput.style.display === 'none') {
          console.log('🔧 File input is hidden, making it temporarily visible...')
          const originalDisplay = fileInput.style.display
          fileInput.style.display = 'block'
          fileInput.style.position = 'absolute'
          fileInput.style.left = '-9999px'
          fileInput.style.opacity = '0'
          
          // Set the file
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(file)
          fileInput.files = dataTransfer.files
          
          // Trigger events
          const events = ['change', 'input']
          for (const eventType of events) {
            const event = new Event(eventType, { bubbles: true })
            fileInput.dispatchEvent(event)
          }
          
          // Restore original display
          fileInput.style.display = originalDisplay
          fileInput.style.position = ''
          fileInput.style.left = ''
          fileInput.style.opacity = ''
        } else {
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
        }
        
        console.log('⏳ Waiting for media upload to process...')
        
        // Wait and verify media upload completed successfully
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
    
    const maxWaitTime = 30000 // Increased to 30 seconds for larger files
    const checkInterval = 500 // Check every 500ms
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      // Check for various indicators that media upload completed
      const indicators = [
        // Media preview appeared
        '[data-testid="media"]',
        '[data-testid="attachments"] img',
        '[data-testid="attachments"] video',
        // Remove media button (appears after upload)
        '[aria-label*="Remove media"]',
        '[aria-label*="Remove attachment"]',
        // Media container with actual content (not empty)
        '[data-testid="attachments"]:not(:empty) img',
        '[data-testid="attachments"]:not(:empty) video'
      ]
      
      let uploadCompleted = false
      let completionElement: Element | null = null
      
      for (const selector of indicators) {
        const element = document.querySelector(selector)
        if (element) {
          console.log(`✅ Found upload completion indicator: ${selector} ${element.tagName}`)
          uploadCompleted = true
          completionElement = element
          break
        }
      }
      
      if (uploadCompleted && completionElement) {
        // Double-check by looking for specific uploading/progress indicators
        const uploadingIndicators = [
          '[data-testid="media"][data-testid*="uploading"]',
          '[data-testid="media"][data-testid*="progress"]',
          '[data-testid="attachments"] [data-testid*="progress"]',
          '[data-testid="attachments"] .uploading',
          '[data-testid="attachments"] .progress-bar',
          // More specific progress indicators
          '[data-testid="attachments"] [role="progressbar"]',
          '[data-testid="attachments"] [aria-valuenow]',
          // Loading spinners
          '[data-testid="attachments"] [data-testid*="spinner"]',
          '[data-testid="attachments"] .spinner'
        ]
        
        let stillUploading = false
        for (const selector of uploadingIndicators) {
          if (document.querySelector(selector)) {
            console.log(`⏳ Still uploading - found indicator: ${selector}`)
            stillUploading = true
            break
          }
        }
        
        if (!stillUploading) {
          // Additional verification for videos
          if (completionElement.tagName.toLowerCase() === 'video') {
            const video = completionElement as HTMLVideoElement
            console.log(`🔍 Video not fully loaded yet - src: ${video.src}, duration: ${!!video.duration}, readyState: ${video.readyState}`)
            
            // For videos, ensure they have duration and are at least loaded to HAVE_CURRENT_DATA (2)
            if (video.readyState >= 2 && video.duration > 0) {
              console.log(`✅ Video is fully loaded and ready`)
              break
            }
          } else {
            // For images, check if fully loaded
            if (completionElement.tagName.toLowerCase() === 'img') {
              const img = completionElement as HTMLImageElement
              if (img.complete && img.naturalHeight !== 0) {
                console.log(`✅ Image is fully loaded and ready`)
                break
              } else {
                console.log(`⏳ Image not fully loaded yet - complete: ${img.complete}, naturalHeight: ${img.naturalHeight}`)
              }
            } else {
              // For other media elements, we'll trust the upload completion indicator
              console.log(`✅ Media upload completed (non-video/image element)`)
              break
            }
          }
        }
      }
      
      // Log progress periodically
      const elapsedTime = Date.now() - startTime
      if (elapsedTime % 3000 < 500) { // Every 3 seconds
        console.log(`⏳ Still waiting for media upload... (${Math.round(elapsedTime / 1000)}s elapsed)`)
        
        // Debug: Check what's in attachments container
        const attachmentsContainer = document.querySelector('[data-testid="attachments"]')
        if (attachmentsContainer) {
          console.log('🔍 Attachments container contents:', {
            innerHTML: attachmentsContainer.innerHTML.substring(0, 200) + '...',
            children: attachmentsContainer.children.length,
            images: attachmentsContainer.querySelectorAll('img').length,
            videos: attachmentsContainer.querySelectorAll('video').length
          })
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
    
    // Final verification
    const attachmentsContainer = document.querySelector('[data-testid="attachments"]')
    if (attachmentsContainer) {
      const images = attachmentsContainer.querySelectorAll('img')
      const videos = attachmentsContainer.querySelectorAll('video')
      const hasMedia = images.length > 0 || videos.length > 0
      
      console.log('🔍 Final attachments container state:')
      console.log(`   - innerHTML length: ${attachmentsContainer.innerHTML.length}`)
      console.log(`   - has images: ${images.length}`)
      console.log(`   - has videos: ${videos.length}`)
      console.log(`   - has progress bars: ${attachmentsContainer.querySelectorAll('[role="progressbar"]').length}`)
      
      if (!hasMedia) {
        console.log('❌ No media found in attachments after waiting, but proceeding anyway')
      } else {
        console.log('✅ Media found in attachments container')
      }
    } else {
      console.log('⚠️ No attachments container found, but proceeding anyway')
    }
    
    console.log('⚠️ Media upload verification completed (may have timed out)')
  }

  /**
   * Wait for media upload and processing to complete
   */
  private static async waitForMediaProcessing(): Promise<void> {
    console.log('⏳ Waiting for media upload to process...')
    
    // Wait longer for media processing - increase timeout to 45 seconds
    const maxWaitTime = 45000 // 45 seconds
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      // Check for upload completion indicators
      const attachmentsContainer = document.querySelector('[data-testid="attachments"]')
      
      if (attachmentsContainer) {
        // Check for images
        const images = attachmentsContainer.querySelectorAll('img')
        const loadedImages = Array.from(images).filter(img => {
          return (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalHeight !== 0
        })
        
        // Check for videos  
        const videos = attachmentsContainer.querySelectorAll('video')
        const loadedVideos = Array.from(videos).filter(video => {
          const vid = video as HTMLVideoElement
          return vid.readyState >= 2 && vid.duration > 0 // HAVE_CURRENT_DATA or higher
        })
        
        // Check for any processing indicators that should be gone
        const processingIndicators = attachmentsContainer.querySelectorAll([
          '.processing',
          '[data-testid="media-progress"]',
          '.upload-progress',
          '.spinner',
          '[role="progressbar"]',
          '[aria-valuenow]',
          '.uploading'
        ].join(', '))
        
        console.log('🔍 Media processing check:', {
          hasAttachments: !!attachmentsContainer,
          imagesTotal: images.length,
          imagesLoaded: loadedImages.length,
          videosTotal: videos.length,
          videosLoaded: loadedVideos.length,
          processingIndicators: processingIndicators.length,
          elapsedTime: Date.now() - startTime
        })
        
        // Consider media ready if we have loaded media and no processing indicators
        if ((loadedImages.length > 0 || loadedVideos.length > 0) && processingIndicators.length === 0) {
          console.log('✅ Media appears to be fully processed')
          
          // Additional verification: Check if the compose tweet area recognizes the media
          // Sometimes media shows up in attachments but isn't properly linked to the tweet
          await new Promise(resolve => setTimeout(resolve, 2000)) // Extra wait time
          
          // Verify the post button is not disabled due to media issues
          const postButton = document.querySelector('[data-testid="tweetButton"]') as HTMLButtonElement
          if (postButton && !postButton.disabled && postButton.getAttribute('aria-disabled') !== 'true') {
            console.log('✅ Post button is enabled, media appears to be properly attached')
            break
          } else {
            console.log('⏳ Post button still disabled, waiting longer for media to be fully attached...')
            console.log(`   - button disabled: ${postButton?.disabled}`)
            console.log(`   - aria-disabled: ${postButton?.getAttribute('aria-disabled')}`)
          }
        }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000)) // Check every second
    }
    
    // Additional buffer time for UI to fully update
    console.log('⏳ Adding extra buffer time for media attachment to complete...')
    await new Promise(resolve => setTimeout(resolve, 3000)) // 3 second buffer
    
    // Final verification
    const attachmentsContainer = document.querySelector('[data-testid="attachments"]')
    if (attachmentsContainer) {
      const images = attachmentsContainer.querySelectorAll('img')
      const videos = attachmentsContainer.querySelectorAll('video')
      const hasMedia = images.length > 0 || videos.length > 0
      
      console.log('🔍 Final media processing verification:', {
        hasAttachments: true,
        mediaCount: images.length + videos.length,
        imagesCount: images.length,
        videosCount: videos.length,
        processingIndicators: attachmentsContainer.querySelectorAll('[role="progressbar"], .uploading, .processing').length
      })
      
      if (hasMedia) {
        console.log('✅ Media processing wait completed - media found in attachments')
      } else {
        console.log('⚠️ No media found in attachments after processing wait')
      }
    } else {
      console.log('⚠️ No attachments container found after processing wait')
    }
    
    console.log('✅ Media processing wait completed')
  }

  /**
   * Click the Post button to submit the tweet
   */
  static async clickPostButton(timeout = 5000): Promise<void> {
    try {
      console.log('🎯 Looking for Post button...')
      const postButton = await this.waitForElement(this.SELECTORS.POST_BUTTON, timeout)
      
      if (postButton) {
        console.log('📍 Found Post button, checking state...')
        
        // Ensure button is enabled before clicking
        const buttonElement = postButton as HTMLButtonElement
        if (buttonElement.disabled) {
          console.log('⚠️ Post button is disabled, waiting for it to be enabled...')
          console.log('🔍 Button classes:', buttonElement.className)
          console.log('🔍 Button aria-disabled:', buttonElement.getAttribute('aria-disabled'))
          
          // Wait for button to become enabled - increased timeout
          const maxWaitTime = 15000 // Increased from 5 seconds to 15 seconds
          const checkInterval = 500 // Check less frequently to reduce spam
          const startTime = Date.now()
          
          while (Date.now() - startTime < maxWaitTime) {
            // Check multiple conditions that might indicate the button is ready
            const isDisabled = buttonElement.disabled
            const ariaDisabled = buttonElement.getAttribute('aria-disabled') === 'true'
            const hasDisabledClass = buttonElement.classList.contains('disabled')
            
            if (!isDisabled && !ariaDisabled && !hasDisabledClass) {
              console.log('✅ Post button is now enabled')
              break
            }
            
            // Log progress every 2 seconds
            if ((Date.now() - startTime) % 2000 < 500) {
              console.log(`⏳ Still waiting for button to enable... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`)
              console.log(`   - disabled: ${isDisabled}, aria-disabled: ${ariaDisabled}, has disabled class: ${hasDisabledClass}`)
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval))
          }
          
          // Final check before throwing error
          const finalCheck = !buttonElement.disabled && 
                            buttonElement.getAttribute('aria-disabled') !== 'true' && 
                            !buttonElement.classList.contains('disabled')
          
          if (!finalCheck) {
            console.log('❌ Post button status after waiting:')
            console.log('   - disabled:', buttonElement.disabled)
            console.log('   - aria-disabled:', buttonElement.getAttribute('aria-disabled'))
            console.log('   - has disabled class:', buttonElement.classList.contains('disabled'))
            console.log('   - classes:', buttonElement.className)
        
            // Try to find reasons why button might be disabled
            const textArea = document.querySelector(this.SELECTORS.DRAFTJS_EDITOR)
            const textContent = textArea?.textContent || ''
            const hasMedia = document.querySelector('[data-testid="attachments"] img, [data-testid="attachments"] video')
            const hasProcessingMedia = document.querySelector('[data-testid="attachments"] [data-testid*="progress"], [data-testid="attachments"] .uploading')
            
            console.log('🔍 Diagnostic info:')
            console.log('   - Text content length:', textContent.length)
            console.log('   - Has media:', !!hasMedia)
            console.log('   - Has processing media:', !!hasProcessingMedia)
            console.log('   - Text content preview:', textContent.substring(0, 100))
            
            throw new Error(`Post button remained disabled after waiting ${maxWaitTime/1000}s`)
          }
        }
        
        console.log('✅ Post button is enabled, clicking...')
        
        // Try multiple click methods to ensure success
        const clickMethods = [
          () => buttonElement.click(),
          () => {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        buttonElement.dispatchEvent(clickEvent)
          },
          () => {
            // Try focus and enter key as alternative
            buttonElement.focus()
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true
            })
            buttonElement.dispatchEvent(enterEvent)
          }
        ]
        
        // Try each click method
        for (let i = 0; i < clickMethods.length; i++) {
          try {
            console.log(`🖱️ Trying click method ${i + 1}...`)
            clickMethods[i]()
            await new Promise(resolve => setTimeout(resolve, 300))
            
            // Check if click was successful by looking for post confirmation
            const postSent = this.checkPostSubmissionSuccess()
            if (postSent) {
              console.log(`✅ Post button clicked successfully with method ${i + 1}`)
              return
            }
          } catch (error) {
            console.log(`❌ Click method ${i + 1} failed:`, error)
          }
        }
        
        console.log('✅ Post button click attempted with all methods')
        
        // Wait a moment to ensure the click was processed
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } else {
        throw new Error('Post button not found')
      }
    } catch (error) {
      console.error('❌ Error clicking Post button:', error)
      throw error
    }
  }

  /**
   * Check if post submission was successful
   */
  private static checkPostSubmissionSuccess(): boolean {
    // Look for indicators that the post was submitted
    const indicators = [
      // Loading state
      '[data-testid="tweetButton"][aria-label*="Loading"]',
      // Success indicators
      '.toast', '.notification',
      // Button text changes
      '[data-testid="tweetButton"]:not([aria-label*="Post"])',
      // URL changes to indicate navigation
      // Note: We can't check URL directly due to same-origin policy
    ]
    
    for (const selector of indicators) {
      if (document.querySelector(selector)) {
        console.log(`✅ Found post submission indicator: ${selector}`)
        return true
      }
    }
    
    return false
  }

  /**
   * Perform final validation check before attempting to post
   */
  private static async performFinalValidationCheck(): Promise<{ isValid: boolean; errors: string[] }> {
    console.log('🔍 Performing final validation check...')

    const errors: string[] = []
    const warnings: string[] = []

    // Check if text content is present and valid
    const textArea = document.querySelector(this.SELECTORS.DRAFTJS_EDITOR)
    const textContent = textArea?.textContent?.trim() || ''
    if (!textContent) {
      errors.push('No text content found in the compose area.')
    } else {
      if (textContent.length < 1) {
        errors.push('Text content is empty after typing.')
      }
      // Don't treat character limit as a blocking error - Twitter may allow posting anyway
      if (textContent.length > 280) {
        warnings.push('Text content exceeds 280 characters - Twitter may split into thread or reject')
        console.log(`⚠️ Warning: Text is ${textContent.length} characters (limit is 280), but allowing post attempt`)
      }
    }
    
    // Check if media is present and valid
    const hasMedia = document.querySelector('[data-testid="attachments"] img, [data-testid="attachments"] video')
    const hasProcessingMedia = document.querySelector('[data-testid="attachments"] [role="progressbar"], [data-testid="attachments"] .uploading')
    
    if (hasProcessingMedia) {
      errors.push('Media is still processing. Please wait for it to complete.')
    }

    // Check if post button exists and is ready
    const postButton = document.querySelector(this.SELECTORS.POST_BUTTON) as HTMLButtonElement
    
    if (!postButton) {
      errors.push('Post button not found.')
    } else {
      if (postButton.disabled) {
        errors.push('Post button is disabled. Please ensure text and media are ready.')
      }
      if (postButton.getAttribute('aria-disabled') === 'true') {
        errors.push('Post button is aria-disabled. Please ensure text and media are ready.')
      }
      if (postButton.classList.contains('disabled')) {
        errors.push('Post button has the "disabled" class. Please ensure text and media are ready.')
      }
    }
    
    console.log('📊 Final validation results:')
    console.log(`   - Text content: "${textContent}" (${textContent.length} chars)`)
    console.log(`   - Has media: ${!!hasMedia}`)
    console.log(`   - Has processing media: ${!!hasProcessingMedia}`)
    console.log(`   - Post button exists: ${!!postButton}`)
    console.log(`   - Post button disabled: ${postButton?.disabled}`)
    console.log(`   - Post button aria-disabled: ${postButton?.getAttribute('aria-disabled')}`)
    console.log(`   - Post button has disabled class: ${postButton?.classList.contains('disabled')}`)

    if (warnings.length > 0) {
      console.log('⚠️ Validation warnings (non-blocking):')
      warnings.forEach(w => console.log(`   - ${w}`))
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    }
  }

  /**
   * Main automation function to post content
   */
  static async postContent(data: PostData): Promise<void> {
    console.log('🚀 Starting Twitter compose automation...')
    console.log('📊 Data received:', data)

    try {
      // Wait for compose container to load
      console.log('⏳ Waiting for compose container...')
      const composeContainer = await this.waitForElement(this.SELECTORS.COMPOSE_CONTAINER, 10000)

      // IMPORTANT: Clear any existing content first to prevent duplication
      console.log('🧹 Clearing any existing content from compose window...')
      const draftJSEditor = document.querySelector(this.SELECTORS.DRAFTJS_EDITOR) as HTMLElement
      if (draftJSEditor && draftJSEditor.textContent && draftJSEditor.textContent.trim().length > 0) {
        console.log(`⚠️ Found existing content: "${draftJSEditor.textContent}" - clearing it now`)
        await this.clearDraftJSContent(draftJSEditor)
      } else {
        console.log('✅ Compose window is clean, no content to clear')
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
      
      // Step 1: Upload media file first (if provided)
      if (mediaFile) {
        console.log('📷 Step 1: Uploading media file first...')
        await this.uploadMediaFile(mediaFile)
        
        // Step 2: Wait for media processing if media was uploaded
        console.log('⏳ Step 2: Waiting for media processing...')
        await this.waitForMediaProcessing()
        
        // Step 3: Verify media is properly attached before proceeding
        console.log('🔍 Step 3: Verifying media attachment...')
        const attachmentsCheck = document.querySelector('[data-testid="attachments"] img, [data-testid="attachments"] video')
        const postButton = document.querySelector('[data-testid="tweetButton"]') as HTMLButtonElement
        
        if (!attachmentsCheck) {
          console.log('⚠️ Warning: No media found in attachments after upload and processing')
        } else {
          console.log('✅ Media found in attachments container')
        }
        
        if (postButton && postButton.disabled) {
          console.log('⚠️ Post button is still disabled after media processing, waiting additional time...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Check again
          const stillDisabled = postButton.disabled || postButton.getAttribute('aria-disabled') === 'true'
          if (stillDisabled) {
            console.log('⚠️ Warning: Post button remains disabled after media upload')
          } else {
            console.log('✅ Post button is now enabled after additional wait')
          }
        } else {
          console.log('✅ Post button appears to be enabled and ready for media tweet')
        }
      } else {
        console.log('ℹ️ No media file provided, skipping media upload...')
      }

      // Step 4: Add text content
      if (data.text && data.text.trim()) {
        console.log('📝 Step 4: Adding text content...')
        await this.setText(data.text)
      }

      // Step 5: Wait for text validation to complete
      console.log('⏳ Step 5: Waiting for text validation to complete...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 6: Final validation check before posting
      console.log('🔍 Step 6: Final validation check before posting...')
      const validationCheck = await this.performFinalValidationCheck()
      if (!validationCheck.isValid) {
        throw new Error(`Validation failed: ${validationCheck.errors.join(', ')}`)
      }

      // Step 7: Click Post button with increased timeout
      console.log('🎯 Step 7: Clicking Post button...')
      await this.clickPostButton(15000) // Increased timeout to 15 seconds
      
      console.log('✅ Automation completed successfully!')
      
    } catch (error) {
      console.error('❌ Error in Twitter compose automation:', error)
      throw error
    }
  }
}

/**
 * Message listener for content script
 */
// Prevent duplicate script execution
if ((window as any).__twitterAutomationLoaded) {
  console.log('⚠️ [Twitter] Script already loaded, skipping duplicate initialization')
} else {
  (window as any).__twitterAutomationLoaded = true

  console.log('🔗 TwitterComposeAutomation content script loaded on:', window.location.href)

  // Track if we're currently processing to prevent duplicate runs
  let isProcessing = false

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Content script received message:', message)
    console.log('📍 Current URL:', window.location.href)
    console.log('📄 Page title:', document.title)

    if (message.type === 'POST_CONTENT') {
      // Prevent duplicate processing
      if (isProcessing) {
        console.log('⚠️ [Twitter] Already processing a post, ignoring duplicate message')
        sendResponse({ success: false, error: 'Already processing' })
        return true
      }

      isProcessing = true
      console.log('🎯 Processing POST_CONTENT message with data:', {
        hasText: !!message.data?.text,
        textLength: message.data?.text?.length || 0,
        hasMediaFile: !!message.data?.mediaFile,
        mediaType: message.data?.mediaFile?.type || 'none',
        mediaSize: message.data?.mediaFile?.size || 0
      })

      TwitterComposeAutomation.postContent(message.data)
        .then(() => {
          console.log('✅ Automation completed successfully')
          isProcessing = false
          sendResponse({ success: true })
        })
        .catch((error) => {
          console.error('❌ Error in automation:', error)
          isProcessing = false
          sendResponse({ success: false, error: error.message })
        })

      // Return true to indicate we'll send a response asynchronously
      return true
    } else {
      console.log('ℹ️ Ignoring message with type:', message.type)
    }

    return false
  })
}

export default TwitterComposeAutomation 