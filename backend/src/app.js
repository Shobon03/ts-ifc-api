"use strict";
/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initApp = initApp;
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const fastify_1 = __importDefault(require("fastify"));
const fastify_type_provider_zod_1 = require("fastify-type-provider-zod");
/**
 * Initializes and configures the Fastify application.
 * @returns {Promise<FastifyInstance>} The configured Fastify application instance.
 */
async function initApp() {
    // Fastify app linitialization
    const app = (0, fastify_1.default)({
        logger: true,
    });
    // Register Zod validation plugin
    app.setValidatorCompiler(fastify_type_provider_zod_1.validatorCompiler);
    app.setSerializerCompiler(fastify_type_provider_zod_1.serializerCompiler);
    // Register plugins
    await app.register(rate_limit_1.default, {
        max: 100,
        timeWindow: '1 minute',
    });
    await app.register(cors_1.default, {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    });
    // Multipart files, will upload .rvt or .arc files, so it needs to be able to handle large files
    // Max file size is set to 100 MB
    await app.register(multipart_1.default, {
        limits: {
            fileSize: 100 * 1024 * 1024, // 100 MB
        },
    });
    return app;
}
