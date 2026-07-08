/**
 * 后台任务运行器
 * 简易的子任务系统，支持后台执行、状态跟踪、结果通知
 */
const { spawn, exec } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

let taskCounter = 0;

class TaskRunner extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map(); // id -> taskInfo
  }

  /**
   * 创建后台任务
   * @param {string} description - 任务描述
   * @param {Object} opts - { command, args, cwd, timeout }
   * @returns {string} taskId
   */
  run(description, opts = {}) {
    const id = `task-${++taskCounter}-${Date.now().toString(36)}`;
    const { command, args = [], cwd = process.cwd(), timeout = 300000 } = opts;

    const task = {
      id,
      description,
      status: 'running', // running | done | failed | killed
      startedAt: Date.now(),
      command: `${command} ${args.join(' ')}`,
      cwd,
      output: '',
      error: '',
    };

    this.tasks.set(id, task);
    this.emit('task-start', task);

    try {
      const child = spawn(command, args, {
        cwd,
        shell: process.platform === 'win32',
        env: process.env,
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      task.process = child;

      child.stdout.on('data', (chunk) => {
        task.output += chunk.toString();
        if (task.output.length > 100000) {
          task.output = task.output.slice(-80000); // 保留最近 80KB
        }
      });

      child.stderr.on('data', (chunk) => {
        task.error += chunk.toString();
      });

      child.on('close', (code) => {
        task.status = code === 0 ? 'done' : 'failed';
        task.exitCode = code;
        task.finishedAt = Date.now();
        task.duration = task.finishedAt - task.startedAt;
        task.process = null;
        this.emit('task-end', task);
      });

      child.on('error', (err) => {
        task.status = 'failed';
        task.error = err.message;
        task.finishedAt = Date.now();
        task.duration = task.finishedAt - task.startedAt;
        task.process = null;
        this.emit('task-end', task);
      });
    } catch (err) {
      task.status = 'failed';
      task.error = err.message;
      task.finishedAt = Date.now();
      task.duration = task.finishedAt - task.startedAt;
      this.emit('task-end', task);
    }

    return id;
  }

  /**
   * 用 shell 命令字符串运行后台任务
   */
  runShell(description, command, opts = {}) {
    return this.run(description, {
      command: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      args: process.platform === 'win32' ? ['/c', command] : ['-c', command],
      ...opts,
    });
  }

  /**
   * 获取任务状态
   */
  getTask(id) {
    return this.tasks.get(id);
  }

  /**
   * 获取所有任务
   */
  listTasks() {
    return [...this.tasks.values()].map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      duration: t.finishedAt ? `${(t.duration / 1000).toFixed(1)}s` : '运行中...',
      exitCode: t.exitCode,
      outputPreview: t.output ? t.output.slice(-200) : '',
    }));
  }

  /**
   * 等待任务完成
   */
  waitFor(id, timeout = 300000) {
    return new Promise((resolve, reject) => {
      const task = this.tasks.get(id);
      if (!task) return reject(new Error(`任务不存在: ${id}`));
      if (task.status !== 'running') return resolve(task);

      const timer = setTimeout(() => {
        this.off('task-end', handler);
        reject(new Error(`任务超时: ${id}`));
      }, timeout);

      const handler = (t) => {
        if (t.id === id) {
          clearTimeout(timer);
          this.off('task-end', handler);
          resolve(t);
        }
      };

      this.on('task-end', handler);
    });
  }

  /**
   * 杀掉任务
   */
  kill(id) {
    const task = this.tasks.get(id);
    if (!task || !task.process) return false;
    task.process.kill();
    task.status = 'killed';
    return true;
  }
}

// 全局单例
const taskRunner = new TaskRunner();

module.exports = { TaskRunner, taskRunner };
