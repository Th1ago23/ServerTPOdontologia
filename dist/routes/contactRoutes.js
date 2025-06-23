"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ContactController_1 = require("../controllers/ContactController");
const router = (0, express_1.Router)();
router.post('/send', ContactController_1.sendContact);
exports.default = router;
