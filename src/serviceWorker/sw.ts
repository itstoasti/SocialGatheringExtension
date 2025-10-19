/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { CheckDownloadWasTriggeredBySelf } from '#domain/useCases/checkDownloadWasTriggeredBySelf'
import { PostingUseCasesImpl } from '#domain/useCases/posting'
import { PostingRepositoryImpl } from '#infra/repositories/posting'
import { getEventPublisher } from '#infra/eventPublisher'
import { init as initMonitor } from '#monitor'
import { downloadRepo } from '#provider'
import { getRuntimeId } from '#utils/runtime'
import handleDownloadChanged from './handlers/handleDownloadChanged'
import handleNotificationButtonClicked from './handlers/handleNotificationButtonClicked'
import handleNotificationClicked from './handlers/handleNotificationClicked'
import handleNotificationClosed from './handlers/handleNotificationClosed'
import handleRuntimeInstalled from './handlers/handleRuntimeInstalled'
import { handleScheduledPostAlarm, processScheduledPostsOnStartup, debugScheduledPosts } from './handlers/handleScheduledPosts'
import { handleAutoPostingAlarm, startAutoPosting, updateAutoPostingSchedule } from './handlers/handleAutoPosting'
import initEventPublisher from './initEventPublisher'
import { initMessageRouter } from './initMessageRouter'
import { getMessageRouter } from './messageRouter'
import Browser from 'webextension-polyfill'

initMonitor()

const eventPublisher = getEventPublisher()
initEventPublisher(eventPublisher)

const messageRouter = getMessageRouter()
initMessageRouter(messageRouter)

// Initialize auto-posting system
startAutoPosting().catch(error => {
  console.error('Error initializing auto-posting system:', error)
})

// Process any missed scheduled posts on startup
processScheduledPostsOnStartup().catch(error => {
  console.error('Error processing missed scheduled posts on startup:', error)
})

// Unified alarm handler for both scheduled posts and auto-posting
Browser.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  console.log('🔔 Alarm triggered:', alarm.name)
  
  // Route to appropriate handler based on alarm name
  if (alarm.name === 'auto_posting_queue') {
    console.log('📤 Handling auto-posting alarm')
    handleAutoPostingAlarm(alarm)
  } else if (alarm.name.startsWith('scheduled_post_')) {
    console.log('⏰ Handling scheduled post alarm')
    handleScheduledPostAlarm(alarm)
  } else {
    console.log('⚠️ Unknown alarm:', alarm.name)
  }
})

Browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle POST_NOW messages separately
  if ((message as any).type === 'POST_NOW') {
    console.log('🎯 Service Worker handling POST_NOW message:', message)
    
    handlePostNow(message)
      .then(result => {
        console.log('✅ POST_NOW handled successfully:', result)
        sendResponse(result)
      })
      .catch(error => {
        console.error('❌ Error handling POST_NOW:', error)
        sendResponse({ success: false, error: error.message })
      })
    
    return true // Keep the message channel open for async response
  }
  
  // Handle UPLOAD_TIKTOK_NOW messages separately
  if ((message as any).type === 'UPLOAD_TIKTOK_NOW') {
    console.log('🎯 Service Worker handling UPLOAD_TIKTOK_NOW message:', message)

    handleTikTokUploadNow(message)
      .then(result => {
        console.log('✅ UPLOAD_TIKTOK_NOW handled successfully:', result)
        sendResponse(result)
      })
      .catch(error => {
        console.error('❌ Error handling UPLOAD_TIKTOK_NOW:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true // Keep the message channel open for async response
  }

  // Handle POST_FACEBOOK_CONTENT messages separately
  if ((message as any).type === 'POST_FACEBOOK_CONTENT') {
    console.log('🎯 Service Worker handling POST_FACEBOOK_CONTENT message:', message)

    handleFacebookPostNow(message)
      .then(result => {
        console.log('✅ POST_FACEBOOK_CONTENT handled successfully:', result)
        sendResponse(result)
      })
      .catch(error => {
        console.error('❌ Error handling POST_FACEBOOK_CONTENT:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true // Keep the message channel open for async response
  }

  // Handle UPDATE_AUTO_POSTING_SCHEDULE messages
  if ((message as any).type === 'UPDATE_AUTO_POSTING_SCHEDULE') {
    console.log('🎯 Service Worker handling UPDATE_AUTO_POSTING_SCHEDULE message:', message)
    
    updateAutoPostingSchedule((message as any).data)
      .then(() => {
        console.log('✅ Auto-posting schedule updated successfully')
        sendResponse({ success: true })
      })
      .catch(error => {
        console.error('❌ Error updating auto-posting schedule:', error)
        sendResponse({ success: false, error: error.message })
      })
    
    return true // Keep the message channel open for async response
  }
  
  // Handle other messages through the message router
  messageRouter.handle({ message, sender, response: sendResponse })
  return true
})

// POST_NOW handler function
async function handlePostNow(message: any): Promise<{ success: boolean, error?: string }> {
  try {
    const postingRepository = new PostingRepositoryImpl()
    const postingUseCases = new PostingUseCasesImpl(postingRepository)
    
    await postingUseCases.postNow({
      text: message.data.text,
      mediaFile: message.data.mediaFile,
      textFile: message.data.textFile,
      platform: message.data.platform,
      caption: message.data.caption,
      hashtags: message.data.hashtags,
      privacy: message.data.privacy,
    })
    
    return { success: true }
    
  } catch (error) {
    console.error('❌ Error in handlePostNow:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// UPLOAD_TIKTOK_NOW handler function
async function handleTikTokUploadNow(message: any): Promise<{ success: boolean, error?: string }> {
  try {
    const postingRepository = new PostingRepositoryImpl()
    const postingUseCases = new PostingUseCasesImpl(postingRepository)

    await postingUseCases.sendPostToTikTok({
      text: message.data.text,
      caption: message.data.caption,
      hashtags: message.data.hashtags,
      privacy: message.data.privacy,
      mediaFile: message.data.mediaFile,
      textFile: message.data.textFile,
    })

    return { success: true }

  } catch (error) {
    console.error('❌ Error in handleTikTokUploadNow:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// POST_FACEBOOK_CONTENT handler function
async function handleFacebookPostNow(message: any): Promise<{ success: boolean, error?: string }> {
  try {
    const postingRepository = new PostingRepositoryImpl()
    const postingUseCases = new PostingUseCasesImpl(postingRepository)

    await postingUseCases.sendPostToFacebook({
      text: message.data.text,
      mediaFile: message.data.mediaFile,
      textFile: message.data.textFile,
    })

    return { success: true }

  } catch (error) {
    console.error('❌ Error in handleFacebookPostNow:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

Browser.runtime.onInstalled.addListener(handleRuntimeInstalled(eventPublisher))
Browser.downloads.onChanged.addListener(
  handleDownloadChanged(
    downloadRepo,
    new CheckDownloadWasTriggeredBySelf(getRuntimeId()),
    eventPublisher
  )
)
Browser.notifications.onClosed.addListener(
  handleNotificationClosed(eventPublisher)
)
Browser.notifications.onClicked.addListener(
  handleNotificationClicked(eventPublisher)
)
Browser.notifications.onButtonClicked.addListener(
  handleNotificationButtonClicked(eventPublisher)
)

// Handle extension icon click - open the main dashboard
Browser.action.onClicked.addListener(async () => {
  console.log('🔧 Extension icon clicked - opening main dashboard')
  try {
    await Browser.tabs.create({
      url: Browser.runtime.getURL('index.html')
    })
  } catch (error) {
    console.error('❌ Error opening main dashboard:', error)
  }
})

// Make debug functions available globally for console access
;(globalThis as any).debugScheduledPosts = debugScheduledPosts
