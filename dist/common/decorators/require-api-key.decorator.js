"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireApiKey = void 0;
const common_1 = require("@nestjs/common");
const api_key_guard_1 = require("../guards/api-key.guard");
const RequireApiKey = () => (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard);
exports.RequireApiKey = RequireApiKey;
//# sourceMappingURL=require-api-key.decorator.js.map