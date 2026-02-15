import express from 'express';
import { connectDB } from './config/db.config.js';
import { ENV } from './config/env.config.js';
import { CreateTask, deleteTask, getALLTasks, getTaskById } from './controller/task.controller.js';

const PORT = ENV.PORT;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('HEllo from task api backend');
});

app.post('/tasks', CreateTask);
app.get('/tasks', getALLTasks);
app.put('/tasks/:id', getTaskById);
app.delete('/tasks/:id', deleteTask);

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.info(`Server listening at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
