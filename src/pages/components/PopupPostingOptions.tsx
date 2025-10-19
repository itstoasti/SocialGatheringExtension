/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Select,
  Card,
  CardHeader,
  CardBody,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
  Checkbox,
} from '@chakra-ui/react'
import { getText as i18n } from '#libs/i18n'
import { tabs } from 'webextension-polyfill'
import { PostingUseCasesImpl } from '#domain/useCases/posting'
import { PostingRepositoryImpl } from '#infra/repositories/posting'
import { QueueSettingsRepositoryImpl } from '#infra/repositories/queueSettings'
import { EnhancedBatchUpload } from './EnhancedBatchUpload'
import { QueueSettings } from './QueueSettings'
import type { PostData } from '#domain/repositories/posting'
import type { QueueSettings as QueueSettingsType } from '#domain/repositories/queueSettings'

interface PostForm {
  text: string
  mediaFile?: File
  textFile?: File
  scheduleTime?: string
  // Platform selection
  platform: 'twitter' | 'tiktok' | 'threads'
  // TikTok-specific fields
  caption?: string
  hashtags?: string[]
  privacy?: 'public' | 'friends' | 'private'
}

const PopupPostingOptions: React.FC = () => {
  const [postData, setPostData] = useState<PostForm>({
    text: '',
    mediaFile: undefined,
    textFile: undefined,
    scheduleTime: undefined,
    platform: 'twitter',
    caption: '',
    hashtags: [],
    privacy: 'public',
  })
  const [isPosting, setIsPosting] = useState(false)
  const [queuedPosts, setQueuedPosts] = useState<PostData[]>([])
  const [enableScheduling, setEnableScheduling] = useState(false)
  const toast = useToast()

  const mediaInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  // Initialize services
  const [postingRepository] = useState(() => new PostingRepositoryImpl())
  const [postingUseCases] = useState(() => new PostingUseCasesImpl(postingRepository))
  const [queueSettingsRepository] = useState(() => new QueueSettingsRepositoryImpl(
    // Use chrome.storage.sync to match service worker implementation
    {
      getItemByDefaults: async <T extends Partial<QueueSettingsType>>(defaults: T): Promise<T> => {
        try {
          const result = await chrome.storage.sync.get('queueSettings')
          return result.queueSettings ? { ...defaults, ...result.queueSettings } : defaults
        } catch (error) {
          console.error('Error getting queue settings:', error)
          return defaults
        }
      },
      setItem: async (item: Partial<QueueSettingsType>) => {
        try {
          console.log('💾 PopupPostingOptions: Saving settings to chrome.storage.sync:', item)
          const current = await chrome.storage.sync.get('queueSettings')
          const updated = { ...(current.queueSettings || {}), ...item }
          await chrome.storage.sync.set({ queueSettings: updated })
          console.log('✅ PopupPostingOptions: Settings saved successfully:', updated)
        } catch (error) {
          console.error('❌ PopupPostingOptions: Error setting queue settings:', error)
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
      removeItem: async (keys: keyof QueueSettingsType | (keyof QueueSettingsType)[]) => {
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
    },
    postingRepository
  ))

  // Load queued posts on mount
  useEffect(() => {
    loadQueuedPosts()
  }, [])

  const loadQueuedPosts = useCallback(async () => {
    try {
      console.log('🔄 Loading queued posts...')
      const posts = await postingUseCases.getQueuedPosts()
      console.log('📋 Loaded posts:', posts.length, 'posts')
      console.log('📋 Posts details:', posts.map(p => ({ id: p.id, text: p.text?.substring(0, 50) + '...', hasMedia: !!p.mediaFile })))
      setQueuedPosts(posts)
    } catch (error) {
      console.error('Error loading queued posts:', error)
    }
  }, [postingUseCases])

  const handlePostNow = async () => {
    // Validation based on platform
    if (postData.platform === 'tiktok') {
      if (!postData.mediaFile) {
        toast({
          title: 'Error',
          description: 'Video file is required for TikTok uploads',
          status: 'error',
          duration: 3000,
        })
        return
      }
    } else {
    if (!postData.mediaFile && !postData.text.trim()) {
      toast({
        title: 'Error',
        description: 'Please add content or select a media file',
        status: 'error',
        duration: 3000,
      })
      return
      }
    }

    setIsPosting(true)
    try {
      console.log('🚀 PopupPostingOptions.handlePostNow called with:', {
        hasText: !!postData.text && postData.text.trim().length > 0,
        hasMediaFile: !!postData.mediaFile,
        hasTextFile: !!postData.textFile,
        textLength: postData.text?.length || 0,
        mediaType: postData.mediaFile?.type || 'none'
      })

      // Convert File to serializable format if present
      let serializedMediaFile = undefined
      if (postData.mediaFile) {
        const arrayBuffer = await postData.mediaFile.arrayBuffer()
        serializedMediaFile = {
          data: Array.from(new Uint8Array(arrayBuffer)),
          name: postData.mediaFile.name,
          type: postData.mediaFile.type,
          size: postData.mediaFile.size
        }
        console.log('📁 Serialized media file:', {
          name: serializedMediaFile.name,
          type: serializedMediaFile.type,
          size: serializedMediaFile.size
        })
      }

      // Send message to service worker to handle the posting
      const response = await chrome.runtime.sendMessage({
        type: 'POST_NOW',
        data: {
          text: postData.text,
          mediaFile: serializedMediaFile,
          textFile: postData.textFile,
          platform: postData.platform,
          caption: postData.caption,
          hashtags: postData.hashtags,
          privacy: postData.privacy,
        }
      })

      console.log('✅ Service worker response:', response)

      // Clear the form
      setPostData({ 
        text: '', 
        mediaFile: undefined, 
        textFile: undefined, 
        scheduleTime: undefined,
        platform: 'twitter',
        caption: '',
        hashtags: [],
        privacy: 'public'
      })
      setEnableScheduling(false)
      
      await loadQueuedPosts()
      
      const successMessage = postData.platform === 'tiktok'
        ? 'TikTok Studio upload page opened with your content!'
        : postData.platform === 'threads'
        ? 'Threads opened!'
        : 'Twitter compose page opened with your content!'

      toast({
        title: 'Success',
        description: successMessage,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('💥 Failed to post now:', error)
      toast({
        title: 'Error',
        description: 'Failed to initiate post',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setIsPosting(false)
    }
  }

  const handleAddToQueue = async () => {
    if (!postData.mediaFile && !postData.text.trim()) {
      toast({
        title: 'Error',
        description: 'Please add content or select a media file',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Validate schedule time if enabled
    if (enableScheduling && postData.scheduleTime) {
      const scheduleDate = new Date(postData.scheduleTime)
      const now = new Date()
      if (scheduleDate <= now) {
        toast({
          title: 'Error',
          description: 'Schedule time must be in the future',
          status: 'error',
          duration: 3000,
        })
        return
      }
    }

    try {
      if (enableScheduling && postData.scheduleTime) {
        // Schedule the post
        await postingUseCases.schedulePost({
          text: postData.text,
          mediaFile: postData.mediaFile,
          textFile: postData.textFile,
          scheduleTime: postData.scheduleTime,
        })
      } else {
        // Add to queue
        await postingUseCases.addToQueue({
          text: postData.text,
          mediaFile: postData.mediaFile,
          textFile: postData.textFile,
        })
      }

      // Clear the form
      setPostData({ 
        text: '', 
        mediaFile: undefined, 
        textFile: undefined, 
        scheduleTime: undefined, 
        platform: 'twitter',
        caption: '',
        hashtags: [],
        privacy: 'public'
      })
      setEnableScheduling(false)
      
      await loadQueuedPosts()
      
      toast({
        title: 'Success',
        description: enableScheduling && postData.scheduleTime ? 'Post scheduled successfully' : 'Post added to queue',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error with queue operation:', error)
      toast({
        title: 'Error',
        description: 'Failed to process request',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleFileUpload = (type: 'media' | 'text') => {
    const input = type === 'media' ? mediaInputRef.current : textInputRef.current
    input?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'text') => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === 'media') {
        setPostData({ ...postData, mediaFile: file })
      } else {
        setPostData({ ...postData, textFile: file })
        // Read text file content with explicit UTF-8 encoding
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          console.log('📄 PopupPostingOptions: Reading text file:', file.name, 'size:', file.size)
          console.log('📄 PopupPostingOptions: Raw content length:', content?.length || 0)
          console.log('📄 PopupPostingOptions: Content preview:', content?.substring(0, 100) + (content?.length > 100 ? '...' : ''))
          
          setPostData(prev => ({ ...prev, text: content || '' }))
        }
        reader.onerror = (error) => {
          console.error('❌ PopupPostingOptions: Error reading text file:', error)
        }
        // Explicitly specify UTF-8 encoding
        reader.readAsText(file, 'UTF-8')
      }
    }
  }

  const removeFromQueue = async (id: string) => {
    try {
      await postingUseCases.removeFromQueue(id)
      await loadQueuedPosts()
      toast({
        title: 'Success',
        description: 'Post removed from queue',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error removing from queue:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove post from queue',
        status: 'error',
        duration: 3000,
      })
    }
  }

  // Get minimum datetime for scheduling (current time + 1 minute)
  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 1)
    return now.toISOString().slice(0, 16) // Format for datetime-local input
  }

  return (
    <Box h="100%" display="flex" flexDirection="column" overflow="hidden">
      <Tabs size="sm" colorScheme="blue" h="full" display="flex" flexDirection="column">
        <TabList>
          <Tab fontSize="xs">{i18n('Create Post', 'options:posting')}</Tab>
          <Tab fontSize="xs">Queue ({queuedPosts.length})</Tab>
          <Tab fontSize="xs">Batch</Tab>
          <Tab fontSize="xs">Settings</Tab>
        </TabList>

        <TabPanels flex="1" display="flex" flexDirection="column" overflow="hidden">
          {/* Create Post Tab */}
          <TabPanel p={0.5} flex="1" display="flex" flexDirection="column" overflow="hidden">
            <VStack spacing={0.5} align="stretch" h="100%">
              {/* Platform Selection */}
              <FormControl>
                <FormLabel fontSize="xs" mb={1}>Platform</FormLabel>
                <Select
                  value={postData.platform}
                  onChange={(e) => setPostData({ ...postData, platform: e.target.value as 'twitter' | 'tiktok' | 'threads' })}
                  size="sm"
                  h="30px"
                >
                  <option value="twitter">Twitter</option>
                  <option value="tiktok">TikTok</option>
                  <option value="threads">Threads</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="xs" mb={1}>
                  {postData.platform === 'tiktok' ? 'Caption' : 'Post Text'}
                </FormLabel>
                <Textarea
                  value={postData.text}
                  onChange={(e) => setPostData({ ...postData, text: e.target.value })}
                  placeholder={
                    postData.platform === 'tiktok' 
                      ? 'Enter your TikTok caption...'
                      : 'Enter your post text here...'
                  }
                  size="sm"
                  rows={2}
                  resize="none"
                  h="45px"
                />
              </FormControl>

              <HStack spacing={1} w="full">
                <Button
                  size="xs"
                  onClick={() => handleFileUpload('media')}
                  variant="outline"
                  flex={1}
                  h="26px"
                >
                  {postData.mediaFile ? 
                    (postData.platform === 'tiktok' ? 'Video ✓' : 'Media ✓') : 
                    (postData.platform === 'tiktok' ? 'Video' : 'Media')
                  }
                </Button>
                <Button
                  size="xs"
                  onClick={() => handleFileUpload('text')}
                  variant="outline"
                  flex={1}
                  h="26px"
                >
                  {postData.textFile ? 
                    (postData.platform === 'tiktok' ? 'Caption ✓' : 'Text ✓') : 
                    (postData.platform === 'tiktok' ? 'Caption' : 'Text')
                  }
                </Button>
              </HStack>

              <Input
                ref={mediaInputRef}
                type="file"
                accept={postData.platform === 'tiktok' ? 'video/*' : 'image/*,video/*'}
                onChange={(e) => handleFileSelect(e, 'media')}
                display="none"
              />
              <Input
                ref={textInputRef}
                type="file"
                accept=".txt"
                onChange={(e) => handleFileSelect(e, 'text')}
                display="none"
              />

              {/* TikTok-specific fields */}
              {postData.platform === 'tiktok' && (
                <FormControl>
                  <FormLabel fontSize="xs" mb={1}>Privacy</FormLabel>
                  <Select
                    value={postData.privacy}
                    onChange={(e) => setPostData({ ...postData, privacy: e.target.value as 'public' | 'friends' | 'private' })}
                    size="sm"
                    h="30px"
                  >
                    <option value="public">Public</option>
                    <option value="friends">Friends</option>
                    <option value="private">Private</option>
                  </Select>
                </FormControl>
              )}

              {/* Scheduling Section */}
              <FormControl>
                <Checkbox
                  isChecked={enableScheduling}
                  onChange={(e) => {
                    setEnableScheduling(e.target.checked)
                    if (!e.target.checked) {
                      setPostData({ ...postData, scheduleTime: undefined })
                    }
                  }}
                  size="sm"
                >
                  <Text fontSize="xs">{i18n('Schedule Post', 'options:posting')}</Text>
                </Checkbox>
              </FormControl>

              {enableScheduling && (
                <FormControl>
                  <FormLabel fontSize="xs" mb={1}>{i18n('Schedule Time', 'options:posting')}</FormLabel>
                  <Input
                    type="datetime-local"
                    size="xs"
                    value={postData.scheduleTime || ''}
                    min={getMinDateTime()}
                    onChange={(e) => setPostData({ ...postData, scheduleTime: e.target.value })}
                  />
                </FormControl>
              )}

              <HStack spacing={1} w="full" mt="auto" flexShrink={0}>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handlePostNow}
                  isLoading={isPosting}
                  loadingText="Opening..."
                  flex={1}
                  h="30px"
                  isDisabled={enableScheduling} // Disable "Post Now" when scheduling is enabled
                >
                  {i18n('Post Now', 'options:posting')}
                </Button>
                <Button
                  size="sm"
                  colorScheme="purple"
                  onClick={handleAddToQueue}
                  flex={1}
                  h="30px"
                >
                  {enableScheduling ? 'Schedule' : 'Queue'}
                </Button>
              </HStack>
            </VStack>
          </TabPanel>

          {/* Queue Tab */}
          <TabPanel p={2} flex="1" display="flex" flexDirection="column">
            <VStack spacing={2} align="stretch" h="full">
              <Text fontSize="sm" fontWeight="bold" mb={1}>
                {i18n('Post Queue', 'options:posting')} ({queuedPosts.length})
              </Text>
              
              {queuedPosts.length === 0 ? (
                <Text fontSize="sm" color="gray.500">No posts in queue</Text>
              ) : (
                <VStack spacing={2} overflowY="auto" flex="1" className="scrollable-hidden" maxH="200px">
                  {queuedPosts.map((post) => (
                    <Card key={post.id} size="sm" w="full">
                      <CardHeader py={1}>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600">
                              {post.scheduleTime ? 
                                `⏰ ${new Date(post.scheduleTime).toLocaleString()}` : 
                                `📝 ${new Date(post.createdAt).toLocaleTimeString()}`
                              }
                            </Text>
                            {post.scheduleTime && (
                              <Text fontSize="xs" color="blue.500" fontWeight="bold">
                                Scheduled
                              </Text>
                            )}
                          </VStack>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={() => removeFromQueue(post.id)}
                          >
                            Remove
                          </Button>
                        </HStack>
                      </CardHeader>
                      <CardBody py={1}>
                        <Text fontSize="xs" noOfLines={2}>
                          {post.text || 'Media only post'}
                        </Text>
                        {post.mediaFile && (
                          <Text fontSize="xs" color="gray.500">
                            📎 {post.mediaFile.name}
                          </Text>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                </VStack>
              )}
            </VStack>
          </TabPanel>

          {/* Enhanced Batch Upload Tab */}
          <TabPanel p={2} flex="1" display="flex" flexDirection="column" overflow="hidden">
            <Box maxH="280px" overflowY="auto" className="scrollable-hidden">
              <EnhancedBatchUpload
                postingUseCases={postingUseCases}
                onComplete={loadQueuedPosts}
              />
            </Box>
          </TabPanel>

          {/* Queue Settings Tab */}
          <TabPanel p={2} flex="1" display="flex" flexDirection="column" overflow="hidden">
            <Box maxH="280px" overflowY="auto" className="scrollable-hidden">
              <QueueSettings
                queueSettingsRepository={queueSettingsRepository}
                onSettingsChange={(settings) => {
                  // Trigger auto-posting schedule update
                  chrome.runtime.sendMessage({
                    type: 'UPDATE_AUTO_POSTING_SCHEDULE',
                    data: settings
                  }).catch(error => {
                    console.error('Error updating auto-posting schedule:', error)
                  })
                }}
              />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default PopupPostingOptions 