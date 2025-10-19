/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import type { Tweet } from '#domain/valueObjects/tweet'
import { TweetTextFile } from '#domain/valueObjects/tweetTextFile'
import type { Factory } from './base'

/**
 * Remove URLs from tweet text
 */
const removeUrlsFromText = (text: string): string => {
  // Remove various URL patterns commonly found in tweets
  return text
    .replace(/https?:\/\/t\.co\/[a-zA-Z0-9]+/g, '') // Remove t.co URLs
    .replace(/https?:\/\/[^\s]+/g, '') // Remove other HTTP URLs
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing whitespace
}

export const tweetToTweetTextFile = (
  tweet: Tweet,
  tweetContent?: string
): TweetTextFile => {
  const { id: tweetId, createdAt, hashtags } = tweet.mapBy(props => ({
    id: props.id,
    createdAt: props.createdAt,
    hashtags: props.hashtags,
  }))

  // Use provided content if available, otherwise create a fallback
  let content = tweetContent || 
    (hashtags.length > 0 
      ? `Tweet with hashtags: ${hashtags.map(h => '#' + h).join(' ')}` 
      : 'Tweet content (no text available - downloaded from API without full content)')

  // Remove URLs from the content if it's actual tweet content
  if (tweetContent) {
    content = removeUrlsFromText(content)
  }

  return new TweetTextFile({
    tweetId: tweetId,
    createdAt: createdAt,
    tweetUser: tweet.user,
    content: content,
    hashtags: hashtags,
  })
} 