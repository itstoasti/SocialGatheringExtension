/*
 * This is proprietary software. All rights reserved.
 * No part of this file may be used, modified, or distributed without explicit written permission.
 */
import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Stack,
  Text,
  VStack,
  Badge,
  Tooltip,
  useColorModeValue,
  Divider,
  Center,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Input,
  Textarea,
  Select,
  FormControl,
  FormLabel,
  FormHelperText,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon, DeleteIcon, EditIcon, RepeatIcon } from '@chakra-ui/icons'
import { FaTwitter, FaTiktok, FaClock, FaCheckCircle, FaExclamationTriangle, FaFacebook } from 'react-icons/fa'
import { SiThreads } from 'react-icons/si'
import type { PostData } from '#domain/repositories/posting'
import PostingRepositoryImpl from '#infra/repositories/posting'

type CalendarView = 'month' | 'week' | 'day'

interface CalendarEvent {
  id: string
  title: string
  time: string
  platform: 'twitter' | 'tiktok' | 'threads' | 'facebook'
  status: PostData['status']
  post: PostData
}

const Calendar: React.FC = () => {
  const [view, setView] = useState<CalendarView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editFormData, setEditFormData] = useState({
    text: '',
    caption: '',
    hashtags: '',
    privacy: 'PUBLIC_TO_EVERYONE' as 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY',
    scheduleTime: ''
  })
  const [deletePostId, setDeletePostId] = useState<string | null>(null)

  const postingRepository = new PostingRepositoryImpl()
  const toast = useToast()
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  // Color mode values
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const todayBg = useColorModeValue('blue.50', 'blue.900')
  const eventBg = useColorModeValue('gray.50', 'gray.700')

  // Load posts from repository
  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const allPosts = await postingRepository.getAllPosts()
      // Filter for posts with scheduled times
      const scheduledPosts = allPosts.filter(post => post.scheduleTime)
      setPosts(scheduledPosts)
    } catch (err) {
      setError('Failed to load scheduled posts')
      console.error('Error loading posts:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0]
    return posts
      .filter(post => post.scheduleTime && post.scheduleTime.startsWith(dateStr))
      .map(post => ({
        id: post.id,
        title: post.text?.substring(0, 30) + '...' || 'No text',
        time: new Date(post.scheduleTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        platform: post.platform || 'twitter',
        status: post.status,
        post
      }))
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() - 1)
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Handle day click to navigate to day view
  const handleDayClick = (date: Date) => {
    setCurrentDate(date)
    setView('day')
  }

  // Handle edit
  const handleEditClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent day click when clicking edit
    setSelectedEvent(event)

    // Format current schedule time for datetime-local input
    const scheduleDate = new Date(event.post.scheduleTime!)
    const formattedDate = new Date(scheduleDate.getTime() - scheduleDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)

    // Pre-fill form with current post data
    setEditFormData({
      text: event.post.text || '',
      caption: event.post.caption || '',
      hashtags: event.post.hashtags || '',
      privacy: event.post.privacy || 'PUBLIC_TO_EVERYONE',
      scheduleTime: formattedDate
    })

    onEditOpen()
  }

  const handleEditSubmit = async () => {
    if (!selectedEvent || !editFormData.scheduleTime) return

    try {
      const newDate = new Date(editFormData.scheduleTime)
      const now = new Date()

      // Check if the new schedule time is in the past
      if (newDate <= now) {
        toast({
          title: 'Invalid schedule time',
          description: 'Schedule time must be in the future.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }

      const isoString = newDate.toISOString()

      // Update the post with new data (preserve status explicitly)
      await postingRepository.updatePost(selectedEvent.id, {
        text: editFormData.text,
        caption: editFormData.caption,
        hashtags: editFormData.hashtags,
        privacy: editFormData.privacy,
        scheduleTime: isoString,
        status: 'pending' // Ensure status stays pending when editing
      })

      // Clear and recreate the Chrome alarm with new time
      const alarmName = `scheduled_post_${selectedEvent.id}`
      await chrome.alarms.clear(alarmName)
      await chrome.alarms.create(alarmName, {
        when: newDate.getTime()
      })

      toast({
        title: 'Post updated',
        description: 'Post has been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Reload posts
      await loadPosts()
      onEditClose()
    } catch (err) {
      console.error('Error updating post:', err)
      toast({
        title: 'Error updating post',
        description: 'Failed to update the post. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // Handle delete
  const handleDeleteClick = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent day click when clicking delete
    setDeletePostId(postId)
    onDeleteOpen()
  }

  const handleDeleteConfirm = async () => {
    if (!deletePostId) return

    try {
      // Delete the post
      await postingRepository.deletePost(deletePostId)

      // Clear the Chrome alarm
      const alarmName = `scheduled_post_${deletePostId}`
      await chrome.alarms.clear(alarmName)

      toast({
        title: 'Post deleted',
        description: 'Scheduled post has been deleted.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Reload posts
      await loadPosts()
      onDeleteClose()
      setDeletePostId(null)
    } catch (err) {
      console.error('Error deleting post:', err)
      toast({
        title: 'Error deleting post',
        description: 'Failed to delete the post. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // Handle retry
  const handleRetryClick = async (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent day click when clicking retry

    try {
      // Schedule to retry in 1 minute from now
      const retryTime = new Date()
      retryTime.setMinutes(retryTime.getMinutes() + 1)

      // Reset status to pending and update schedule time
      await postingRepository.updatePost(event.id, {
        status: 'pending',
        scheduleTime: retryTime.toISOString()
      })

      // Recreate the Chrome alarm to retry posting
      const alarmName = `scheduled_post_${event.id}`
      await chrome.alarms.clear(alarmName)

      await chrome.alarms.create(alarmName, {
        when: retryTime.getTime()
      })

      toast({
        title: 'Post retry scheduled',
        description: 'Post will be retried in 1 minute.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Reload posts
      await loadPosts()
    } catch (err) {
      console.error('Error retrying post:', err)
      toast({
        title: 'Error retrying post',
        description: 'Failed to retry the post. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // Get platform icon
  const getPlatformIcon = (platform: 'twitter' | 'tiktok' | 'threads' | 'facebook') => {
    if (platform === 'twitter') return FaTwitter
    if (platform === 'threads') return SiThreads
    if (platform === 'facebook') return FaFacebook
    return FaTiktok
  }

  // Get status color
  const getStatusColor = (status: PostData['status']) => {
    switch (status) {
      case 'pending': return 'blue'
      case 'posting': return 'yellow'
      case 'posted': return 'green'
      case 'failed': return 'red'
      default: return 'gray'
    }
  }

  // Get status icon
  const getStatusIcon = (status: PostData['status']) => {
    switch (status) {
      case 'pending': return FaClock
      case 'posting': return FaClock
      case 'posted': return FaCheckCircle
      case 'failed': return FaExclamationTriangle
      default: return FaClock
    }
  }

  // Get platform color
  const getPlatformColor = (platform: 'twitter' | 'tiktok' | 'threads' | 'facebook') => {
    if (platform === 'twitter') return 'blue.500'
    if (platform === 'threads') return 'purple.500'
    if (platform === 'facebook') return 'blue.600'
    return 'pink.500'
  }

  // Render event card (compact version for month/week views)
  const renderEventCard = (event: CalendarEvent, showDate = false) => (
    <Card key={event.id} size="sm" bg={eventBg} mb={2}>
      <CardBody p={2}>
        <HStack spacing={2}>
          <Box as={getPlatformIcon(event.platform)} color={getPlatformColor(event.platform)} />
          <VStack align="start" spacing={0} flex={1}>
            <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
              {event.title}
            </Text>
            <HStack spacing={2}>
              <Text fontSize="xs" color="gray.500">
                {showDate && new Date(event.post.scheduleTime!).toLocaleDateString()} {event.time}
              </Text>
              <Badge size="sm" colorScheme={getStatusColor(event.status)}>
                {event.status}
              </Badge>
            </HStack>
          </VStack>
          {/* Action buttons - show different buttons based on status */}
          {event.status === 'pending' && (
            <HStack spacing={1}>
              <Tooltip label="Edit">
                <IconButton
                  aria-label="Edit post"
                  icon={<EditIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="blue"
                  onClick={(e) => handleEditClick(event, e)}
                />
              </Tooltip>
              <Tooltip label="Delete">
                <IconButton
                  aria-label="Delete post"
                  icon={<DeleteIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={(e) => handleDeleteClick(event.id, e)}
                />
              </Tooltip>
            </HStack>
          )}
          {(event.status === 'posting' || event.status === 'failed') && (
            <HStack spacing={1}>
              <Tooltip label="Retry">
                <IconButton
                  aria-label="Retry post"
                  icon={<RepeatIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="orange"
                  onClick={(e) => handleRetryClick(event, e)}
                />
              </Tooltip>
              <Tooltip label="Delete">
                <IconButton
                  aria-label="Delete post"
                  icon={<DeleteIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={(e) => handleDeleteClick(event.id, e)}
                />
              </Tooltip>
            </HStack>
          )}
          {event.status === 'posted' && (
            <HStack spacing={1}>
              <Tooltip label="Delete">
                <IconButton
                  aria-label="Delete post"
                  icon={<DeleteIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={(e) => handleDeleteClick(event.id, e)}
                />
              </Tooltip>
            </HStack>
          )}
        </HStack>
      </CardBody>
    </Card>
  )

  // Render detailed event card (for daily view)
  const renderDetailedEventCard = (event: CalendarEvent) => (
    <Card key={event.id} size="md" bg={eventBg} h="full">
      <CardBody p={3}>
        <VStack align="stretch" spacing={2}>
          {/* Header with platform, time, and status */}
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Box as={getPlatformIcon(event.platform)} boxSize="18px" color={getPlatformColor(event.platform)} />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" fontWeight="bold" textTransform="capitalize">
                  {event.platform}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {event.time}
                </Text>
              </VStack>
            </HStack>
            <Badge colorScheme={getStatusColor(event.status)} fontSize="xs" px={2} py={0.5}>
              {event.status}
            </Badge>
          </HStack>

          <Divider />

          {/* Post content */}
          <VStack align="stretch" spacing={1}>
            <Text fontWeight="semibold" fontSize="xs" color="gray.600">
              Post Content:
            </Text>
            <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="normal" noOfLines={4}>
              {event.post.text || 'No text'}
            </Text>
          </VStack>

          {/* TikTok specific fields */}
          {event.platform === 'tiktok' && (event.post.caption || event.post.hashtags || event.post.privacy) && (
            <>
              <Divider />
              <VStack align="stretch" spacing={1}>
                {event.post.caption && (
                  <>
                    <Text fontWeight="semibold" fontSize="xs" color="gray.600">
                      Caption:
                    </Text>
                    <Text fontSize="xs" noOfLines={2}>{event.post.caption}</Text>
                  </>
                )}
                {event.post.hashtags && (
                  <>
                    <Text fontWeight="semibold" fontSize="xs" color="gray.600">
                      Hashtags:
                    </Text>
                    <Text fontSize="xs" noOfLines={1}>{event.post.hashtags}</Text>
                  </>
                )}
                {event.post.privacy && (
                  <>
                    <Text fontWeight="semibold" fontSize="xs" color="gray.600">
                      Privacy:
                    </Text>
                    <Text fontSize="xs">{event.post.privacy.replace(/_/g, ' ').toLowerCase()}</Text>
                  </>
                )}
              </VStack>
            </>
          )}

          {/* Media indicator */}
          {event.post.mediaFile && (
            <>
              <Divider />
              <HStack>
                <Badge colorScheme="purple" fontSize="xs">Media</Badge>
              </HStack>
            </>
          )}

          {/* Action buttons */}
          <Divider />
          <HStack justify="flex-end" spacing={1}>
            {event.status === 'pending' && (
              <>
                <Button
                  leftIcon={<EditIcon />}
                  size="xs"
                  colorScheme="blue"
                  variant="outline"
                  onClick={(e) => handleEditClick(event, e)}
                >
                  Edit
                </Button>
                <Button
                  leftIcon={<DeleteIcon />}
                  size="xs"
                  colorScheme="red"
                  variant="outline"
                  onClick={(e) => handleDeleteClick(event.id, e)}
                >
                  Delete
                </Button>
              </>
            )}
            {(event.status === 'posting' || event.status === 'failed') && (
              <>
                <Button
                  leftIcon={<RepeatIcon />}
                  size="xs"
                  colorScheme="orange"
                  variant="outline"
                  onClick={(e) => handleRetryClick(event, e)}
                >
                  Retry
                </Button>
                <Button
                  leftIcon={<DeleteIcon />}
                  size="xs"
                  colorScheme="red"
                  variant="outline"
                  onClick={(e) => handleDeleteClick(event.id, e)}
                >
                  Delete
                </Button>
              </>
            )}
            {event.status === 'posted' && (
              <Button
                leftIcon={<DeleteIcon />}
                size="xs"
                colorScheme="red"
                variant="outline"
                onClick={(e) => handleDeleteClick(event.id, e)}
              >
                Delete
              </Button>
            )}
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  )

  // Render month view
  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days = []
    const today = new Date()
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      
      const isCurrentMonth = date.getMonth() === month
      const isToday = date.toDateString() === today.toDateString()
      const events = getEventsForDate(date)
      
      days.push(
        <GridItem
          key={i}
          minH="120px"
          p={1}
          cursor="pointer"
          onClick={() => handleDayClick(date)}
          _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
          borderRadius="md"
          transition="background 0.2s"
        >
          <VStack spacing={1} align="stretch" h="full">
            <Text
              fontSize="sm"
              fontWeight={isToday ? "bold" : "normal"}
              color={isCurrentMonth ? "inherit" : "gray.400"}
              bg={isToday ? todayBg : "transparent"}
              px={2}
              py={1}
              borderRadius="md"
            >
              {date.getDate()}
            </Text>
            <VStack spacing={1} align="stretch" flex={1}>
              {events.slice(0, 3).map(event => (
                <Tooltip key={event.id} label={event.post.text || 'No text'}>
                  <Box
                    bg={eventBg}
                    px={2}
                    py={1}
                    borderRadius="sm"
                    fontSize="xs"
                    cursor="pointer"
                  >
                    <HStack spacing={1}>
                      <Box as={getPlatformIcon(event.platform)} color={getPlatformColor(event.platform)} />
                      <Text noOfLines={1}>{event.time}</Text>
                    </HStack>
                  </Box>
                </Tooltip>
              ))}
              {events.length > 3 && (
                <Text fontSize="xs" color="gray.500" textAlign="center">
                  +{events.length - 3} more
                </Text>
              )}
            </VStack>
          </VStack>
        </GridItem>
      )
    }

    return (
      <Box>
        <Grid templateColumns="repeat(7, 1fr)" gap={1} mb={4}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <GridItem key={day} p={2}>
              <Text fontSize="sm" fontWeight="bold" textAlign="center" color="gray.600">
                {day}
              </Text>
            </GridItem>
          ))}
        </Grid>
        <Grid templateColumns="repeat(7, 1fr)" gap={1} border="1px solid" borderColor={borderColor}>
          {days}
        </Grid>
      </Box>
    )
  }

  // Render week view
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const events = getEventsForDate(date)
      const isToday = date.toDateString() === new Date().toDateString()
      
      days.push(
        <GridItem key={i} p={3} borderRight="1px solid" borderColor={borderColor}>
          <VStack spacing={3} align="stretch">
            <Text
              fontSize="lg"
              fontWeight="bold"
              textAlign="center"
              bg={isToday ? todayBg : "transparent"}
              py={2}
              borderRadius="md"
            >
              {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <VStack spacing={2} align="stretch">
              {events.map(event => renderEventCard(event))}
            </VStack>
          </VStack>
        </GridItem>
      )
    }

    return (
      <Grid templateColumns="repeat(7, 1fr)" gap={0} border="1px solid" borderColor={borderColor}>
        {days}
      </Grid>
    )
  }

  // Render day view
  const renderDayView = () => {
    const events = getEventsForDate(currentDate)
    const isToday = currentDate.toDateString() === new Date().toDateString()
    
    return (
      <Card bg={cardBg}>
        <CardHeader>
          <Heading size="md" textAlign="center">
            {currentDate.toLocaleDateString([], { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {isToday && <Badge ml={2} colorScheme="blue">Today</Badge>}
          </Heading>
        </CardHeader>
        <CardBody>
          {events.length === 0 ? (
            <Center py={8}>
              <Text color="gray.500">No posts scheduled for this day</Text>
            </Center>
          ) : (
            <Grid templateColumns="repeat(3, 1fr)" gap={4}>
              {events.map(event => (
                <GridItem key={event.id}>
                  {renderDetailedEventCard(event)}
                </GridItem>
              ))}
            </Grid>
          )}
        </CardBody>
      </Card>
    )
  }

  // Get current period string
  const getCurrentPeriodString = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString([], { year: 'numeric', month: 'long' })
    } else if (view === 'week') {
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return `${startOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    }
  }

  if (loading) {
    return (
      <Center py={8}>
        <VStack spacing={4}>
          <Spinner size="lg" />
          <Text>Loading scheduled posts...</Text>
        </VStack>
      </Center>
    )
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Error loading calendar!</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <HStack spacing={4}>
            <ButtonGroup size="sm" isAttached variant="outline">
              <Button 
                isActive={view === 'month'} 
                onClick={() => setView('month')}
              >
                Month
              </Button>
              <Button 
                isActive={view === 'week'} 
                onClick={() => setView('week')}
              >
                Week
              </Button>
              <Button 
                isActive={view === 'day'} 
                onClick={() => setView('day')}
              >
                Day
              </Button>
            </ButtonGroup>
            <Button size="sm" onClick={goToToday}>
              Today
            </Button>
          </HStack>
          
          <HStack spacing={4}>
            <HStack>
              <IconButton
                aria-label="Previous"
                icon={<ChevronLeftIcon />}
                onClick={goToPrevious}
                size="sm"
              />
              <Heading size="md" minW="250px" textAlign="center">
                {getCurrentPeriodString()}
              </Heading>
              <IconButton
                aria-label="Next"
                icon={<ChevronRightIcon />}
                onClick={goToNext}
                size="sm"
              />
            </HStack>
            <Button size="sm" onClick={loadPosts}>
              Refresh
            </Button>
          </HStack>
        </Flex>

        {/* Stats */}
        <HStack spacing={4} justify="center">
          <Badge colorScheme="blue" p={2}>
            <HStack>
              <Text fontSize="sm">Total Scheduled:</Text>
              <Text fontSize="sm" fontWeight="bold">{posts.length}</Text>
            </HStack>
          </Badge>
          <Badge colorScheme="green" p={2}>
            <HStack>
              <Text fontSize="sm">Pending:</Text>
              <Text fontSize="sm" fontWeight="bold">
                {posts.filter(p => p.status === 'pending').length}
              </Text>
            </HStack>
          </Badge>
          <Badge colorScheme="orange" p={2}>
            <HStack>
              <Text fontSize="sm">Posted:</Text>
              <Text fontSize="sm" fontWeight="bold">
                {posts.filter(p => p.status === 'posted').length}
              </Text>
            </HStack>
          </Badge>
        </HStack>

        <Divider />

        {/* Calendar View */}
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </VStack>

      {/* Edit Post Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Scheduled Post</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Platform badge */}
              <HStack>
                <Badge colorScheme={
                  selectedEvent?.platform === 'twitter' ? 'blue' :
                  selectedEvent?.platform === 'threads' ? 'purple' : 'pink'
                }>
                  {selectedEvent?.platform?.toUpperCase() || 'TWITTER'}
                </Badge>
                <Badge colorScheme={getStatusColor(selectedEvent?.status || 'pending')}>
                  {selectedEvent?.status}
                </Badge>
              </HStack>

              {/* Text/Content field */}
              <FormControl isRequired>
                <FormLabel>
                  {selectedEvent?.platform === 'tiktok' ? 'Video Description' : 'Post Text'}
                </FormLabel>
                <Textarea
                  value={editFormData.text}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Enter post content..."
                  rows={4}
                />
                <FormHelperText>
                  {editFormData.text.length} characters
                </FormHelperText>
              </FormControl>

              {/* TikTok specific fields */}
              {selectedEvent?.platform === 'tiktok' && (
                <>
                  <FormControl>
                    <FormLabel>Caption</FormLabel>
                    <Textarea
                      value={editFormData.caption}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, caption: e.target.value }))}
                      placeholder="Enter caption..."
                      rows={2}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Hashtags</FormLabel>
                    <Input
                      value={editFormData.hashtags}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                      placeholder="#example #hashtags"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Privacy</FormLabel>
                    <Select
                      value={editFormData.privacy}
                      onChange={(e) => setEditFormData(prev => ({
                        ...prev,
                        privacy: e.target.value as 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
                      }))}
                    >
                      <option value="PUBLIC_TO_EVERYONE">Public to Everyone</option>
                      <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
                      <option value="SELF_ONLY">Private (Only Me)</option>
                    </Select>
                  </FormControl>
                </>
              )}

              {/* Schedule Time */}
              <FormControl isRequired>
                <FormLabel>Schedule Time</FormLabel>
                <Input
                  type="datetime-local"
                  value={editFormData.scheduleTime}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                />
                <FormHelperText>
                  Current: {selectedEvent && new Date(selectedEvent.post.scheduleTime!).toLocaleString()}
                </FormHelperText>
              </FormControl>

              {/* Note about media */}
              {selectedEvent?.post.mediaFile && (
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Note: Media files cannot be changed. To change media, delete this post and create a new one.
                  </Text>
                </Alert>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleEditSubmit}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Scheduled Post
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this scheduled post? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}

export default Calendar 