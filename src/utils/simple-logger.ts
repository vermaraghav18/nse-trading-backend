/**
 * Simple Beautiful Logger
 * Makes terminal output easy to read for non-coders
 */

import chalk from 'chalk';

export class SimpleLogger {
  private static enabled = true;
  private static lastProgressLine = '';

  static disable() {
    this.enabled = false;
  }

  static enable() {
    this.enabled = true;
  }

  // Success messages (green)
  static success(message: string) {
    if (!this.enabled) return;
    console.log(chalk.green('✓') + ' ' + message);
  }

  // Info messages (blue)
  static info(message: string) {
    if (!this.enabled) return;
    console.log(chalk.blue('ℹ') + ' ' + message);
  }

  // Warning messages (yellow)
  static warning(message: string) {
    if (!this.enabled) return;
    console.log(chalk.yellow('⚠') + ' ' + message);
  }

  // Error messages (red)
  static error(message: string) {
    if (!this.enabled) return;
    console.log(chalk.red('✗') + ' ' + message);
  }

  // Progress bar (overwrites same line)
  static progress(current: number, total: number, label: string) {
    if (!this.enabled) return;
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 2);
    const bar = '█'.repeat(filled) + '░'.repeat(50 - filled);
    const line = `${label}: [${bar}] ${percentage}% (${current}/${total})`;
    
    // Clear previous line and write new one
    if (this.lastProgressLine) {
      process.stdout.write('\r' + ' '.repeat(this.lastProgressLine.length) + '\r');
    }
    process.stdout.write(line);
    this.lastProgressLine = line;
    
    // If complete, add newline
    if (current === total) {
      process.stdout.write('\n');
      this.lastProgressLine = '';
    }
  }

  // Section headers
  static header(title: string) {
    if (!this.enabled) return;
    console.log('\n' + chalk.cyan.bold('═'.repeat(70)));
    console.log(chalk.cyan.bold(`  ${title}`));
    console.log(chalk.cyan.bold('═'.repeat(70)));
  }

  // Clean line
  static line() {
    if (!this.enabled) return;
    console.log(chalk.gray('─'.repeat(70)));
  }

  // Table row
  static row(label: string, value: string | number) {
    if (!this.enabled) return;
    const spacing = ' '.repeat(Math.max(0, 30 - label.length));
    console.log(chalk.gray(label + ':') + spacing + chalk.white(value));
  }
}