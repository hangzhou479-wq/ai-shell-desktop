/**
 * 终端加载动画
 * 纯 ASCII，零依赖
 */
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

class Spinner {
  constructor(message = '思考中...') {
    this.message = message;
    this.frameIndex = 0;
    this.interval = null;
    this.running = false;
  }

  start(message) {
    if (message) this.message = message;
    if (this.running) return;

    this.running = true;
    this.interval = setInterval(() => {
      process.stdout.write(`\r\x1b[36m${frames[this.frameIndex]}\x1b[0m ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }, 80);
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.interval);
    // 清除动画行
    process.stdout.write('\r\x1b[K');
    this.running = false;
  }

  succeed(message) {
    this.stop();
    console.log(`\x1b[32m✓\x1b[0m ${message}`);
  }

  fail(message) {
    this.stop();
    console.log(`\x1b[31m✗\x1b[0m ${message}`);
  }
}

module.exports = Spinner;
