/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { ValueObject } from './base'
import type { TweetUser } from './tweetUser'

export type TweetTextFileProps = {
  tweetId: string
  tweetUser: TweetUser
  createdAt: Date
  content: string
  hashtags: string[]
}

export class TweetTextFile extends ValueObject<TweetTextFileProps> {
  get content() {
    return this.props.content
  }

  get tweetId() {
    return this.props.tweetId
  }

  get tweetUser() {
    return this.props.tweetUser
  }

  get createdAt() {
    return this.props.createdAt
  }

  get hashtags() {
    return this.props.hashtags
  }

  get ext() {
    return '.txt'
  }

  static create(props: TweetTextFileProps) {
    return new TweetTextFile(props)
  }
} 