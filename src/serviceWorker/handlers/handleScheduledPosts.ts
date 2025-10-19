/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { PostingRepositoryImpl } from '#infra/repositories/posting'
import { PostingUseCasesImpl } from '#domain/useCases/posting'

let postingRepository: PostingRepositoryImpl | null = null
let postingUseCases: PostingUseCasesImpl | null = null

/**
 * Initialize posting services
 */
function initPostingServices() {
  if (!postingRepository) {
    postingRepository = new PostingRepositoryImpl()
  }
  if (!postingUseCases) {
    postingUseCases = new PostingUseCasesImpl(postingRepository)
  }
  return { postingRepository, postingUseCases }
}

/**
 * Track posts currently being processed to prevent duplicates
 */
const processingPosts = new Set<string>()

/**
 * Handle Chrome alarm events for scheduled posts
 */
export function handleScheduledPostAlarm(alarm: chrome.alarms.Alarm): void {
  console.log('🔔 Scheduled post alarm triggered:', {
    alarmName: alarm.name,
    scheduledTime: alarm.scheduledTime ? new Date(alarm.scheduledTime).toLocaleString() : 'unknown',
    currentTime: new Date().toLocaleString(),
    periodInMinutes: alarm.periodInMinutes
  })

  // Check if this is a scheduled post alarm
  if (alarm.name.startsWith('scheduled_post_')) {
    const postId = alarm.name.replace('scheduled_post_', '')
    console.log(`📤 Processing scheduled post from alarm: ${postId}`)

    // Process immediately in parallel - no queue needed!
    processScheduledPost(postId).catch(error => {
      console.error(`❌ Error in alarm handler for post ${postId}:`, error)
    })
  } else {
    console.log('⚠️ Alarm is not a scheduled post alarm, ignoring:', alarm.name)
  }
}

/**
 * Process a specific scheduled post
 */
async function processScheduledPost(postId: string): Promise<void> {
  // Check if this post is already being processed
  if (processingPosts.has(postId)) {
    console.log(`🔒 Post ${postId} is already being processed by another handler, skipping duplicate`)
    return
  }

  // Add to processing set to prevent duplicates
  processingPosts.add(postId)

  try {
    const { postingRepository, postingUseCases } = initPostingServices()
    
    console.log(`📋 Processing scheduled post from alarm handler: ${postId}`)
    
    // Get the post data with current status
    const posts = await postingRepository.getAllPosts()
    const post = posts.find(p => p.id === postId)
    
    if (!post) {
      console.error(`❌ Scheduled post ${postId} not found in database`)
      return
    }
    
    // Check if post is still pending (might have been processed by startup handler)
    if (post.status !== 'pending') {
      console.log(`⏭️ Post ${postId} already processed by another handler (status: ${post.status}), skipping`)
      return
    }
    
    console.log(`📤 Processing scheduled post ${postId}:`, {
      platform: post.platform || 'twitter',
      hasText: !!post.text,
      hasMedia: !!post.mediaFile,
      hasCaption: !!post.caption,
      scheduledTime: post.scheduleTime ? new Date(post.scheduleTime).toLocaleString() : 'none',
      currentStatus: post.status
    })
    
    // Update status to 'posting' to prevent other handlers from processing it
    await postingRepository.updatePost(post.id, { status: 'posting' })
    console.log(`🔄 Post ${post.id} status updated to 'posting' by alarm handler`)
    
    // Serialize media file if present
    let serializedMediaFile: any = undefined
    if (post.mediaFile) {
      console.log('🔄 Serializing media file for posting...')
      const arrayBuffer = await post.mediaFile.arrayBuffer()
      serializedMediaFile = {
        data: Array.from(new Uint8Array(arrayBuffer)),
        name: post.mediaFile.name,
        type: post.mediaFile.type,
        size: post.mediaFile.size
      }
    }
    
    // Post the content to the appropriate platform
    let postingSucceeded = false
    try {
      if (post.platform === 'tiktok') {
        await postingUseCases.sendPostToTikTok({
          text: post.text,
          caption: post.caption,
          hashtags: post.hashtags,
          privacy: post.privacy,
          mediaFile: serializedMediaFile,
          textFile: post.textFile,
          closeTabAfterPost: post.closeTabAfterPost ?? false, // Use saved preference, default false
        })
      } else if (post.platform === 'threads') {
        await postingUseCases.sendPostToThreads({
          text: post.text,
          mediaFile: serializedMediaFile,
          textFile: post.textFile,
          closeTabAfterPost: post.closeTabAfterPost ?? false, // Use saved preference, default false
        })
      } else if (post.platform === 'facebook') {
        await postingUseCases.sendPostToFacebook({
          text: post.text,
          mediaFile: serializedMediaFile,
          closeTabAfterPost: post.closeTabAfterPost ?? false, // Use saved preference, default false
        })
      } else {
        await postingUseCases.sendPostToTwitter({
          text: post.text,
          mediaFile: serializedMediaFile,
          textFile: post.textFile,
          closeTabAfterPost: post.closeTabAfterPost ?? false, // Use saved preference, default false
        })
      }
      postingSucceeded = true
    } catch (postError) {
      console.error(`❌ Error posting content for ${post.id}:`, postError)
      // Don't throw - let the status update to 'failed' below
    }

    // Update status based on result
    if (postingSucceeded) {
      await postingRepository.updatePost(post.id, { status: 'posted' })
      console.log(`✅ Successfully posted scheduled post ${post.id} via alarm handler`)
    } else {
      await postingRepository.updatePost(post.id, { status: 'failed' })
      console.log(`❌ Failed to post scheduled post ${post.id} - marked as failed`)
      // Don't throw error - just mark as failed and continue
      return
    }
    
    // Clean up the Chrome alarm
    try {
      const alarmName = `scheduled_post_${post.id}`
      await chrome.alarms.clear(alarmName)
      console.log(`🧹 Cleaned up alarm: ${alarmName}`)
    } catch (alarmError) {
      console.error('⚠️ Error cleaning up alarm:', alarmError)
    }
    
  } catch (error) {
    console.error(`❌ Error processing scheduled post ${postId}:`, error)
    
    try {
      const { postingRepository } = initPostingServices()
      await postingRepository.updatePost(postId, { status: 'failed' })
    } catch (updateError) {
      console.error('❌ Error updating post status to failed:', updateError)
    }
  } finally {
    // Always remove from processing set
    processingPosts.delete(postId)
    console.log(`🔓 Released processing lock for post ${postId}`)
  }
}

/**
 * Set up alarm listener
 */
export function setupScheduledPostsListener(): void {
  // Listen for alarms
  chrome.alarms.onAlarm.addListener(handleScheduledPostAlarm)
  
  // Process any posts that may have been missed (e.g., if extension was disabled)
  processScheduledPostsOnStartup()
}

/**
 * Process any scheduled posts that may have been missed
 * Only marks missed posts as 'failed' - requires manual retry via the UI
 */
export async function processScheduledPostsOnStartup(): Promise<void> {
  try {
    const { postingRepository } = initPostingServices()

    console.log('🎯 Startup processor: Checking for missed scheduled posts...')

    // Add a small delay to let Chrome alarms process first
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Get all active Chrome alarms
    const allAlarms = await chrome.alarms.getAll()
    const scheduledPostAlarms = new Set(
      allAlarms
        .filter(alarm => alarm.name.startsWith('scheduled_post_'))
        .map(alarm => alarm.name.replace('scheduled_post_', ''))
    )

    console.log(`⏰ Found ${scheduledPostAlarms.size} active Chrome alarms for scheduled posts`)

    // Get all pending scheduled posts
    const allPosts = await postingRepository.getAllPosts()
    const now = new Date()
    const duePosts = allPosts.filter(post =>
      post.scheduleTime &&
      post.status === 'pending' &&
      new Date(post.scheduleTime) <= now
    )

    console.log(`📋 Found ${duePosts.length} posts that are past their scheduled time`)

    // Only process posts that DON'T have active alarms (meaning they were truly missed)
    const missedPosts = duePosts.filter(post => !scheduledPostAlarms.has(post.id))

    if (missedPosts.length === 0) {
      console.log('✅ No missed posts found - all due posts have active Chrome alarms')
      return
    }

    console.log(`⚠️ Found ${missedPosts.length} posts that were missed (no active alarm):`)
    missedPosts.forEach(post => {
      console.log(`  - Post ${post.id}: scheduled for ${new Date(post.scheduleTime!).toLocaleString()}`)
    })

    // Mark missed posts as 'failed' instead of auto-posting them
    // This requires the user to manually click the retry button
    for (const post of missedPosts) {
      console.log(`⏭️ Marking missed post ${post.id} as 'failed' - manual retry required`)
      await postingRepository.updatePost(post.id, { status: 'failed' })

      // Clean up the Chrome alarm if it exists
      const alarmName = `scheduled_post_${post.id}`
      await chrome.alarms.clear(alarmName)
    }

    console.log('✅ Startup processor: Finished checking for missed posts - marked as failed')

  } catch (error) {
    console.error('❌ Startup processor error:', error)
  }
}

/**
 * Clean up old completed posts (optional)
 */
export async function cleanupOldPosts(): Promise<void> {
  try {
    const { postingRepository } = initPostingServices()
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const allPosts = await postingRepository.getAllPosts()
    
    for (const post of allPosts) {
      if (post.status === 'posted' || post.status === 'failed') {
        if (post.updatedAt < thirtyDaysAgo) {
          await postingRepository.deletePost(post.id)
        }
      }
    }
    
    console.log('Cleaned up old posts')
    
  } catch (error) {
    console.error('Error cleaning up old posts:', error)
  }
}

/**
 * Debug function to check scheduled posts and alarms
 * Run this in browser console: chrome.runtime.getBackgroundPage().then(bg => bg.debugScheduledPosts())
 */
export async function debugScheduledPosts(): Promise<void> {
  try {
    console.log('🔍 === SCHEDULED POSTS DIAGNOSTIC ===')
    
    const { postingRepository } = initPostingServices()
    
    // Get all posts
    const allPosts = await postingRepository.getAllPosts()
    const scheduledPosts = allPosts.filter(post => post.scheduleTime)
    
    console.log('📋 All Posts:', allPosts.length)
    console.log('📅 Scheduled Posts:', scheduledPosts.length)
    
    // Show scheduled posts details
    scheduledPosts.forEach(post => {
      const scheduleTime = new Date(post.scheduleTime!)
      const now = new Date()
      const isPast = scheduleTime < now
      
      console.log(`📤 Post ${post.id}:`, {
        status: post.status,
        platform: post.platform || 'twitter',
        scheduledTime: scheduleTime.toLocaleString(),
        isPastDue: isPast,
        minutesUntilPost: isPast ? 'PAST DUE' : Math.round((scheduleTime.getTime() - now.getTime()) / 60000),
        hasText: !!post.text,
        hasMedia: !!post.mediaFile,
        hasCaption: !!post.caption
      })
    })
    
    // Check Chrome alarms
    const allAlarms = await chrome.alarms.getAll()
    const scheduledPostAlarms = allAlarms.filter(alarm => alarm.name.startsWith('scheduled_post_'))
    
    console.log('⏰ Chrome Alarms:', allAlarms.length)
    console.log('📅 Scheduled Post Alarms:', scheduledPostAlarms.length)
    
    scheduledPostAlarms.forEach(alarm => {
      const scheduledTime = alarm.scheduledTime ? new Date(alarm.scheduledTime) : null
      const now = new Date()
      
      console.log(`⏰ Alarm ${alarm.name}:`, {
        scheduledTime: scheduledTime ? scheduledTime.toLocaleString() : 'unknown',
        isPastDue: scheduledTime ? scheduledTime < now : 'unknown',
        minutesUntilAlarm: scheduledTime ? Math.round((scheduledTime.getTime() - now.getTime()) / 60000) : 'unknown',
        periodInMinutes: alarm.periodInMinutes
      })
    })
    
    // Check for mismatches
    const postIds = scheduledPosts.filter(p => p.status === 'pending').map(p => p.id)
    const alarmPostIds = scheduledPostAlarms.map(a => a.name.replace('scheduled_post_', ''))
    
    const postsWithoutAlarms = postIds.filter(id => !alarmPostIds.includes(id))
    const alarmsWithoutPosts = alarmPostIds.filter(id => !postIds.includes(id))
    
    if (postsWithoutAlarms.length > 0) {
      console.log('❌ Posts without alarms:', postsWithoutAlarms)
    }
    
    if (alarmsWithoutPosts.length > 0) {
      console.log('❌ Alarms without posts:', alarmsWithoutPosts)
    }
    
    if (postsWithoutAlarms.length === 0 && alarmsWithoutPosts.length === 0) {
      console.log('✅ All scheduled posts have corresponding alarms')
    }
    
  } catch (error) {
    console.error('❌ Error debugging scheduled posts:', error)
  }
}

export default {
  handleScheduledPostAlarm,
  setupScheduledPostsListener,
  cleanupOldPosts,
} 