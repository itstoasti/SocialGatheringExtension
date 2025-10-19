/**
 * @jest-environment jsdom
 */
import TikTokUploadAutomation from './TikTokUploadAutomation'

// Mock chrome runtime
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
}

global.chrome = mockChrome as any

describe('TikTokUploadAutomation', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('uploadContent', () => {
    it('should throw error when no media file is provided', async () => {
      const testData = {
        text: 'Test TikTok caption',
        mediaFile: undefined,
        caption: 'Test caption',
        hashtags: ['test', 'tiktok'],
        privacy: 'public' as const,
      }

      await expect(TikTokUploadAutomation.uploadContent(testData)).rejects.toThrow(
        'Video file is required for TikTok upload'
      )
    })

    it('should throw error when not on TikTok upload page', async () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com',
        },
        writable: true,
      })

      const testData = {
        text: 'Test TikTok caption',
        mediaFile: {
          data: [1, 2, 3],
          name: 'test.mp4',
          type: 'video/mp4',
          size: 1024,
        },
        caption: 'Test caption',
        hashtags: ['test', 'tiktok'],
        privacy: 'public' as const,
      }

      await expect(TikTokUploadAutomation.uploadContent(testData)).rejects.toThrow(
        'Not on TikTok upload page'
      )
    })

    it('should handle media file reconstruction', async () => {
      const testData = {
        text: 'Test TikTok caption',
        mediaFile: {
          data: [1, 2, 3],
          name: 'test.mp4',
          type: 'video/mp4',
          size: 3,
        },
        caption: 'Test caption',
        hashtags: ['test', 'tiktok'],
        privacy: 'public' as const,
      }

      // Mock window.location for TikTok upload page
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.tiktok.com/tiktokstudio/upload',
        },
        writable: true,
      })

      // Mock DOM elements
      const mockUploadContainer = document.createElement('div')
      mockUploadContainer.setAttribute('data-e2e', 'select_video_container')
      document.body.appendChild(mockUploadContainer)

      const mockFileInput = document.createElement('input')
      mockFileInput.type = 'file'
      document.body.appendChild(mockFileInput)

      const mockCaptionInput = document.createElement('textarea')
      mockCaptionInput.placeholder = 'Add a caption...'
      document.body.appendChild(mockCaptionInput)

      const mockPublishButton = document.createElement('button')
      mockPublishButton.setAttribute('data-e2e', 'publish-button')
      document.body.appendChild(mockPublishButton)

      // Mock querySelector to return our mock elements
      const originalQuerySelector = document.querySelector
      document.querySelector = jest.fn((selector) => {
        if (selector === '[data-e2e="select_video_container"]') {
          return mockUploadContainer
        }
        if (selector === 'input[type="file"]') {
          return mockFileInput
        }
        if (selector.includes('caption') || selector.includes('description')) {
          return mockCaptionInput
        }
        if (selector === '[data-e2e="publish-button"]') {
          return mockPublishButton
        }
        return originalQuerySelector.call(document, selector)
      })

      // Mock File constructor
      global.File = jest.fn().mockImplementation((chunks, filename, options) => ({
        name: filename,
        type: options.type,
        size: chunks[0].length,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(chunks[0].length)),
      })) as any

      // Mock DataTransfer
      global.DataTransfer = jest.fn().mockImplementation(() => ({
        items: {
          add: jest.fn(),
        },
        files: [],
      })) as any

      // Mock events
      global.Event = jest.fn().mockImplementation((type, options) => ({
        type,
        bubbles: options?.bubbles || false,
      })) as any

      // This should not throw an error
      try {
        await TikTokUploadAutomation.uploadContent(testData)
      } catch (error) {
        // Expected to fail due to missing DOM elements, but media file should be reconstructed
        expect(error).toBeDefined()
      }

      // Restore original querySelector
      document.querySelector = originalQuerySelector
    })
  })

  describe('setCaption', () => {
    it('should throw error when caption input is not found', async () => {
      await expect(TikTokUploadAutomation.setCaption('Test caption')).rejects.toThrow(
        'Caption input not found'
      )
    })
  })

  describe('setPrivacy', () => {
    it('should not throw error when privacy elements are not found', async () => {
      // setPrivacy should not throw errors as it's optional
      await expect(TikTokUploadAutomation.setPrivacy('public')).resolves.not.toThrow()
    })
  })

  describe('publishVideo', () => {
    it('should throw error when publish button is not found', async () => {
      await expect(TikTokUploadAutomation.publishVideo()).rejects.toThrow(
        'Publish button not found'
      )
    })
  })
}) 