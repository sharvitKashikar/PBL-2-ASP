import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiFileText, FiLink, FiUpload } from 'react-icons/fi';

interface SummaryResponse {
  summary: string;
  model_used: string;
  id: string;
}

interface SummaryHistory {
  _id: string;
  summary: string;
  modelUsed: string;
  type: 'text' | 'url' | 'file';
  fileName?: string;
  sourceUrl?: string;
  createdAt: string;
}

export default function Summarize() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'text' | 'url' | 'file'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState('');
  const [history, setHistory] = useState<SummaryHistory[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get<SummaryHistory[]>(
        `${import.meta.env.VITE_API_URL}/summarize/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load summary history');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSummary('');

    try {
      let response;
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      switch (activeTab) {
        case 'text':
          response = await axios.post(
            `${import.meta.env.VITE_API_URL}/summarize/text`,
            { text },
            { headers }
          );
          break;
        case 'url':
          response = await axios.post(
            `${import.meta.env.VITE_API_URL}/summarize/url`,
            { url },
            { headers }
          );
          break;
        case 'file':
          if (!file) {
            toast.error('Please select a file');
            return;
          }
          const formData = new FormData();
          formData.append('file', file);
          response = await axios.post(
            `${import.meta.env.VITE_API_URL}/summarize/file`,
            formData,
            {
              headers: {
                ...headers,
                'Content-Type': 'multipart/form-data',
              },
            }
          );
          break;
      }

      setSummary(response?.data.summary || '');
      setModelUsed(response?.data.model_used || '');
      toast.success('Summary generated successfully!');
      await fetchHistory();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.response?.data?.error || 'Error generating summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text mb-4">
            AI Text Summarization
          </h1>
          <p className="text-xl text-black">
            Transform your content into concise, meaningful summaries powered by advanced AI
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex justify-center space-x-4 mb-8">
            {[
              { id: 'text', icon: FiFileText, label: 'Paste Text' },
              { id: 'url', icon: FiLink, label: 'Enter URL' },
              { id: 'file', icon: FiUpload, label: 'Upload File' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as 'text' | 'url' | 'file')}
                className={`flex items-center px-6 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {label}
              </button>
            ))}
          </div>

          {/* Input Forms */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {activeTab === 'text' && (
              <div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter your text here..."
                  className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200 text-black"
                  required
                />
              </div>
            )}

            {activeTab === 'url' && (
              <div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter URL to summarize..."
                  className=" text-black w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            )}

            {activeTab === 'file' && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <FiUpload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">
                  {file ? file.name : 'Drag and drop or click to upload'}
                </p>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".txt,.pdf"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors duration-200"
                >
                  Select File
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Generating Summary...
                </div>
              ) : (
                'Generate Summary'
              )}
            </button>
          </form>
        </div>

        {/* Summary Output */}
        {summary && (
          <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Summary</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed">{summary}</p>
            </div>
            <div className="mt-4 text-sm text-gray-500 flex items-center justify-end">
              <span>Generated using BART-large-CNN</span>
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl mt-8">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
              <h3 className="text-lg font-medium text-white flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Summaries
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {history.map((item) => (
                <div key={item._id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.type === 'text' && '📝'}
                        {item.type === 'url' && '🔗'}
                        {item.type === 'file' && '📄'}
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                      {item.fileName && (
                        <span className="text-sm text-gray-500">
                          {item.fileName}
                        </span>
                      )}
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
                        >
                          {new URL(item.sourceUrl).hostname}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-xs text-gray-500">
                        Model: {item.modelUsed}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 