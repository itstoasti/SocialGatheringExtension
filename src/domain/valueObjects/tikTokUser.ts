/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { ValueObject } from './base'

export type TikTokUserProps = {
  userId: string
  username: string
  displayName: string
  avatarUrl?: string
  followerCount: number
  followingCount: number
  likesCount: number
  isVerified: boolean
  isPrivate: boolean
  bio?: string
}

export class TikTokUser extends ValueObject<TikTokUserProps> {
  get userId() {
    return this.props.userId
  }

  get username() {
    return this.props.username
  }

  get displayName() {
    return this.props.displayName
  }

  get avatarUrl() {
    return this.props.avatarUrl
  }

  get followerCount() {
    return this.props.followerCount
  }

  get followingCount() {
    return this.props.followingCount
  }

  get likesCount() {
    return this.props.likesCount
  }

  get isVerified() {
    return this.props.isVerified
  }

  get isPrivate() {
    return this.props.isPrivate
  }

  get bio() {
    return this.props.bio
  }

  static create(props: TikTokUserProps) {
    return new TikTokUser(props)
  }
} 