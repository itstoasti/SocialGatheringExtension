/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { ValueObject } from './base'
import type { TikTokUser } from './tikTokUser'

export type TikTokPostProps = {
  id: string
  createdAt: Date
  caption: string
  hashtags: string[]
  videoUrl: string
  thumbnailUrl?: string
  user: TikTokUser
  privacy: 'public' | 'friends' | 'private'
  likes: number
  comments: number
  shares: number
  duration: number // in seconds
}

export class TikTokPost extends ValueObject<TikTokPostProps> {
  get id() {
    return this.props.id
  }

  get caption() {
    return this.props.caption
  }

  get hashtags() {
    return this.props.hashtags
  }

  get videoUrl() {
    return this.props.videoUrl
  }

  get thumbnailUrl() {
    return this.props.thumbnailUrl
  }

  get user() {
    return this.props.user
  }

  get privacy() {
    return this.props.privacy
  }

  get isPrivate() {
    return this.props.privacy === 'private'
  }

  get createdAt() {
    return this.props.createdAt
  }

  get likes() {
    return this.props.likes
  }

  get comments() {
    return this.props.comments
  }

  get shares() {
    return this.props.shares
  }

  get duration() {
    return this.props.duration
  }

  static create(props: TikTokPostProps) {
    return new TikTokPost(props)
  }
} 