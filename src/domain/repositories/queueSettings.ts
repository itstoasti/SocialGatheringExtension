/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export interface QueueSettings {
  /**
   * Whether auto-posting from queue is enabled
   */
  autoPostingEnabled: boolean
  
  /**
   * Interval between posts in minutes
   */
  postingIntervalMinutes: number
  
  /**
   * Time range when auto-posting is allowed
   */
  allowedTimeRange: {
    startHour: number // 0-23
    endHour: number   // 0-23
  }
  
  /**
   * Days of week when auto-posting is allowed (0=Sunday, 6=Saturday)
   */
  allowedDays: number[]
  
  /**
   * Maximum number of posts per day
   */
  maxPostsPerDay: number
  
  /**
   * Whether to randomize posting times within the interval
   */
  randomizeTimings: boolean
  
  /**
   * Randomization range in minutes (+/- from scheduled time)
   */
  randomRangeMinutes: number
  
  /**
   * Whether to pause auto-posting when queue is low
   */
  pauseWhenLow: boolean
  
  /**
   * Minimum queue size before pausing
   */
  minQueueSize: number
}

export interface QueueStatistics {
  totalPostsInQueue: number
  postsPostedToday: number
  nextPostTime?: Date
  autoPostingActive: boolean
  timeUntilNextPost?: number // milliseconds
}

export interface QueueSettingsRepository {
  /**
   * Get queue settings
   */
  getSettings(): Promise<QueueSettings>
  
  /**
   * Save queue settings
   */
  saveSettings(settings: Partial<QueueSettings>): Promise<void>
  
  /**
   * Reset settings to default
   */
  resetSettings(): Promise<void>
  
  /**
   * Get queue statistics
   */
  getStatistics(): Promise<QueueStatistics>
} 