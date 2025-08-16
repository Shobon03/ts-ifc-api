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
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
let app = null;
async function main() {
    app = await (0, app_1.initApp)();
    try {
        const host = process.env.HOST || 'localhost';
        const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
        await app.listen({
            port,
            host,
        });
        app.log.info(`Server is running at http://localhost:3000`);
    }
    catch (err) {
        console.error(err);
        handleGracefulShutdown(1);
    }
}
async function handleGracefulShutdown(exitCode) {
    if (app) {
        app.log.info('Shutting down server gracefully...');
        try {
            await app.close();
            app.log.info('Server shut down successfully.');
        }
        catch (err) {
            console.error('Error during server shutdown:', err);
        }
    }
    app = null;
    console.log('Server reference cleared.');
    process.exit(Number(exitCode ?? 0));
}
process.on('SIGINT', handleGracefulShutdown);
process.on('SIGTERM', handleGracefulShutdown);
main();
