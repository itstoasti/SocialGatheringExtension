/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { PostData, PostingRepository } from '#domain/repositories/posting'

export interface PostContentRequest {
  text: string
  mediaFile?: File | SerializedMediaFile
  textFile?: File
  scheduleTime?: string
  // Platform-specific properties
  platform?: 'twitter' | 'tiktok' | 'threads' | 'facebook'
  // TikTok-specific properties
  caption?: string
  hashtags?: string[]
  privacy?: 'public' | 'friends' | 'private'
  // Auto-close tab after posting
  closeTabAfterPost?: boolean
}

export interface SerializedMediaFile {
  data: number[]
  name: string
  type: string
  size: number
}

export interface PostingUseCases {
  /**
   * Create and immediately post content
   */
  postNow(request: PostContentRequest): Promise<void>

  /**
   * Send post to Twitter without saving to database (for queue processing)
   */
  sendPostToTwitter(request: PostContentRequest): Promise<void>

  /**
   * Send post to TikTok without saving to database (for queue processing)
   */
  sendPostToTikTok(request: PostContentRequest): Promise<void>

  /**
   * Send post to Threads without saving to database (for queue processing)
   */
  sendPostToThreads(request: PostContentRequest): Promise<void>

  /**
   * Send post to Facebook without saving to database (for queue processing)
   */
  sendPostToFacebook(request: PostContentRequest): Promise<void>

  /**
   * Schedule a post for later
   */
  schedulePost(request: PostContentRequest): Promise<PostData>

  /**
   * Add a post to the queue
   */
  addToQueue(request: PostContentRequest): Promise<PostData>

  /**
   * Get all queued posts
   */
  getQueuedPosts(): Promise<PostData[]>

  /**
   * Process scheduled posts that are due
   */
  processScheduledPosts(): Promise<void>

  /**
   * Remove a post from queue
   */
  removeFromQueue(postId: string): Promise<void>

  /**
   * Clear all posts from queue
   */
  clearQueue(): Promise<void>
}

export class PostingUseCasesImpl implements PostingUseCases {
  constructor(private readonly postingRepository: PostingRepository) {}

  /**
   * Create and immediately post content
   */
  async postNow(request: PostContentRequest): Promise<void> {
    try {
      console.log('🚀 PostingUseCases.postNow called with:', {
        hasText: !!request.text && request.text.trim().length > 0,
        hasMediaFile: !!request.mediaFile,
        hasTextFile: !!request.textFile,
        textLength: request.text?.length || 0,
        mediaType: request.mediaFile?.type || 'none',
        platform: request.platform || 'twitter'
      })

      // Send the post to the appropriate platform
      if (request.platform === 'tiktok') {
        await this.sendPostToTikTok(request)
      } else if (request.platform === 'threads') {
        await this.sendPostToThreads(request)
      } else if (request.platform === 'facebook') {
        await this.sendPostToFacebook(request)
      } else {
        await this.sendPostToTwitter(request)
      }
      
      // Handle media file - convert serialized format back to File if needed for saving
      let mediaFile: File | undefined = undefined
      if (request.mediaFile) {
        if (request.mediaFile instanceof File) {
          // Already a File object
          mediaFile = request.mediaFile
        } else {
          // Serialized media file - convert back to File
          console.log('🔄 Converting serialized media file back to File object')
          const uint8Array = new Uint8Array(request.mediaFile.data)
          mediaFile = new File([uint8Array], request.mediaFile.name, {
            type: request.mediaFile.type
          })
          console.log('✅ Media file converted:', {
            name: mediaFile.name,
            type: mediaFile.type,
            size: mediaFile.size
          })
        }
      }
      
      // Save to history with 'posted' status
      await this.postingRepository.savePost({
        text: request.text,
        mediaFile: mediaFile, // This is always a File object or undefined
        textFile: request.textFile,
        status: 'posted',
      })
      
      console.log('💾 Post saved to history')
      
    } catch (error) {
      console.error('💥 Error in postNow:', error)
      throw error
    }
  }

  /**
   * Send post to Twitter without saving to database (for queue processing)
   */
  async sendPostToTwitter(request: PostContentRequest): Promise<void> {
    try {
      console.log('🚀 PostingUseCases.sendPostToTwitter called with:', {
        hasText: !!request.text && request.text.trim().length > 0,
        hasMediaFile: !!request.mediaFile,
        hasTextFile: !!request.textFile,
        textLength: request.text?.length || 0,
        mediaType: request.mediaFile?.type || 'none'
      })

      // Read text file content if provided
      let textContent = request.text || ''
      
      if (request.textFile) {
        try {
          console.log('📄 Reading text file content:', {
            fileName: request.textFile.name,
            fileSize: request.textFile.size,
            fileType: request.textFile.type
          })
          
          const fileText = await request.textFile.text()
          
          console.log('📝 Raw text file content (first 200 chars):', JSON.stringify(fileText.substring(0, 200)))
          console.log('📝 Text file content preview:', fileText.substring(0, 100) + (fileText.length > 100 ? '...' : ''))
          console.log('📝 Text file content length:', fileText.length)
          console.log('📝 Text file starts with filename?:', fileText.startsWith(request.textFile.name.replace('.txt', '')))
          
          // Check if the filename is embedded in the content and remove it
          let cleanedText = fileText.trim()
          const filenameWithoutExt = request.textFile.name.replace(/\.[^/.]+$/, "") // Remove extension
          
          // If content starts with filename, remove it
          if (cleanedText.startsWith(filenameWithoutExt)) {
            console.log('🧹 Removing filename from beginning of text file content')
            cleanedText = cleanedText.substring(filenameWithoutExt.length).trim()
            console.log('📝 Cleaned text content:', cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''))
          }
          
          // Use cleaned text file content as main text if no text provided
          if (!textContent.trim() && cleanedText.trim()) {
            textContent = cleanedText.trim()
            console.log('📝 Using cleaned text file content as text')
          }
        } catch (error) {
          console.error('❌ Error reading text file:', error)
        }
      }

      // Handle media file - convert serialized format back to File if needed
      let mediaFile: File | undefined = undefined
      if (request.mediaFile) {
        if (request.mediaFile instanceof File) {
          // Already a File object
          mediaFile = request.mediaFile
        } else {
          // Serialized media file - convert back to File
          console.log('🔄 Converting serialized media file back to File object')
          const uint8Array = new Uint8Array(request.mediaFile.data)
          mediaFile = new File([uint8Array], request.mediaFile.name, {
            type: request.mediaFile.type
          })
          console.log('✅ Media file converted:', {
            name: mediaFile.name,
            type: mediaFile.type,
            size: mediaFile.size
          })
        }
      }

      // Open Twitter compose page
      const composeUrl = 'https://x.com/compose/post'
      console.log('📂 Opening tab:', composeUrl)
      const tab = await chrome.tabs.create({ url: composeUrl })
      
      if (!tab.id) {
        throw new Error('Failed to create tab - no tab ID received')
      }
      
      console.log('✅ Tab created with ID:', tab.id)
      
      // Wait for tab to load, then send post data with proper error handling
      const sendMessageWithRetry = async (retryCount = 0): Promise<void> => {
        const maxRetries = 5
        const delay = 2000 + (retryCount * 1000) // 2s, 3s, 4s, 5s, 6s
        
        console.log(`⏳ Waiting ${delay}ms before sending message (attempt ${retryCount + 1}/${maxRetries + 1})...`)
        
        // Use promise-based delay instead of setTimeout
        await new Promise(resolve => setTimeout(resolve, delay))
        
        try {
          // Convert File to serializable format for message passing
          let serializedMediaFile = undefined
          if (mediaFile) {
            console.log('📁 Serializing media file for message passing:', {
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            })
            
            const arrayBuffer = await mediaFile.arrayBuffer()
            serializedMediaFile = {
              data: Array.from(new Uint8Array(arrayBuffer)),
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            }
            
            console.log('✅ Media file serialized for message passing')
          }
          
          console.log('📨 Sending POST_CONTENT message to tab:', tab.id)
          const response = await chrome.tabs.sendMessage(tab.id!, {
            type: 'POST_CONTENT',
            data: {
              text: textContent,
              mediaFile: serializedMediaFile,
              closeTabAfterPost: request.closeTabAfterPost || false,
            }
          })

          console.log('✅ Message sent successfully, response:', response)

          // Check if content script reported failure
          if (response && !response.success) {
            throw new Error(`Content script failed to post: ${response.error || 'Unknown error'}`)
          }

          // If closeTabAfterPost is enabled, schedule tab closure asynchronously
          // Don't await this - let it run in the background to avoid blocking other posts
          if (request.closeTabAfterPost) {
            const tabIdToClose = tab.id!
            console.log(`⏳ Scheduling tab ${tabIdToClose} for closure in 15 seconds (non-blocking)...`)

            // Schedule closure asynchronously without blocking
            setTimeout(async () => {
              try {
                await chrome.tabs.remove(tabIdToClose)
                console.log(`✅ Twitter tab ${tabIdToClose} closed successfully`)
              } catch (error) {
                console.error(`❌ Error closing Twitter tab ${tabIdToClose}:`, error)
              }
            }, 15000) // 15 seconds
          }
          
        } catch (error) {
          console.error(`❌ Error sending message (attempt ${retryCount + 1}):`, error)
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`)
            return await sendMessageWithRetry(retryCount + 1)
          } else {
            console.error('💥 All retry attempts failed')
            throw new Error(`Failed to send message after ${maxRetries + 1} attempts: ${error}`)
          }
        }
      }
      
      await sendMessageWithRetry()
      
    } catch (error) {
      console.error('💥 Error in sendPostToTwitter:', error)
      throw error
    }
  }

  /**
   * Send post to TikTok without saving to database (for queue processing)
   */
  async sendPostToTikTok(request: PostContentRequest): Promise<void> {
    try {
      console.log('🚀 PostingUseCases.sendPostToTikTok called with:', {
        hasText: !!request.text && request.text.trim().length > 0,
        hasCaption: !!request.caption && request.caption.trim().length > 0,
        hasMediaFile: !!request.mediaFile,
        hasTextFile: !!request.textFile,
        textLength: request.text?.length || 0,
        captionLength: request.caption?.length || 0,
        mediaType: request.mediaFile?.type || 'none',
        privacy: request.privacy || 'public',
        hashtagsCount: request.hashtags?.length || 0
      })

      // Read text file content if provided
      let textContent = request.text || ''
      let captionContent = request.caption || ''
      
      if (request.textFile) {
        try {
          console.log('📄 Reading text file content:', {
            fileName: request.textFile.name,
            fileSize: request.textFile.size,
            fileType: request.textFile.type
          })
          
          const fileText = await request.textFile.text()
          
          console.log('📝 Raw text file content (first 200 chars):', JSON.stringify(fileText.substring(0, 200)))
          console.log('📝 Text file content preview:', fileText.substring(0, 100) + (fileText.length > 100 ? '...' : ''))
          console.log('📝 Text file content length:', fileText.length)
          console.log('📝 Text file starts with filename?:', fileText.startsWith(request.textFile.name.replace('.txt', '')))
          
          // Check if the filename is embedded in the content and remove it
          let cleanedText = fileText.trim()
          const filenameWithoutExt = request.textFile.name.replace(/\.[^/.]+$/, "") // Remove extension
          
          // If content starts with filename, remove it
          if (cleanedText.startsWith(filenameWithoutExt)) {
            console.log('🧹 Removing filename from beginning of text file content')
            cleanedText = cleanedText.substring(filenameWithoutExt.length).trim()
            console.log('📝 Cleaned text content:', cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''))
          }
          
          // Use cleaned text file content as caption if no caption provided
          if (!captionContent.trim() && cleanedText.trim()) {
            captionContent = cleanedText.trim()
            console.log('📝 Using cleaned text file content as caption')
          }
          
          // Use cleaned text file content as main text if no text provided
          if (!textContent.trim() && cleanedText.trim()) {
            textContent = cleanedText.trim()
            console.log('📝 Using cleaned text file content as text')
          }
        } catch (error) {
          console.error('❌ Error reading text file:', error)
        }
      }

      // Handle media file - convert serialized format back to File if needed
      let mediaFile: File | undefined = undefined
      if (request.mediaFile) {
        if (request.mediaFile instanceof File) {
          // Already a File object
          mediaFile = request.mediaFile
        } else {
          // Serialized media file - convert back to File
          console.log('🔄 Converting serialized media file back to File object for TikTok')
          const uint8Array = new Uint8Array(request.mediaFile.data)
          mediaFile = new File([uint8Array], request.mediaFile.name, {
            type: request.mediaFile.type
          })
          console.log('✅ Media file converted:', {
            name: mediaFile.name,
            type: mediaFile.type,
            size: mediaFile.size
          })
        }
      }

      // Open TikTok Studio upload page
      const uploadUrl = 'https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=en'
      console.log('📂 Opening TikTok Studio tab:', uploadUrl)
      const tab = await chrome.tabs.create({ url: uploadUrl })
      
      if (!tab.id) {
        throw new Error('Failed to create TikTok tab - no tab ID received')
      }
      
      console.log('✅ TikTok tab created with ID:', tab.id)
      
      // Wait for tab to load, then send upload data with proper error handling
      const sendMessageWithRetry = async (retryCount = 0): Promise<void> => {
        const maxRetries = 5
        const delay = 3000 + (retryCount * 2000) // 3s, 5s, 7s, 9s, 11s (TikTok needs more time)
        
        console.log(`⏳ Waiting ${delay}ms before sending TikTok message (attempt ${retryCount + 1}/${maxRetries + 1})...`)
        
        // Use promise-based delay instead of setTimeout
        await new Promise(resolve => setTimeout(resolve, delay))
        
        try {
          // Convert File to serializable format for message passing
          let serializedMediaFile = undefined
          if (mediaFile) {
            console.log('📁 Serializing media file for TikTok message passing:', {
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            })
            
            const arrayBuffer = await mediaFile.arrayBuffer()
            serializedMediaFile = {
              data: Array.from(new Uint8Array(arrayBuffer)),
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            }
            
            console.log('✅ Media file serialized for TikTok message passing')
          }
          
          console.log('📨 Sending UPLOAD_TIKTOK_CONTENT message to tab:', tab.id)
          const response = await chrome.tabs.sendMessage(tab.id!, {
            type: 'UPLOAD_TIKTOK_CONTENT',
            data: {
              text: textContent,
              caption: captionContent,
              hashtags: request.hashtags,
              privacy: request.privacy || 'public',
              mediaFile: serializedMediaFile,
              closeTabAfterPost: request.closeTabAfterPost || false,
            }
          })

          console.log('✅ TikTok message sent successfully, response:', response)

          // Check if content script reported failure
          if (response && !response.success) {
            throw new Error(`Content script failed to upload to TikTok: ${response.error || 'Unknown error'}`)
          }

          // If closeTabAfterPost is enabled, schedule tab closure asynchronously
          // Don't await this - let it run in the background to avoid blocking other posts
          if (request.closeTabAfterPost) {
            const tabIdToClose = tab.id!
            console.log(`⏳ Scheduling tab ${tabIdToClose} for closure in 15 seconds (non-blocking)...`)

            // Schedule closure asynchronously without blocking
            setTimeout(async () => {
              try {
                await chrome.tabs.remove(tabIdToClose)
                console.log(`✅ TikTok tab ${tabIdToClose} closed successfully`)
              } catch (error) {
                console.error(`❌ Error closing TikTok tab ${tabIdToClose}:`, error)
              }
            }, 15000) // 15 seconds
          }
          
        } catch (error) {
          console.error(`❌ Error sending TikTok message (attempt ${retryCount + 1}):`, error)
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`)
            await sendMessageWithRetry(retryCount + 1)
          } else {
            console.error('💥 All TikTok retry attempts failed')
            throw new Error(`Failed to send TikTok message after ${maxRetries + 1} attempts: ${error}`)
          }
        }
      }
      
      await sendMessageWithRetry()

    } catch (error) {
      console.error('💥 Error in sendPostToTikTok:', error)
      throw error
    }
  }

  /**
   * Send post to Threads without saving to database (for queue processing)
   */
  async sendPostToThreads(request: PostContentRequest): Promise<void> {
    try {
      console.log('🚀 PostingUseCases.sendPostToThreads called with:', {
        hasText: !!request.text && request.text.trim().length > 0,
        hasMediaFile: !!request.mediaFile,
        hasTextFile: !!request.textFile,
        textLength: request.text?.length || 0,
        mediaType: request.mediaFile?.type || 'none'
      })

      // Read text file content if provided
      let textContent = request.text || ''

      if (request.textFile) {
        try {
          console.log('📄 Reading text file content:', {
            fileName: request.textFile.name,
            fileSize: request.textFile.size,
            fileType: request.textFile.type
          })

          const fileText = await request.textFile.text()

          console.log('📝 Raw text file content (first 200 chars):', JSON.stringify(fileText.substring(0, 200)))
          console.log('📝 Text file content preview:', fileText.substring(0, 100) + (fileText.length > 100 ? '...' : ''))
          console.log('📝 Text file content length:', fileText.length)

          // Check if the filename is embedded in the content and remove it
          let cleanedText = fileText.trim()
          const filenameWithoutExt = request.textFile.name.replace(/\.[^/.]+$/, "") // Remove extension

          // If content starts with filename, remove it
          if (cleanedText.startsWith(filenameWithoutExt)) {
            console.log('🧹 Removing filename from beginning of text file content')
            cleanedText = cleanedText.substring(filenameWithoutExt.length).trim()
            console.log('📝 Cleaned text content:', cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''))
          }

          // Use cleaned text file content as main text if no text provided
          if (!textContent.trim() && cleanedText.trim()) {
            textContent = cleanedText.trim()
            console.log('📝 Using cleaned text file content as text')
          }
        } catch (error) {
          console.error('❌ Error reading text file:', error)
        }
      }

      // Handle media file - convert serialized format back to File if needed
      let mediaFile: File | undefined = undefined
      if (request.mediaFile) {
        if (request.mediaFile instanceof File) {
          // Already a File object
          mediaFile = request.mediaFile
        } else {
          // Serialized media file - convert back to File
          console.log('🔄 Converting serialized media file back to File object for Threads')
          const uint8Array = new Uint8Array(request.mediaFile.data)
          mediaFile = new File([uint8Array], request.mediaFile.name, {
            type: request.mediaFile.type
          })
          console.log('✅ Media file converted:', {
            name: mediaFile.name,
            type: mediaFile.type,
            size: mediaFile.size
          })
        }
      }

      // Open Threads website
      const threadsUrl = 'https://www.threads.net'
      console.log('📂 Opening Threads tab:', threadsUrl)
      const tab = await chrome.tabs.create({ url: threadsUrl })

      if (!tab.id) {
        throw new Error('Failed to create Threads tab - no tab ID received')
      }

      console.log('✅ Threads tab created with ID:', tab.id)

      // Wait for tab to load, then send message with content
      const sendMessageWithRetry = async (retryCount = 0): Promise<void> => {
        const maxRetries = 5
        const delay = 4000 + (retryCount * 1000) // 4s, 5s, 6s, 7s, 8s

        console.log(`⏳ Waiting ${delay}ms before sending Threads message (attempt ${retryCount + 1}/${maxRetries + 1})...`)

        await new Promise(resolve => setTimeout(resolve, delay))

        try {
          // Convert File to serializable format for message passing
          let serializedMediaFile = undefined
          if (mediaFile) {
            console.log('📁 Serializing media file for Threads message passing:', {
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            })

            const arrayBuffer = await mediaFile.arrayBuffer()
            serializedMediaFile = {
              data: Array.from(new Uint8Array(arrayBuffer)),
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            }

            console.log('✅ Media file serialized for Threads message passing')
          }

          console.log('📨 Sending POST_THREADS_CONTENT message to tab:', tab.id)
          const response = await chrome.tabs.sendMessage(tab.id!, {
            type: 'POST_THREADS_CONTENT',
            data: {
              text: textContent,
              mediaFile: serializedMediaFile,
              closeTabAfterPost: request.closeTabAfterPost || false,
            }
          })

          console.log('✅ Threads message sent successfully, response:', response)

          // Check if content script reported failure
          if (response && !response.success) {
            throw new Error(`Content script failed to post to Threads: ${response.error || 'Unknown error'}`)
          }

          // If closeTabAfterPost is enabled, schedule tab closure asynchronously
          // Don't await this - let it run in the background to avoid blocking other posts
          if (request.closeTabAfterPost) {
            const tabIdToClose = tab.id!
            console.log(`⏳ Scheduling tab ${tabIdToClose} for closure in 4 minutes (non-blocking)...`)

            // Schedule closure asynchronously without blocking
            setTimeout(async () => {
              try {
                await chrome.tabs.remove(tabIdToClose)
                console.log(`✅ Threads tab ${tabIdToClose} closed successfully`)
              } catch (error) {
                console.error(`❌ Error closing Threads tab ${tabIdToClose}:`, error)
              }
            }, 240000) // 4 minutes
          }

        } catch (error) {
          console.error(`❌ Error sending Threads message (attempt ${retryCount + 1}):`, error)

          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`)
            return await sendMessageWithRetry(retryCount + 1)
          } else {
            console.error('💥 All retry attempts failed')
            throw new Error(`Failed to send Threads message after ${maxRetries + 1} attempts: ${error}`)
          }
        }
      }

      await sendMessageWithRetry()

    } catch (error) {
      console.error('💥 Error in sendPostToThreads:', error)
      throw error
    }
  }

  /**
   * Send post to Facebook without saving to database (for queue processing)
   */
  async sendPostToFacebook(request: PostContentRequest): Promise<void> {
    try {
      console.log('🚀 PostingUseCases.sendPostToFacebook called with:', {
        hasText: !!request.text && request.text.trim().length > 0,
        hasMediaFile: !!request.mediaFile,
        hasTextFile: !!request.textFile,
        textLength: request.text?.length || 0,
        mediaType: request.mediaFile?.type || 'none'
      })

      // Read text file content if provided
      let textContent = request.text || ''

      if (request.textFile) {
        try {
          console.log('📄 Reading text file content:', {
            fileName: request.textFile.name,
            fileSize: request.textFile.size,
            fileType: request.textFile.type
          })

          const fileText = await request.textFile.text()
          let cleanedText = fileText.trim()
          const filenameWithoutExt = request.textFile.name.replace(/\.[^/.]+$/, "")

          if (cleanedText.startsWith(filenameWithoutExt)) {
            console.log('🧹 Removing filename from beginning of text file content')
            cleanedText = cleanedText.substring(filenameWithoutExt.length).trim()
          }

          if (!textContent.trim() && cleanedText.trim()) {
            textContent = cleanedText.trim()
            console.log('📝 Using cleaned text file content as text')
          }
        } catch (error) {
          console.error('❌ Error reading text file:', error)
        }
      }

      // Handle media file - convert serialized format back to File if needed
      let mediaFile: File | undefined = undefined
      if (request.mediaFile) {
        if (request.mediaFile instanceof File) {
          mediaFile = request.mediaFile
        } else {
          console.log('🔄 Converting serialized media file back to File object for Facebook')
          const uint8Array = new Uint8Array(request.mediaFile.data)
          mediaFile = new File([uint8Array], request.mediaFile.name, {
            type: request.mediaFile.type
          })
          console.log('✅ Media file converted:', {
            name: mediaFile.name,
            type: mediaFile.type,
            size: mediaFile.size
          })
        }
      }

      // Open Facebook homepage
      const facebookUrl = 'https://www.facebook.com/'
      console.log('📂 Opening Facebook tab:', facebookUrl)
      const tab = await chrome.tabs.create({ url: facebookUrl })

      if (!tab.id) {
        throw new Error('Failed to create Facebook tab - no tab ID received')
      }

      console.log('✅ Facebook tab created with ID:', tab.id)

      // Wait for tab to load, then send message with content
      const sendMessageWithRetry = async (retryCount = 0): Promise<void> => {
        const maxRetries = 5
        const delay = 4000 + (retryCount * 1000) // 4s, 5s, 6s, 7s, 8s

        console.log(`⏳ Waiting ${delay}ms before sending Facebook message (attempt ${retryCount + 1}/${maxRetries + 1})...`)

        await new Promise(resolve => setTimeout(resolve, delay))

        try {
          // Convert File to serializable format for message passing
          let serializedMediaFile = undefined
          if (mediaFile) {
            console.log('📁 Serializing media file for Facebook message passing:', {
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            })

            const arrayBuffer = await mediaFile.arrayBuffer()
            serializedMediaFile = {
              data: Array.from(new Uint8Array(arrayBuffer)),
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size
            }

            console.log('✅ Media file serialized for Facebook message passing')
          }

          console.log('📨 Sending POST_FACEBOOK_CONTENT message to tab:', tab.id)
          const response = await chrome.tabs.sendMessage(tab.id!, {
            type: 'POST_FACEBOOK_CONTENT',
            data: {
              text: textContent,
              mediaFile: serializedMediaFile,
              closeTabAfterPost: request.closeTabAfterPost || false,
            }
          })

          console.log('✅ Facebook message sent successfully, response:', response)

          if (response && !response.success) {
            throw new Error(`Content script failed to post to Facebook: ${response.error || 'Unknown error'}`)
          }

          // If closeTabAfterPost is enabled, schedule tab closure
          if (request.closeTabAfterPost) {
            const tabIdToClose = tab.id!
            console.log(`⏳ Scheduling tab ${tabIdToClose} for closure in 10 seconds (non-blocking)...`)

            setTimeout(async () => {
              try {
                await chrome.tabs.remove(tabIdToClose)
                console.log(`✅ Facebook tab ${tabIdToClose} closed successfully`)
              } catch (error) {
                console.error(`❌ Error closing Facebook tab ${tabIdToClose}:`, error)
              }
            }, 10000) // 10 seconds - enough time for post to complete
          }

        } catch (error) {
          console.error(`❌ Error sending Facebook message (attempt ${retryCount + 1}):`, error)

          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`)
            return await sendMessageWithRetry(retryCount + 1)
          } else {
            console.error('💥 All retry attempts failed for Facebook')
            throw new Error(`Failed to send Facebook message after ${maxRetries + 1} attempts: ${error}`)
          }
        }
      }

      await sendMessageWithRetry()

    } catch (error) {
      console.error('💥 Error in sendPostToFacebook:', error)
      throw error
    }
  }

  /**
   * Schedule a post for later
   */
  async schedulePost(request: PostContentRequest): Promise<PostData> {
    if (!request.scheduleTime) {
      throw new Error('Schedule time is required for scheduled posts')
    }

    // Handle media file - convert serialized format back to File if needed
    let mediaFile: File | undefined = undefined
    if (request.mediaFile) {
      if (request.mediaFile instanceof File) {
        // Already a File object
        mediaFile = request.mediaFile
      } else {
        // Serialized media file - convert back to File
        console.log('🔄 Converting serialized media file back to File object for scheduling')
        const uint8Array = new Uint8Array(request.mediaFile.data)
        mediaFile = new File([uint8Array], request.mediaFile.name, {
          type: request.mediaFile.type
        })
      }
    }

    const post = await this.postingRepository.savePost({
      text: request.text,
      mediaFile: mediaFile, // This is always a File object or undefined
      textFile: request.textFile,
      scheduleTime: request.scheduleTime,
      status: 'pending',
      platform: request.platform,
      caption: request.caption,
      hashtags: request.hashtags,
      privacy: request.privacy,
    })

    // Set up Chrome alarm for scheduled post
    const alarmName = `scheduled_post_${post.id}`
    const scheduledTime = new Date(request.scheduleTime).getTime()
    const now = new Date().getTime()
    
    console.log(`⏰ Creating alarm for scheduled post:`, {
      postId: post.id,
      platform: post.platform || 'twitter',
      alarmName,
      scheduledTime: new Date(scheduledTime).toLocaleString(),
      currentTime: new Date(now).toLocaleString(),
      timeUntilPost: Math.round((scheduledTime - now) / 60000) + ' minutes',
      scheduledTimeMs: scheduledTime
    })
    
    chrome.alarms.create(alarmName, {
      when: scheduledTime,
    })

    // Verify alarm was created
    setTimeout(async () => {
      const allAlarms = await chrome.alarms.getAll()
      const ourAlarm = allAlarms.find(a => a.name === alarmName)
      if (ourAlarm) {
        console.log(`✅ Alarm verification successful for post ${post.id}:`, ourAlarm)
      } else {
        console.log(`❌ Alarm verification failed for post ${post.id} - alarm not found`)
      }
    }, 100)

    return post
  }

  /**
   * Add a post to the queue
   */
  async addToQueue(request: PostContentRequest): Promise<PostData> {
    // Handle media file - convert serialized format back to File if needed
    let mediaFile: File | undefined = undefined
    if (request.mediaFile) {
      if (request.mediaFile instanceof File) {
        // Already a File object
        mediaFile = request.mediaFile
      } else {
        // Serialized media file - convert back to File
        console.log('🔄 Converting serialized media file back to File object for queue')
        const uint8Array = new Uint8Array(request.mediaFile.data)
        mediaFile = new File([uint8Array], request.mediaFile.name, {
          type: request.mediaFile.type
        })
      }
    }

    const post = await this.postingRepository.savePost({
      text: request.text,
      mediaFile: mediaFile, // This is always a File object or undefined
      textFile: request.textFile,
      status: 'pending',
      platform: request.platform,
      caption: request.caption,
      hashtags: request.hashtags,
      privacy: request.privacy,
    })

    return post
  }

  /**
   * Get all queued posts
   */
  async getQueuedPosts(): Promise<PostData[]> {
    const allPosts = await this.postingRepository.getAllPosts()
    
    // Filter to only include posts that are pending and not scheduled
    const queuedPosts = allPosts.filter(post => 
      post.status === 'pending' && !post.scheduleTime
    )
    
    console.log('📊 Queue status:', {
      totalPosts: allPosts.length,
      queuedPosts: queuedPosts.length,
      postedPosts: allPosts.filter(post => post.status === 'posted').length,
      failedPosts: allPosts.filter(post => post.status === 'failed').length,
      scheduledPosts: allPosts.filter(post => post.scheduleTime).length
    })
    
    return queuedPosts
  }

  /**
   * Process scheduled posts that are due
   */
  async processScheduledPosts(): Promise<void> {
    console.log('🔍 Processing scheduled posts via startup processor...')
    const duePosts = await this.postingRepository.getScheduledPostsDue()
    
    console.log(`📋 Found ${duePosts.length} scheduled posts due for processing`)
    
    if (duePosts.length === 0) {
      console.log('✅ No scheduled posts due for processing')
      return
    }
    
    let processedCount = 0
    let skippedCount = 0
    
    for (const post of duePosts) {
      try {
        console.log(`📤 Checking scheduled post ${post.id}:`, {
          platform: post.platform || 'twitter',
          hasText: !!post.text,
          hasMedia: !!post.mediaFile,
          hasCaption: !!post.caption,
          scheduledTime: post.scheduleTime,
          currentStatus: post.status
        })
        
        // Get the most recent post data to check current status
        const currentPosts = await this.postingRepository.getAllPosts()
        const currentPost = currentPosts.find(p => p.id === post.id)
        
        if (!currentPost) {
          console.log(`⚠️ Scheduled post ${post.id} no longer exists`)
          skippedCount++
          continue
        }
        
        if (currentPost.status !== 'pending') {
          console.log(`⏭️ Post ${post.id} already processed by another handler (current status: ${currentPost.status}), skipping`)
          skippedCount++
          continue
        }
        
        // Update status to 'posting' immediately to prevent race conditions
        await this.postingRepository.updatePost(post.id, { status: 'posting' })
        console.log(`🔄 Post ${post.id} status updated to 'posting' by startup processor`)
        
        // Small delay to let other processors see the status change
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Double-check status again after the delay
        const recheckPosts = await this.postingRepository.getAllPosts()
        const recheckPost = recheckPosts.find(p => p.id === post.id)
        
        if (!recheckPost || recheckPost.status !== 'posting') {
          console.log(`⏭️ Post ${post.id} status changed during processing (now: ${recheckPost?.status || 'not found'}), another handler may have taken over`)
          skippedCount++
          continue
        }
        
        console.log(`🚀 Proceeding with post processing for ${post.id}`)
        
        // Post the content with all platform-specific data
        await this.postNow({
          text: post.text,
          mediaFile: post.mediaFile,
          textFile: post.textFile,
          platform: post.platform,
          caption: post.caption,
          hashtags: post.hashtags,
          privacy: post.privacy,
        })
        
        // Update status to 'posted'
        await this.postingRepository.updatePost(post.id, { status: 'posted' })
        
        console.log(`✅ Successfully posted scheduled post ${post.id} via startup processor`)
        processedCount++
        
      } catch (error) {
        console.error(`❌ Error posting scheduled post ${post.id}:`, error)
        
        // Update status to 'failed'
        await this.postingRepository.updatePost(post.id, { status: 'failed' })
        processedCount++ // Count as processed even if failed
      }
    }
    
    console.log(`✅ Startup processor finished: ${processedCount} processed, ${skippedCount} skipped, ${duePosts.length} total`)
  }

  /**
   * Remove a post from queue
   */
  async removeFromQueue(postId: string): Promise<void> {
    // Remove Chrome alarm if it exists
    const alarmName = `scheduled_post_${postId}`
    chrome.alarms.clear(alarmName)
    
    // Remove from repository
    await this.postingRepository.deletePost(postId)
  }

  /**
   * Clear all posts from queue
   */
  async clearQueue(): Promise<void> {
    // Get all posts to clear their alarms
    const posts = await this.postingRepository.getAllPosts()
    
    for (const post of posts) {
      const alarmName = `scheduled_post_${post.id}`
      chrome.alarms.clear(alarmName)
    }
    
    // Clear all posts
    await this.postingRepository.clearAllPosts()
  }
}

export default PostingUseCasesImpl 