"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const bodyParser = require("body-parser");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const structured_logger_service_1 = require("./common/logger/structured-logger.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get((config_1.ConfigService));
    app.useLogger(app.get(structured_logger_service_1.StructuredLogger));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.use(bodyParser.json({ limit: '1mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
    const port = configService.get('app.port', { infer: true }) ?? 8081;
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map