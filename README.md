# AI Text Summarization Tool

A full-stack web application that provides intelligent text summarization using a hybrid approach combining BART-large-CNN and LONGT5 models. The application supports multiple input formats including text, URLs, and files (PDF and text files).

## Features

- **Hybrid Summarization Model**:
  - BART-large-CNN: Optimized for news article summarization
  - LONGT5: Specialized for handling longer documents
  - Smart model selection based on input length and content type

- **Multiple Input Methods**:
  - Direct text input
  - URL content summarization
  - File upload support (PDF and text files)

- **User Management**:
  - Secure user registration and authentication
  - JWT-based authentication
  - Protected routes and API endpoints

- **History Management**:
  - View summarization history
  - Access previous summaries
  - Delete unwanted summaries

## Tech Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- React Router for navigation
- Axios for API calls
- React Hot Toast for notifications

### Backend
- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- PDF-parse for PDF processing
- Hugging Face API integration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Git
- Hugging Face API key

## Environment Variables

Create a `.env` file in the backend directory:

```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
HUGGING_FACE_API_KEY=your_huggingface_api_key
PORT=5001
```

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:5001/api
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/sharvitkashikar/PBL-2-ASP.git
cd PBL-2-ASP
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

## Running the Application

1. Start the backend server:
```bash
cd backend
npm start
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Summarization
- `POST /api/summarize/text` - Summarize text input
- `POST /api/summarize/url` - Summarize URL content
- `POST /api/summarize/file` - Summarize uploaded file
- `GET /api/summarize/history` - Get user's summarization history

## Model Details

### BART-large-CNN
- Optimized for news article summarization
- Maximum input length: 1000 characters
- Summary length: 50-150 words
- Best for shorter, structured content

### LONGT5
- Specialized for longer documents
- Can handle input up to 16,000 tokens
- Better for academic papers and long articles
- Maintains context across longer texts

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Hugging Face for providing the BART-large-CNN and LONGT5 models
- MongoDB Atlas for database hosting
- All contributors and maintainers

## Contact

Sharvit Kashikar - [@sharvitkashikar](https://github.com/sharvitkashikar)
Atharva Dethe - [@Atharvadethe](https://github.com/Atharvadethe)

Project Link: [https://github.com/sharvitkashikar/PBL-2-ASP](https://github.com/sharvitkashikar/PBL-2-ASP) 
