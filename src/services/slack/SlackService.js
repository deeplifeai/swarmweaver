"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackService = void 0;
var bolt_1 = require("@slack/bolt");
var config_1 = require("@/config/config");
var EventBus_1 = require("@/utils/EventBus");
var SlackService = /** @class */ (function () {
    function SlackService() {
        this.mentionRegex = /<@([A-Z0-9]+)>/g;
        this.processedMessageIds = new Set(); // Track processed message IDs
        this.botUserId = null; // Store the bot's user ID
        this.app = new bolt_1.App({
            token: config_1.config.slack.botToken,
            signingSecret: config_1.config.slack.signingSecret,
            socketMode: true,
            appToken: config_1.config.slack.appToken,
            logLevel: bolt_1.LogLevel.DEBUG
        });
        this.client = this.app.client;
        // Initialize event listeners
        this.initEventListeners();
        // Fetch bot user ID on initialization
        this.fetchBotUserId();
    }
    SlackService.prototype.initEventListeners = function () {
        var _this = this;
        // Listen for message events
        this.app.message(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var messageText, botId, containsBotMention, mentionResult, agentMessage;
            var message = _b.message, say = _b.say;
            return __generator(this, function (_c) {
                // Only process regular messages with text (not ephemeral, app messages, etc)
                if (message.subtype === undefined && 'text' in message && 'user' in message) {
                    messageText = message.text || '';
                    
                    // Get bot user ID from the config 
                    botId = this.botUserId;
                    
                    // Check if the message contains a mention of the bot
                    // If it does, skip processing as it will be handled by the app_mention event
                    containsBotMention = botId && messageText.includes(`<@${botId}>`);
                    if (containsBotMention) {
                        console.log(`Skipping message with bot mention, will be handled by app_mention event: ${message.ts}`);
                        return [2 /*return*/];
                    }
                    
                    mentionResult = this.processMentions(messageText);
                    if (mentionResult.targetAgents.length > 0) {
                        console.log(`Processing message from user: ${message.user} with text: "${messageText}"`);
                        agentMessage = {
                            id: message.ts,
                            timestamp: new Date().toISOString(),
                            agentId: message.user,
                            content: this.cleanMessage(messageText),
                            channel: message.channel,
                            mentions: mentionResult.targetAgents,
                            // Only include thread_ts if it exists in the message
                            replyToMessageId: 'thread_ts' in message ? message.thread_ts : undefined
                        };
                        // Emit message event for agent orchestration using EventBus
                        this.emitMessageEvent(agentMessage);
                    }
                }
                return [2 /*return*/];
            });
        }); });
        // Handle app_mention events (direct mentions of the bot)
        this.app.event('app_mention', function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var mentionResult, agentMessage;
            var event = _b.event, say = _b.say;
            return __generator(this, function (_c) {
                console.log(`Received app_mention from user: ${event.user} with text: "${event.text || ''}"`);
                mentionResult = this.processMentions(event.text || '');
                if (mentionResult.targetAgents.length > 0) {
                    agentMessage = {
                        id: event.ts,
                        timestamp: new Date().toISOString(),
                        agentId: event.user,
                        content: this.cleanMessage(event.text || ''),
                        channel: event.channel,
                        mentions: mentionResult.targetAgents,
                        // Only include thread_ts if it exists in the event
                        replyToMessageId: 'thread_ts' in event ? event.thread_ts : undefined
                    };
                    this.emitMessageEvent(agentMessage);
                } else {
                    console.log(`No valid target agents found in mention text: "${event.text || ''}"`);
                }
                return [2 /*return*/];
            });
        }); });
        // Error handler
        this.app.error(function (error) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.error('Slack app error:', error);
                EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, { source: 'SlackService', error: error });
                return [2 /*return*/];
            });
        }); });
    };
    SlackService.prototype.start = function () {
        this.app.start(config_1.config.port)
            .then(function () {
            console.log("\u26A1\uFE0F Slack Bolt app is running on port ".concat(config_1.config.port));
        })
            .catch(function (error) {
            console.error('Error starting Slack app:', error);
            EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, { source: 'SlackService', error: error, message: 'Failed to start Slack app' });
        });
    };
    SlackService.prototype.sendMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.chat.postMessage({
                                channel: message.channel,
                                text: message.text,
                                thread_ts: message.thread_ts,
                                blocks: message.blocks,
                                attachments: message.attachments
                            })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error sending Slack message:', error_1);
                        EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, { source: 'SlackService', error: error_1, message: 'Failed to send message' });
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SlackService.prototype.getChannels = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.conversations.list()];
                    case 1:
                        response = _a.sent();
                        if (response.channels) {
                            return [2 /*return*/, response.channels
                                    .filter(function (channel) { return channel.id && channel.name; })
                                    .map(function (channel) { return ({
                                    id: channel.id,
                                    name: channel.name
                                }); })];
                        }
                        return [2 /*return*/, []];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error getting channels:', error_2);
                        EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, { source: 'SlackService', error: error_2, message: 'Failed to get channels' });
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process mentions in a message and determine target agents
     * Rules:
     * 1. If mentions are comma-separated (e.g. "<@U1234>, <@U5678>"), message goes to both agents
     * 2. Otherwise, only the first mentioned agent receives the message
     */
    SlackService.prototype.processMentions = function (text) {
        var allMentions = [];
        var targetAgents = [];
        // Reset regex
        this.mentionRegex.lastIndex = 0;
        // Extract all mentions
        var match;
        while ((match = this.mentionRegex.exec(text)) !== null) {
            allMentions.push(match[1]);
        }
        if (allMentions.length === 0) {
            return { targetAgents: [], allMentions: [] };
        }
        // Check if this is a comma-separated list of mentions
        // Look for pattern like "<@U1234>, <@U5678>" near the start of the message
        var commaPattern = new RegExp("^(.*?<@[A-Z0-9]+>\\s*,\\s*<@[A-Z0-9]+>).*$");
        var commaPatternMatch = text.match(commaPattern);
        if (commaPatternMatch) {
            // This is a comma-separated list, get all mentions in the comma-separated part
            var commaSeparatedPart = commaPatternMatch[1];
            // Find all mentions in the comma-separated part
            var commaRegex = /<@([A-Z0-9]+)>/g;
            var commaMatch = void 0;
            while ((commaMatch = commaRegex.exec(commaSeparatedPart)) !== null) {
                targetAgents.push(commaMatch[1]);
            }
            console.log('Message with comma-separated mentions targeting:', targetAgents);
        }
        else {
            // Not comma-separated, just use the first mention
            targetAgents.push(allMentions[0]);
            console.log('Message with mentions targeting only first agent:', targetAgents[0]);
        }
        return { targetAgents: targetAgents, allMentions: allMentions };
    };
    /**
     * Extract all mentions from a message text
     */
    SlackService.prototype.extractMentions = function (text) {
        var mentions = [];
        // Reset regex
        this.mentionRegex.lastIndex = 0;
        var match;
        while ((match = this.mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    };
    /**
     * Clean message text by replacing mention formats
     */
    SlackService.prototype.cleanMessage = function (text) {
        // Remove the mention format <@USERID> and replace with @user
        return text.replace(this.mentionRegex, '@user');
    };
    /**
     * Emit message event to the event bus
     */
    SlackService.prototype.emitMessageEvent = function (message) {
        // More robust check for duplicate messages - use message ID AND channel
        const messageKey = `${message.id}-${message.channel}`;
        
        // Check if we've already processed this message
        if (this.processedMessageIds.has(messageKey)) {
            console.log(`Skipping duplicate message processing for ID: ${message.id} in channel ${message.channel}`);
            return;
        }
        
        // Add this message ID to our processed set
        this.processedMessageIds.add(messageKey);
        
        // Implement a simple cleanup to prevent memory leaks
        // Keep the set size under control by removing older entries when it gets too large
        if (this.processedMessageIds.size > 1000) {
            const oldestEntries = Array.from(this.processedMessageIds).slice(0, 500);
            oldestEntries.forEach(id => this.processedMessageIds.delete(id));
        }
        
        // Add more detailed logging
        console.log('Agent message received:', JSON.stringify({
            id: message.id,
            timestamp: message.timestamp,
            agentId: message.agentId,
            content: message.content,
            channel: message.channel,
            mentions: message.mentions,
            replyToMessageId: message.replyToMessageId
        }, null, 2));
        
        // Emit event using EventBus
        EventBus_1.eventBus.emitAgentMessage(message);
    };
    SlackService.prototype.fetchBotUserId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var authResult, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.auth.test()];
                    case 1:
                        authResult = _a.sent();
                        this.botUserId = authResult.user_id;
                        console.log(`Bot User ID initialized: ${this.botUserId}`);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error fetching bot user ID:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return SlackService;
}());
exports.SlackService = SlackService;
