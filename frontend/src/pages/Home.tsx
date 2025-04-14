import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="page-container py-12 md:py-24">
        <div className="section-container">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
              AI-Powered Text Summarization
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              Transform long articles and research papers into concise summaries using state-of-the-art AI models.
              Perfect for students, researchers, and professionals.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              {isAuthenticated ? (
                <Link
                  to="/summarize"
                  className="btn-primary"
                >
                  Start Summarizing
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="btn-primary"
                >
                  Get Started
                </Link>
              )}
              <Link to="/about" className="btn-secondary">
                Learn more
              </Link>
            </div>
          </div>

          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-black">Text Summarization</h3>
              <p className="text-black">
                Paste any text and get an AI-generated summary using state-of-the-art models.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-black">PDF Processing</h3>
              <p className="text-black">
                Upload PDF documents and get comprehensive summaries of their content.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-black">URL Processing</h3>
              <p className="text-black">
                Enter any news article URL and get an instant summary of the content.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 