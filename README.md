# Social Gathering

**Your all-in-one social media management tool**

Manage, schedule, and post content across multiple social media platforms with ease.

## Features

### Multi-Platform Posting
- [x] **Twitter/X** - Post tweets with text and media
- [x] **Threads** - Create and post threads with images
- [x] **TikTok** - Upload videos with captions and hashtags
- [x] **Facebook** - Share posts with text and images

### Content Management
- [x] **Post Scheduling** - Schedule posts for future dates and times
- [x] **Multi-Platform Publishing** - Post to multiple platforms simultaneously
- [x] **Media Support** - Upload images and videos with your posts
- [x] **Post Queue** - Manage your scheduled and pending posts
- [x] **Post History** - Track all your posted content

### Dashboard & Calendar
- [x] **Analytics Dashboard** - View post statistics and platform breakdown
- [x] **Calendar View** - Visualize your scheduled posts in a calendar
- [x] **Post Status Tracking** - Monitor pending, posted, and failed posts
- [x] **Platform Statistics** - See post counts per platform

### Advanced Features
- [x] **Auto Tab Close** - Automatically close tabs after posting (optional)
- [x] **Content Preview** - Review posts before publishing
- [x] **Batch Operations** - Manage multiple posts efficiently
- [x] **Clean Architecture** - Built with modern design patterns
- [x] **Local Storage** - All data stored locally, no cloud dependency

## Installation

### Chrome / Edge

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run build:chrome:all:dev` to build the extension
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `build/chrome-dev` directory
7. The extension is now installed and ready to use!

### Development Mode

For development with hot reload:
```bash
npm install
npm run build:chrome:all:dev
```

For production build:
```bash
npm run build:chrome:all
```

## How It Works

Social Gathering uses browser automation to interact with social media platforms:

1. **Create a Post** - Enter your text, upload media, and select platforms
2. **Schedule or Post** - Choose to post immediately or schedule for later
3. **Automated Posting** - The extension opens the platform and fills in your content
4. **Track Progress** - Monitor post status in the Dashboard and Calendar

### Supported Platforms

- **Twitter/X** (`https://twitter.com`) - Automated tweet posting with media
- **Threads** (`https://threads.net`) - Automated thread creation with images
- **TikTok** (`https://www.tiktok.com/upload`) - Automated video uploads with captions
- **Facebook** (`https://www.facebook.com`) - Automated post creation with text and images

## Development

### Tech Stack

- **Framework**: React 18 with TypeScript
- **UI Library**: Chakra UI
- **Architecture**: Clean Architecture with domain/use cases/infrastructure layers
- **Storage**: IndexedDB for local data persistence
- **Build Tool**: Webpack 5
- **Extension API**: Chrome Extension Manifest V3

### Project Structure

```
src/
├── contentScript/     # Platform automation scripts
│   └── posting/       # Facebook, Twitter, Threads, TikTok automation
├── domain/            # Business logic and interfaces
│   ├── repositories/  # Data access interfaces
│   └── useCases/      # Application use cases
├── infra/             # Infrastructure implementations
│   └── repositories/  # IndexedDB implementations
├── pages/             # UI components
│   ├── app/          # Main app layout
│   └── components/    # Dashboard, Calendar, Posting, etc.
└── serviceWorker/     # Background service worker
```

### Building from Source

This project uses `npm` as the package manager.

1. Install dependencies:
```bash
npm install
```

2. Build for development:
```bash
npm run build:chrome:all:dev
```

3. Build for production:
```bash
npm run build:chrome:all
```

The compiled extension will be in the `build/` directory.

## Usage

### Creating a Post

1. Click the extension icon and select "Posting"
2. Enter your post text
3. (Optional) Upload an image or video
4. Select one or more platforms (Twitter, Threads, TikTok, Facebook)
5. Choose to "Post Now" or "Schedule Post"

### Scheduling Posts

1. Follow the same steps as creating a post
2. Click "Schedule Post"
3. Select a date and time
4. The post will automatically be published at the scheduled time

### Managing Posts

- **Dashboard** - View statistics and recent activity
- **Calendar** - See all scheduled posts in calendar view
- **History** - Browse all past posts and their status
- **Queue** - Manage pending and scheduled posts

### Platform-Specific Notes

- **Twitter/X**: Supports text and media (images/videos)
- **Threads**: Supports text and images
- **TikTok**: Requires video files, supports captions and hashtags
- **Facebook**: Supports text and images

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details.

## Privacy Policy

All data is stored locally on your device using IndexedDB. No data is sent to external servers. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.

## Acknowledgments

Built with modern web technologies and browser extension APIs to provide a seamless social media management experience.
