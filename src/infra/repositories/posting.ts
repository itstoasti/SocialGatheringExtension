/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { PostData, PostingRepository } from '#domain/repositories/posting'

const DB_NAME = 'SocialGathering_Posting'
const DB_VERSION = 1
const STORE_NAME = 'posts'

export class PostingRepositoryImpl implements PostingRepository {
  private db: IDBDatabase | null = null

  /**
   * Initialize the database connection
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open database'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('scheduleTime', 'scheduleTime', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  /**
   * Helper method to perform transactions
   */
  private async performTransaction<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.initDB()
    const transaction = db.transaction([STORE_NAME], mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = callback(store)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Save a post to the queue
   */
  async savePost(post: Omit<PostData, 'id' | 'createdAt' | 'updatedAt'>): Promise<PostData> {
    const now = new Date()
    const newPost: PostData = {
      ...post,
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    }

    console.log('💾 Saving post to database:', {
      id: newPost.id,
      text: newPost.text?.substring(0, 50) + '...',
      hasMedia: !!newPost.mediaFile,
      status: newPost.status
    })

    await this.performTransaction('readwrite', (store) => store.add(newPost))
    
    console.log('✅ Post saved to database successfully:', newPost.id)
    return newPost
  }

  /**
   * Get all posts
   */
  async getAllPosts(): Promise<PostData[]> {
    return this.performTransaction('readonly', (store) => store.getAll())
  }

  /**
   * Get posts by status
   */
  async getPostsByStatus(status: PostData['status']): Promise<PostData[]> {
    return this.performTransaction('readonly', (store) => {
      const index = store.index('status')
      return index.getAll(status)
    })
  }

  /**
   * Get scheduled posts due for posting
   */
  async getScheduledPostsDue(): Promise<PostData[]> {
    const now = new Date().toISOString()
    const db = await this.initDB()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('scheduleTime')
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor()
      const results: PostData[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const post = cursor.value as PostData
          if (post.scheduleTime && post.scheduleTime <= now && post.status === 'pending') {
            results.push(post)
          }
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Update a post
   */
  async updatePost(id: string, updates: Partial<PostData>): Promise<PostData> {
    const db = await this.initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id)
      
      getRequest.onsuccess = () => {
        const existingPost = getRequest.result as PostData
        if (!existingPost) {
          reject(new Error('Post not found'))
          return
        }

        const updatedPost: PostData = {
          ...existingPost,
          ...updates,
          updatedAt: new Date(),
        }

        const putRequest = store.put(updatedPost)
        putRequest.onsuccess = () => resolve(updatedPost)
        putRequest.onerror = () => reject(putRequest.error)
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Delete a post
   */
  async deletePost(id: string): Promise<void> {
    await this.performTransaction('readwrite', (store) => store.delete(id))
  }

  /**
   * Clear all posts
   */
  async clearAllPosts(): Promise<void> {
    await this.performTransaction('readwrite', (store) => store.clear())
  }
}

export default PostingRepositoryImpl 