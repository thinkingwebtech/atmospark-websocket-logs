import express from 'express';
import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';
import cors from "cors";
import "./WebSocket.js";
const app = express();

const port = 8080;
app.use(cors());
configDotenv()

// mongo
const url = process.env.MONGODB_STRING;
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => { console.log('Connected to MongoDB') })
    .catch((error) => { console.error('Error connecting to MongoDB:', error) });

app.get('/', (req, res) => {
    res.send('Hey I am still alive');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
