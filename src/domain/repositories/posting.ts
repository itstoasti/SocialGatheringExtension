/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export interface PostData {
  id: string
  text: string
  mediaFile?: File
  textFile?: File
  scheduleTime?: string
  status: 'pending' | 'posting' | 'posted' | 'failed'
  createdAt: Date
  updatedAt: Date
  // Platform-specific properties
  platform?: 'twitter' | 'tiktok' | 'threads' | 'facebook'
  // TikTok-specific properties
  caption?: string
  hashtags?: string[]
  privacy?: 'public' | 'friends' | 'private'
  // Posting behavior
  closeTabAfterPost?: boolean
}

export interface PostingRepository {
  /**
   * Save a post to the queue
   */
  savePost(post: Omit<PostData, 'id' | 'createdAt' | 'updatedAt'>): Promise<PostData>
  
  /**
   * Get all posts
   */
  getAllPosts(): Promise<PostData[]>
  
  /**
   * Get posts by status
   */
  getPostsByStatus(status: PostData['status']): Promise<PostData[]>
  
  /**
   * Get scheduled posts due for posting
   */
  getScheduledPostsDue(): Promise<PostData[]>
  
  /**
   * Update a post
   */
  updatePost(id: string, updates: Partial<PostData>): Promise<PostData>
  
  /**
   * Delete a post
   */
  deletePost(id: string): Promise<void>
  
  /**
   * Clear all posts
   */
  clearAllPosts(): Promise<void>
}

export default PostingRepository 