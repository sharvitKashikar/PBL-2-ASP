import { runEvaluation } from './evaluation';

async function showReport() {
    console.log('\n========= HYBRID MODEL EVALUATION REPORT =========\n');
    
    try {
        const results = await runEvaluation();
        
        for (const [modelName, scores] of Object.entries(results)) {
            const overallAccuracy = (
                scores.averageRouge1 + 
                scores.averageRouge2 + 
                scores.averageRougeL
            ) / 3 * 100;
            
            console.log('MODEL:', modelName);
            console.log('----------------------------------------');
            console.log('OVERALL ACCURACY:', `${overallAccuracy.toFixed(2)}%`);
            
            console.log('\nDetailed Metrics:');
            console.log('• Word-level accuracy (ROUGE-1):', `${(scores.averageRouge1 * 100).toFixed(2)}%`);
            console.log('• Phrase-level accuracy (ROUGE-2):', `${(scores.averageRouge2 * 100).toFixed(2)}%`);
            console.log('• Sequence-level accuracy (ROUGE-L):', `${(scores.averageRougeL * 100).toFixed(2)}%`);
            
            console.log('\nBreakdown by Content Type:');
            scores.rouge1.forEach((score, index) => {
                const contentType = index === 0 ? 'Educational' : 
                                  index === 1 ? 'News' : 'Research';
                const contentAccuracy = (
                    scores.rouge1[index] + 
                    scores.rouge2[index] + 
                    scores.rougeL[index]
                ) / 3 * 100;
                
                console.log(`\n${contentType} Content:`);
                console.log(`• Overall: ${contentAccuracy.toFixed(2)}%`);
                console.log(`• ROUGE-1: ${(scores.rouge1[index] * 100).toFixed(2)}%`);
                console.log(`• ROUGE-2: ${(scores.rouge2[index] * 100).toFixed(2)}%`);
                console.log(`• ROUGE-L: ${(scores.rougeL[index] * 100).toFixed(2)}%`);
            });
            
            console.log('\nTarget Achievement:');
            if (overallAccuracy >= 90) {
                console.log('✓ Model meets target accuracy of 90%+');
            } else {
                const gap = (90 - overallAccuracy).toFixed(2);
                console.log(`! Improvement needed: ${gap}% below target`);
                console.log('Recommendations:');
                if (scores.averageRouge1 < 0.9) console.log('- Improve word choice accuracy');
                if (scores.averageRouge2 < 0.9) console.log('- Enhance phrase coherence');
                if (scores.averageRougeL < 0.9) console.log('- Better maintain text sequence');
            }
        }
        
        console.log('\n================ END OF REPORT ================\n');
    } catch (error) {
        console.error('Error generating report:', error);
    }
}

showReport(); 