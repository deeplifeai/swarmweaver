"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventType = void 0;
var events_1 = require("events");

/**
 * Event types used in the application
 */
var EventType;
(function (EventType) {
    EventType["AGENT_MESSAGE"] = "agent_message";
    EventType["SLACK_MESSAGE"] = "slack_message";
    EventType["ERROR"] = "error";
})(EventType = exports.EventType || (exports.EventType = {}));

/**
 * EventBus for communication between services
 * Uses Node.js EventEmitter for pub/sub pattern
 */
var EventBus = /** @class */ (function () {
    function EventBus() {
        this.emitter = new events_1.EventEmitter();
        // Increase max listeners to avoid warning
        this.emitter.setMaxListeners(20);
    }
    /**
     * Subscribe to an event
     * @param event Event type to subscribe to
     * @param listener Callback function to execute when event is emitted
     */
    EventBus.prototype.on = function (event, listener) {
        var _this = this;
        this.emitter.on(event, listener);
        return function () { return _this.emitter.off(event, listener); }; // Return unsubscribe function
    };
    /**
     * Emit an event
     * @param event Event type to emit
     * @param args Arguments to pass to listeners
     */
    EventBus.prototype.emit = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        this.emitter.emit.apply(this.emitter, __spreadArray([event], args, false));
    };
    /**
     * Subscribe to an event once
     * @param event Event type to subscribe to
     * @param listener Callback function to execute when event is emitted
     */
    EventBus.prototype.once = function (event, listener) {
        this.emitter.once(event, listener);
    };
    /**
     * Unsubscribe from an event
     * @param event Event type to unsubscribe from
     * @param listener Callback function to remove
     */
    EventBus.prototype.off = function (event, listener) {
        this.emitter.off(event, listener);
    };
    /**
     * Helper method to emit an agent message event
     * @param message The agent message to emit
     */
    EventBus.prototype.emitAgentMessage = function (message) {
        console.log('EventBus: Emitting agent message event');
        this.emit(EventType.AGENT_MESSAGE, message);
    };
    return EventBus;
}());

// Export a singleton instance
exports.eventBus = new EventBus(); 