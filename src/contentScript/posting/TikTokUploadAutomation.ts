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

interface TikTokPostData {
  text: string
  mediaFile?: SerializedFile
  caption?: string
  hashtags?: string[]
  privacy?: 'public' | 'friends' | 'private'
}

/**
 * TikTok Upload Page Automation
 * This script handles the automation of uploading content to TikTok
 */
export class TikTokUploadAutomation {
  private static lastUploadedBaseName: string | null = null
  private static lastSetCaption: string | null = null
  private static interceptorsInstalled = false
  private static readonly SAFE_UPLOAD_BASENAME = 'mh_tmp_upload'
  private static readonly SELECTORS = {
    // Upload area selectors
    UPLOAD_CONTAINER: '[data-e2e="select_video_container"]',
    UPLOAD_BUTTON: '[data-e2e="select_video_button"]',
    DRAG_DROP_AREA: '.upload-card.before-upload-new-stage',
    FILE_INPUT: 'input[type="file"]',
    
    // After upload selectors
    CAPTION_INPUT: 'div[data-text="true"], .public-DraftEditor-content[contenteditable="true"]',
    CAPTION_TEXTAREA: 'textarea[placeholder*="caption"], textarea[placeholder*="description"]',
    
    // Settings selectors
    PRIVACY_BUTTON: '[data-e2e="privacy-button"]',
    PRIVACY_PUBLIC: '[data-e2e="privacy-public"]',
    PRIVACY_FRIENDS: '[data-e2e="privacy-friends"]',
    PRIVACY_PRIVATE: '[data-e2e="privacy-private"]',
    
    // Publish button - comprehensive selector with multiple fallbacks
    PUBLISH_BUTTON: '[data-e2e="publish-button"], button[data-e2e="publish-button"], button[data-e2e="post-button"], button[data-e2e="post_video_button"], button[data-testid*="publish"], button[data-testid*="post"], button[aria-label*="Post"], button[aria-label*="Publish"], .publish-btn, .post-btn, button[type="submit"]',
    POST_BUTTON: 'button[data-testid*="post"], button[aria-label*="Post"]',
    POST_VIDEO_BUTTON: 'button[data-e2e="post_video_button"]',
    
    // Loading and progress indicators
    UPLOAD_PROGRESS: '.upload-progress, [data-e2e="upload-progress"]',
    PROCESSING_INDICATOR: '[data-e2e="processing-indicator"]',
  }

  private static readonly RETRY_ATTEMPTS = 10
  private static readonly RETRY_DELAY = 1000
  private static readonly UPLOAD_TIMEOUT = 60000 // 1 minute for video processing

  /**
   * Upload a video file to TikTok
   */
  static async uploadVideoFile(file: File): Promise<void> {
    try {
      console.log('🎬 Starting TikTok video upload for:', file.name, file.type)
      
      // Create a clean filename to prevent TikTok from using the original problematic filename
      const cleanFileName = `${TikTokUploadAutomation.SAFE_UPLOAD_BASENAME}_${Date.now()}.${file.type.split('/')[1] || 'mp4'}`
      console.log('🧹 Renaming file from "' + file.name + '" to "' + cleanFileName + '"')
      
      // Create a new File object with clean filename
      const cleanFile = new File([file], cleanFileName, { 
        type: file.type,
        lastModified: file.lastModified 
      })
      // Keep base name for later caption-cleaning detection
      TikTokUploadAutomation.lastUploadedBaseName = cleanFileName.replace(/\.[^/.]+$/, '')
      
      // Verify we're on the upload page
      if (!window.location.href.includes('tiktokstudio/upload')) {
        throw new Error('Not on TikTok upload page')
      }
      
      // Wait for the upload container to be ready
      console.log('⏳ Waiting for upload container...')
      const uploadContainer = await this.waitForElement(this.SELECTORS.UPLOAD_CONTAINER, 10000)
      
      // Try multiple upload methods
      const uploadMethods = [
        () => this.uploadViaFileInput(cleanFile),
        () => this.uploadViaDragDrop(cleanFile),
        () => this.uploadViaButton(cleanFile)
      ]
      
      let uploadSuccess = false
      for (const method of uploadMethods) {
        try {
          await method()
          uploadSuccess = true
          break
        } catch (error) {
          console.log('❌ Upload method failed:', error)
        }
      }
      
      if (!uploadSuccess) {
        throw new Error('All upload methods failed')
      }
      
      // Wait for upload to complete
      console.log('⏳ Waiting for upload to complete...')
      await this.waitForUploadCompletion()
      
      console.log('✅ Video upload completed successfully')
      
    } catch (error) {
      console.error('❌ Error in TikTok video upload:', error)
      throw error
    }
  }

  /**
   * Upload via file input (primary method)
   */
  private static async uploadViaFileInput(file: File): Promise<void> {
    console.log('📁 Trying file input upload...')
    
    // Look for file input
    const fileInput = document.querySelector(this.SELECTORS.FILE_INPUT) as HTMLInputElement
    if (!fileInput) {
      throw new Error('File input not found')
    }
    
    // Set the file
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    fileInput.files = dataTransfer.files
    
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true })
    fileInput.dispatchEvent(changeEvent)
    
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * Upload via drag and drop
   */
  private static async uploadViaDragDrop(file: File): Promise<void> {
    console.log('🎯 Trying drag and drop upload...')
    
    const dropArea = document.querySelector(this.SELECTORS.DRAG_DROP_AREA)
    if (!dropArea) {
      throw new Error('Drop area not found')
    }
    
    // Create drag events
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    
    // Simulate drag and drop sequence
    const dragEnterEvent = new DragEvent('dragenter', {
      dataTransfer,
      bubbles: true
    })
    
    const dragOverEvent = new DragEvent('dragover', {
      dataTransfer,
      bubbles: true
    })
    
    const dropEvent = new DragEvent('drop', {
      dataTransfer,
      bubbles: true
    })
    
    dropArea.dispatchEvent(dragEnterEvent)
    await new Promise(resolve => setTimeout(resolve, 100))
    
    dropArea.dispatchEvent(dragOverEvent)
    await new Promise(resolve => setTimeout(resolve, 100))
    
    dropArea.dispatchEvent(dropEvent)
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * Upload via button click
   */
  private static async uploadViaButton(file: File): Promise<void> {
    console.log('🎯 Trying button upload...')
    
    const uploadButton = document.querySelector(this.SELECTORS.UPLOAD_BUTTON)
    if (!uploadButton) {
      throw new Error('Upload button not found')
    }
    
    // Click the upload button
    (uploadButton as HTMLElement).click()
    
    // Wait for file input to appear
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Find the file input that appeared
    const fileInput = document.querySelector(this.SELECTORS.FILE_INPUT) as HTMLInputElement
    if (!fileInput) {
      throw new Error('File input not found after button click')
    }
    
    // Set the file
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    fileInput.files = dataTransfer.files
    
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true })
    fileInput.dispatchEvent(changeEvent)
    
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * Wait for upload to complete
   */
  private static async waitForUploadCompletion(): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < this.UPLOAD_TIMEOUT) {
      // Check if upload is still in progress
      const uploadProgress = document.querySelector(this.SELECTORS.UPLOAD_PROGRESS)
      const processingIndicator = document.querySelector(this.SELECTORS.PROCESSING_INDICATOR)
      
      if (!uploadProgress && !processingIndicator) {
        // Check if we can find the caption input (indicates upload is complete)
        const captionInput = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                            document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
        
        if (captionInput) {
          console.log('✅ Upload completed - caption input is available')
          return
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    throw new Error('Upload timeout - video processing took too long')
  }

  /**
   * Set caption/description text
   */
  static async setCaption(text: string): Promise<void> {
    try {
      console.log('📝 Setting caption:', text)
      
      // Look for caption input elements
      let captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                          document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
      
      if (!captionElement) {
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 2000))
        captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                        document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
      }
      
      if (!captionElement) {
        throw new Error('Caption input not found')
      }
      
      // Log current content before clearing
      const currentContent = captionElement.tagName.toLowerCase() === 'textarea'
        ? (captionElement as HTMLTextAreaElement).value
        : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
      
      console.log('📝 Current caption content before clearing:', currentContent)
      
      // Enhanced clearing process - try multiple methods
      if (captionElement.tagName.toLowerCase() === 'textarea') {
        const textarea = captionElement as HTMLTextAreaElement
        
        // Method 1: Select all and delete
        textarea.focus()
        textarea.select()
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Method 2: Set value to empty
        textarea.value = ''
        
        // Method 3: Dispatch input events to ensure TikTok recognizes the change
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.dispatchEvent(new Event('change', { bubbles: true }))
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Method 4: Verify clearing worked
        const afterClearValue = textarea.value
        console.log('📝 Caption content after clearing:', afterClearValue)
        
        if (afterClearValue.trim() !== '') {
          console.log('⚠️ Clearing failed, trying alternative method...')
          // Use keyboard events to clear
          textarea.focus()
          textarea.select()
          document.execCommand('delete')
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
      } else {
        const element = captionElement as HTMLElement
        
        // Method 1: Focus and select all
        element.focus()
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Method 2: Clear content
        element.textContent = ''
        element.innerText = ''
        
        // Method 3: Use selection API if available
        if (window.getSelection) {
          const selection = window.getSelection()
          const range = document.createRange()
          range.selectNodeContents(element)
          selection?.removeAllRanges()
          selection?.addRange(range)
          document.execCommand('delete')
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Method 4: Verify clearing worked
        const afterClearContent = element.textContent || element.innerText || ''
        console.log('📝 Caption content after clearing:', afterClearContent)
      }
      
      // Additional delay to let TikTok process the clearing
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Set the text using multiple methods
      await this.setText(captionElement as HTMLElement, text)
      
      // Final verification
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check for and remove filename that TikTok might append
      let finalContent = captionElement.tagName.toLowerCase() === 'textarea'
        ? (captionElement as HTMLTextAreaElement).value
        : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
      
      console.log('📝 Final caption content after setting:', finalContent)
      console.log('📝 Expected caption content:', text)
      
      // Detect if filename was appended/prepended
      const patterns: RegExp[] = [
        /em3dia-\d+(-\d+)?(-\d+)?$/i,
        /^em3dia-\d+(-\d+)?(-\d+)?/i,
        /\b[a-zA-Z]+[_-]\d{6,}\b/i,
        /\b[a-zA-Z0-9\-_]+\d{6,}\b/i
      ]
      if (TikTokUploadAutomation.lastUploadedBaseName) {
        patterns.push(new RegExp(`\\b${TikTokUploadAutomation.escapeRegExp(TikTokUploadAutomation.lastUploadedBaseName)}\\b`, 'i'))
      }

      if (finalContent !== text && finalContent.includes(text)) {
        const unwanted = finalContent.replace(text, '').trim()
        if (patterns.some((re) => re.test(unwanted))) {
          console.log('⚠️ Detected filename suffix appended:', unwanted.trim())
          console.log('🧹 Cleaning caption to remove filename...')
          
          // Re-clear and set the caption
          if (captionElement.tagName.toLowerCase() === 'textarea') {
            (captionElement as HTMLTextAreaElement).value = text
            captionElement.dispatchEvent(new Event('input', { bubbles: true }))
          } else {
            ;(captionElement as HTMLElement).textContent = text
            ;(captionElement as HTMLElement).innerText = text
          }
          
          // Force focus and trigger events to ensure TikTok recognizes the change
          ;(captionElement as HTMLElement).focus()
          await new Promise(resolve => setTimeout(resolve, 200))
          
          finalContent = captionElement.tagName.toLowerCase() === 'textarea'
            ? (captionElement as HTMLTextAreaElement).value
            : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
          console.log('🧹 Caption after cleanup:', finalContent)
        }
      }
      
      console.log('📝 Caption setting successful:', finalContent.includes(text))
      console.log('✅ Caption set successfully')
      TikTokUploadAutomation.lastSetCaption = text
      TikTokUploadAutomation.updatePageDesiredCaption(text)

      // Also try syncing any hidden/underlying inputs TikTok might submit
      try {
        const candidates = Array.from(document.querySelectorAll('input[name], textarea[name]')) as (HTMLInputElement|HTMLTextAreaElement)[]
        for (const el of candidates) {
          const name = (el.getAttribute('name') || '').toLowerCase()
          if (['desc','description','caption','text'].includes(name)) {
            if (el.tagName.toLowerCase() === 'textarea') {
              (el as HTMLTextAreaElement).value = text
            } else {
              (el as HTMLInputElement).value = text
            }
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
      } catch {}
      
    } catch (error) {
      console.error('❌ Error setting caption:', error)
      throw error
    }
  }

  /**
   * Set privacy setting
   */
  static async setPrivacy(privacy: 'public' | 'friends' | 'private'): Promise<void> {
    try {
      console.log('🔒 Setting privacy to:', privacy)
      
      // Click privacy button to open menu
      const privacyButton = document.querySelector(this.SELECTORS.PRIVACY_BUTTON)
      if (privacyButton) {
        (privacyButton as HTMLElement).click()
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Select privacy option
      let privacySelector: string
      switch (privacy) {
        case 'public':
          privacySelector = this.SELECTORS.PRIVACY_PUBLIC
          break
        case 'friends':
          privacySelector = this.SELECTORS.PRIVACY_FRIENDS
          break
        case 'private':
          privacySelector = this.SELECTORS.PRIVACY_PRIVATE
          break
        default:
          privacySelector = this.SELECTORS.PRIVACY_PUBLIC
      }
      
      const privacyOption = document.querySelector(privacySelector)
      if (privacyOption) {
        (privacyOption as HTMLElement).click()
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log('✅ Privacy set successfully')
      
    } catch (error) {
      console.error('❌ Error setting privacy:', error)
      // Don't throw, privacy setting is optional
    }
  }

  /**
   * Publish the video
   */
  static async publishVideo(): Promise<void> {
    console.log('🚀 Publishing TikTok video...')
    
    // Pre-publish caption verification and cleaning
    console.log('🔍 Pre-publish caption verification...')
    await this.prePublishCaptionCheck()
    
    // Find publish button with enhanced error handling
    let publishButton: Element | null = null
    try {
      publishButton = await this.waitForElement(this.SELECTORS.PUBLISH_BUTTON, 30000)
    } catch (error) {
      console.error('❌ Primary publish button selector failed:', error)
      
      // Try alternative approaches
      console.log('🔄 Attempting alternative button detection methods...')
      
      // Method 1: Try to find any button with "Post" or "Publish" text
      const buttons = Array.from(document.querySelectorAll('button'))
      publishButton = buttons.find(btn => {
        const text = (btn.textContent || '').toLowerCase().trim()
        return text.includes('post') || text.includes('publish') || text.includes('share')
      }) || null
      
      if (!publishButton) {
        // Method 2: Look for buttons in common TikTok container areas
        const containers = [
          '.btn-post', 
          '.publish-container',
          '[class*="publish"]',
          '[class*="post"]',
          '.bottom-bar',
          '.action-bar',
          '.submit-area'
        ]
        
        for (const containerSelector of containers) {
          const container = document.querySelector(containerSelector)
          if (container) {
            publishButton = container.querySelector('button') || null
            if (publishButton) {
              console.log(`✅ Found button in container: ${containerSelector}`)
              break
            }
          }
        }
      }
      
      if (!publishButton) {
        // Debug: Log all available buttons for troubleshooting
        console.log('🔍 Debug: All buttons found on page:')
        buttons.forEach((btn, index) => {
          console.log(`Button ${index}:`, {
            text: btn.textContent?.trim(),
            className: btn.className,
            id: btn.id,
            dataset: Object.keys(btn.dataset).length > 0 ? btn.dataset : 'none',
            attributes: Array.from(btn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
          })
        })
        
        throw new Error('Could not locate publish button using any method. TikTok interface may have changed.')
      }
    }
    
    console.log('🎯 Found publish button using selector:', this.SELECTORS.PUBLISH_BUTTON)
    console.log('🎯 Button details:', {
      text: publishButton.textContent,
      disabled: publishButton.hasAttribute('disabled') || publishButton.getAttribute('aria-disabled') === 'true',
      classes: publishButton.className
    })
    
    // Wait for button to be enabled if it's disabled
    if (publishButton.hasAttribute('disabled') || publishButton.getAttribute('aria-disabled') === 'true') {
      console.log('⏳ Publish button is disabled, waiting for video processing...', {
        disabled: publishButton.hasAttribute('disabled'),
        ariaDisabled: publishButton.getAttribute('aria-disabled')
      })

      const buttonEl = publishButton as HTMLElement

      // Try to observe the button enabling in real time
      let enabled = false
      const enablePromise = new Promise<void>((resolve) => {
        const obs = new MutationObserver(() => {
          const isDisabled = buttonEl.hasAttribute('disabled') || buttonEl.getAttribute('aria-disabled') === 'true'
          if (!isDisabled) {
            enabled = true
            obs.disconnect()
            resolve()
          }
        })
        obs.observe(buttonEl, { attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'class'] })
      })

      // Poll as a fallback and re-query button in case of re-render
      const pollPromise = (async () => {
        const maxMs = 180000 // 180s
        const start = Date.now()
        let attempts = 0
        while (Date.now() - start < maxMs) {
          // Re-query in case the button was re-rendered
          const btn = document.querySelector(this.SELECTORS.PUBLISH_BUTTON)
          if (btn) publishButton = btn
          const isDisabled = publishButton.hasAttribute('disabled') || publishButton.getAttribute('aria-disabled') === 'true'
          if (!isDisabled) {
            enabled = true
            console.log(`✅ Publish button became enabled after ~${Math.round((Date.now() - start)/1000)}s`)
            return
          }
          // Nudge UI: scroll a bit to trigger lazy updates
          window.scrollBy(0, attempts % 2 === 0 ? 100 : -100)
          attempts++
          await new Promise(r => setTimeout(r, 1000))
        }
      })()

      await Promise.race([enablePromise, pollPromise])
      if (!enabled) {
        throw new Error('Publish button remained disabled after waiting')
      }
    }
    
    // Final caption check right before clicking publish
    console.log('🔍 Final pre-publish caption check...')
    await this.prePublishCaptionCheck()
    
    // As a last safeguard, add unload/visibility listeners to force a clean caption right before unload
    const enforceClean = () => {
      try {
        const captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                               document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
        const desired = TikTokUploadAutomation.lastSetCaption || ''
        if (captionElement && desired) {
          if (captionElement.tagName.toLowerCase() === 'textarea') {
            ;(captionElement as HTMLTextAreaElement).value = desired
            captionElement.dispatchEvent(new Event('input', { bubbles: true }))
            captionElement.dispatchEvent(new Event('change', { bubbles: true }))
          } else {
            ;(captionElement as HTMLElement).textContent = desired
            ;(captionElement as HTMLElement).innerText = desired
            captionElement.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }
      } catch {}
    }
    window.addEventListener('beforeunload', enforceClean, { once: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') enforceClean()
    }, { once: true })

    // Click publish button
    console.log('🖱️ Clicking publish button...')
    ;(publishButton as HTMLElement).click()
    
    // Start aggressive caption monitoring - TikTok appends filename at various stages
    console.log('🔍 Starting continuous caption monitoring...')
    this.startContinuousCaptionMonitoring()
    
    // Wait a moment to ensure the click registered
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('✅ Publish button clicked successfully')
  }

  /**
   * Start continuous caption monitoring to catch filename injection at any stage
   */
  static startContinuousCaptionMonitoring(): void {
    let monitoringActive = true
    let cleanupCount = 0
    const maxCleanups = 300 // ~60 seconds with 200ms cadence
    
    // Store the original clean caption for reference
    const captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                          document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
    if (!captionElement) return
    
    let originalContent = captionElement.tagName.toLowerCase() === 'textarea'
      ? (captionElement as HTMLTextAreaElement).value
      : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
    
    console.log('🛡️ Monitoring caption for filename injection. Original:', originalContent)

    // React to DOM changes immediately
    const observer = new MutationObserver(() => {
      const el = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                 document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
      if (!el) return
      const current = el.tagName.toLowerCase() === 'textarea'
        ? (el as HTMLTextAreaElement).value
        : (el as HTMLElement).textContent || (el as HTMLElement).innerText || ''
      const sanitized = TikTokUploadAutomation.sanitizeCaption(current)
      if (sanitized !== current) {
        if (el.tagName.toLowerCase() === 'textarea') {
          ;(el as HTMLTextAreaElement).value = sanitized
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        } else {
          ;(el as HTMLElement).textContent = sanitized
          ;(el as HTMLElement).innerText = sanitized
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        console.log('🛡️ MutationObserver cleaned caption to:', sanitized)
      }
    })
    observer.observe(captionElement, { childList: true, subtree: true, characterData: true })
    
    const monitor = () => {
      if (!monitoringActive || cleanupCount >= maxCleanups) return
      
      const captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                            document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
      if (!captionElement) {
        setTimeout(monitor, 200)
        cleanupCount++
        return
      }
      
      const currentContent = captionElement.tagName.toLowerCase() === 'textarea'
        ? (captionElement as HTMLTextAreaElement).value
        : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
      
      // Check if filename was injected
      const filenamePatterns: RegExp[] = TikTokUploadAutomation.getFilenamePatterns()
      
      let hasFilename = false
      let cleanedContent = currentContent
      
      for (const pattern of filenamePatterns) {
        if (pattern.test(currentContent)) {
          hasFilename = true
          const matches = currentContent.match(pattern)
          if (matches) {
            console.log(`🚨 FILENAME INJECTION DETECTED: "${matches[0]}"`)
            cleanedContent = cleanedContent.replace(pattern, '').replace(/\s+/g, ' ').trim()
          }
        }
      }
      
      // If we detected filename injection, clean it immediately
      if (hasFilename && cleanedContent !== currentContent) {
        console.log(`🧹 CLEANING: "${currentContent}" → "${cleanedContent}"`)
        
        // Multiple cleanup methods to ensure it sticks
        if (captionElement.tagName.toLowerCase() === 'textarea') {
          ;(captionElement as HTMLTextAreaElement).value = cleanedContent
          captionElement.dispatchEvent(new Event('input', { bubbles: true }))
          captionElement.dispatchEvent(new Event('change', { bubbles: true }))
          captionElement.dispatchEvent(new Event('blur', { bubbles: true }))
        } else {
          ;(captionElement as HTMLElement).textContent = cleanedContent
          ;(captionElement as HTMLElement).innerText = cleanedContent
          ;(captionElement as HTMLElement).innerHTML = cleanedContent
          captionElement.dispatchEvent(new Event('input', { bubbles: true }))
          captionElement.dispatchEvent(new Event('DOMNodeInserted', { bubbles: true }))
        }
        
        // Force focus and selection to ensure TikTok registers the change
        ;(captionElement as HTMLElement).focus()
        if ('select' in captionElement) (captionElement as any).select()
        
        console.log('✅ Caption cleaned successfully')
      }
      
      // Check if we're still on the upload page
      if (window.location.href.includes('upload') || window.location.href.includes('creator')) {
        setTimeout(monitor, 200)
        cleanupCount++
      } else {
        console.log('🏁 Page changed, stopping caption monitoring')
        monitoringActive = false
        observer.disconnect()
      }
    }
    
    // Start monitoring
    monitor()
    
    // Safety timeout to stop monitoring after 120 seconds
    setTimeout(() => {
      if (monitoringActive) {
        console.log('⏰ Caption monitoring timeout reached, stopping')
        monitoringActive = false
        observer.disconnect()
      }
    }, 120000)
  }

  /**
   * Clear TikTok's auto-filled filename from the caption field
   */
  static async clearAutoFilledCaption(): Promise<void> {
    console.log('🧹 Clearing TikTok auto-filled filename from caption...')
    
    const captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                          document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
    if (!captionElement) {
      console.log('⚠️ Caption element not found for clearing')
      return
    }
    
    const currentContent = captionElement.tagName.toLowerCase() === 'textarea'
      ? (captionElement as HTMLTextAreaElement).value
      : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
    
    console.log('🧹 Current auto-filled content:', currentContent)
    
    // Multiple aggressive clearing methods
    console.log('🧹 Method 1: Complete field clearing...')
    if (captionElement.tagName.toLowerCase() === 'textarea') {
      ;(captionElement as HTMLTextAreaElement).value = ''
      captionElement.dispatchEvent(new Event('input', { bubbles: true }))
      captionElement.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      ;(captionElement as HTMLElement).textContent = ''
      ;(captionElement as HTMLElement).innerText = ''
      ;(captionElement as HTMLElement).innerHTML = ''
      captionElement.dispatchEvent(new Event('input', { bubbles: true }))
    }
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Method 2: Select all and delete
    console.log('🧹 Method 2: Select all and delete...')
    ;(captionElement as HTMLElement).focus()
    if ('select' in captionElement) (captionElement as any).select()
    document.execCommand('selectAll')
    document.execCommand('delete')
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Method 3: Key simulation
    console.log('🧹 Method 3: Keyboard clearing...')
    ;(captionElement as HTMLElement).focus()
    
    // Simulate Ctrl+A then Delete
    const ctrlAEvent = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true
    })
    captionElement.dispatchEvent(ctrlAEvent)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const deleteEvent = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true
    })
    captionElement.dispatchEvent(deleteEvent)
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Verify clearing worked
    const afterClearContent = captionElement.tagName.toLowerCase() === 'textarea'
      ? (captionElement as HTMLTextAreaElement).value
      : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
    
    console.log('🧹 Content after clearing:', afterClearContent)
    
    if (afterClearContent.trim() === '') {
      console.log('✅ Auto-filled caption successfully cleared')
    } else {
      console.log('⚠️ Some content remains after clearing:', afterClearContent)
      
      // Final desperate attempt - direct DOM manipulation
      if (captionElement.tagName.toLowerCase() === 'textarea') {
        ;(captionElement as HTMLTextAreaElement).value = ''
      } else {
        ;(captionElement as HTMLElement).textContent = ''
        ;(captionElement as HTMLElement).innerText = ''
        ;(captionElement as HTMLElement).innerHTML = ''
      }
      
      // Trigger all possible events
      ;['input', 'change', 'keyup', 'blur', 'focus'].forEach(eventType => {
        captionElement.dispatchEvent(new Event(eventType, { bubbles: true }))
      })
      
      console.log('🧹 Applied final clearing methods')
    }
  }

  /**
   * Pre-publish caption verification and cleaning
   */
  private static async prePublishCaptionCheck(): Promise<void> {
    try {
      console.log('🔍 Checking caption before publish...')
      
      // Find caption element
      let captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                          document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
      
      if (!captionElement) {
        console.log('⚠️ Caption element not found during pre-publish check')
        return
      }
      
      // Get current caption content
      const currentContent = captionElement.tagName.toLowerCase() === 'textarea'
        ? (captionElement as HTMLTextAreaElement).value
        : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
      
      console.log('📝 Current caption content:', currentContent)
      
      // Check if filename pattern is present (cover hyphen and underscore variants)
      const filenamePatterns: RegExp[] = [
        /em3dia-\d+(-\d+)?(-\d+)?/gi,  // em3dia-numbers-numbers or variations
        /\b\w+-\d{10,}-\d+\b/gi,       // word-longnumber-number
        /\b[a-zA-Z0-9]+-\d{13,}-\d+\b/gi, // long timestamp numbers
        /\b[a-zA-Z]+[_-]\d{6,}\b/gi,    // word_123456 or word-123456
        /\b[a-zA-Z0-9\-_]+\d{6,}\b/gi  // general slug with 6+ trailing digits
      ]
      if (TikTokUploadAutomation.lastUploadedBaseName) {
        filenamePatterns.push(new RegExp(`\\b${TikTokUploadAutomation.escapeRegExp(TikTokUploadAutomation.lastUploadedBaseName)}\\b`, 'gi'))
      }
      
      let hasFilename = false
      let cleanedContent = currentContent
      
      // Check and remove each filename pattern
      for (const pattern of filenamePatterns) {
        if (pattern.test(currentContent)) {
          hasFilename = true
          cleanedContent = cleanedContent.replace(pattern, '').trim()
          console.log(`🧹 Removed pattern ${pattern.source} from caption`)
        }
      }
      
      // Additional cleanup - remove extra spaces and normalize
      cleanedContent = TikTokUploadAutomation.sanitizeCaption(cleanedContent)
      
      if (hasFilename) {
        console.log('⚠️ Filename detected in caption, cleaning...')
        console.log('🧹 Cleaned caption content:', cleanedContent)
        
        // More aggressive cleaning with multiple attempts
        await this.forceSetCaptionContent(captionElement as HTMLElement, cleanedContent)
        
        console.log('✅ Caption cleaned before publish')

        // Also attempt to update any underlying textarea to ensure value source is clean
        const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[]
        for (const ta of textareas) {
          const ph = (ta.getAttribute('placeholder') || '').toLowerCase()
          if (ph.includes('caption') || ph.includes('description')) {
            ta.value = cleanedContent
            ta.dispatchEvent(new Event('input', { bubbles: true }))
            ta.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
        // Also sync name-based inputs that may be posted
        const inputs = Array.from(document.querySelectorAll('input[name], textarea[name]')) as (HTMLInputElement|HTMLTextAreaElement)[]
        for (const el of inputs) {
          const n = (el.getAttribute('name') || '').toLowerCase()
          if (['desc','description','caption','text'].includes(n)) {
            if (el.tagName.toLowerCase() === 'textarea') (el as HTMLTextAreaElement).value = cleanedContent
            else (el as HTMLInputElement).value = cleanedContent
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
      } else {
        console.log('✅ Caption appears clean (no filename detected)')
      }
      
    } catch (error) {
      console.error('❌ Error during pre-publish caption check:', error)
      // Don't throw error, just log it to avoid breaking the publish process
    }
  }

  /**
   * Post-upload caption check to see what TikTok auto-fills
   */
  private static async postUploadCaptionCheck(): Promise<void> {
    try {
      console.log('🔍 Checking caption after video upload...')
      
      // Wait a moment for TikTok to process the upload and auto-fill caption
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Find caption element
      let captionElement = document.querySelector(this.SELECTORS.CAPTION_INPUT) ||
                          document.querySelector(this.SELECTORS.CAPTION_TEXTAREA)
      
      if (!captionElement) {
        console.log('⚠️ Caption element not found during post-upload check')
        return
      }
      
      // Get current caption content
      const currentContent = captionElement.tagName.toLowerCase() === 'textarea'
        ? (captionElement as HTMLTextAreaElement).value
        : (captionElement as HTMLElement).textContent || (captionElement as HTMLElement).innerText || ''
      
      console.log('📝 Post-upload caption content:', currentContent)
      
      // Check if TikTok auto-filled with filename
      const filenamePatterns: RegExp[] = [
        /em3dia-\d+-\d+/gi,
        /\b[a-zA-Z]+[_-]\d{6,}\b/gi,
        /\b[a-zA-Z0-9\-_]+\d{6,}\b/gi
      ]
      if (TikTokUploadAutomation.lastUploadedBaseName) {
        filenamePatterns.push(new RegExp(`\\b${TikTokUploadAutomation.escapeRegExp(TikTokUploadAutomation.lastUploadedBaseName)}\\b`, 'gi'))
      }
      const hasFilename = filenamePatterns.some((re) => re.test(currentContent))
      
      if (hasFilename) {
        console.log('⚠️ TikTok auto-filled caption with filename after upload')
      } else {
        console.log('✅ No filename detected in caption after upload')
      }
      
    } catch (error) {
      console.error('❌ Error during post-upload caption check:', error)
    }
  }

  /**
   * Set text in form elements
   */
  private static async setText(element: HTMLElement, text: string): Promise<void> {
    // Focus the element first
    element.focus()
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Try different methods based on element type
    if (element.tagName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement
      
      // Method 1: Clear and set value
      textarea.value = text
      
      // Method 2: Trigger input events
      const events = ['input', 'change', 'keyup', 'keydown']
      for (const eventType of events) {
        const event = new Event(eventType, { bubbles: true })
        textarea.dispatchEvent(event)
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Method 3: Verify and retry if needed
      if (textarea.value !== text) {
        console.log('⚠️ Textarea value not set correctly, retrying...')
        textarea.focus()
        textarea.select()
        
        // Try typing simulation
        for (const char of text) {
          const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true })
          const keyupEvent = new KeyboardEvent('keyup', { key: char, bubbles: true })
          const inputEvent = new InputEvent('input', { data: char, bubbles: true })
          
          textarea.dispatchEvent(keydownEvent)
          textarea.value += char
          textarea.dispatchEvent(inputEvent)
          textarea.dispatchEvent(keyupEvent)
        }
        
        textarea.dispatchEvent(new Event('change', { bubbles: true }))
      }
      
    } else if (element.contentEditable === 'true') {
      // For contenteditable elements (like DraftJS or TikTok's custom editor)
      await this.setTextInContentEditable(element, text)
    } else {
      // For other input types
      const input = element as HTMLInputElement
      
      // Method 1: Set value
      input.value = text
      
      // Method 2: Trigger events
      const events = ['input', 'change', 'keyup', 'keydown']
      for (const eventType of events) {
        const event = new Event(eventType, { bubbles: true })
        input.dispatchEvent(event)
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Method 3: Verify and retry if needed
      if (input.value !== text) {
        console.log('⚠️ Input value not set correctly, retrying...')
        input.focus()
        input.select()
        input.value = ''
        
        // Simulate typing
        for (const char of text) {
          const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true })
          const keyupEvent = new KeyboardEvent('keyup', { key: char, bubbles: true })
          const inputEvent = new InputEvent('input', { data: char, bubbles: true })
          
          input.dispatchEvent(keydownEvent)
          input.value += char
          input.dispatchEvent(inputEvent)
          input.dispatchEvent(keyupEvent)
        }
        
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    
    // Final verification
    await new Promise(resolve => setTimeout(resolve, 200))
    const finalValue = element.tagName.toLowerCase() === 'textarea' 
      ? (element as HTMLTextAreaElement).value
      : element.tagName.toLowerCase() === 'input'
      ? (element as HTMLInputElement).value
      : element.textContent || element.innerText || ''
    
    console.log('📝 setText final verification:', {
      expected: text,
      actual: finalValue,
      success: finalValue === text || finalValue.includes(text)
    })
  }

  /**
   * Set text in contenteditable elements
   */
  private static async setTextInContentEditable(element: HTMLElement, text: string): Promise<void> {
    console.log('📝 Setting text in contenteditable element:', text)
    
    // Method 1: Try paste event first (most reliable for modern web apps)
    try {
      element.focus()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Clear existing content first
      if (window.getSelection) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(element)
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        // Delete existing content
        document.execCommand('delete')
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/plain', text)
      
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })
      
      element.dispatchEvent(pasteEvent)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Check if it worked
      const currentContent = element.textContent || element.innerText || ''
      console.log('📝 Content after paste event:', currentContent)
      
      if (currentContent.includes(text)) {
        console.log('✅ Paste method successful')
        return
      }
    } catch (error) {
      console.log('⚠️ Paste event failed:', error)
    }
    
    // Method 2: Direct content manipulation
    try {
      element.focus()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Clear content
      element.innerHTML = ''
      element.textContent = ''
      
      // Set new content
      element.textContent = text
      
      // Trigger events
      const events = ['input', 'change', 'keyup', 'compositionend']
      for (const eventType of events) {
        const event = new Event(eventType, { bubbles: true })
        element.dispatchEvent(event)
      }
      
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const currentContent = element.textContent || element.innerText || ''
      console.log('📝 Content after direct manipulation:', currentContent)
      
      if (currentContent.includes(text)) {
        console.log('✅ Direct manipulation method successful')
        return
      }
    } catch (error) {
      console.log('⚠️ Direct manipulation failed:', error)
    }
    
    // Method 3: Keyboard simulation (most compatible but slower)
    try {
      element.focus()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Clear existing content with Ctrl+A and Delete
      const selectAllEvent = new KeyboardEvent('keydown', { 
        key: 'a', 
        ctrlKey: true, 
        bubbles: true 
      })
      element.dispatchEvent(selectAllEvent)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const deleteEvent = new KeyboardEvent('keydown', { 
        key: 'Delete', 
        bubbles: true 
      })
      element.dispatchEvent(deleteEvent)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Type the text character by character
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        
        const keydownEvent = new KeyboardEvent('keydown', { 
          key: char, 
          bubbles: true 
        })
        const keypressEvent = new KeyboardEvent('keypress', { 
          key: char, 
          bubbles: true 
        })
        const inputEvent = new InputEvent('input', { 
          data: char, 
          bubbles: true,
          inputType: 'insertText'
        })
        const keyupEvent = new KeyboardEvent('keyup', { 
          key: char, 
          bubbles: true 
        })
        
        element.dispatchEvent(keydownEvent)
        element.dispatchEvent(keypressEvent)
        
        // Insert the character into the element
        const currentText: string = element.textContent || ''
        element.textContent = currentText + char
        
        element.dispatchEvent(inputEvent)
        element.dispatchEvent(keyupEvent)
        
        // Small delay between characters to simulate human typing
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Final composition end event
      element.dispatchEvent(new Event('compositionend', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const currentContent = element.textContent || element.innerText || ''
      console.log('📝 Content after keyboard simulation:', currentContent)
      
      if (currentContent.includes(text)) {
        console.log('✅ Keyboard simulation method successful')
        return
      }
    } catch (error) {
      console.log('⚠️ Keyboard simulation failed:', error)
    }
    
    console.log('⚠️ All contenteditable text setting methods failed')
  }

  /**
   * Force set the content of a contenteditable element
   */
  private static async forceSetCaptionContent(element: HTMLElement, text: string): Promise<void> {
    console.log('📝 Forcing set content in contenteditable element:', text)
    
    // Clear existing content
    element.innerHTML = ''
    element.textContent = ''
    
    // Set new content
    element.textContent = text
    
    // Trigger events
    const events = ['input', 'change', 'keyup', 'compositionend']
    for (const eventType of events) {
      const event = new Event(eventType, { bubbles: true })
      element.dispatchEvent(event)
    }
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const currentContent = element.textContent || element.innerText || ''
    console.log('📝 Content after forced set:', currentContent)
    
    if (currentContent.includes(text)) {
      console.log('✅ Forced set content successful')
      return
    }
    
    console.log('⚠️ Forced set content failed, trying alternative methods...')
    
    // Alternative method 1: Paste
    try {
      element.focus()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      if (window.getSelection) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(element)
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        document.execCommand('delete')
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/plain', text)
      
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })
      
      element.dispatchEvent(pasteEvent)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const currentContent = element.textContent || element.innerText || ''
      console.log('📝 Content after paste alternative:', currentContent)
      
      if (currentContent.includes(text)) {
        console.log('✅ Paste alternative method successful')
        return
      }
    } catch (error) {
      console.log('⚠️ Paste alternative failed:', error)
    }
    
    // Alternative method 2: Direct typing
    try {
      element.focus()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Clear existing content
      element.innerHTML = ''
      element.textContent = ''
      
      // Type the text character by character
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        
        const keydownEvent = new KeyboardEvent('keydown', { 
          key: char, 
          bubbles: true 
        })
        const keypressEvent = new KeyboardEvent('keypress', { 
          key: char, 
          bubbles: true 
        })
        const inputEvent = new InputEvent('input', { 
          data: char, 
          bubbles: true,
          inputType: 'insertText'
        })
        const keyupEvent = new KeyboardEvent('keyup', { 
          key: char, 
          bubbles: true 
        })
        
        element.dispatchEvent(keydownEvent)
        element.dispatchEvent(keypressEvent)
        
        // Insert the character into the element
        const currentText: string = element.textContent || ''
        element.textContent = currentText + char
        
        element.dispatchEvent(inputEvent)
        element.dispatchEvent(keyupEvent)
        
        // Small delay between characters to simulate human typing
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Final composition end event
      element.dispatchEvent(new Event('compositionend', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const currentContent = element.textContent || element.innerText || ''
      console.log('📝 Content after direct typing alternative:', currentContent)
      
      if (currentContent.includes(text)) {
        console.log('✅ Direct typing alternative method successful')
        return
      }
    } catch (error) {
      console.log('⚠️ Direct typing alternative failed:', error)
    }
    
    console.log('⚠️ All forced contenteditable text setting methods failed')
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

  private static escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // --- Filename patterns and sanitizers ---
  private static getFilenamePatterns(): RegExp[] {
    const patterns: RegExp[] = [
      /em3dia-\d+(-\d+)?(-\d+)?/gi,
      /\b\w+-\d{10,}-\d+\b/gi,
      /\b[a-zA-Z0-9]+-\d{13,}-\d+\b/gi,
      /\b[a-zA-Z]+[_-]\d{6,}\b/gi,
      /\b[a-zA-Z0-9\-_]+\d{6,}\b/gi
    ]
    if (TikTokUploadAutomation.lastUploadedBaseName) {
      patterns.push(new RegExp(`\\b${TikTokUploadAutomation.escapeRegExp(TikTokUploadAutomation.lastUploadedBaseName)}\\b`, 'gi'))
    }
    // Always include the safe upload basename
    patterns.push(new RegExp(`\\b${TikTokUploadAutomation.escapeRegExp(TikTokUploadAutomation.SAFE_UPLOAD_BASENAME)}\\b`, 'gi'))
    return patterns
  }

  private static sanitizeCaption(content: string): string {
    let cleaned = content
    for (const re of TikTokUploadAutomation.getFilenamePatterns()) {
      cleaned = cleaned.replace(re, ' ')
    }
    return cleaned.replace(/\s+/g, ' ').trim()
  }

  // --- Network interception to enforce clean caption ---
  private static initRequestInterceptors(): void {
    if (TikTokUploadAutomation.interceptorsInstalled) return
    TikTokUploadAutomation.interceptorsInstalled = true

    try {
      const originalFetch = window.fetch
      window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        try {
          if (init && init.body) {
            init = { ...init, body: TikTokUploadAutomation.sanitizeRequestBody(init.body) }
          }
        } catch {}
        return originalFetch.apply(this, [input, init as any])
      }
    } catch {}

    try {
      const openMap = new WeakMap<XMLHttpRequest, string>()
      const originalOpen = XMLHttpRequest.prototype.open
      const originalSend = XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.open = function(method: string, url: string): void {
        try { openMap.set(this, url) } catch {}
        return originalOpen.apply(this, arguments as any)
      }
      XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
        try {
          if (body) {
            const url = openMap.get(this) || ''
            // Only attempt to sanitize on TikTok domains
            if (location.hostname.includes('tiktok.com') || /tiktok/.test(url)) {
              body = TikTokUploadAutomation.sanitizeRequestBody(body as any) as any
            }
          }
        } catch {}
        return originalSend.apply(this, [body as any])
      }
    } catch {}

    // Patch navigator.sendBeacon
    try {
      const originalSendBeacon = navigator.sendBeacon?.bind(navigator)
      if (originalSendBeacon) {
        navigator.sendBeacon = function(url: string | URL, data?: BodyInit | null): boolean {
          try {
            if (data) data = TikTokUploadAutomation.sanitizeRequestBody(data as any) as any
          } catch {}
          return originalSendBeacon(url, data)
        }
      }
    } catch {}

    // Patch FormData append/set to sanitize caption-related fields proactively
    try {
      const originalAppend = FormData.prototype.append
      const originalSet = FormData.prototype.set
      FormData.prototype.append = function(name: string, value: any, fileName?: string) {
        try {
          if (typeof value === 'string') {
            value = TikTokUploadAutomation.sanitizeFormField(name, value)
          }
        } catch {}
        return originalAppend.call(this, name, value, fileName as any)
      }
      FormData.prototype.set = function(name: string, value: any, fileName?: string) {
        try {
          if (typeof value === 'string') {
            value = TikTokUploadAutomation.sanitizeFormField(name, value)
          }
        } catch {}
        return originalSet.call(this, name, value, fileName as any)
      }
    } catch {}

    // Patch URLSearchParams append/set
    try {
      const proto = URLSearchParams.prototype as any
      const originalUSPAppend = proto.append
      const originalUSPSet = proto.set
      proto.append = function(name: string, value: string) {
        try { value = TikTokUploadAutomation.sanitizeFormField(name, value) } catch {}
        return originalUSPAppend.call(this, name, value)
      }
      proto.set = function(name: string, value: string) {
        try { value = TikTokUploadAutomation.sanitizeFormField(name, value) } catch {}
        return originalUSPSet.call(this, name, value)
      }
    } catch {}

    // Also inject into page context (content scripts run in isolated world)
    try {
      this.injectPageInterceptors()
    } catch {}
  }

  private static sanitizeRequestBody(body: any): any {
    // String (likely JSON)
    if (typeof body === 'string') {
      const sanitized = TikTokUploadAutomation.sanitizeJSONString(body)
      return sanitized
    }
    // FormData
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      const keysToCheck = ['desc', 'description', 'caption', 'text']
      for (const key of keysToCheck) {
        const val = body.get(key)
        if (typeof val === 'string' && val) {
          const target = TikTokUploadAutomation.lastSetCaption || TikTokUploadAutomation.sanitizeCaption(val)
          body.set(key, target)
        }
      }
      return body
    }
    // Blob/ArrayBuffer – cannot easily modify
    return body
  }

  private static sanitizeJSONString(jsonStr: string): string {
    try {
      const obj = JSON.parse(jsonStr)
      const sanitized = TikTokUploadAutomation.sanitizePayloadObject(obj)
      return JSON.stringify(sanitized)
    } catch {
      // Fallback: try to directly replace filename-like tokens
      const cleaned = TikTokUploadAutomation.sanitizeCaption(jsonStr)
      return cleaned
    }
  }

  private static sanitizePayloadObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    const keysToCheck = new Set(['desc', 'description', 'caption', 'text'])
    const stack: any[] = [obj]
    while (stack.length) {
      const current = stack.pop()
      for (const key of Object.keys(current)) {
        const value = current[key]
        if (value && typeof value === 'object') {
          stack.push(value)
        } else if (typeof value === 'string') {
          if (keysToCheck.has(key)) {
            current[key] = TikTokUploadAutomation.lastSetCaption || TikTokUploadAutomation.sanitizeCaption(value)
          } else {
            current[key] = TikTokUploadAutomation.sanitizeCaption(value)
          }
        }
      }
    }
    return obj
  }

  private static sanitizeFormField(name: string, value: string): string {
    const n = (name || '').toLowerCase()
    if (['desc', 'description', 'caption', 'text'].includes(n)) {
      return TikTokUploadAutomation.lastSetCaption || TikTokUploadAutomation.sanitizeCaption(value)
    }
    return TikTokUploadAutomation.sanitizeCaption(value)
  }

  private static injectPageInterceptors(): void {
    const SCRIPT_ID = 'mh-tiktok-page-interceptors'
    if (document.getElementById(SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.type = 'text/javascript'
    script.textContent = `(() => {
      const SAFE_BASENAME = ${JSON.stringify(TikTokUploadAutomation.SAFE_UPLOAD_BASENAME)}
      let mhDesiredCaption = ''
      window.addEventListener('mh:set-caption', (e) => {
        try { mhDesiredCaption = (e as CustomEvent).detail || mhDesiredCaption } catch {}
      })
      const escapeRegExp = (s) => s.replace(/[.*+?^$(){}|[\\]\\]/g, '\\$&')
      const getPatterns = () => {
        const arr = [
          /em3dia-\\d+(-\\d+)?(-\\d+)?/gi,
          /\\b\\w+-\\d{10,}-\\d+\\b/gi,
          /\\b[a-zA-Z0-9]+-\\d{13,}-\\d+\\b/gi,
          /\\b[a-zA-Z]+[_-]\\d{6,}\\b/gi,
          /\\b[a-zA-Z0-9\\-_]+\\d{6,}\\b/gi,
          new RegExp('\\\\b' + escapeRegExp(SAFE_BASENAME) + '\\\\b', 'gi')
        ]
        return arr
      }
      const sanitizeCaption = (s) => {
        let cleaned = String(s || '')
        for (const re of getPatterns()) cleaned = cleaned.replace(re, ' ')
        return cleaned.replace(/\\s+/g, ' ').trim()
      }
      const sanitizeJSONString = (js) => {
        try {
          const obj = JSON.parse(js)
          const keys = new Set(['desc','description','caption','text'])
          const stack = [obj]
          while (stack.length) {
            const cur = stack.pop()
            for (const k in cur) {
              const v = cur[k]
              if (v && typeof v === 'object') stack.push(v)
              else if (typeof v === 'string') cur[k] = keys.has(k) ? (mhDesiredCaption || sanitizeCaption(v)) : sanitizeCaption(v)
            }
          }
          return JSON.stringify(obj)
        } catch { return sanitizeCaption(js) }
      }
      try {
        const ofetch = window.fetch
        window.fetch = async function(i, init){
          try { if (init && init.body) init = { ...init, body: sanitizeBody(init.body) } } catch {}
          return ofetch.apply(this, [i, init])
        }
      } catch {}
      try {
        const openMap = new WeakMap()
        const oopen = XMLHttpRequest.prototype.open
        const osend = XMLHttpRequest.prototype.send
        XMLHttpRequest.prototype.open = function(m,u){ try{openMap.set(this,u)}catch{} return oopen.apply(this, arguments) }
        XMLHttpRequest.prototype.send = function(b){ try{ if(b){ const u=openMap.get(this)||''; if(location.hostname.includes('tiktok.com')||/tiktok/.test(u)){ b = sanitizeBody(b) } } }catch{} return osend.apply(this,[b]) }
      } catch {}
      try {
        const ob = navigator.sendBeacon && navigator.sendBeacon.bind(navigator)
        if (ob) navigator.sendBeacon = function(u,d){ try{ if(d) d = sanitizeBody(d) }catch{} return ob(u,d) }
      } catch {}
      try {
        const oa = FormData.prototype.append
        const os = FormData.prototype.set
        FormData.prototype.append = function(n,v,f){ try{ if(typeof v==='string') v = field(n,v) }catch{} return oa.call(this,n,v,f) }
        FormData.prototype.set = function(n,v,f){ try{ if(typeof v==='string') v = field(n,v) }catch{} return os.call(this,n,v,f) }
      } catch {}
      try {
        const p = URLSearchParams.prototype
        const oa = p.append
        const os = p.set
        p.append = function(n,v){ try{ v = field(n,v) }catch{} return oa.call(this,n,v) }
        p.set = function(n,v){ try{ v = field(n,v) }catch{} return os.call(this,n,v) }
      } catch {}
      function field(n,v){ n = String(n||'').toLowerCase(); if(['desc','description','caption','text'].includes(n)) return mhDesiredCaption || sanitizeCaption(v); return sanitizeCaption(v) }
      function sanitizeBody(b){ if(typeof b==='string') return sanitizeJSONString(b); if(b instanceof FormData){ ['desc','description','caption','text'].forEach(k=>{ const val=b.get(k); if(typeof val==='string'&&val){ b.set(k, mhDesiredCaption || sanitizeCaption(val)) } }); return b } return b }
    })();`
    document.documentElement.appendChild(script)
  }

  private static updatePageDesiredCaption(text: string): void {
    try {
      document.dispatchEvent(new CustomEvent('mh:set-caption', { detail: text }))
    } catch {}
  }

  /**
   * Main automation function to upload content to TikTok
   */
  static async uploadContent(data: TikTokPostData): Promise<void> {
    console.log('🚀 Starting TikTok upload automation...')
    console.log('📊 Data received:', data)
    
    try {
      // Ensure network request interceptors are installed early
      this.initRequestInterceptors()
      // Reconstruct File object from serialized data
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
      
      // Step 1: Upload video file (required for TikTok)
      if (mediaFile) {
        console.log('🎬 Step 1: Uploading video file...')
        await this.uploadVideoFile(mediaFile)
        
        // Check caption after video upload to see if TikTok auto-filled it
        console.log('🔍 Post-upload caption check...')
        await this.postUploadCaptionCheck()
        
        // CRITICAL: Completely clear the auto-filled filename before setting our caption
        console.log('🧹 Step 1.5: Clearing TikTok auto-filled filename...')
        await this.clearAutoFilledCaption()
      } else {
        throw new Error('Video file is required for TikTok upload')
      }
      
      // Step 2: Set caption if provided
      if (data.text || data.caption) {
        console.log('📝 Step 2: Setting caption...')
        const captionText = data.caption || data.text || ''
        
        // Add hashtags if provided
        if (data.hashtags && data.hashtags.length > 0) {
          const hashtagText = data.hashtags.map(tag => 
            tag.startsWith('#') ? tag : `#${tag}`
          ).join(' ');
          await this.setCaption(`${captionText} ${hashtagText}`);
        } else {
          await this.setCaption(captionText);
        }
      }
      
      // Step 3: Set privacy if provided
      if (data.privacy) {
        console.log('🔒 Step 3: Setting privacy...')
        await this.setPrivacy(data.privacy)
      }
      
      // Step 4: Publish the video
      console.log('🚀 Step 4: Publishing video...');
      await this.publishVideo();
      
      console.log('✅ TikTok upload automation completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in TikTok upload automation:', error);
      throw error;
    }
  }
}

/**
 * Message listener for TikTok content script
 */
console.log('🔗 TikTokUploadAutomation content script loaded on:', window.location.href)
console.log('🔗 Script load time:', new Date().toISOString())
console.log('🔗 Document ready state:', document.readyState)
console.log('🔗 TikTok page check:', window.location.href.includes('tiktok.com'))

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 TikTok content script received message:', message)
  console.log('📍 Current URL:', window.location.href)
  console.log('📄 Page title:', document.title)
  
  if (message.type === 'UPLOAD_TIKTOK_CONTENT') {
    console.log('🎯 Processing UPLOAD_TIKTOK_CONTENT message with data:', {
      hasText: !!message.data?.text,
      hasCaption: !!message.data?.caption,
      hasMediaFile: !!message.data?.mediaFile,
      mediaType: message.data?.mediaFile?.type || 'none',
      mediaSize: message.data?.mediaFile?.size || 0,
      privacy: message.data?.privacy || 'public',
      hashtagsCount: message.data?.hashtags?.length || 0
    })
    
    TikTokUploadAutomation.uploadContent(message.data)
      .then(() => {
        console.log('✅ TikTok upload automation completed successfully')
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error('❌ Error in TikTok upload automation:', error)
        sendResponse({ success: false, error: error.message })
      })
    
    // Return true to indicate we'll send a response asynchronously
    return true
  } else {
    console.log('ℹ️ Ignoring message with type:', message.type)
  }
  
  return false
})

export default TikTokUploadAutomation 