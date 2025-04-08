import express, { Request, Response, NextFunction } from 'express';

const app = express();

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.use((_req: Request, res: Response) => {
  res.status(404).send('Not found');
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  return res.status(500).send('Something broke!');
});

export default app; 