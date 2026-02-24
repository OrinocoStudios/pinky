"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAnswerGeneratorAdapter = void 0;
const common_1 = require("@nestjs/common");
let LocalAnswerGeneratorAdapter = class LocalAnswerGeneratorAdapter {
    async generate(input) {
        const max = 1200;
        const trimmed = input.prompt.length > max ? `${input.prompt.slice(0, max)}...` : input.prompt;
        const sourcesUsed = input.sources.map((s) => s.id);
        return {
            answer: `Respuesta grounded preliminar (modo local):\n\n${trimmed}`,
            sourcesUsed,
            model: 'local-deterministic',
            tokensUsed: 0,
        };
    }
};
exports.LocalAnswerGeneratorAdapter = LocalAnswerGeneratorAdapter;
exports.LocalAnswerGeneratorAdapter = LocalAnswerGeneratorAdapter = __decorate([
    (0, common_1.Injectable)()
], LocalAnswerGeneratorAdapter);
//# sourceMappingURL=local-answer-generator.adapter.js.map