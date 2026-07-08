/**
 * MCP STDIO 传输层
 * 通过子进程的标准输入/输出进行 JSON-RPC 通信
 */
const { spawn } = require('child_process');
const { parseMessage } = require('./protocol');

class StdioTransport {
  constructor(command, args = [], env = {}) {
    this.command = command;
    this.args = args;
    this.env = { ...process.env, ...env };
    this.process = null;
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.closeHandlers = [];
    this.buffer = '';
    this.running = false;
  }

  /**
   * 启动子进程
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: this.env,
          shell: process.platform === 'win32',
        });

        this.running = true;

        // 监听 stdout 数据
        this.process.stdout.on('data', (chunk) => {
          this.buffer += chunk.toString('utf-8');

          // 按换行符分割消息
          const lines = this.buffer.split('\n');
          this.buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const message = parseMessage(trimmed);
            if (message) {
              for (const handler of this.messageHandlers) {
                handler(message);
              }
            }
          }
        });

        // 监听 stderr
        this.process.stderr.on('data', (chunk) => {
          // stderr 通常用于日志，不解析为 JSON-RPC
          if (process.env.DEBUG) {
            process.stderr.write(`[MCP Server Log] ${chunk}`);
          }
        });

        // 进程退出
        this.process.on('close', (code) => {
          this.running = false;
          for (const handler of this.closeHandlers) {
            handler(code);
          }
        });

        // 进程错误
        this.process.on('error', (err) => {
          this.running = false;
          for (const handler of this.errorHandlers) {
            handler(err);
          }
          reject(err);
        });

        // 给小进程一点启动时间
        setTimeout(() => resolve(), 100);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 发送消息到子进程
   */
  send(message) {
    if (!this.running || !this.process) {
      throw new Error('传输层已关闭');
    }
    const data = JSON.stringify(message) + '\n';
    this.process.stdin.write(data);
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * 注册错误处理器
   */
  onError(handler) {
    this.errorHandlers.push(handler);
  }

  /**
   * 注册关闭处理器
   */
  onClose(handler) {
    this.closeHandlers.push(handler);
  }

  /**
   * 关闭传输层
   */
  async stop() {
    this.running = false;
    if (this.process) {
      this.process.kill('SIGTERM');
      // 给进程 3 秒优雅退出
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }
  }
}

module.exports = StdioTransport;
