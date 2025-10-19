# TikTok Integration & Automation

TweetSavvy now supports TikTok integration alongside Twitter functionality, allowing users to upload videos, manage captions, and automate TikTok posting through the same interface.

## Features

### 🎬 TikTok Video Upload
- **One-click video upload** to TikTok Studio
- **Drag and drop** or **file selection** upload methods
- **Video processing** with automatic completion detection
- **Multi-format support** for various video types

### 📝 Caption & Content Management
- **Caption input** with support for plain text and rich content
- **Hashtag management** with automatic # prefix handling
- **Privacy settings** (Public, Friends, Private)
- **Character limit** awareness and validation

### 🔄 Queue & Scheduling System
- **Post queuing** for TikTok videos
- **Scheduled uploads** with Chrome alarms integration
- **Auto-posting** with configurable intervals and time windows
- **Batch processing** for multiple TikTok videos

### 🎯 Smart Automation
- **Automatic form filling** on TikTok Studio upload page
- **Upload progress monitoring** with timeout handling
- **Error recovery** with retry mechanisms
- **Platform detection** and appropriate handling

## Usage

### Basic Upload

1. **Select Platform**: Choose "TikTok" from the platform dropdown
2. **Upload Video**: Click "Media" button and select your video file
3. **Add Caption**: Enter your caption text (optional)
4. **Set Privacy**: Choose between Public, Friends, or Private
5. **Add Hashtags**: Add relevant hashtags (automatically prefixed with #)
6. **Post Now**: Click "Post Now" to upload immediately

### Queue Management

```javascript
// Add to queue
await postingUseCases.addToQueue({
  text: 'Check out this awesome video!',
  caption: 'My latest TikTok creation',
  hashtags: ['viral', 'trending', 'awesome'],
  privacy: 'public',
  platform: 'tiktok',
  mediaFile: videoFile
})

// Schedule for later
await postingUseCases.schedulePost({
  text: 'Scheduled TikTok upload',
  caption: 'This will be posted at the scheduled time',
  hashtags: ['scheduled', 'automated'],
  privacy: 'public',
  platform: 'tiktok',
  mediaFile: videoFile,
  scheduleTime: '2024-01-15T10:00:00Z'
})
```

### Auto-posting Configuration

Auto-posting works for both Twitter and TikTok:

```javascript
// Configure auto-posting settings
const settings = {
  autoPostingEnabled: true,
  postingIntervalMinutes: 120, // 2 hours
  allowedTimeRange: {
    start: '09:00',
    end: '17:00'
  },
  allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  maxPostsPerDay: 3,
  pauseWhenLow: true,
  minQueueSize: 2
}
```

## Technical Implementation

### Architecture

```
TikTok Integration
├── Content Script (TikTokUploadAutomation.ts)
├── Domain Layer
│   ├── Value Objects (TikTokPost, TikTokUser, TikTokPostInfo)
│   ├── Use Cases (PostingUseCases with TikTok support)
│   └── Repositories (Extended PostingRepository)
├── Service Worker (TikTok message handlers)
├── UI Components (Platform selection, TikTok fields)
└── Queue System (Multi-platform support)
```

### Key Components

#### TikTokUploadAutomation
- **Upload Methods**: File input, drag-drop, button click
- **Form Automation**: Caption setting, privacy selection
- **Progress Monitoring**: Upload completion detection
- **Error Handling**: Retry mechanisms and fallbacks

#### Domain Models
```typescript
interface TikTokPost {
  id: string
  caption: string
  hashtags: string[]
  videoUrl: string
  privacy: 'public' | 'friends' | 'private'
  user: TikTokUser
  // ... other properties
}

interface PostData {
  platform: 'twitter' | 'tiktok'
  caption?: string
  hashtags?: string[]
  privacy?: 'public' | 'friends' | 'private'
  // ... existing properties
}
```

#### Message Handling
```typescript
// Service Worker message types
'UPLOAD_TIKTOK_NOW' -> handleTikTokUploadNow()
'UPLOAD_TIKTOK_CONTENT' -> TikTokUploadAutomation.uploadContent()
```

## Upload Process Flow

1. **User Interface**: User selects TikTok platform and fills form
2. **Validation**: Video file requirement and field validation
3. **Serialization**: File conversion for Chrome message passing
4. **Service Worker**: Message routing to appropriate handler
5. **Tab Creation**: TikTok Studio upload page opened
6. **Content Script**: TikTokUploadAutomation takes over
7. **Upload Process**: 
   - Video file upload via multiple methods
   - Progress monitoring and completion detection
   - Caption and settings application
   - Final publishing
8. **Completion**: Success notification and cleanup

## Supported Selectors

The automation uses TikTok's data-e2e attributes for reliable element detection:

```typescript
const SELECTORS = {
  UPLOAD_CONTAINER: '[data-e2e="select_video_container"]',
  UPLOAD_BUTTON: '[data-e2e="select_video_button"]',
  CAPTION_INPUT: 'div[data-text="true"]',
  PRIVACY_BUTTON: '[data-e2e="privacy-button"]',
  PUBLISH_BUTTON: '[data-e2e="publish-button"]'
}
```

## Error Handling

### Common Issues and Solutions

1. **Upload Timeout**: Video processing took too long
   - Solution: Increase `UPLOAD_TIMEOUT` or retry with smaller file
   
2. **Element Not Found**: TikTok UI changed
   - Solution: Update selectors in `TikTokUploadAutomation.ts`
   
3. **File Size Limit**: Video file too large
   - Solution: Compress video or use TikTok's recommended specs

4. **Privacy Settings**: Cannot set privacy level
   - Solution: Ensure user has appropriate TikTok account permissions

### Debugging

Enable debug logging:
```javascript
console.log('🎬 TikTok upload debug mode enabled')
```

## Configuration

### Manifest Permissions
```json
{
  "host_permissions": [
    "*://www.tiktok.com/*",
    "*://tiktok.com/*",
    "*://*.tiktok.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "*://www.tiktok.com/*",
        "*://tiktok.com/*"
      ]
    }
  ]
}
```

### Platform Detection
```typescript
export const isTikTok = (): boolean => {
  const host = window.location.host
  return host === 'www.tiktok.com' || host === 'tiktok.com'
}

export const isTikTokStudioUpload = (): boolean => {
  return isTikTok() && window.location.pathname.includes('tiktokstudio/upload')
}
```

## Future Enhancements

- **TikTok Analytics**: Integration with TikTok's analytics API
- **Trending Hashtags**: Auto-suggestion based on trending content
- **Video Editing**: Basic video editing capabilities
- **Duet Support**: Automation for duet and stitch creation
- **TikTok Live**: Integration with TikTok Live streaming
- **Multiple Accounts**: Support for multiple TikTok accounts

## Testing

Run TikTok integration tests:
```bash
npm test -- --testPathPattern=TikTokUploadAutomation.test.ts
```

## Troubleshooting

### Common Issues

1. **TikTok Studio Not Loading**
   - Check internet connection
   - Verify TikTok account is logged in
   - Clear browser cache and cookies

2. **Upload Fails**
   - Ensure video meets TikTok's requirements
   - Check file size and format
   - Verify sufficient storage space

3. **Automation Stops**
   - Check if TikTok updated their UI
   - Review console logs for errors
   - Update selectors if necessary

### Support

For issues specific to TikTok integration:
1. Check the browser console for error messages
2. Verify you're on the correct TikTok Studio upload page
3. Ensure your TikTok account has upload permissions
4. Try uploading manually to confirm TikTok functionality

---

**Note**: This integration relies on TikTok's web interface and may require updates if TikTok changes their UI structure. Always test thoroughly before using in production. 