/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { getText as i18n } from '#libs/i18n'
import { getFullVersion } from '#utils/runtime'
import { PostingRepositoryImpl } from '#infra/repositories/posting'
import { PostingUseCasesImpl } from '#domain/useCases/posting'
import type { PostData } from '#domain/repositories/posting'
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Badge,
  Button,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
} from '@chakra-ui/react'
import React, { useEffect, useState, useCallback } from 'react'
import { FaTwitter, FaCalendarAlt, FaClock, FaCheckCircle, FaExclamationCircle, FaTimes, FaFacebook } from 'react-icons/fa'
import { SiTiktok, SiThreads } from 'react-icons/si'
import { MdSchedule, MdPostAdd, MdPending } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'

interface DashboardStats {
  totalPosts: number
  pendingPosts: number
  postedPosts: number
  failedPosts: number
  scheduledToday: number
  scheduledThisWeek: number
  twitterPosts: number
  threadsPosts: number
  tiktokPosts: number
  facebookPosts: number
}

const StatCard = ({
  icon,
  label,
  value,
  helpText,
  colorScheme = 'blue'
}: {
  icon: any
  label: string
  value: number
  helpText?: string
  colorScheme?: string
}) => (
  <Card>
    <CardBody>
      <Stat>
        <HStack spacing={3} align="start">
          <Icon as={icon} boxSize={8} color={`${colorScheme}.500`} />
          <Box flex={1}>
            <StatLabel fontSize="sm" color="white">{label}</StatLabel>
            <StatNumber fontSize="3xl" mt={1}>{value}</StatNumber>
            {helpText && <StatHelpText fontSize="xs" mt={1} color="gray.300">{helpText}</StatHelpText>}
          </Box>
        </HStack>
      </Stat>
    </CardBody>
  </Card>
)

const PostStatusBadge = ({ status }: { status: PostData['status'] }) => {
  const colorMap = {
    pending: 'yellow',
    posting: 'blue',
    posted: 'green',
    failed: 'red',
  }

  return (
    <Badge colorScheme={colorMap[status]} fontSize="xs">
      {status.toUpperCase()}
    </Badge>
  )
}

const PlatformIcon = ({ platform }: { platform?: 'twitter' | 'tiktok' | 'threads' | 'facebook' }) => {
  const iconMap = {
    twitter: FaTwitter,
    tiktok: SiTiktok,
    threads: SiThreads,
    facebook: FaFacebook,
  }

  const colorMap = {
    twitter: 'blue.400',
    tiktok: 'pink.400',
    threads: 'purple.400',
    facebook: 'blue.600',
  }

  return platform ? (
    <Icon as={iconMap[platform]} color={colorMap[platform]} boxSize={4} />
  ) : (
    <Icon as={FaTwitter} color="gray.400" boxSize={4} />
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    pendingPosts: 0,
    postedPosts: 0,
    failedPosts: 0,
    scheduledToday: 0,
    scheduledThisWeek: 0,
    twitterPosts: 0,
    threadsPosts: 0,
    tiktokPosts: 0,
    facebookPosts: 0,
  })
  const [upcomingPosts, setUpcomingPosts] = useState<PostData[]>([])
  const [recentPosts, setRecentPosts] = useState<PostData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      const postingRepository = new PostingRepositoryImpl()
      const allPosts = await postingRepository.getAllPosts()

      // Calculate stats
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekFromNow = new Date(today)
      weekFromNow.setDate(weekFromNow.getDate() + 7)

      const newStats: DashboardStats = {
        totalPosts: allPosts.length,
        pendingPosts: allPosts.filter(p => p.status === 'pending').length,
        postedPosts: allPosts.filter(p => p.status === 'posted').length,
        failedPosts: allPosts.filter(p => p.status === 'failed').length,
        scheduledToday: allPosts.filter(p => {
          if (!p.scheduleTime) return false
          const scheduleDate = new Date(p.scheduleTime)
          return scheduleDate >= today && scheduleDate < new Date(today.getTime() + 86400000)
        }).length,
        scheduledThisWeek: allPosts.filter(p => {
          if (!p.scheduleTime) return false
          const scheduleDate = new Date(p.scheduleTime)
          return scheduleDate >= today && scheduleDate < weekFromNow
        }).length,
        twitterPosts: allPosts.filter(p => p.platform === 'twitter' || !p.platform).length,
        threadsPosts: allPosts.filter(p => p.platform === 'threads').length,
        tiktokPosts: allPosts.filter(p => p.platform === 'tiktok').length,
        facebookPosts: allPosts.filter(p => p.platform === 'facebook').length,
      }

      setStats(newStats)

      // Get upcoming scheduled posts (next 5)
      const upcoming = allPosts
        .filter(p => p.scheduleTime && p.status === 'pending')
        .sort((a, b) => new Date(a.scheduleTime!).getTime() - new Date(b.scheduleTime!).getTime())
        .slice(0, 5)
      setUpcomingPosts(upcoming)

      // Get recent posts (last 5)
      const recent = allPosts
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
      setRecentPosts(recent)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [loadDashboardData])

  return (
    <Box p={6} width="100%">
      <Stack spacing={6}>
        {/* Welcome Header */}
        {showWelcome && (
          <Card bg="gradient" bgGradient="linear(to-r, blue.500, purple.500)" position="relative">
            <IconButton
              aria-label="Close welcome message"
              icon={<FaTimes />}
              size="sm"
              position="absolute"
              top={2}
              right={2}
              variant="ghost"
              colorScheme="whiteAlpha"
              color="white"
              _hover={{ bg: 'whiteAlpha.300' }}
              onClick={() => setShowWelcome(false)}
            />
            <CardBody>
              <VStack align="start" spacing={2}>
                <Heading size="lg" color="white">
                  Welcome to Social Gathering
                </Heading>
                <Text color="whiteAlpha.900" fontSize="md">
                  Your all-in-one social media management tool for Twitter, Threads, and TikTok
                </Text>
                <Text color="whiteAlpha.700" fontSize="sm">
                  Version {getFullVersion()}
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Quick Stats */}
        <Box>
          <Heading size="md" mb={4}>Overview</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            <StatCard
              icon={MdPostAdd}
              label="Total Posts"
              value={stats.totalPosts}
              helpText="All time"
              colorScheme="blue"
            />
            <StatCard
              icon={MdPending}
              label="Pending Posts"
              value={stats.pendingPosts}
              helpText="Waiting to post"
              colorScheme="yellow"
            />
            <StatCard
              icon={FaCheckCircle}
              label="Posted Successfully"
              value={stats.postedPosts}
              helpText="Completed"
              colorScheme="green"
            />
            <StatCard
              icon={FaExclamationCircle}
              label="Failed Posts"
              value={stats.failedPosts}
              helpText="Need attention"
              colorScheme="red"
            />
          </SimpleGrid>
        </Box>

        {/* Scheduled Stats */}
        <Box>
          <Heading size="md" mb={4}>Scheduled Posts</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <StatCard
              icon={FaClock}
              label="Scheduled Today"
              value={stats.scheduledToday}
              helpText={new Date().toLocaleDateString()}
              colorScheme="orange"
            />
            <StatCard
              icon={MdSchedule}
              label="Scheduled This Week"
              value={stats.scheduledThisWeek}
              helpText="Next 7 days"
              colorScheme="purple"
            />
          </SimpleGrid>
        </Box>

        {/* Platform Breakdown */}
        <Box>
          <Heading size="md" mb={4}>Platform Breakdown</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            <StatCard
              icon={FaTwitter}
              label="Twitter / X"
              value={stats.twitterPosts}
              colorScheme="blue"
            />
            <StatCard
              icon={SiThreads}
              label="Threads"
              value={stats.threadsPosts}
              colorScheme="purple"
            />
            <StatCard
              icon={SiTiktok}
              label="TikTok"
              value={stats.tiktokPosts}
              colorScheme="pink"
            />
            <StatCard
              icon={FaFacebook}
              label="Facebook"
              value={stats.facebookPosts}
              colorScheme="blue"
            />
          </SimpleGrid>
        </Box>

        {/* Main Content Grid */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Upcoming Posts */}
          <Card>
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">Upcoming Posts</Heading>
                <Button
                  size="sm"
                  colorScheme="blue"
                  variant="ghost"
                  onClick={() => navigate('/calendar')}
                >
                  View Calendar
                </Button>
              </HStack>
            </CardHeader>
            <CardBody>
              {upcomingPosts.length === 0 ? (
                <Text color="gray.500" fontSize="sm">No upcoming scheduled posts</Text>
              ) : (
                <VStack align="stretch" spacing={3} divider={<Divider />}>
                  {upcomingPosts.map((post) => (
                    <HStack key={post.id} justify="space-between" align="start">
                      <HStack flex={1} spacing={3}>
                        <PlatformIcon platform={post.platform} />
                        <Box flex={1}>
                          <Text fontSize="sm" noOfLines={1}>
                            {post.text || 'Media only post'}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            <Icon as={FaCalendarAlt} mr={1} />
                            {new Date(post.scheduleTime!).toLocaleString()}
                          </Text>
                        </Box>
                      </HStack>
                      <PostStatusBadge status={post.status} />
                    </HStack>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">Recent Activity</Heading>
                <Button
                  size="sm"
                  colorScheme="blue"
                  variant="ghost"
                  onClick={() => navigate('/posting')}
                >
                  View All
                </Button>
              </HStack>
            </CardHeader>
            <CardBody>
              {recentPosts.length === 0 ? (
                <Text color="gray.500" fontSize="sm">No posts yet</Text>
              ) : (
                <VStack align="stretch" spacing={3} divider={<Divider />}>
                  {recentPosts.map((post) => (
                    <HStack key={post.id} justify="space-between" align="start">
                      <HStack flex={1} spacing={3}>
                        <PlatformIcon platform={post.platform} />
                        <Box flex={1}>
                          <Text fontSize="sm" noOfLines={1}>
                            {post.text || 'Media only post'}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Updated {new Date(post.updatedAt).toLocaleString()}
                          </Text>
                        </Box>
                      </HStack>
                      <PostStatusBadge status={post.status} />
                    </HStack>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <Heading size="md">Quick Actions</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <Button
                leftIcon={<Icon as={MdPostAdd} />}
                colorScheme="blue"
                onClick={() => navigate('/posting')}
                size="lg"
              >
                Create New Post
              </Button>
              <Button
                leftIcon={<Icon as={FaCalendarAlt} />}
                colorScheme="purple"
                onClick={() => navigate('/calendar')}
                size="lg"
              >
                View Calendar
              </Button>
              <Button
                leftIcon={<Icon as={MdSchedule} />}
                colorScheme="green"
                onClick={() => navigate('/posting')}
                size="lg"
              >
                Schedule Post
              </Button>
            </SimpleGrid>
          </CardBody>
        </Card>
      </Stack>
    </Box>
  )
}

export default Dashboard
