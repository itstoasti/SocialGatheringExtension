/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { PostingRepositoryImpl } from '#infra/repositories/posting'
import { PostingUseCasesImpl } from '#domain/useCases/posting'
import { QueueSettingsRepositoryImpl } from '#infra/repositories/queueSettings'
import type { QueueSettings } from '#domain/repositories/queueSettings'

let postingRepository: PostingRepositoryImpl | null = null
let postingUseCases: PostingUseCasesImpl | null = null
let queueSettingsRepository: QueueSettingsRepositoryImpl | null = null

const AUTO_POSTING_ALARM_NAME = 'auto_posting_queue'

/**
 * Migrate queue settings from localStorage to chrome.storage.sync
 * This ensures compatibility for users who had settings saved in localStorage
 */
async function migrateQueueSettings(): Promise<void> {
  try {
    // Check if we already have settings in chrome.storage.sync
    const existingSettings = await chrome.storage.sync.get('queueSettings')
    
    if (existingSettings.queueSettings) {
      console.log('📦 Queue settings already exist in chrome.storage.sync, skipping migration')
      return
    }

    // Try to get settings from localStorage (this only works in content scripts, not service worker)
    // But we can check if there are any settings to migrate by looking at tabs
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (tabs.length > 0) {
      try {
        // Execute script to check for localStorage settings
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id! },
          func: () => {
            const stored = localStorage.getItem('queueSettings')
            return stored ? JSON.parse(stored) : null
          }
        })
        
        if (results[0]?.result) {
          console.log('📦 Migrating queue settings from localStorage to chrome.storage.sync...')
          await chrome.storage.sync.set({ queueSettings: results[0].result })
          console.log('✅ Migration completed successfully')
        }
      } catch (migrationError) {
        console.log('📦 No localStorage settings found to migrate (this is normal for new installations)')
      }
    }
  } catch (error) {
    console.error('❌ Error during settings migration:', error)
  }
}

/**
 * Initialize auto-posting services
 */
function initAutoPostingServices() {
  if (!postingRepository) {
    postingRepository = new PostingRepositoryImpl()
  }
  if (!postingUseCases) {
    postingUseCases = new PostingUseCasesImpl(postingRepository)
  }
  if (!queueSettingsRepository) {
    // Simple storage proxy implementation for service worker
    const storageProxy = {
      getItemByDefaults: async <T extends Partial<QueueSettings>>(defaults: T): Promise<T> => {
        try {
          const result = await chrome.storage.sync.get('queueSettings')
          return result.queueSettings ? { ...defaults, ...result.queueSettings } : defaults
        } catch (error) {
          console.error('Error getting queue settings:', error)
          return defaults
        }
      },
      setItem: async (item: Partial<QueueSettings>) => {
        try {
          const current = await chrome.storage.sync.get('queueSettings')
          const updated = { ...(current.queueSettings || {}), ...item }
          await chrome.storage.sync.set({ queueSettings: updated })
        } catch (error) {
          console.error('Error setting queue settings:', error)
        }
      },
      getItemByKey: async (key: string) => {
        try {
          const result = await chrome.storage.sync.get(key)
          return result[key]
        } catch (error) {
          console.error('Error getting item by key:', error)
          return undefined
        }
      },
      removeItem: async (keys: keyof QueueSettings | (keyof QueueSettings)[]) => {
        try {
          if (Array.isArray(keys)) {
            await chrome.storage.sync.remove(keys.map(k => k as string))
          } else {
            await chrome.storage.sync.remove(keys as string)
          }
        } catch (error) {
          console.error('Error removing item:', error)
        }
      }
    }
    queueSettingsRepository = new QueueSettingsRepositoryImpl(storageProxy, postingRepository)
  }
  return { postingRepository, postingUseCases, queueSettingsRepository }
}

/**
 * Start auto-posting system
 */
export async function startAutoPosting(): Promise<void> {
  try {
    console.log('🚀 Starting auto-posting system...')
    
    // Migrate settings from localStorage if needed
    await migrateQueueSettings()
    
    // Debug: Check what's actually in storage
    const allStorageData = await chrome.storage.sync.get(null)
    console.log('🔍 All chrome.storage.sync data:', JSON.stringify(allStorageData, null, 2))
    
    const { queueSettingsRepository } = initAutoPostingServices()
    const settings = await queueSettingsRepository.getSettings()
    
    console.log('⚙️ Auto-posting settings loaded:', JSON.stringify({
      autoPostingEnabled: settings.autoPostingEnabled,
      postingIntervalMinutes: settings.postingIntervalMinutes,
      allowedTimeRange: settings.allowedTimeRange,
      allowedDays: settings.allowedDays,
      maxPostsPerDay: settings.maxPostsPerDay,
      pauseWhenLow: settings.pauseWhenLow,
      minQueueSize: settings.minQueueSize
    }, null, 2))
    
    if (!settings.autoPostingEnabled) {
      console.log('❌ Auto-posting is disabled')
      console.log('💡 To enable: Go to Queue Settings in the extension and toggle on "Enable Auto-posting"')
      // Clear stored next post time since auto-posting is disabled
      try {
        await chrome.storage.sync.remove('nextAutoPostTime')
        console.log('🧹 Cleared stored next post time')
      } catch (error) {
        console.error('Error clearing stored next post time:', error)
      }
      return
    }
    
    // Clear existing alarm
    console.log('🧹 Clearing existing alarm...')
    const cleared = await chrome.alarms.clear(AUTO_POSTING_ALARM_NAME)
    console.log(`🧹 Alarm cleared: ${cleared}`)
    
    // Calculate next posting time
    console.log('📊 Calculating next post time...')
    const nextPostTime = await calculateNextPostTime(settings)
    
    if (nextPostTime) {
      const now = new Date()
      const timeUntilNext = nextPostTime.getTime() - now.getTime()
      
      console.log(`⏰ Next post time calculated: ${nextPostTime.toLocaleString()}`)
      console.log(`⏰ Time until next post: ${Math.round(timeUntilNext / 60000)} minutes`)
      
      // Store the scheduled time in storage for UI display (prevents recalculation with fresh randomization)
      try {
        await chrome.storage.sync.set({ 
          nextAutoPostTime: nextPostTime.getTime()
        })
        console.log('💾 Stored next post time in storage for UI display')
      } catch (error) {
        console.error('Error storing next post time:', error)
      }
      
      // Create alarm for next post
      await chrome.alarms.create(AUTO_POSTING_ALARM_NAME, {
        when: nextPostTime.getTime()
      })
      
      console.log(`✅ Auto-posting alarm created for: ${nextPostTime.toLocaleString()}`)
      
      // Verify alarm was created
      const allAlarms = await chrome.alarms.getAll()
      const ourAlarm = allAlarms.find(a => a.name === AUTO_POSTING_ALARM_NAME)
      if (ourAlarm) {
        console.log('✅ Alarm verification successful:', ourAlarm)
      } else {
        console.log('❌ Alarm verification failed - alarm not found in list')
      }
    } else {
      console.log('❌ No valid next post time calculated')
    }
    
  } catch (error) {
    console.error('❌ Error starting auto-posting:', error)
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '')
  }
}

/**
 * Stop auto-posting system
 */
export async function stopAutoPosting(): Promise<void> {
  try {
    await chrome.alarms.clear(AUTO_POSTING_ALARM_NAME)
    console.log('Auto-posting stopped')
  } catch (error) {
    console.error('Error stopping auto-posting:', error)
  }
}

/**
 * Handle auto-posting alarm
 */
export async function handleAutoPostingAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== AUTO_POSTING_ALARM_NAME) {
    console.log('🚫 Ignoring alarm - not auto-posting alarm:', alarm.name)
    return
  }
  
  console.log('🔔 Auto-posting alarm triggered at:', new Date().toISOString())
  console.log('🔔 Alarm details:', alarm)
  
  // Clear the stored next post time since this alarm has now fired
  try {
    await chrome.storage.sync.remove('nextAutoPostTime')
    console.log('🧹 Cleared stored next post time (alarm fired)')
  } catch (error) {
    console.error('Error clearing stored next post time:', error)
  }
  
  try {
    const { postingRepository, postingUseCases, queueSettingsRepository } = initAutoPostingServices()
    const settings = await queueSettingsRepository.getSettings()
    
    console.log('⚙️ Auto-posting settings:', {
      autoPostingEnabled: settings.autoPostingEnabled,
      postingIntervalMinutes: settings.postingIntervalMinutes,
      allowedTimeRange: settings.allowedTimeRange,
      allowedDays: settings.allowedDays,
      maxPostsPerDay: settings.maxPostsPerDay,
      pauseWhenLow: settings.pauseWhenLow,
      minQueueSize: settings.minQueueSize
    })
    
    if (!settings.autoPostingEnabled) {
      console.log('❌ Auto-posting is disabled, skipping')
      return
    }
    
    // Check if we should post now
    const shouldPost = await shouldPostNow(settings)
    
    console.log('🤔 Should post now?', shouldPost)
    
    if (!shouldPost) {
      console.log('❌ Conditions not met for auto-posting, rescheduling')
      await rescheduleAutoPosting(settings)
      return
    }
    
    // Get next post from queue
    const queuedPosts = await postingUseCases.getQueuedPosts()
    const pendingPosts = queuedPosts.filter(post => post.status === 'pending' && !post.scheduleTime)
    
    console.log('📋 Queue status:', {
      totalPosts: queuedPosts.length,
      pendingPosts: pendingPosts.length,
      postStatuses: queuedPosts.map(p => ({ id: p.id, status: p.status, hasScheduleTime: !!p.scheduleTime }))
    })
    
    const nextPost = pendingPosts[0]
    
    if (!nextPost) {
      console.log('❌ No posts in queue for auto-posting')
      await rescheduleAutoPosting(settings)
      return
    }
    
    // Post the content
    console.log(`📤 Auto-posting: ${nextPost.text?.substring(0, 50)}...`)
    console.log('📤 Post details:', {
      id: nextPost.id,
      hasText: !!nextPost.text,
      hasMediaFile: !!nextPost.mediaFile,
      hasTextFile: !!nextPost.textFile,
      status: nextPost.status
    })
    
    try {
      // Serialize media file if present (required for Chrome message passing)
      let serializedMediaFile = undefined
      if (nextPost.mediaFile) {
        console.log('📁 Serializing media file for auto-posting:', {
          name: nextPost.mediaFile.name,
          type: nextPost.mediaFile.type,
          size: nextPost.mediaFile.size
        })
        
        const arrayBuffer = await nextPost.mediaFile.arrayBuffer()
        serializedMediaFile = {
          data: Array.from(new Uint8Array(arrayBuffer)),
          name: nextPost.mediaFile.name,
          type: nextPost.mediaFile.type,
          size: nextPost.mediaFile.size
        }
        
        console.log('✅ Media file serialized successfully for auto-posting')
      }
      
      // Post to the appropriate platform
      if (nextPost.platform === 'tiktok') {
        await postingUseCases.sendPostToTikTok({
          text: nextPost.text,
          caption: nextPost.caption,
          hashtags: nextPost.hashtags,
          privacy: nextPost.privacy,
          mediaFile: serializedMediaFile,
          textFile: nextPost.textFile,
        })
      } else {
      await postingUseCases.sendPostToTwitter({
        text: nextPost.text,
        mediaFile: serializedMediaFile,
        textFile: nextPost.textFile,
      })
      }
      
      console.log('✅ Auto-post successful')
      
      // Update the original post's status to 'posted' so it doesn't get reprocessed
      await postingRepository.updatePost(nextPost.id, { status: 'posted' })
      console.log('✅ Original post status updated to "posted"')
      
      // Show success notification
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon@128.png',
        title: 'Auto-post Successful',
        message: `Posted: ${nextPost.text?.substring(0, 50)}${nextPost.text && nextPost.text.length > 50 ? '...' : ''}`,
      })
      
    } catch (error) {
      console.error('❌ Error auto-posting:', error)
      
      // Update the original post's status to 'failed' so we can track failures
      await postingRepository.updatePost(nextPost.id, { status: 'failed' })
      console.log('⚠️ Original post status updated to "failed"')

      // Show error notification
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon@128.png',
        title: 'Auto-post Failed',
        message: 'Failed to post content automatically. Please check your queue.',
      })
    }
    
    // Schedule next post
    await rescheduleAutoPosting(settings)
    
  } catch (error) {
    console.error('❌ Error in auto-posting alarm handler:', error)
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '')
  }
}

/**
 * Calculate next posting time based on settings
 */
async function calculateNextPostTime(settings: QueueSettings): Promise<Date | null> {
  try {
    const { queueSettingsRepository } = initAutoPostingServices()
    const statistics = await queueSettingsRepository.getStatistics()
    
    return queueSettingsRepository.calculateNextPostTime(settings, statistics.postsPostedToday)
  } catch (error) {
    console.error('Error calculating next post time:', error)
    return null
  }
}

/**
 * Check if we should post now based on settings
 */
async function shouldPostNow(settings: QueueSettings): Promise<boolean> {
  const now = new Date()
  console.log('🕐 Checking if should post now at:', now.toISOString())
  
  // Check if current day is allowed
  const currentDay = now.getDay()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  console.log(`📅 Current day: ${dayNames[currentDay]} (${currentDay})`)
  console.log(`📅 Allowed days: ${settings.allowedDays.map(d => dayNames[d]).join(', ')} (${settings.allowedDays.join(', ')})`)
  
  if (!settings.allowedDays.includes(currentDay)) {
    console.log(`❌ Current day (${currentDay}) not in allowed days:`, settings.allowedDays)
    return false
  }
  console.log('✅ Current day is allowed')
  
  // Check if current time is in allowed range
  const currentHour = now.getHours()
  console.log(`🕐 Current hour: ${currentHour}`)
  console.log(`🕐 Allowed time range: ${settings.allowedTimeRange.startHour}-${settings.allowedTimeRange.endHour}`)
  
  if (currentHour < settings.allowedTimeRange.startHour || currentHour >= settings.allowedTimeRange.endHour) {
    console.log(`❌ Current hour (${currentHour}) not in allowed range: ${settings.allowedTimeRange.startHour}-${settings.allowedTimeRange.endHour}`)
    return false
  }
  console.log('✅ Current hour is within allowed range')
  
  // Check daily post limit
  try {
    const { queueSettingsRepository } = initAutoPostingServices()
    const statistics = await queueSettingsRepository.getStatistics()
    
    console.log(`📊 Daily posts: ${statistics.postsPostedToday}/${settings.maxPostsPerDay}`)
    
    if (statistics.postsPostedToday >= settings.maxPostsPerDay) {
      console.log(`❌ Daily limit reached: ${statistics.postsPostedToday}/${settings.maxPostsPerDay}`)
      return false
    }
    console.log('✅ Daily post limit not reached')
  } catch (error) {
    console.error('❌ Error checking daily post limit:', error)
    return false
  }
  
  // Check minimum queue size
  if (settings.pauseWhenLow) {
    try {
      const { postingUseCases } = initAutoPostingServices()
      const queuedPosts = await postingUseCases.getQueuedPosts()
      const availablePosts = queuedPosts.filter(post => post.status === 'pending' && !post.scheduleTime)
      
      console.log(`📋 Queue size check: ${availablePosts.length}/${settings.minQueueSize} (pauseWhenLow: ${settings.pauseWhenLow})`)
      
      if (availablePosts.length < settings.minQueueSize) {
        console.log(`❌ Queue too small: ${availablePosts.length}/${settings.minQueueSize}`)
        return false
      }
      console.log('✅ Queue size is sufficient')
    } catch (error) {
      console.error('❌ Error checking queue size:', error)
      return false
    }
  } else {
    console.log('⏭️ Queue size check skipped (pauseWhenLow is false)')
  }
  
  console.log('✅ All conditions met - should post now!')
  return true
}

/**
 * Reschedule auto-posting for the next valid time
 */
async function rescheduleAutoPosting(settings: QueueSettings): Promise<void> {
  try {
    const nextPostTime = await calculateNextPostTime(settings)
    
    if (nextPostTime) {
      // Store the new scheduled time
      try {
        await chrome.storage.sync.set({ 
          nextAutoPostTime: nextPostTime.getTime()
        })
        console.log('💾 Stored rescheduled post time in storage')
      } catch (error) {
        console.error('Error storing rescheduled post time:', error)
      }
      
      await chrome.alarms.create(AUTO_POSTING_ALARM_NAME, {
        when: nextPostTime.getTime()
      })
      
      console.log(`Auto-posting rescheduled for: ${nextPostTime.toLocaleString()}`)
    } else {
      console.log('Could not reschedule auto-posting')
    }
  } catch (error) {
    console.error('Error rescheduling auto-posting:', error)
  }
}

/**
 * Update auto-posting schedule when settings change
 */
export async function updateAutoPostingSchedule(settings: QueueSettings): Promise<void> {
  if (settings.autoPostingEnabled) {
    await startAutoPosting()
  } else {
    await stopAutoPosting()
  }
} 

/**
 * Manually enable auto-posting for testing
 * Run this in the browser console: chrome.runtime.getBackgroundPage().then(bg => bg.enableAutoPostingForTesting())
 */
export async function enableAutoPostingForTesting(): Promise<void> {
  try {
    console.log('🔧 Manually enabling auto-posting for testing...')
    
    // Default settings that should work
    const testSettings = {
      autoPostingEnabled: true,
      postingIntervalMinutes: 60,
      allowedTimeRange: { startHour: 9, endHour: 21 },
      allowedDays: [0, 1, 2, 3, 4, 5, 6], // All days
      maxPostsPerDay: 10,
      pauseWhenLow: false,
      minQueueSize: 1
    }
    
    // Save directly to chrome.storage.sync
    await chrome.storage.sync.set({ queueSettings: testSettings })
    console.log('✅ Auto-posting settings saved to chrome.storage.sync')
    
    // Try to start auto-posting
    await startAutoPosting()
    console.log('✅ Auto-posting system restarted')
    
  } catch (error) {
    console.error('❌ Error enabling auto-posting:', error)
  }
}

/**
 * Diagnostic function to help debug auto-posting issues
 * Run this in the browser console: chrome.runtime.getBackgroundPage().then(bg => bg.debugAutoPosting())
 */
export async function debugAutoPosting(): Promise<void> {
  try {
    console.log('🔍 === AUTO-POSTING DIAGNOSTIC ===')
    
    // Check storage
    const allStorageData = await chrome.storage.sync.get(null)
    console.log('💾 Chrome storage data:', allStorageData)
    
    const { postingUseCases, queueSettingsRepository } = initAutoPostingServices()
    const settings = await queueSettingsRepository.getSettings()
    const statistics = await queueSettingsRepository.getStatistics()
    const queuedPosts = await postingUseCases.getQueuedPosts()
    
    console.log('📊 Current Statistics:', statistics)
    console.log('⚙️ Current Settings:', settings)
    
    if (!settings.autoPostingEnabled) {
      console.log('❌ AUTO-POSTING IS DISABLED')
      console.log('💡 SOLUTION: Go to extension popup → Queue Settings tab → Enable "Auto-posting from queue"')
      console.log('📝 This will save the setting to chrome.storage.sync where the service worker can read it')
    }
    
    console.log('📋 Queue Details:', {
      totalPosts: queuedPosts.length,
      postBreakdown: queuedPosts.map(p => ({
        id: p.id,
        status: p.status,
        hasScheduleTime: !!p.scheduleTime,
        createdAt: p.createdAt,
        text: p.text?.substring(0, 30) + '...'
      }))
    })
    
    const pendingPosts = queuedPosts.filter(post => post.status === 'pending' && !post.scheduleTime)
    console.log('📋 Pending Posts (eligible for auto-posting):', pendingPosts.length)
    
    // Check current conditions
    const shouldPost = await shouldPostNow(settings)
    console.log('✅ Should post now?', shouldPost)
    
    // Check alarms
    const allAlarms = await chrome.alarms.getAll()
    const autoPostingAlarm = allAlarms.find(a => a.name === AUTO_POSTING_ALARM_NAME)
    console.log('⏰ Auto-posting alarm:', autoPostingAlarm)
    console.log('⏰ All alarms:', allAlarms)
    
    // Calculate next post time
    const nextPostTime = await calculateNextPostTime(settings)
    console.log('🕐 Next calculated post time:', nextPostTime)
    
    console.log('🔍 === END DIAGNOSTIC ===')
    
  } catch (error) {
    console.error('❌ Error in diagnostic:', error)
  }
}

// Make diagnostic function available globally in service worker
if (typeof globalThis !== 'undefined') {
  (globalThis as any).debugAutoPosting = debugAutoPosting
} 