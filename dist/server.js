"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';
app_1.app.listen(port, host, () => {
    console.log(`Servidor rodando em http://${host}:${port}`);
});
