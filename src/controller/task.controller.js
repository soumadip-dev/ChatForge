import { Task } from '../schema.js';

async function CreateTask(req, res) {
  try {
    const { title, status } = req.body;
    if (!title || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and status',
      });
    }

    const newTask = await Task.create({ title, status });
    res.status(201).json({
      message: 'Task created successfully',
      data: newTask,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
}

async function getALLTasks(req, res) {
  try {
    const tasks = await Task.find({});
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
}

async function getTaskById(req, res) {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found', success: false });
    }

    res.status(200).json({
      message: 'Task retrieved successfully',
      data: task,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        success: false,
      });
    }

    await Task.deleteOne({ _id: id });
    res.status(200).json({ message: 'Task deleted successfully', success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
}

export { CreateTask, getALLTasks, getTaskById, deleteTask };
