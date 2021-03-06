'use strict';

import io from 'socket.io-client';
import sha1 from 'sha1';

class Dataprovider {
    constructor(source) {
        this._source = source;
        this._listeners = {
            open: [],
            close: [],
            error: [],
            message: [],
            messageTypes: {},
        };
    }

    init() {
        const socket = this.socket = io.connect(this._source, {reconnect: true});

        socket.on('connect', data => this._onConnect(data));
        socket.on('message', data => this._onMessage(data));
        socket.on('error', data => this._onError(data));
        socket.on('close', data => this._onClose(data));
    }

    send(data) {
        // TODO: add spinner
        this.socket.send(JSON.stringify(data));
    }

    /**
     * Subscribing to <event>:<type>
     *
     * @param  {String|Object} e – event or object of events
     * @param  {Function}      listener
     * @param  {Object}        ctx – context
     */
    on(e, listener, ctx) {
        if (typeof e === 'object') {
            const _ctx = listener;
            for(let event in e) {
                this.on(event, e[event], _ctx);
            }

            return;
        }

        const [event, type] = e.split(':');

        switch(event) {
            case 'message':
                this._addMessageListener(type, listener, ctx);
            break;

            default:
                this._listeners[event].push(
                    this._buildListenerData(listener, ctx)
                );
        }
    }

    /**
     * Unsubscribing from <event>:<type>
     *
     * @param  {String|Object}   e – event or object of events
     * @param  {Function} listener
     */
    un(e, listener, ctx) {
        if (typeof e === 'object') {
            for(let event in e) {
                this.un(event, e[event]);
            }

            return;
        }

        const [event, type] = e.split(':');

        switch(event) {
            case 'message':
                this._removeMessageListener(type, listener, ctx);
            break;

            case 'open':
            case 'error':
                _.remove(
                    this._listeners[event],
                    {id: this._buildListenerID(listener, ctx)}
                );
        }
    }

    _buildListenerID(listener, ctx) {
        return sha1(listener.toString()); // TODO: use `context` too to generate sha1
    }

    _buildListenerData(listener, ctx) {
        return {
            id: this._buildListenerID(listener, ctx),
            listener: listener,
            ctx: ctx
        };
    }

    _addMessageListener(type, listener, ctx) {
        const listenerData = this._buildListenerData(listener, ctx);

        if (!type) {
            this._listeners.message.push(listenerData);
            return;
        }

        const typeListeners = this._listeners.messageTypes;

        if (!typeListeners[type]) {
            typeListeners[type] = [];
        }

        typeListeners[type].push(listenerData);
    }

    _removeMessageListener(type, listener, ctx) {
        const eventID = this._buildListenerID(listener, ctx);

        if (!type) {
            _.remove(this._listeners.message, {id: eventID});

            return;
        }

        _.remove(this._listeners.messageTypes[type], {id: eventID});
    }

    _onConnect(data) {
        this._listeners.open.forEach(item => item.listener.call(item.ctx, data));
    }

    _onError(data) {
        this._listeners.error.forEach(item => item.listener.call(item.ctx, data));
    }

    _onClose(data) {
        this._listeners.close.forEach(item => item.listener.call(item.ctx, data));
    }

    _onMessage(data) {
        const messageTypes = this._listeners.messageTypes;
        const typeListeners = messageTypes[data.$type];

        this._listeners.message.forEach(item => item.listener.call(item.ctx, data));

        if (typeListeners) {
            typeListeners.forEach(item => item.listener.call(item.ctx, data));
        }
    }
}

export default new Dataprovider('http://localhost:3000');
