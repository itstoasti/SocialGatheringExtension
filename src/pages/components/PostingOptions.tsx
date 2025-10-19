/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { getText as i18n } from '#libs/i18n'
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  CheckboxGroup,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  Select,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react'
import React, { useCallback, useRef, useState, useEffect } from 'react'
import { PostingRepositoryImpl } from '#infra/repositories/posting'
import { PostingUseCasesImpl } from '#domain/useCases/posting'
import { QueueSettingsRepositoryImpl } from '#infra/repositories/queueSettings'
import { QueueSettings } from './QueueSettings'
import { EnhancedBatchUpload } from './EnhancedBatchUpload'
import type { PostData } from '#domain/repositories/posting'
import type { QueueSettings as QueueSettingsType } from '#domain/repositories/queueSettings'

interface PostingOptionsProps {
  // We'll add repository props here later
}

interface PostForm {
  text: string
  mediaFile?: File
  textFile?: File
  scheduleTime?: string
  // Platform selection - array to support multiple platforms
  platforms: ('twitter' | 'tiktok' | 'threads' | 'facebook')[]
  // TikTok-specific fields
  caption?: string
  hashtags?: string[]
  privacy?: 'public' | 'friends' | 'private'
  // Auto-close tab after posting
  closeTabAfterPost?: boolean
}

const PostingOptions: React.FC<PostingOptionsProps> = () => {
  const [postData, setPostData] = useState<PostForm>({
    text: '',
    mediaFile: undefined,
    textFile: undefined,
    scheduleTime: undefined,
    platforms: [], // No platforms selected by default
    caption: '',
    hashtags: [],
    privacy: 'public',
    closeTabAfterPost: false,
  })
  const [queuedPosts, setQueuedPosts] = useState<PostData[]>([])
  const [isPosting, setIsPosting] = useState(false)
  
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  
  const toast = useToast()

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
          console.log('💾 PostingOptions: Saving settings to chrome.storage.sync:', item)
          const current = await chrome.storage.sync.get('queueSettings')
          const updated = { ...(current.queueSettings || {}), ...item }
          await chrome.storage.sync.set({ queueSettings: updated })
          console.log('✅ PostingOptions: Settings saved successfully:', updated)
        } catch (error) {
          console.error('❌ PostingOptions: Error setting queue settings:', error)
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
      const posts = await postingUseCases.getQueuedPosts()
      setQueuedPosts(posts)
    } catch (error) {
      console.error('Error loading queued posts:', error)
    }
  }, [postingUseCases])

  const handleMediaFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setPostData(prev => ({ ...prev, mediaFile: file }))
    }
  }, [])

  const handleTextFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Read the text file content with explicit UTF-8 encoding
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        console.log('📄 PostingOptions: Reading text file:', file.name, 'size:', file.size)
        console.log('📄 PostingOptions: Raw content length:', content?.length || 0)
        console.log('📄 PostingOptions: Content preview:', content?.substring(0, 100) + (content?.length > 100 ? '...' : ''))
        
        // Simple content validation
        if (content && content.length > 0) {
          console.log('📄 PostingOptions: Text file loaded successfully:', content.length, 'characters')
        }
        
        setPostData(prev => ({ 
          ...prev, 
          textFile: file,
          text: content || ''
        }))
        

      }
      reader.onerror = (error) => {
        console.error('❌ PostingOptions: Error reading text file:', error)
        toast({
          title: 'Error',
          description: 'Failed to read text file',
          status: 'error',
          duration: 3000,
        })
      }
      // Explicitly specify UTF-8 encoding
      reader.readAsText(file, 'UTF-8')
    }
  }, [toast])




  const handlePostNow = useCallback(async () => {
    // Validate at least one platform is selected
    if (postData.platforms.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one platform',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Platform-specific validation
    if (postData.platforms.includes('tiktok')) {
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
      if (!postData.text.trim() && !postData.mediaFile) {
        toast({
          title: 'Error',
          description: 'Please enter text or select media to post',
          status: 'error',
          duration: 3000,
        })
        return
      }
    }

    setIsPosting(true)
    try {
      // Post to each selected platform
      for (const platform of postData.platforms) {
        await postingUseCases.postNow({
          text: postData.text,
          mediaFile: postData.mediaFile,
          textFile: postData.textFile,
          platform: platform,
          privacy: postData.privacy,
          closeTabAfterPost: postData.closeTabAfterPost,
        })
      }

      setPostData({
        text: '',
        mediaFile: undefined,
        textFile: undefined,
        scheduleTime: undefined,
        platforms: [], // No platforms selected by default
        caption: '',
        hashtags: [],
        privacy: 'public',
        closeTabAfterPost: false,
      })

      // Clear file input elements to allow selecting the same file again
      if (mediaInputRef.current) {
        mediaInputRef.current.value = ''
      }
      if (textInputRef.current) {
        textInputRef.current.value = ''
      }

      await loadQueuedPosts()

      const platformNames = postData.platforms.map(p => {
        if (p === 'twitter') return 'Twitter'
        if (p === 'threads') return 'Threads'
        if (p === 'facebook') return 'Facebook'
        return 'TikTok'
      }).join(', ')

      toast({
        title: 'Posts initiated',
        description: `Opening ${platformNames}...`,
        status: 'info',
        duration: 3000,
      })
    } catch (error) {
      console.error('Error posting:', error)
      toast({
        title: 'Error',
        description: 'Failed to initiate posts',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setIsPosting(false)
    }
  }, [postData, postingUseCases, toast, loadQueuedPosts])

  const handleSchedulePost = useCallback(async () => {
    // Validate at least one platform is selected
    if (postData.platforms.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one platform',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Platform-specific validation
    if (postData.platforms.includes('tiktok')) {
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
      if (!postData.text.trim() && !postData.mediaFile) {
        toast({
          title: 'Error',
          description: 'Please enter text or select media to schedule',
          status: 'error',
          duration: 3000,
        })
        return
      }
    }

    if (!postData.scheduleTime) {
      toast({
        title: 'Error',
        description: 'Please select a schedule time',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      // Schedule post for each selected platform
      for (const platform of postData.platforms) {
        await postingUseCases.schedulePost({
          text: postData.text,
          mediaFile: postData.mediaFile,
          textFile: postData.textFile,
          scheduleTime: postData.scheduleTime,
          platform: platform,
          privacy: postData.privacy,
          closeTabAfterPost: postData.closeTabAfterPost,
        })
      }

      setPostData({
        text: '',
        mediaFile: undefined,
        textFile: undefined,
        scheduleTime: undefined,
        platforms: [], // No platforms selected by default
        caption: '',
        hashtags: [],
        privacy: 'public',
        closeTabAfterPost: false,
      })

      // Clear file input elements to allow selecting the same file again
      if (mediaInputRef.current) {
        mediaInputRef.current.value = ''
      }
      if (textInputRef.current) {
        textInputRef.current.value = ''
      }

      await loadQueuedPosts()

      const platformNames = postData.platforms.map(p => {
        if (p === 'twitter') return 'Twitter'
        if (p === 'threads') return 'Threads'
        if (p === 'facebook') return 'Facebook'
        return 'TikTok'
      }).join(', ')

      toast({
        title: 'Posts scheduled',
        description: `Posts scheduled for ${new Date(postData.scheduleTime).toLocaleString()} on ${platformNames}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Error scheduling post:', error)
      toast({
        title: 'Error',
        description: 'Failed to schedule posts',
        status: 'error',
        duration: 3000,
      })
    }
  }, [postData, postingUseCases, toast, loadQueuedPosts])

  const handleAddToQueue = useCallback(async () => {
    // Validate at least one platform is selected
    if (postData.platforms.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one platform',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Platform-specific validation
    if (postData.platforms.includes('tiktok')) {
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
      if (!postData.text.trim() && !postData.mediaFile) {
        toast({
          title: 'Error',
          description: 'Please enter text or select media to add to queue',
          status: 'error',
          duration: 3000,
        })
        return
      }
    }

    try {
      // Add to queue for each selected platform
      for (const platform of postData.platforms) {
        await postingUseCases.addToQueue({
          text: postData.text,
          mediaFile: postData.mediaFile,
          textFile: postData.textFile,
          platform: platform,
          privacy: postData.privacy,
        })
      }

      setPostData({
        text: '',
        mediaFile: undefined,
        textFile: undefined,
        scheduleTime: undefined,
        platforms: [], // No platforms selected by default
        caption: '',
        hashtags: [],
        privacy: 'public',
      })

      // Clear file input elements to allow selecting the same file again
      if (mediaInputRef.current) {
        mediaInputRef.current.value = ''
      }
      if (textInputRef.current) {
        textInputRef.current.value = ''
      }

      await loadQueuedPosts()

      const platformNames = postData.platforms.map(p => {
        if (p === 'twitter') return 'Twitter'
        if (p === 'threads') return 'Threads'
        if (p === 'facebook') return 'Facebook'
        return 'TikTok'
      }).join(', ')

      toast({
        title: 'Added to queue',
        description: `Post${postData.platforms.length > 1 ? 's' : ''} added to queue for ${platformNames}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Error adding to queue:', error)
      toast({
        title: 'Error',
        description: 'Failed to add posts to queue',
        status: 'error',
        duration: 3000,
      })
    }
  }, [postData, postingUseCases, toast, loadQueuedPosts])



  const removeFromQueue = useCallback(async (id: string) => {
    try {
      await postingUseCases.removeFromQueue(id)
      await loadQueuedPosts()
      
      toast({
        title: 'Removed from queue',
        description: 'Post removed successfully',
        status: 'success',
        duration: 3000,
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
  }, [postingUseCases, toast, loadQueuedPosts])

  return (
    <Box p={6} width="100%">
      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
        <Tab>{i18n('Create Post', 'options:posting')}</Tab>
        <Tab>Enhanced Batch Upload</Tab>
        <Tab>Queue Settings</Tab>
        <Tab>{i18n('SchedulePosts', 'options:posting')}</Tab>
      </TabList>

      <TabPanels>
          {/* Create Post Tab */}
          <TabPanel p={0}>
            <Box width="100%" maxW="none">
              <VStack spacing={4} align="stretch" width="100%">
              <Text fontSize="md" color="gray.600">
                {i18n('Compose new post with media', 'options:posting')}
              </Text>
              
              {/* Platform Selection - Multiple Checkboxes */}
              <FormControl>
                <FormLabel>Platforms (Select one or more)</FormLabel>
                <CheckboxGroup
                  value={postData.platforms}
                  onChange={(values) => setPostData(prev => ({
                    ...prev,
                    platforms: values as ('twitter' | 'tiktok' | 'threads' | 'facebook')[]
                  }))}
                >
                  <Stack direction="row" spacing={4}>
                    <Checkbox value="twitter">Twitter / X</Checkbox>
                    <Checkbox value="threads">Threads</Checkbox>
                    <Checkbox value="tiktok">TikTok</Checkbox>
                    <Checkbox value="facebook">Facebook</Checkbox>
                  </Stack>
                </CheckboxGroup>
              </FormControl>

              <FormControl>
                <FormLabel>
                  {postData.platforms.includes('tiktok') ? 'Caption' : i18n('Post Text', 'options:posting')}
                </FormLabel>
                <Textarea
                  value={postData.text}
                  onChange={(e) => setPostData(prev => ({ ...prev, text: e.target.value }))}
                  placeholder={
                    postData.platforms.includes('tiktok')
                      ? 'Enter your TikTok caption...'
                      : i18n('Enter your post text here...', 'options:posting')
                  }
                  rows={4}
                />
              </FormControl>

              <HStack spacing={4}>
                <FormControl>
                  <FormLabel>
                    {postData.platforms.includes('tiktok') ? 'Select Video File' : i18n('Select Media File', 'options:posting')}
                  </FormLabel>
                  <Input
                    ref={mediaInputRef}
                    type="file"
                    accept={postData.platforms.includes('tiktok') ? 'video/*' : 'image/*,video/*'}
                    onChange={handleMediaFileSelect}
                    display="none"
                  />
                  <Button
                    onClick={() => mediaInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                  >
                    {postData.mediaFile ? postData.mediaFile.name :
                      (postData.platforms.includes('tiktok') ? 'No video file selected' : i18n('No media file selected', 'options:posting'))
                    }
                  </Button>
                </FormControl>

                <FormControl>
                  <FormLabel>
                    {postData.platforms.includes('tiktok') ? 'Caption File (Optional)' : 'Text File (Optional)'}
                  </FormLabel>
                  <Input
                    ref={textInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleTextFileSelect}
                    display="none"
                  />
                  <Button
                    onClick={() => textInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                  >
                    {postData.textFile ? postData.textFile.name :
                      (postData.platforms.includes('tiktok') ? 'No caption file selected' : 'No text file selected')
                    }
                  </Button>
                </FormControl>
              </HStack>

              {/* TikTok-specific fields */}
              {postData.platforms.includes('tiktok') && (
                <FormControl>
                  <FormLabel>Privacy</FormLabel>
                  <Select
                    value={postData.privacy}
                    onChange={(e) => setPostData(prev => ({ ...prev, privacy: e.target.value as 'public' | 'friends' | 'private' }))}
                  >
                    <option value="public">Public</option>
                    <option value="friends">Friends</option>
                    <option value="private">Private</option>
                  </Select>
                </FormControl>
              )}

              <FormControl>
                <FormLabel>{i18n('Schedule Time', 'options:posting')} (Optional)</FormLabel>
                <Input
                  type="datetime-local"
                  value={postData.scheduleTime || ''}
                  onChange={(e) => setPostData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                />
              </FormControl>

              {/* Close Tab After Post Option */}
              <FormControl>
                <Checkbox
                  isChecked={postData.closeTabAfterPost}
                  onChange={(e) => setPostData(prev => ({ ...prev, closeTabAfterPost: e.target.checked }))}
                >
                  Close browser tab after posting successfully
                </Checkbox>
              </FormControl>

              <HStack spacing={4}>
                <Button 
                  colorScheme="blue" 
                  onClick={handlePostNow}
                  isLoading={isPosting}
                  loadingText="Posting..."
                >
                  {i18n('Post Now', 'options:posting')}
                </Button>
                <Button 
                  colorScheme="green" 
                  onClick={handleSchedulePost}
                  isDisabled={!postData.scheduleTime}
                >
                  {i18n('Schedule Post', 'options:posting')}
                </Button>
                <Button 
                  colorScheme="purple" 
                  onClick={handleAddToQueue}
                >
                  {i18n('Add to Queue', 'options:posting')}
                </Button>
              </HStack>
              </VStack>
            </Box>
          </TabPanel>

          {/* Enhanced Batch Upload Tab */}
          <TabPanel p={0}>
            <Box width="100%" maxW="none">
            <EnhancedBatchUpload
              postingUseCases={postingUseCases}
              onComplete={loadQueuedPosts}
            />
            </Box>
          </TabPanel>

          {/* Queue Settings Tab */}
          <TabPanel p={0}>
            <Box width="100%" maxW="none">
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

          {/* Schedule Posts Tab */}
          <TabPanel p={0}>
            <Box width="100%" maxW="none">
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" color="gray.600">
                {i18n('Manage scheduled posts and queue', 'options:posting')}
              </Text>

              <Stack spacing={4}>
                <Heading size="md">{i18n('Post Queue', 'options:posting')}</Heading>
                
                {queuedPosts.length === 0 ? (
                  <Text color="gray.500">No posts in queue</Text>
                ) : (
                  queuedPosts.map((post) => (
                    <Card key={post.id} size="sm">
                      <CardHeader>
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="bold">
                            {post.scheduleTime ? 
                              `Scheduled: ${new Date(post.scheduleTime).toLocaleString()}` : 
                              'Queued'
                            }
                          </Text>
                          <Button 
                            size="xs" 
                            colorScheme="red" 
                            onClick={() => removeFromQueue(post.id)}
                          >
                            Remove
                          </Button>
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        <Text fontSize="sm" noOfLines={3}>
                          {post.text || 'Media only post'}
                        </Text>
                        {post.mediaFile && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Media: {post.mediaFile.name}
                          </Text>
                        )}
                      </CardBody>
                    </Card>
                  ))
                )}
              </Stack>
            </VStack>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default PostingOptions 