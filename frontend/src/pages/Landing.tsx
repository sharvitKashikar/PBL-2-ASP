import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { FiFileText, FiLink, FiUpload, FiCpu } from 'react-icons/fi';

interface Feature {
  icon: JSX.Element;
  title: string;
  description: string;
}

interface AnimationVariants extends Variants {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="container mx-auto px-4 pt-20 pb-16 text-center"
      >
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text mb-6">
          AI-Powered Text Summarization
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
          Transform lengthy content into clear, concise summaries using advanced artificial intelligence.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="inline-flex items-center px-8 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 transform hover:scale-105"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center px-8 py-3 text-lg font-semibold text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 transform hover:scale-105"
          >
            Sign In
          </Link>
        </div>
      </motion.div>

      {/* Features Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-800">
          Powerful Features for Easy Summarization
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* How It Works Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="container mx-auto px-4 py-16 text-center"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-16 text-gray-800">
          How It Works
        </h2>
        <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full"
          >
            <div className="text-4xl font-bold text-blue-600 mb-4">1</div>
            <h3 className="text-xl font-semibold mb-2">Input Your Content</h3>
            <p className="text-gray-600">Paste text, enter a URL, or upload a file</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full"
          >
            <div className="text-4xl font-bold text-blue-600 mb-4">2</div>
            <h3 className="text-xl font-semibold mb-2">AI Processing</h3>
            <p className="text-gray-600">Our AI analyzes and extracts key information</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full"
          >
            <div className="text-4xl font-bold text-blue-600 mb-4">3</div>
            <h3 className="text-xl font-semibold mb-2">Get Your Summary</h3>
            <p className="text-gray-600">Receive a clear, concise summary instantly</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="bg-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} AI Text Summarizer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
} 