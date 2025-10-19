/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { ValueObject } from './base'

export type TikTokPostInfoProps = {
  postId: string
  username: string
}

export class TikTokPostInfo extends ValueObject<TikTokPostInfoProps> {
  get postId() {
    return this.props.postId
  }

  get username() {
    return this.props.username
  }

  static create(props: TikTokPostInfoProps) {
    return new TikTokPostInfo(props)
  }
} 