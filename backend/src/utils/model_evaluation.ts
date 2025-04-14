import { runLocalModel } from './local_inference';

interface EvaluationResult {
    accuracy: number;
    rouge1: number;
    rouge2: number;
    rougeL: number;
    contentTypeScores: {
        [key: string]: {
            accuracy: number;
            summary: string;
            reference: string;
        }
    };
}

interface ModelParams {
    max_length: number;
    min_length: number;
    temperature: number;
    num_beams: number;
    no_repeat_ngram_size: number;
    length_penalty: number;
    early_stopping: boolean;
}

const TEST_CASES = [
    {
        type: 'Educational',
        input: `Project-based learning (PBL) is a student-centered pedagogy that involves dynamic classroom approaches where students gain deeper knowledge through active exploration of real-world challenges. This method emphasizes collaborative learning, critical thinking, and practical problem-solving skills. Students work on projects for extended periods, investigating and responding to complex questions while developing deep content understanding.`,
        reference: `Project-based learning is a student-centered teaching method where students gain deeper knowledge through exploring real-world challenges and developing critical thinking skills.`
    },
    {
        type: 'News',
        input: `The COVID-19 pandemic has transformed global education, forcing rapid adoption of online learning platforms and highlighting digital inequalities. Schools worldwide implemented remote learning solutions, revealing significant challenges in internet access and device availability. This transition particularly affected disadvantaged students, emphasizing the need for equitable educational technology access.`,
        reference: `The COVID-19 pandemic forced global education systems to adopt online learning, exposing digital inequalities and access challenges, particularly affecting disadvantaged students.`
    },
    {
        type: 'Research',
        input: `Recent cognitive psychology research demonstrates that spaced repetition significantly enhances long-term memory retention compared to traditional study methods. This technique involves reviewing information at progressively increasing intervals, allowing neural pathways to strengthen over time. Studies show consistent improvement in retention rates using this method.`,
        reference: `Research shows spaced repetition, which involves reviewing information at increasing intervals, significantly improves long-term memory retention compared to traditional methods.`
    }
];

function calculateRougeScores(reference: string, candidate: string): { rouge1: number; rouge2: number; rougeL: number } {
    // Normalize texts
    reference = reference.toLowerCase().trim();
    candidate = candidate.toLowerCase().trim();
    
    const refWords = reference.split(/\s+/);
    const candWords = candidate.split(/\s+/);
    
    // ROUGE-1: Word overlap
    const refSet = new Set(refWords);
    const candSet = new Set(candWords);
    const commonWords = refWords.filter(w => candSet.has(w));
    const rouge1 = commonWords.length / refWords.length;
    
    // ROUGE-2: Bigram overlap
    const refBigrams = new Set();
    const candBigrams = new Set();
    for (let i = 0; i < refWords.length - 1; i++) {
        refBigrams.add(`${refWords[i]} ${refWords[i + 1]}`);
    }
    for (let i = 0; i < candWords.length - 1; i++) {
        candBigrams.add(`${candWords[i]} ${candWords[i + 1]}`);
    }
    const commonBigrams = Array.from(refBigrams).filter(b => candBigrams.has(b));
    const rouge2 = refBigrams.size > 0 ? commonBigrams.length / refBigrams.size : 0;
    
    // ROUGE-L: Longest Common Subsequence
    const lcs = calculateLCS(refWords, candWords);
    const rougeL = lcs / refWords.length;
    
    return {
        rouge1: Math.min(rouge1, 1),
        rouge2: Math.min(rouge2, 1),
        rougeL: Math.min(rougeL, 1)
    };
}

function calculateLCS(x: string[], y: string[]): number {
    const m = x.length;
    const n = y.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (x[i - 1] === y[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    return dp[m][n];
}

async function evaluateModel(): Promise<EvaluationResult> {
    const modelUrl = 'facebook/bart-large-cnn';
    const results: EvaluationResult = {
        accuracy: 0,
        rouge1: 0,
        rouge2: 0,
        rougeL: 0,
        contentTypeScores: {}
    };
    
    let totalRouge1 = 0;
    let totalRouge2 = 0;
    let totalRougeL = 0;
    
    console.log('\n=== Starting Model Evaluation ===\n');
    
    const modelParams: ModelParams = {
        max_length: 150,
        min_length: 40,
        temperature: 0.3,
        num_beams: 8,
        no_repeat_ngram_size: 3,
        length_penalty: 2.0,
        early_stopping: true
    };
    
    for (const testCase of TEST_CASES) {
        console.log(`Processing ${testCase.type} Content:`);
        console.log('Input length:', testCase.input.length, 'characters');
        
        try {
            const response = await runLocalModel(testCase.input, modelUrl, modelParams);
            
            // Parse the JSON response
            const { summary } = JSON.parse(response);
            
            const scores = calculateRougeScores(testCase.reference, summary);
            const contentAccuracy = (scores.rouge1 + scores.rouge2 + scores.rougeL) / 3;
            
            results.contentTypeScores[testCase.type] = {
                accuracy: contentAccuracy * 100,
                summary,
                reference: testCase.reference
            };
            
            totalRouge1 += scores.rouge1;
            totalRouge2 += scores.rouge2;
            totalRougeL += scores.rougeL;
            
            console.log('Generated Summary:', summary);
            console.log(`Accuracy: ${(contentAccuracy * 100).toFixed(2)}%\n`);
        } catch (error) {
            console.error(`Error processing ${testCase.type} content:`, error);
            throw error;
        }
    }
    
    results.rouge1 = (totalRouge1 / TEST_CASES.length) * 100;
    results.rouge2 = (totalRouge2 / TEST_CASES.length) * 100;
    results.rougeL = (totalRougeL / TEST_CASES.length) * 100;
    results.accuracy = (results.rouge1 + results.rouge2 + results.rougeL) / 3;
    
    return results;
}

async function displayEvaluationReport() {
    console.log('\n======= HYBRID MODEL EVALUATION REPORT =======\n');
    
    try {
        const results = await evaluateModel();
        
        console.log('OVERALL PERFORMANCE:');
        console.log('-------------------');
        console.log(`Total Accuracy: ${results.accuracy.toFixed(2)}%`);
        console.log(`ROUGE-1 Score: ${results.rouge1.toFixed(2)}%`);
        console.log(`ROUGE-2 Score: ${results.rouge2.toFixed(2)}%`);
        console.log(`ROUGE-L Score: ${results.rougeL.toFixed(2)}%\n`);
        
        console.log('PERFORMANCE BY CONTENT TYPE:');
        console.log('---------------------------');
        for (const [type, scores] of Object.entries(results.contentTypeScores)) {
            console.log(`\n${type} Content:`);
            console.log(`Accuracy: ${scores.accuracy.toFixed(2)}%`);
            console.log('Generated Summary:', scores.summary);
            console.log('Reference Summary:', scores.reference);
        }
        
        console.log('\nANALYSIS:');
        console.log('---------');
        if (results.accuracy >= 90) {
            console.log('✓ Model achieves target accuracy of 90%+');
        } else {
            const gap = (90 - results.accuracy).toFixed(2);
            console.log(`! Model needs improvement: ${gap}% below target`);
            console.log('\nRecommendations:');
            if (results.rouge1 < 90) console.log('- Improve word choice accuracy');
            if (results.rouge2 < 90) console.log('- Enhance phrase coherence');
            if (results.rougeL < 90) console.log('- Better maintain text sequence');
        }
        
        console.log('\n============= END OF REPORT =============\n');
        
    } catch (error) {
        console.error('Error in evaluation:', error);
    }
}

// Run the evaluation
displayEvaluationReport(); 