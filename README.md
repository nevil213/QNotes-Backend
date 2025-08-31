# QNotes - AI-Powered Audio Note Taking

QNotes is an innovative note-taking application that leverages artificial intelligence to convert audio recordings into well-structured notes. Save time and enhance productivity by automatically transforming your spoken content into written format.

## 🔗 Project Links
- **GitHub Repository**: [github.com/nevil213/QNotes-Backend](https://github.com/nevil213/QNotes-Backend)
<!-- - **Live Demo**: [q-notes-backend.vercel.app](https://q-notes-backend.vercel.app/) -->
- **Live Demo**: [qnotes-backend.onrender.com](https://qnotes-backend.onrender.com/)

## ✨ Key Features

- **AI-Powered Audio Transcription**: Convert spoken content into written notes automatically
- **Smart Organization**: Categorize and organize your notes efficiently
- **Playlists**: Group related notes into playlists for better management
- **User Authentication**: Secure user accounts and personal note storage
- **Clap System**: Show appreciation for notes shared by other users
- **Cross-Platform Access**: Access your notes from any device with internet connection

## 🛠️ Technologies Used

- **Backend Framework**: Node.js with Express.js 5.x
- **Database**: MongoDB 6.x with Mongoose ODM
- **Authentication**: JWT with access & refresh token strategy
- **File Processing**: 
  - Multer for file uploads (memory storage)
  - Cloudinary for cloud storage
  - Fluent-FFmpeg for audio processing
- **API Security**: 
  - CORS protection
  - HTTP-only cookies
  - bcrypt for password hashing
- **Email Services**: Nodemailer 7.x for verification & password resets
- **AI Integration**: Groq API for speech-to-text transcription
- **Development**: Nodemon for hot-reloading

## 📋 Prerequisites

- Node.js (v14.x or higher)
- MongoDB
- npm or pnpm or yarn

## ⚙️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nevil213/qnotes.git
   cd qnotes
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   GROQ_API_KEY=your_groq_api_key_here        # AI API key for processing
   PORT=8000                                  # Server port
   MONGODB_URI=mongodb://localhost:27017      # MongoDB connection string
   CORS_ORIGIN=*                              # CORS policy
   ACCESS_TOKEN_SECRET=your_secret_here       # JWT access token secret
   ACCESS_TOKEN_EXPIRY=1d                     # Access token expiration
   REFRESH_TOKEN_SECRET=your_secret_here      # JWT refresh token secret
   JWT_SECRET=your_secret_here                # General JWT secret
   REFRESH_TOKEN_EXPIRY=10d                   # Refresh token expiration
   CLOUDINARY_CLOUD_NAME=your_cloud_name      # Cloudinary for media storage
   CLOUDINARY_API_KEY=your_api_key            # Cloudinary API key
   CLOUDINARY_API_SECRET=your_api_secret      # Cloudinary API secret
   DOMAIN=localhost                           # Application domain
   EMAIL=your_email_for_sending_email         # Email
   ```

4. Start the server:
   ```bash
   npm start
   ```

## 🚀 Usage

1. Register a new user account or log in
2. Upload audio files for AI processing
3. View, edit, and organize your automatically generated notes
4. Create playlists to group related notes
5. Share notes with other users if desired

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/user/register` - Register new user with email verification
- `POST /api/v1/user/login` - Login and get access tokens
- `POST /api/v1/user/logout` - Logout and invalidate tokens
- `POST /api/v1/user/refresh-access-token` - Refresh expired access token

### Password Management
- `PATCH /api/v1/user/change-password` - Change password (when logged in)
- `POST /api/v1/user/initiate-forget-password` - Start password reset process
- `POST /api/v1/user/forget-password` - Complete password reset with token

### User Profile
- `GET /api/v1/user/get-user` - Get current user profile
- `PATCH /api/v1/user/update-account` - Update profile information
- `PATCH /api/v1/user/update-avatar` - Change profile picture
- `PATCH /api/v1/user/update-coverimage` - Change profile cover image

### Notes Management
- `POST /api/v1/note/create-note` - Create note from audio recording
- `GET /api/v1/note/get-notes` - Get all your notes
- `PATCH /api/v1/note/update-noteinfo/:noteId` - Update note metadata
- `DELETE /api/v1/note/delete-note/:noteId` - Delete a note
- `POST /api/v1/note/create-new-version-note/:noteId` - Create alternate version of note
- `PATCH /api/v1/note/star-note/:noteId/:noteVersionId` - Mark a version of note

### Playlist Organization
- `POST /api/v1/playlist/create-playlist` - Create a new playlist
- `PATCH /api/v1/playlist/update-playlist/:playlistId` - Update playlist details
- `PUT /api/v1/playlist/add-note/:playlistId/:noteId` - Add note to playlist
- `DELETE /api/v1/playlist/remove-note/:playlistId/:noteId` - Remove note from playlist
- `GET /api/v1/playlist/get-playlist-by-user` - Get all your playlists
- `GET /api/v1/playlist/get-playlist/:playlistId` - View notes in a playlist

### Social Features
- `PATCH /api/v1/clap/increment/:noteId` - Appreciate a note with clap (similar to medium clap system)
- `PATCH /api/v1/clap/decrement/:noteId` - Remove appreciation from note
- `GET /api/v1/note/u/:username` - View public notes of a user
- `GET /api/v1/playlist/get-playlist-by-username/:username` - View public playlists of a user

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📬 Contact

For any questions or suggestions, please open an issue or contact the project maintainer.

---

Made with ❤️ by Nevil Vataliya

For any questions or suggestions, please open an issue or contact the project maintainer.

