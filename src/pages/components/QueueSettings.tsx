/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Switch,
  Select,
  CheckboxGroup,
  Checkbox,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useToast,
  Alert,
  AlertIcon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Badge,
  Tooltip,
  SimpleGrid,
  Icon,
} from '@chakra-ui/react'
import { InfoIcon, TimeIcon, CalendarIcon, SettingsIcon } from '@chakra-ui/icons'
import { getText as i18n } from '#libs/i18n'
import type { QueueSettings as QueueSettingsType, QueueSettingsRepository, QueueStatistics } from '#domain/repositories/queueSettings'

interface QueueSettingsProps {
  queueSettingsRepository: QueueSettingsRepository
  onSettingsChange?: (settings: QueueSettingsType) => void
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`
}))

export const QueueSettings: React.FC<QueueSettingsProps> = ({
  queueSettingsRepository,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<QueueSettingsType>({
    autoPostingEnabled: false,
    postingIntervalMinutes: 60,
    allowedTimeRange: { startHour: 9, endHour: 21 },
    allowedDays: [1, 2, 3, 4, 5, 6, 7],
    maxPostsPerDay: 10,
    randomizeTimings: true,
    randomRangeMinutes: 15,
    pauseWhenLow: true,
    minQueueSize: 3
  })
  
  const [statistics, setStatistics] = useState<QueueStatistics>({
    totalPostsInQueue: 0,
    postsPostedToday: 0,
    autoPostingActive: false
  })
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const toast = useToast()

  // Load settings and statistics
  useEffect(() => {
    loadSettings()
    loadStatistics()
    
    // Set up periodic stats refresh
    const interval = setInterval(loadStatistics, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const currentSettings = await queueSettingsRepository.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error('Error loading queue settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load queue settings',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }, [queueSettingsRepository, toast])

  const loadStatistics = useCallback(async () => {
    try {
      const currentStats = await queueSettingsRepository.getStatistics()
      setStatistics(currentStats)
    } catch (error) {
      console.error('Error loading queue statistics:', error)
    }
  }, [queueSettingsRepository])

  const saveSettings = useCallback(async () => {
    setIsSaving(true)
    try {
      await queueSettingsRepository.saveSettings(settings)
      
      if (onSettingsChange) {
        onSettingsChange(settings)
      }
      
      await loadStatistics() // Refresh stats after settings change
      
      toast({
        title: 'Settings saved',
        description: 'Queue settings have been updated successfully',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error saving queue settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save queue settings',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setIsSaving(false)
    }
  }, [settings, queueSettingsRepository, onSettingsChange, toast, loadStatistics])

  const resetSettings = useCallback(async () => {
    try {
      await queueSettingsRepository.resetSettings()
      await loadSettings()
      await loadStatistics()
      
      toast({
        title: 'Settings reset',
        description: 'Queue settings have been reset to default values',
        status: 'info',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error resetting queue settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to reset queue settings',
        status: 'error',
        duration: 3000,
      })
    }
  }, [queueSettingsRepository, toast, loadSettings, loadStatistics])

  const updateSetting = useCallback(<K extends keyof QueueSettingsType>(
    key: K,
    value: QueueSettingsType[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const formatTimeUntilNext = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <Text>Loading queue settings...</Text>
        </CardBody>
      </Card>
    )
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Statistics Dashboard */}
      <Card>
        <CardHeader>
          <HStack>
            <Icon as={SettingsIcon} />
            <Text fontSize="lg" fontWeight="bold">Queue Statistics</Text>
          </HStack>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat>
              <StatLabel>Posts in Queue</StatLabel>
              <StatNumber>{statistics.totalPostsInQueue}</StatNumber>
              <StatHelpText>Ready to post</StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Posted Today</StatLabel>
              <StatNumber>{statistics.postsPostedToday}</StatNumber>
              <StatHelpText>of {settings.maxPostsPerDay} max</StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Auto-posting</StatLabel>
              <StatNumber>
                <Badge 
                  colorScheme={statistics.autoPostingActive ? 'green' : 'gray'}
                  fontSize="sm"
                >
                  {statistics.autoPostingActive ? 'Active' : 'Inactive'}
                </Badge>
              </StatNumber>
              <StatHelpText>Current status</StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Next Post</StatLabel>
              <StatNumber fontSize="sm">
                {statistics.nextPostTime 
                  ? statistics.nextPostTime.toLocaleTimeString()
                  : 'N/A'
                }
              </StatNumber>
              <StatHelpText>
                {statistics.timeUntilNextPost 
                  ? `in ${formatTimeUntilNext(statistics.timeUntilNextPost)}`
                  : 'Not scheduled'
                }
              </StatHelpText>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Main Settings */}
      <Card>
        <CardHeader>
          <HStack>
            <Icon as={TimeIcon} />
            <Text fontSize="lg" fontWeight="bold">Auto-posting Settings</Text>
          </HStack>
        </CardHeader>
        <CardBody>
          <VStack spacing={6} align="stretch">
            {/* Enable/Disable Auto-posting */}
            <FormControl>
              <HStack justify="space-between">
                <VStack align="start" spacing={1}>
                  <Text fontWeight="medium">Enable Auto-posting</Text>
                  <Text fontSize="sm" color="gray.600">
                    Automatically post from queue at specified intervals
                  </Text>
                </VStack>
                <Switch
                  size="lg"
                  isChecked={settings.autoPostingEnabled}
                  onChange={(e) => updateSetting('autoPostingEnabled', e.target.checked)}
                />
              </HStack>
            </FormControl>

            {settings.autoPostingEnabled && (
              <>
                <Divider />
                
                {/* Posting Interval */}
                <FormControl>
                  <FormLabel>Posting Interval</FormLabel>
                  <HStack spacing={4}>
                    <NumberInput
                      value={settings.postingIntervalMinutes}
                      onChange={(_, value) => updateSetting('postingIntervalMinutes', value)}
                      min={5}
                      max={1440}
                      step={5}
                      width="120px"
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <Text>minutes between posts</Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Time to wait between automatic posts (5-1440 minutes)
                  </Text>
                </FormControl>

                {/* Time Range */}
                <FormControl>
                  <FormLabel>Allowed Time Range</FormLabel>
                  <HStack spacing={4}>
                    <Select
                      value={settings.allowedTimeRange.startHour}
                      onChange={(e) => updateSetting('allowedTimeRange', {
                        ...settings.allowedTimeRange,
                        startHour: parseInt(e.target.value)
                      })}
                      width="120px"
                    >
                      {hourOptions.map(hour => (
                        <option key={hour.value} value={hour.value}>
                          {hour.label}
                        </option>
                      ))}
                    </Select>
                    <Text>to</Text>
                    <Select
                      value={settings.allowedTimeRange.endHour}
                      onChange={(e) => updateSetting('allowedTimeRange', {
                        ...settings.allowedTimeRange,
                        endHour: parseInt(e.target.value)
                      })}
                      width="120px"
                    >
                      {hourOptions.map(hour => (
                        <option key={hour.value} value={hour.value}>
                          {hour.label}
                        </option>
                      ))}
                    </Select>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Posts will only be sent during this time range
                  </Text>
                </FormControl>

                {/* Allowed Days */}
                <FormControl>
                  <FormLabel>Allowed Days</FormLabel>
                                      <CheckboxGroup
                      value={settings.allowedDays.map(d => d.toString())}
                      onChange={(values) => updateSetting('allowedDays', (values as string[]).map(v => parseInt(v)))}
                    >
                      <HStack spacing={4}>
                        {dayNames.map((day, index) => (
                          <Checkbox key={index} value={index.toString()}>
                            {day}
                          </Checkbox>
                        ))}
                      </HStack>
                    </CheckboxGroup>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Days of the week when auto-posting is allowed
                  </Text>
                </FormControl>

                {/* Max Posts Per Day */}
                <FormControl>
                  <FormLabel>Maximum Posts Per Day</FormLabel>
                  <HStack spacing={4}>
                    <NumberInput
                      value={settings.maxPostsPerDay}
                      onChange={(_, value) => updateSetting('maxPostsPerDay', value)}
                      min={1}
                      max={50}
                      width="120px"
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <Text>posts maximum</Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Auto-posting will stop after reaching this daily limit
                  </Text>
                </FormControl>

                <Divider />

                {/* Advanced Settings */}
                <Text fontSize="md" fontWeight="bold">Advanced Settings</Text>

                {/* Randomize Timings */}
                <FormControl>
                  <HStack justify="space-between">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium">Randomize Timings</Text>
                      <Text fontSize="sm" color="gray.600">
                        Add random variation to posting times
                      </Text>
                    </VStack>
                    <Switch
                      isChecked={settings.randomizeTimings}
                      onChange={(e) => updateSetting('randomizeTimings', e.target.checked)}
                    />
                  </HStack>
                </FormControl>

                {settings.randomizeTimings && (
                  <FormControl>
                    <FormLabel>Random Range (± minutes)</FormLabel>
                    <HStack spacing={4}>
                      <Slider
                        value={settings.randomRangeMinutes}
                        onChange={(value) => updateSetting('randomRangeMinutes', value)}
                        min={0}
                        max={60}
                        step={5}
                        width="200px"
                      >
                        <SliderTrack>
                          <SliderFilledTrack />
                        </SliderTrack>
                        <SliderThumb />
                      </Slider>
                      <Text minWidth="60px">±{settings.randomRangeMinutes}m</Text>
                    </HStack>
                  </FormControl>
                )}

                {/* Pause When Low */}
                <FormControl>
                  <HStack justify="space-between">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium">Pause When Queue Low</Text>
                      <Text fontSize="sm" color="gray.600">
                        Pause auto-posting when queue has few items
                      </Text>
                    </VStack>
                    <Switch
                      isChecked={settings.pauseWhenLow}
                      onChange={(e) => updateSetting('pauseWhenLow', e.target.checked)}
                    />
                  </HStack>
                </FormControl>

                {settings.pauseWhenLow && (
                  <FormControl>
                    <FormLabel>Minimum Queue Size</FormLabel>
                    <HStack spacing={4}>
                      <NumberInput
                        value={settings.minQueueSize}
                        onChange={(_, value) => updateSetting('minQueueSize', value)}
                        min={1}
                        max={20}
                        width="120px"
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <Text>posts minimum</Text>
                    </HStack>
                  </FormControl>
                )}
              </>
            )}
          </VStack>
        </CardBody>
      </Card>

      {/* Action Buttons */}
      <HStack spacing={4} justify="flex-end">
        <Button onClick={resetSettings} variant="outline">
          Reset to Defaults
        </Button>
        <Button
          onClick={saveSettings}
          colorScheme="blue"
          isLoading={isSaving}
          loadingText="Saving..."
        >
          Save Settings
        </Button>
      </HStack>

      {/* Warning for new users */}
      {settings.autoPostingEnabled && statistics.totalPostsInQueue === 0 && (
        <Alert status="warning">
          <AlertIcon />
          <Text>
            Auto-posting is enabled but your queue is empty. Add posts to your queue to start automatic posting.
          </Text>
        </Alert>
      )}
    </VStack>
  )
} 