/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React, { useState, useCallback, useRef } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Progress,
  Card,
  CardBody,
  Textarea,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  useToast,
  Alert,
  AlertIcon,
  Badge,
  IconButton,
  Divider,
} from '@chakra-ui/react'
import { DeleteIcon } from '@chakra-ui/icons'
import { getText as i18n } from '#libs/i18n'
import type { PostingUseCases } from '#domain/useCases/posting'

interface BatchFile {
  id: string
  file: File
  text: string
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  preview?: string
  pairedTextFile?: File
  isPaired?: boolean
}

interface EnhancedBatchUploadProps {
  postingUseCases: PostingUseCases
  onComplete?: () => void
}

export const EnhancedBatchUpload: React.FC<EnhancedBatchUploadProps> = ({
  postingUseCases,
  onComplete
}) => {
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [customTemplate, setCustomTemplate] = useState('')
  const [globalText, setGlobalText] = useState('')
  const [useGlobalText, setUseGlobalText] = useState(false)
  const [autoPairFiles, setAutoPairFiles] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // File utilities
  const getBaseFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.')
    const baseNameWithoutExt = lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex)
    
    // Smart matching for Social Gathering filename patterns
    // Convert patterns like: username-123456-01, username-123456-text → username-123456
    const tweetMatch = baseNameWithoutExt.match(/^(.+)-(\d+)-(.+)$/)
    if (tweetMatch) {
      const [, account, tweetId, suffix] = tweetMatch
      // If suffix is a number (serial) or "text", use account-tweetId as base
      if (/^\d+$/.test(suffix) || suffix === 'text') {
        return `${account}-${tweetId}`
      }
    }
    
    // Fallback to original logic
    return baseNameWithoutExt
  }

  const isMediaFile = (file: File): boolean => {
    return file.type.startsWith('image/') || file.type.startsWith('video/')
  }

  const isTextFile = (file: File): boolean => {
    return file.type === 'text/plain'
  }

  const isValidFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/mov', 'text/plain']
    const maxSize = 50 * 1024 * 1024 // 50MB
    return validTypes.includes(file.type) && file.size <= maxSize
  }

  const generateTextForFile = async (file: File, index: number): Promise<string> => {
    let result = ''
    
    if (useGlobalText && globalText.trim()) {
      result = globalText.trim()
      console.log('🌐 Using global text:', result)
    } else if (customTemplate.trim()) {
      const filename = file.name.replace(/\.[^/.]+$/, '') // Remove extension
      const time = new Date().toLocaleString()
      
      result = customTemplate
        .replace(/\{filename\}/g, filename)
        .replace(/\{index\}/g, index.toString())
        .replace(/\{time\}/g, time)
      console.log('📝 Using custom template result:', result)
    } else {
      // Default fallback - just filename
      result = file.name.replace(/\.[^/.]+$/, '')
      console.log('📄 Using filename as default text:', result)
    }
    
    return result
  }

  const pairFiles = (files: File[]): { pairedFiles: Map<string, { media: File, text?: File }>, unpairedFiles: File[] } => {
    const mediaFiles: Map<string, File> = new Map()
    const textFiles: Map<string, File> = new Map()
    const unpairedFiles: File[] = []

    files.forEach(file => {
      if (isMediaFile(file)) {
        const baseName = getBaseFileName(file.name)
        mediaFiles.set(baseName, file)
      } else if (isTextFile(file)) {
        const baseName = getBaseFileName(file.name)
        textFiles.set(baseName, file)
      } else {
        unpairedFiles.push(file)
      }
    })

    const pairedFiles: Map<string, { media: File, text?: File }> = new Map()
    
    mediaFiles.forEach((mediaFile, baseName) => {
      const textFile = textFiles.get(baseName)
      pairedFiles.set(baseName, { media: mediaFile, text: textFile })
      if (textFile) {
        textFiles.delete(baseName)
      }
    })

    textFiles.forEach((textFile) => {
      unpairedFiles.push(textFile)
    })

    return { pairedFiles, unpairedFiles }
  }

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      processFiles(files)
    }
  }, [])

  const processFiles = useCallback(async (files: File[]) => {
    const validFiles: BatchFile[] = []
    let skippedCount = 0
    let fileIndex = 0

    if (autoPairFiles) {
      const { pairedFiles, unpairedFiles } = pairFiles(files)
      
      // Process paired files
      for (const [baseName, { media, text }] of pairedFiles) {
        if (!isValidFile(media)) {
          skippedCount++
          continue
        }

        let textContent = ''
        if (text) {
          try {
            console.log('📄 Reading text file:', text.name, 'size:', text.size)
            textContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = (e) => {
                const content = e.target?.result as string || ''
                console.log('✅ Text file content read:', content.substring(0, 100) + (content.length > 100 ? '...' : ''))
                resolve(content)
              }
              reader.onerror = (error) => {
                console.error('❌ Error reading text file:', error)
                reject(error)
              }
              // Explicitly specify UTF-8 encoding
              reader.readAsText(text, 'UTF-8')
            })
            
            // Ensure we have valid content
            if (!textContent || textContent.trim() === '') {
              console.warn('⚠️ Empty text file content, using fallback')
              textContent = await generateTextForFile(media, fileIndex + 1)
            } else {
              console.log('✅ Using text file content:', textContent.length, 'characters')
            }
          } catch (error) {
            console.error('❌ Error reading text file:', error)
            textContent = await generateTextForFile(media, fileIndex + 1)
          }
        } else {
          console.log('📝 No paired text file, generating default text')
          textContent = await generateTextForFile(media, fileIndex + 1)
        }

        const batchFile: BatchFile = {
          id: `${Date.now()}-${fileIndex}`,
          file: media,
          text: textContent,
          status: 'pending',
          pairedTextFile: text,
          isPaired: !!text
        }

        if (media.type.startsWith('image/')) {
          batchFile.preview = URL.createObjectURL(media)
        }

        console.log('📦 Created batch file:', {
          id: batchFile.id,
          fileName: media.name,
          textLength: textContent.length,
          textPreview: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : ''),
          isPaired: batchFile.isPaired,
          pairedTextFileName: text?.name || 'none'
        })

        validFiles.push(batchFile)
        fileIndex++
      }

      // Process unpaired files
      for (const file of unpairedFiles) {
        if (!isValidFile(file)) {
          skippedCount++
          continue
        }

        if (isTextFile(file)) {
          skippedCount++
          continue
        }

        const batchFile: BatchFile = {
          id: `${Date.now()}-${fileIndex}`,
          file,
          text: await generateTextForFile(file, fileIndex + 1),
          status: 'pending',
          isPaired: false
        }

        if (file.type.startsWith('image/')) {
          batchFile.preview = URL.createObjectURL(file)
        }

        validFiles.push(batchFile)
        fileIndex++
      }
    } else {
      // Process all files individually
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        if (!isValidFile(file)) {
          skippedCount++
          continue
        }

        const batchFile: BatchFile = {
          id: `${Date.now()}-${i}`,
          file,
          text: await generateTextForFile(file, i + 1),
          status: 'pending',
          isPaired: false
        }

        if (file.type.startsWith('image/')) {
          batchFile.preview = URL.createObjectURL(file)
        }

        validFiles.push(batchFile)
      }
    }

    setBatchFiles(prev => [...prev, ...validFiles])

    if (skippedCount > 0) {
      toast({
        title: 'Some files skipped',
        description: `${skippedCount} files were skipped (unsupported type or too large)`,
        status: 'warning',
        duration: 3000,
      })
    }

    toast({
      title: 'Files processed',
      description: `${validFiles.length} files ready for upload`,
      status: 'success',
      duration: 3000,
    })
  }, [autoPairFiles, customTemplate, globalText, useGlobalText, toast])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      processFiles(files)
    }
  }, [processFiles])

  const removeFile = useCallback((id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const updateFileText = useCallback((id: string, newText: string) => {
    setBatchFiles(prev => prev.map(f => 
      f.id === id ? { ...f, text: newText } : f
    ))
  }, [])

  const processBatch = useCallback(async () => {
    if (batchFiles.length === 0) return

    setIsProcessing(true)
    setUploadProgress(0)

    const totalFiles = batchFiles.length
    let processedFiles = 0

    for (const batchFile of batchFiles) {
      try {
        setBatchFiles(prev => prev.map(f => 
          f.id === batchFile.id ? { ...f, status: 'uploading' } : f
        ))

        console.log('🚀 Adding to queue:', {
          fileName: batchFile.file.name,
          fileType: batchFile.file.type,
          text: batchFile.text,
          hasMediaFile: batchFile.file.type.startsWith('image/') || batchFile.file.type.startsWith('video/'),
          hasTextFile: batchFile.file.type === 'text/plain'
        })

        const result = await postingUseCases.addToQueue({
          text: batchFile.text,
          mediaFile: batchFile.file.type.startsWith('image/') || batchFile.file.type.startsWith('video/') 
            ? batchFile.file : undefined,
          textFile: batchFile.file.type === 'text/plain' ? batchFile.file : undefined,
        })

        console.log('✅ Added to queue successfully:', result)

        setBatchFiles(prev => prev.map(f => 
          f.id === batchFile.id ? { ...f, status: 'completed' } : f
        ))

        processedFiles++
        setUploadProgress((processedFiles / totalFiles) * 100)
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        setBatchFiles(prev => prev.map(f => 
          f.id === batchFile.id ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          } : f
        ))

        processedFiles++
        setUploadProgress((processedFiles / totalFiles) * 100)
      }
    }

    setIsProcessing(false)
    const successCount = batchFiles.filter(f => f.status === 'completed').length
    
    toast({
      title: 'Batch upload completed',
      description: `${successCount} files uploaded successfully to queue`,
      status: 'success',
      duration: 5000,
    })

    console.log('🎉 Batch upload completed, calling onComplete callback')
    if (onComplete) {
      onComplete()
      console.log('✅ onComplete callback called')
    } else {
      console.log('⚠️ No onComplete callback provided')
    }
  }, [batchFiles, postingUseCases, toast, onComplete])

  const clearCompleted = useCallback(() => {
    setBatchFiles(prev => prev.filter(f => f.status !== 'completed'))
  }, [])

  const clearAll = useCallback(() => {
    setBatchFiles([])
    setUploadProgress(0)
  }, [])

  return (
    <VStack spacing={4} align="stretch">
      {/* Simplified Settings */}
      <Card>
        <CardBody>
          <VStack spacing={3} align="stretch">
            <Text fontSize="md" fontWeight="bold">📂 Batch Upload Settings</Text>
            
            {/* Auto-pair setting - most prominent */}
            <Card variant="outline" borderColor="purple.200">
              <CardBody>
                <Checkbox
                  isChecked={autoPairFiles}
                  onChange={(e) => setAutoPairFiles(e.target.checked)}
                  colorScheme="purple"
                  size="lg"
                >
                  <Text fontWeight="medium">🔗 Auto-pair media and text files</Text>
                </Checkbox>
                <Text fontSize="xs" color="gray.600" mt={2}>
                  💡 Pairs files with matching names
                </Text>
              </CardBody>
            </Card>

            <Divider />

            {/* Global text option */}
            <Checkbox
              isChecked={useGlobalText}
              onChange={(e) => setUseGlobalText(e.target.checked)}
            >
              Use same text for all files
            </Checkbox>

            {useGlobalText && (
              <FormControl>
                <FormLabel>Global Text</FormLabel>
                <Textarea
                  value={globalText}
                  onChange={(e) => setGlobalText(e.target.value)}
                  placeholder="This text will be used for all files"
                  rows={3}
                />
              </FormControl>
            )}

            {/* Custom template option */}
            {!useGlobalText && (
              <FormControl>
                <FormLabel>Custom Template (Optional)</FormLabel>
                <Textarea
                  value={customTemplate}
                  onChange={(e) => setCustomTemplate(e.target.value)}
                  placeholder="Leave empty to use filename. Use {filename}, {index}, {time} as placeholders"
                  rows={2}
                />
              </FormControl>
            )}
          </VStack>
        </CardBody>
      </Card>

      {/* File Drop Zone */}
      <Box
        border="2px dashed"
        borderColor={dragActive ? "blue.400" : "gray.300"}
        borderRadius="lg"
        p={4}
        textAlign="center"
        bg={dragActive ? "blue.50" : "gray.50"}
        transition="all 0.2s"
        cursor="pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <VStack spacing={2}>
          <Text fontSize="md" fontWeight="bold" color={dragActive ? "blue.600" : "gray.600"}>
            {dragActive ? "Drop files here" : "Drag & drop or click"}
          </Text>
          <Text fontSize="xs" color="gray.500" textAlign="center">
            Images, Videos, Text files
          </Text>
          {autoPairFiles && (
            <Text fontSize="xs" color="purple.600" fontWeight="medium" textAlign="center">
              🔗 Auto-pairing enabled
            </Text>
          )}
          <Text fontSize="xs" color="gray.400">
            Max: 50MB
          </Text>
        </VStack>
        
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,text/plain,.txt"
          onChange={handleFileSelect}
          display="none"
        />
      </Box>

      {/* Progress Bar */}
      {isProcessing && (
        <Box>
          <Text fontSize="sm" mb={2}>Processing batch upload...</Text>
          <Progress value={uploadProgress} colorScheme="blue" />
        </Box>
      )}

      {/* File List */}
      {batchFiles.length > 0 && (
        <Card>
          <CardBody>
            <VStack spacing={3} align="stretch">
              <VStack spacing={2} align="stretch">
                <Text fontSize="md" fontWeight="bold">
                  Files ({batchFiles.length})
                </Text>
                <HStack spacing={2}>
                  <Button size="xs" onClick={clearCompleted} variant="outline" flex={1}>
                    Clear Done
                  </Button>
                  <Button size="xs" onClick={clearAll} variant="outline" flex={1}>
                    Clear All
                  </Button>
                  <Button 
                    size="xs" 
                    colorScheme="purple" 
                    onClick={processBatch}
                    isLoading={isProcessing}
                    loadingText="Processing..."
                    flex={1}
                  >
                    Upload
                  </Button>
                </HStack>
              </VStack>

              <Divider />

              <VStack spacing={2}>
                {batchFiles.map((batchFile) => (
                  <Card key={batchFile.id} size="sm" width="100%">
                    <CardBody>
                      <VStack spacing={2} align="stretch">
                        <HStack spacing={2}>
                          {batchFile.preview && (
                            <Box flexShrink={0}>
                              <img 
                                src={batchFile.preview} 
                                alt={batchFile.file.name}
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            </Box>
                          )}
                          
                          <VStack align="start" flex={1} spacing={1} minW={0}>
                            <Text fontSize="xs" fontWeight="bold" noOfLines={2} wordBreak="break-all">
                              {batchFile.file.name}
                            </Text>
                            <HStack spacing={1} flexWrap="wrap">
                              <Badge 
                                colorScheme={
                                  batchFile.status === 'completed' ? 'green' :
                                  batchFile.status === 'error' ? 'red' :
                                  batchFile.status === 'uploading' ? 'blue' : 'gray'
                                }
                                size="sm"
                              >
                                {batchFile.status}
                              </Badge>
                              {batchFile.isPaired && (
                                <Badge colorScheme="purple" size="sm">
                                  🔗
                                </Badge>
                              )}
                            </HStack>
                            <Text fontSize="xs" color="gray.500">
                              {(batchFile.file.size / 1024).toFixed(1)} KB
                            </Text>
                          </VStack>
                          
                          <IconButton
                            aria-label="Remove file"
                            icon={<DeleteIcon />}
                            size="xs"
                            variant="ghost"
                            onClick={() => removeFile(batchFile.id)}
                            isDisabled={batchFile.status === 'uploading'}
                            flexShrink={0}
                          />
                        </HStack>
                        
                        {batchFile.pairedTextFile && (
                          <Text fontSize="xs" color="purple.600" fontWeight="medium" noOfLines={1}>
                            📄 Text: {batchFile.pairedTextFile.name}
                          </Text>
                        )}
                        
                        <Textarea
                          size="sm"
                          value={batchFile.text}
                          onChange={(e) => updateFileText(batchFile.id, e.target.value)}
                          placeholder="Post text..."
                          rows={2}
                          isDisabled={batchFile.status === 'uploading' || batchFile.status === 'completed'}
                        />
                        
                        {batchFile.error && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <Text fontSize="xs">{batchFile.error}</Text>
                          </Alert>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  )
} 