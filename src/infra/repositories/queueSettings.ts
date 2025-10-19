/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { IStorageProxy } from '#libs/storageProxy'
import type { QueueSettings, QueueSettingsRepository, QueueStatistics } from '#domain/repositories/queueSettings'
import type { PostingRepository } from '#domain/repositories/posting'

const defaultQueueSettings: QueueSettings = {
  autoPostingEnabled: false,
  postingIntervalMinutes: 60, // Default: 1 hour between posts
  allowedTimeRange: {
    startHour: 9,  // 9 AM
    endHour: 21    // 9 PM
  },
  allowedDays: [1, 2, 3, 4, 5, 6, 7], // Monday to Sunday (0=Sunday)
  maxPostsPerDay: 10,
  randomizeTimings: true,
  randomRangeMinutes: 15, // +/- 15 minutes
  pauseWhenLow: true,
  minQueueSize: 3
}

export class QueueSettingsRepositoryImpl implements QueueSettingsRepository {
  constructor(
    private readonly storageProxy: IStorageProxy<QueueSettings>,
    private readonly postingRepository: PostingRepository
  ) {}

  async getSettings(): Promise<QueueSettings> {
    return await this.storageProxy.getItemByDefaults(defaultQueueSettings)
  }

  async saveSettings(settings: Partial<QueueSettings>): Promise<void> {
    await this.storageProxy.setItem(settings)
  }

  async resetSettings(): Promise<void> {
    await this.saveSettings(defaultQueueSettings)
  }

  async getStatistics(): Promise<QueueStatistics> {
    const settings = await this.getSettings()
    const allPosts = await this.postingRepository.getAllPosts()
    
    // Count posts in queue (pending status, no schedule time)
    const queuedPosts = allPosts.filter(post => 
      post.status === 'pending' && !post.scheduleTime
    )
    
    // Count posts posted today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const postsPostedToday = allPosts.filter(post => {
      if (post.status !== 'posted') return false
      const postDate = new Date(post.updatedAt)
      return postDate >= today && postDate < tomorrow
    }).length

    // Get the stored scheduled time to avoid recalculating with fresh randomization
    let nextPostTime: Date | undefined
    let timeUntilNextPost: number | undefined
    
    if (settings.autoPostingEnabled && queuedPosts.length > 0) {
      try {
        // First try to get the stored scheduled time
        const storage = await chrome.storage.sync.get('nextAutoPostTime')
        if (storage.nextAutoPostTime) {
          const storedTime = new Date(storage.nextAutoPostTime)
          // Only use stored time if it's in the future
          if (storedTime.getTime() > Date.now()) {
            nextPostTime = storedTime
            timeUntilNextPost = storedTime.getTime() - Date.now()
            console.log('📅 Using stored scheduled time:', nextPostTime.toLocaleString())
          } else {
            console.log('📅 Stored time is in the past, will need recalculation')
          }
        }
        
        // If no valid stored time, calculate fresh (this should rarely happen in normal operation)
        if (!nextPostTime) {
          console.log('📅 No valid stored time found, calculating next time...')
          const nextTime = this.calculateNextPostTime(settings, postsPostedToday)
          if (nextTime) {
            nextPostTime = nextTime
            timeUntilNextPost = nextTime.getTime() - Date.now()
          }
        }
      } catch (error) {
        console.error('Error getting stored next post time:', error)
        // Fallback to calculation
        const nextTime = this.calculateNextPostTime(settings, postsPostedToday)
        if (nextTime) {
          nextPostTime = nextTime
          timeUntilNextPost = nextTime.getTime() - Date.now()
        }
      }
    }

    return {
      totalPostsInQueue: queuedPosts.length,
      postsPostedToday,
      nextPostTime,
      autoPostingActive: settings.autoPostingEnabled && queuedPosts.length > 0,
      timeUntilNextPost
    }
  }

  /**
   * Calculate next posting time based on settings and current posts today
   * Note: This applies randomization, so should only be called when actually scheduling
   */
  calculateNextPostTime(settings: QueueSettings, postsToday: number): Date | null {
    const now = new Date()
    console.log('⏰ calculateNextPostTime - Current time:', now.toLocaleString())
    console.log('⏰ calculateNextPostTime - Posts today:', postsToday, '/', settings.maxPostsPerDay)
    
    // Check if we've hit daily limit
    if (postsToday >= settings.maxPostsPerDay) {
      // Next post tomorrow at start of allowed time
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
      console.log('⏰ Daily limit reached, scheduling for tomorrow:', tomorrow.toLocaleString())
      return tomorrow
    }
    
    // Check if current day is allowed
    const currentDay = now.getDay()
    console.log('⏰ Current day:', currentDay, 'Allowed days:', settings.allowedDays)
    if (!settings.allowedDays.includes(currentDay)) {
      // Find next allowed day
      console.log('⏰ Current day not allowed, finding next allowed day')
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(now)
        checkDate.setDate(checkDate.getDate() + i)
        if (settings.allowedDays.includes(checkDate.getDay())) {
          checkDate.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
          console.log('⏰ Next allowed day found:', checkDate.toLocaleString())
          return checkDate
        }
      }
      console.log('⏰ No allowed day found in next 7 days')
      return null
    }
    
    // Check if we're in allowed time range
    const currentHour = now.getHours()
    let nextPostTime = new Date(now)
    
    console.log('⏰ Current hour:', currentHour, 'Allowed range:', settings.allowedTimeRange.startHour, '-', settings.allowedTimeRange.endHour)
    
    if (currentHour < settings.allowedTimeRange.startHour) {
      // Before allowed time - schedule for start of allowed time
      nextPostTime.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
      console.log('⏰ Before allowed time, scheduling for start of range:', nextPostTime.toLocaleString())
    } else if (currentHour >= settings.allowedTimeRange.endHour) {
      // After allowed time - schedule for tomorrow
      nextPostTime.setDate(nextPostTime.getDate() + 1)
      nextPostTime.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
      console.log('⏰ After allowed time, scheduling for tomorrow:', nextPostTime.toLocaleString())
    } else {
      // In allowed time - add interval
      nextPostTime = new Date(now.getTime() + (settings.postingIntervalMinutes * 60 * 1000))
      console.log('⏰ In allowed time, adding interval:', nextPostTime.toLocaleString())
      
      // Check if next time exceeds allowed range
      if (nextPostTime.getHours() >= settings.allowedTimeRange.endHour) {
        // Schedule for tomorrow
        nextPostTime.setDate(nextPostTime.getDate() + 1)
        nextPostTime.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
        console.log('⏰ Next time exceeds allowed range, scheduling for tomorrow:', nextPostTime.toLocaleString())
      }
    }
    
    // Apply randomization if enabled
    if (settings.randomizeTimings && settings.randomRangeMinutes > 0) {
      const randomOffset = (Math.random() - 0.5) * 2 * settings.randomRangeMinutes * 60 * 1000
      console.log('⏰ Applying randomization:', Math.round(randomOffset / 60000), 'minutes to base time:', nextPostTime.toLocaleString())
      nextPostTime = new Date(nextPostTime.getTime() + randomOffset)
      
      // Ensure it's still within allowed time range
      const hour = nextPostTime.getHours()
      if (hour < settings.allowedTimeRange.startHour) {
        console.log('⏰ Randomization pushed time before start hour, adjusting to start hour')
        nextPostTime.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
      } else if (hour >= settings.allowedTimeRange.endHour) {
        console.log('⏰ Randomization pushed time after end hour, adjusting to end hour')
        nextPostTime.setHours(settings.allowedTimeRange.endHour - 1, 59, 59, 999)
      }
    }
    
    // CRITICAL FIX: Ensure the calculated time is always in the future
    const currentTime = new Date()
    console.log('⏰ Final time check - Current:', currentTime.toLocaleString())
    console.log('⏰ Final time check - Calculated:', nextPostTime.toLocaleString())
    if (nextPostTime <= currentTime) {
      console.log('⚠️ Calculated time is in the past, adjusting to future')
      nextPostTime = new Date(currentTime.getTime() + (settings.postingIntervalMinutes * 60 * 1000))
      console.log('⏰ Adjusted time:', nextPostTime.toLocaleString())
      
      // Check if the adjusted time exceeds allowed range
      if (nextPostTime.getHours() >= settings.allowedTimeRange.endHour) {
        // Schedule for next day
        nextPostTime.setDate(nextPostTime.getDate() + 1)
        nextPostTime.setHours(settings.allowedTimeRange.startHour, 0, 0, 0)
        console.log('⏰ Adjusted time exceeds range, scheduling for tomorrow:', nextPostTime.toLocaleString())
      }
    }
    
    console.log('⏰ Final calculated time:', nextPostTime.toLocaleString())
    return nextPostTime
  }
} 