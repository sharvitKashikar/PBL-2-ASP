import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiFileText, FiLink, FiUpload, FiCpu } from 'react-icons/fi';

interface Feature {
  icon: JSX.Element;
  title: string;
  description: string;
}

interface AnimationVariants {
  hidden: {
    opacity: number;
    y?: number;
  };
  visible: {
    opacity: number;
    y?: number;
    transition?: {
      duration?: number;
      staggerChildren?: number;
    };
  };
  [key: string]: any;
}

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to home after 3 seconds
    const timer = setTimeout(() => {
      navigate('/home');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const features: Feature[] = [
    {
      icon: <FiFileText className="w-6 h-6" />,
      title: 'Text Summarization',
      description: 'Paste any text and get an instant, concise summary powered by AI.'
    },
    {
      icon: <FiLink className="w-6 h-6" />,
      title: 'URL Processing',
      description: 'Enter any article URL and get a quick summary of its content.'
    },
    {
      icon: <FiUpload className="w-6 h-6" />,
      title: 'File Upload',
      description: 'Upload PDF or text files for instant summarization.'
    },
    {
      icon: <FiCpu className="w-6 h-6" />,
      title: 'AI-Powered',
      description: 'Advanced AI models ensure accurate and coherent summaries.'
    }
  ];

  const containerVariants: AnimationVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants: AnimationVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="w-24 h-24 mx-auto bg-blue-600 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text mb-4"
        >
          AI Summarizer
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-600 text-lg"
        >
          Transforming text into concise summaries...
        </motion.p>
      </motion.div>
    </div>
  );
} 