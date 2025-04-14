import { runEvaluation } from './evaluation';

async function displayReport() {
  console.log('\n======= MODEL EVALUATION REPORT =======\n');
  
  try {
    const results = await runEvaluation();
    
    // Overall Performance
    console.log('OVERALL PERFORMANCE:');
    console.log('-------------------');
    console.log(`Total Accuracy: ${results.overallAccuracy.toFixed(2)}%`);
    console.log(`ROUGE-1 Score: ${results.rougeScores.rouge1.toFixed(2)}%`);
    console.log(`ROUGE-2 Score: ${results.rougeScores.rouge2.toFixed(2)}%`);
    console.log(`ROUGE-L Score: ${results.rougeScores.rougeL.toFixed(2)}%\n`);
    
    // Detailed Results by Content Type
    console.log('DETAILED RESULTS BY CONTENT TYPE:');
    console.log('--------------------------------');
    
    for (const result of results.testResults) {
      console.log(`\n${result.type} Content:`);
      console.log('------------------------');
      console.log('Input:', result.input);
      console.log('\nGenerated Summary:', result.generated);
      console.log('Reference Summary:', result.reference);
      console.log('\nScores:');
      console.log(`• ROUGE-1: ${(result.scores.rouge1.fmeasure * 100).toFixed(2)}%`);
      console.log(`• ROUGE-2: ${(result.scores.rouge2?.fmeasure ? (result.scores.rouge2.fmeasure * 100).toFixed(2) : 'N/A')}%`);
      console.log(`• ROUGE-L: ${(result.scores.rougeL?.fmeasure ? (result.scores.rougeL.fmeasure * 100).toFixed(2) : 'N/A')}%`);
    }
    
    // Analysis and Recommendations
    console.log('\nANALYSIS & RECOMMENDATIONS:');
    console.log('-------------------------');
    
    if (results.overallAccuracy >= 90) {
      console.log('✓ Model performance is excellent (90%+ accuracy)');
    } else if (results.overallAccuracy >= 80) {
      console.log('✓ Model performance is good (80%+ accuracy)');
    } else if (results.overallAccuracy >= 70) {
      console.log('! Model performance is acceptable but could be improved');
    } else {
      console.log('! Model performance needs significant improvement');
    }
    
    // Specific recommendations based on scores
    if (results.rougeScores.rouge1 < 45) {
      console.log('- Consider improving word choice accuracy');
    }
    if (results.rougeScores.rouge2 < 20) {
      console.log('- Focus on improving phrase-level coherence');
    }
    if (results.rougeScores.rougeL < 40) {
      console.log('- Work on maintaining better text sequence');
    }
    
    console.log('\n========= END OF REPORT =========\n');
    
  } catch (error) {
    console.error('Error during evaluation:', error);
  }
}

// Run the evaluation
displayReport().catch(console.error); 