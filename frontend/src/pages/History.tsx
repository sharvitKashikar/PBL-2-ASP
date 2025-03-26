import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Summary {
  _id: string;
  originalContent: string;
  summary: string;
  modelUsed: string;
  fileName?: string;
  type: 'text' | 'url' | 'file';
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function History() {
  const { token, isAuthenticated } = useAuth();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchSummaries();
  }, [isAuthenticated, token]);

  const fetchSummaries = async () => {
    if (!token) {
      setError('Please log in to view your history');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('Fetching summaries...');
      
      const response = await axios.get<Summary[]>(
        `/summarize/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          baseURL: import.meta.env.VITE_API_URL
        }
      );

      console.log('Received summaries:', response.data);
      setSummaries(response.data);
    } catch (error: any) {
      console.error('Error fetching history:', error.response || error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load history';
      setError(errorMessage);
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        navigate('/login');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return '📝';
      case 'url':
        return '🔗';
      case 'file':
        return '📄';
      default:
        return '📄';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <div className="flex flex-col items-center">
                <div className="flex-shrink-0 mb-4">
                  <svg className="h-12 w-12 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-yellow-800 mb-2">Authentication Required</h3>
                <p className="text-yellow-700 mb-4">Please log in to view your summary history.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors duration-200 transform hover:scale-105"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading your summaries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex flex-col items-center">
                <div className="flex-shrink-0 mb-4">
                  <svg className="h-12 w-12 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-red-800 mb-2">Error Loading History</h3>
                <p className="text-red-700 mb-4">{error}</p>
                <button
                  onClick={fetchSummaries}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 transform hover:scale-105"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text mb-4">
            Summarization History
          </h1>
          <p className="text-xl text-gray-600">
            View and manage your previous summaries
          </p>
        </div>

        {summaries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center">
              <svg className="h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Summaries Found</h3>
              <p className="text-gray-600 mb-6">Start by creating your first summary!</p>
              <button
                onClick={() => navigate('/summarize')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 transform hover:scale-105"
              >
                Create Summary
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {summaries.map((summary) => (
              <div
                key={summary._id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl p-2 bg-blue-50 rounded-lg" role="img" aria-label={summary.type}>
                        {getTypeIcon(summary.type)}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {summary.fileName || (summary.sourceUrl ? 'URL Summary' : 'Text Summary')}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(summary.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {summary.modelUsed}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Original Content</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {summary.originalContent}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                          {summary.summary}
                        </p>
                      </div>
                    </div>

                    {summary.sourceUrl && (
                      <div className="mt-4">
                        <a
                          href={summary.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <span>View Source</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 