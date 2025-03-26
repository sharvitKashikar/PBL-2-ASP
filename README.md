# AI-Powered News & Research Paper Summarizer

A full-stack application that provides intelligent summarization of news articles and research papers using state-of-the-art NLP models.

## Features

- Text summarization using BART and LongT5 models
- URL-based news article summarization
- PDF and text document processing
- User authentication and history tracking
- Responsive UI with Tailwind CSS

## Tech Stack

- Frontend: React.js + Tailwind CSS
- Backend: Express.js + Node.js
- AI Processing: Python + Flask
- Database: MongoDB
- Authentication: JWT/Google OAuth

## Project Structure

```
.
├── frontend/           # React frontend application
├── backend/           # Express.js backend server
├── ai-service/        # Flask AI processing service
└── docker/           # Docker configuration files
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Python 3.8+
- MongoDB
- Docker (optional)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

### AI Service Setup

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Environment Variables

Create `.env` files in each service directory with the following variables:

#### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_AI_SERVICE_URL=http://localhost:5001
```

#### Backend (.env)
```
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
AI_SERVICE_URL=http://localhost:5001
```

#### AI Service (.env)
```
PORT=5001
MODEL_CACHE_DIR=./models
```

## API Documentation

### Endpoints

#### Frontend Routes
- `/` - Home page
- `/summarize` - Text summarization interface
- `/history` - User's summarization history
- `/auth` - Authentication pages

#### Backend API
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/summarize` - Text summarization
- `GET /api/history` - Get user's summarization history

#### AI Service API
- `POST /api/summarize` - Process text and generate summary
- `POST /api/process-pdf` - Process PDF documents
- `POST /api/process-url` - Process news article URLs

## Deployment

The application can be deployed using Docker Compose:

```bash
docker-compose up --build
```

## License

MIT License 