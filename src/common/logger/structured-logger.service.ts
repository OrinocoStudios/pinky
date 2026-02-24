import { Injectable, LoggerService } from '@nestjs/common';

export type LogMeta = Record<string, unknown>;

@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: string, context?: string, meta?: LogMeta): void {
    this.output('info', message, context, meta);
  }

  error(message: string, trace?: string, context?: string, meta?: LogMeta): void {
    this.output('error', message, context, { ...meta, stack: trace });
  }

  warn(message: string, context?: string, meta?: LogMeta): void {
    this.output('warn', message, context, meta);
  }

  debug(message: string, context?: string, meta?: LogMeta): void {
    this.output('debug', message, context, meta);
  }

  verbose(message: string, context?: string, meta?: LogMeta): void {
    this.output('verbose', message, context, meta);
  }

  private output(
    level: string,
    message: string,
    context?: string,
    meta?: LogMeta,
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'Application',
      message,
      ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}
