"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
const common_1 = require("@nestjs/common");
let StructuredLogger = class StructuredLogger {
    log(message, context, meta) {
        this.output('info', message, context, meta);
    }
    error(message, trace, context, meta) {
        this.output('error', message, context, { ...meta, stack: trace });
    }
    warn(message, context, meta) {
        this.output('warn', message, context, meta);
    }
    debug(message, context, meta) {
        this.output('debug', message, context, meta);
    }
    verbose(message, context, meta) {
        this.output('verbose', message, context, meta);
    }
    output(level, message, context, meta) {
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
        }
        else {
            process.stdout.write(line + '\n');
        }
    }
};
exports.StructuredLogger = StructuredLogger;
exports.StructuredLogger = StructuredLogger = __decorate([
    (0, common_1.Injectable)()
], StructuredLogger);
//# sourceMappingURL=structured-logger.service.js.map