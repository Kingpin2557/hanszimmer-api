import express from 'express';
import serverless from 'serverless-http';

const app = express();

app.get('/', (req, res) => {
    res.json({ hello: 'world' });
});

export default serverless(app);
