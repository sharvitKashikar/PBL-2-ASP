import { runEvaluation } from '../utils/evaluation';

async function main() {
  try {
    console.log('Initializing evaluation...');
    
    // Increased timeout to 10 minutes since model downloads and inference take time
    const timeout = setTimeout(() => {
      console.error('Evaluation timed out after 10 minutes');
      process.exit(1);
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT. Cleaning up...');
      clearTimeout(timeout);
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM. Cleaning up...');
      clearTimeout(timeout);
      process.exit(0);
    });

    await runEvaluation();
    
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    console.error('Evaluation failed:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

main(); 