import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ModelParams {
    max_length: number;
    min_length: number;
    temperature: number;
    num_beams: number;
    no_repeat_ngram_size: number;
    length_penalty: number;
    early_stopping: boolean;
}

export async function runLocalModel(
    input: string,
    modelName: string,
    params: ModelParams
): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), 'model-inference');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const inputFile = path.join(tmpDir, 'input.txt');
    fs.writeFileSync(inputFile, input);

    const paramsJson = JSON.stringify(params);
    const pythonScript = path.join(__dirname, 'local_inference.py');

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [
            pythonScript,
            inputFile,
            modelName,
            paramsJson
        ]);

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Model inference failed: ${errorData}`));
            } else {
                try {
                    // Ensure the output is valid JSON
                    const summary = outputData.trim();
                    const jsonOutput = JSON.stringify({ summary });
                    resolve(jsonOutput);
                } catch (error) {
                    reject(new Error(`Failed to parse model output: ${error.message}`));
                }
            }
        });
    });
} 